"""SLA driven ticket escalation.

An SLA policy can enable escalation and configure two fixed levels, each with
its own SLA target as the trigger:

  * Level 1, **FAT Escalation** -- measured from the first response due time.
  * Level 2, **TAT Escalation** -- measured from the resolution (turnaround)
    due time.

A level names the agents to assign to and an ``Escalation Point``, the delay
after that target is missed -- ``0`` escalates on the first run after the miss.
A scheduled job walks open tickets and fires the next due level. The two clocks are independent: if the ticket was answered in
time, level 1 can never fire, but level 2 still can.
"""

import json
from contextlib import contextmanager
from datetime import datetime, time, timedelta

import frappe
from frappe.desk.form.assign_to import _remove as remove_assignment
from frappe.desk.form.assign_to import add as assign
from frappe.utils import (
    add_to_date,
    get_datetime,
    get_weekdays,
    getdate,
    now_datetime,
    today,
)

from helpdesk.helpdesk.doctype.hd_sla_escalation_level.hd_sla_escalation_level import (
    UNIT_SECONDS,
    parse_assignees,
)
from helpdesk.helpdesk.doctype.hd_ticket_activity.hd_ticket_activity import (
    log_ticket_activity,
)
from helpdesk.utils import publish_event

# The two levels are fixed: a name and the SLA target their clock runs from.
ESCALATION_LEVELS = (
    {"level": 1, "name": "FAT Escalation", "trigger": "first_response"},
    {"level": 2, "name": "TAT Escalation", "trigger": "resolution"},
)

ESCALATION_LEVEL_NAMES = {row["level"]: row["name"] for row in ESCALATION_LEVELS}


def get_level_definition(level_no):
    """Return the fixed definition for an escalation level number."""
    for row in ESCALATION_LEVELS:
        if row["level"] == level_no:
            return row
    return None

# Custom fields backing the escalation config. Created on install and kept in
# sync by ``helpdesk.patches.rebuild_escalation_fields``.
ESCALATION_CUSTOM_FIELDS = {
    "HD Service Level Agreement": [
        {
            "fieldname": "custom_escalation_section",
            "fieldtype": "Section Break",
            "label": "Escalation",
            "description": "Escalate a ticket through configured levels when a target is missed",
            "insert_after": "custom_use_assignee_holiday_list",
        },
        {
            "fieldname": "custom_enable_escalation",
            "fieldtype": "Check",
            "label": "Enable Escalation",
            "default": "0",
            "insert_after": "custom_escalation_section",
        },
        {
            "fieldname": "custom_escalation_levels",
            "fieldtype": "Table",
            "label": "Escalation Levels",
            "options": "HD SLA Escalation Level",
            "depends_on": "eval: doc.custom_enable_escalation",
            "insert_after": "custom_enable_escalation",
        },
    ],
    "HD Ticket": [
        {
            "fieldname": "custom_escalation_tracking_section",
            "fieldtype": "Section Break",
            "label": "Escalation Tracking",
            "collapsible": 1,
            "insert_after": "resolution_date",
        },
        {
            "fieldname": "escalation_level",
            "fieldtype": "Int",
            "label": "Escalation Level",
            "default": "0",
            "read_only": 1,
            "insert_after": "custom_escalation_tracking_section",
        },
        {
            "fieldname": "custom_escalation_log",
            "fieldtype": "Table",
            "label": "Escalation Log",
            "options": "HD Ticket Escalation Log",
            "read_only": 1,
            "insert_after": "escalation_level",
        },
    ],
}

# Fields from the old two-level escalation, dropped by the rebuild patch.
LEGACY_ESCALATION_FIELDS = {
    "HD Service Level Agreement": [
        "custom_escalation_type",
        "custom_second_level_escalation_section",
        "custom_second_level_escalation_enabled",
        "custom_second_level_escalation_target",
        "custom_second_level_escalation_user",
        "custom_second_level_escalation_team",
        "custom_second_level_escalation_delay_hours",
    ],
    "HD Ticket": [
        "first_escalation_on",
        "first_escalated_to",
        "custom_escalation_col_break",
        "second_escalation_on",
        "second_escalated_to",
        "custom_second_level_escalation_delay_hours",
    ],
}

TICKET_FIELDS = [
    "name",
    "status",
    "sla",
    # Needed by SLAs that resolve holidays from the assignee's Employee record.
    "_assign",
    "escalation_level",
    "service_level_agreement_creation",
    "creation",
    "response_by",
    "resolution_by",
    "first_responded_on",
    "resolution_date",
]


def get_trigger_time(ticket, level_no: int):
    """Return the datetime this level's escalation clock starts from.

    ``None`` means the level can never fire on this ticket, either because its
    milestone was already met or because the SLA has not set that target yet.
    """
    definition = get_level_definition(level_no)
    if not definition:
        return None

    if definition["trigger"] == "first_response":
        # The agent replied in time, so there is no FAT breach to escalate.
        if ticket.get("first_responded_on"):
            return None
        return get_datetime(ticket.response_by) if ticket.get("response_by") else None

    if definition["trigger"] == "resolution":
        # Ticket was resolved, so the turnaround target no longer applies.
        if ticket.get("resolution_date"):
            return None
        return get_datetime(ticket.resolution_by) if ticket.get("resolution_by") else None

    return None


# Never walk the calendar forever: an SLA with a broken schedule would other-
# wise spin here. Past this many days we fall back to plain wall clock.
MAX_DAY_SCAN = 400


@contextmanager
def sla_ticket_context(ticket):
    """Expose the ticket to pw_helpdesk's SLA overrides while a block runs.

    An SLA with ``custom_use_assignee_holiday_list`` resolves holidays from the
    assignee's Employee record, and the override reads that ticket off this
    flag. Without it the escalation clock would silently fall back to the SLA's
    generic holiday list.
    """
    previous = getattr(frappe.flags, "pw_sla_ticket", None)
    frappe.flags.pw_sla_ticket = ticket
    try:
        yield
    finally:
        frappe.flags.pw_sla_ticket = previous


def resolve_schedule(sla, schedule=None):
    """Return ``(workdays, holidays)`` for the SLA, resolved once per ticket.

    Holiday resolution can hit the database per call, so callers working on one
    ticket resolve it once and pass it down.
    """
    if schedule is not None:
        return schedule
    return sla.get_workdays(), set(sla.get_holidays())


def get_workday_window(sla, day, holidays, workdays):
    """Return the ``(start, end)`` datetimes the SLA works on ``day``.

    ``None`` means the SLA does not work that day at all -- a holiday, a weekday
    missing from Support and Resolution, or a row whose window is empty.
    """
    if day in holidays:
        return None

    workday = workdays.get(get_weekdays()[day.weekday()])
    if not workday:
        return None

    midnight = datetime.combine(day, time.min)
    start = midnight + (workday.start_time or timedelta())
    end = midnight + (workday.end_time or timedelta())
    if end <= start:
        return None
    return start, end


def add_business_seconds(sla, start_at, seconds: float, schedule=None):
    """Return ``start_at`` advanced by ``seconds`` of the SLA's working time.

    Falls back to wall clock when the SLA has no working hours configured, so a
    half set up SLA still escalates instead of silently never firing.
    """
    result = get_datetime(start_at)
    seconds = max(float(seconds or 0), 0)
    if not seconds:
        return result

    workdays, holidays = resolve_schedule(sla, schedule)
    if not workdays:
        return add_to_date(result, seconds=seconds, as_datetime=True)

    remaining = seconds
    cursor = result

    for _ in range(MAX_DAY_SCAN):
        window = get_workday_window(sla, getdate(cursor), holidays, workdays)
        if window and cursor < window[1]:
            point = max(cursor, window[0])
            taken = min(remaining, (window[1] - point).total_seconds())
            remaining -= taken
            cursor = point + timedelta(seconds=taken)
            if remaining <= 0:
                return cursor
        # Nothing left to use today, restart at the top of the next one.
        cursor = datetime.combine(getdate(cursor) + timedelta(days=1), time.min)

    # Ran off the end of the scan window; spend what is left as wall clock.
    return add_to_date(cursor, seconds=remaining, as_datetime=True)


def business_seconds_between(sla, start_at, end_at, schedule=None) -> float:
    """Return the SLA working seconds in ``[start_at, end_at)``. Never negative."""
    start = get_datetime(start_at)
    end = get_datetime(end_at)
    if end <= start:
        return 0.0

    workdays, holidays = resolve_schedule(sla, schedule)
    if not workdays:
        return (end - start).total_seconds()

    total = 0.0
    day = getdate(start)
    last_day = getdate(end)

    for _ in range(MAX_DAY_SCAN):
        if day > last_day:
            break
        window = get_workday_window(sla, day, holidays, workdays)
        if window:
            overlap_start = max(window[0], start)
            overlap_end = min(window[1], end)
            if overlap_end > overlap_start:
                total += (overlap_end - overlap_start).total_seconds()
        day += timedelta(days=1)

    return total


def is_working_moment(sla, moment, schedule=None) -> bool:
    """Is ``moment`` inside the SLA's working hours?

    An SLA with no working hours configured is treated as always working, which
    matches how ``add_business_seconds`` falls back for it.
    """
    workdays, holidays = resolve_schedule(sla, schedule)
    if not workdays:
        return True

    moment = get_datetime(moment)
    window = get_workday_window(sla, getdate(moment), holidays, workdays)
    return bool(window and window[0] <= moment < window[1])


def get_working_boundaries(sla, moment, schedule=None):
    """Return ``(working_until, next_working_start)`` around ``moment``.

    Exactly one is set: inside working hours the clock runs until
    ``working_until``, outside them it is frozen until ``next_working_start``.
    Both are ``None`` for an SLA with no working hours, which never pauses.
    """
    workdays, holidays = resolve_schedule(sla, schedule)
    if not workdays:
        return None, None

    moment = get_datetime(moment)
    day = getdate(moment)

    for _ in range(MAX_DAY_SCAN):
        window = get_workday_window(sla, day, holidays, workdays)
        if window:
            start, end = window
            if moment < start:
                return None, start
            if moment < end:
                return end, None
        day += timedelta(days=1)

    return None, None


def get_level_offset_seconds(level) -> float:
    """Return a level's Escalation Point in seconds."""
    point = level.get("escalation_point") if isinstance(level, dict) else level.escalation_point
    unit = level.get("unit") if isinstance(level, dict) else level.unit
    return (point or 0) * UNIT_SECONDS.get(unit or "Hours", 3600)


def get_level_due_time(sla, trigger_time, level, schedule=None):
    """Return when ``level`` becomes due, given the trigger time.

    The Escalation Point is spent in working time, the same way the SLA targets
    it hangs off are calculated -- a 4 hour point set at 5pm Friday comes due
    Monday morning, not over the weekend.
    """
    return add_business_seconds(
        sla, trigger_time, get_level_offset_seconds(level), schedule=schedule
    )


def get_sorted_levels(sla) -> list:
    """Return the SLA's escalation levels, ordered, and only the usable ones."""
    levels = [
        level
        for level in (sla.get("custom_escalation_levels") or [])
        if parse_assignees(level.escalation_assignee)
    ]
    return sorted(levels, key=lambda level: (level.level or 0))


def get_open_statuses(sla) -> list[str]:
    """Return ticket statuses that keep the escalation clock running."""
    stopped = {row.status for row in sla.get("sla_fulfilled_on") or []}
    stopped |= {row.status for row in sla.get("pause_sla_on") or []}
    stopped.add("Archived")

    status_field = frappe.get_meta("HD Ticket").get_field("status")
    all_statuses = (status_field.options or "").split("\n") if status_field else []
    return [status for status in all_statuses if status and status not in stopped]


def get_current_assignees(ticket) -> list[str]:
    """Return whoever currently holds the ticket, per ``_assign``."""
    raw = ticket.get("_assign")
    if not raw:
        return []
    try:
        return [user for user in json.loads(raw) if user]
    except (ValueError, TypeError):
        return []


def get_manager_of_user(user: str) -> str | None:
    """Return the ``reports_to`` manager's user id for an employee's user."""
    employee = frappe.db.get_value(
        "Employee", {"user_id": user}, ["name", "reports_to"], as_dict=True
    )
    if not employee or not employee.reports_to:
        return None
    return frappe.db.get_value("Employee", employee.reports_to, "user_id")


def is_on_leave(user: str) -> bool:
    """Is this user on approved leave today?

    Half days count as available: the person is still working part of the day.
    Returns ``False`` when HR is not installed, so escalation keeps working on
    a helpdesk-only site.
    """
    if not frappe.db.exists("DocType", "Leave Application"):
        return False

    employee = frappe.db.get_value("Employee", {"user_id": user}, "name")
    if not employee:
        return False

    leaves = frappe.get_all(
        "Leave Application",
        filters={
            "employee": employee,
            "status": "Approved",
            "docstatus": 1,
            "from_date": ["<=", today()],
            "to_date": [">=", today()],
        },
        fields=["half_day", "half_day_date"],
    )

    for leave in leaves:
        # A half day is only half off on the date it is booked for; the rest of
        # a multi-day leave is still a full day away.
        if leave.half_day and str(leave.half_day_date or "") == today():
            continue
        return True

    return False


def is_available(user: str) -> bool:
    """Can this user actually be handed a ticket right now?"""
    if not frappe.db.get_value("User", user, "enabled"):
        return False
    return not is_on_leave(user)


def resolve_assignees(ticket, level) -> tuple[list[str], str]:
    """Return the users to escalate to, and how they were chosen.

    With ``assign_to_manager`` on, the ticket goes up to the manager of whoever
    is holding it. If no manager is reachable, or every one of them is on leave,
    it falls back to the level's Escalation Assignee.
    """
    fallback = [
        user for user in parse_assignees(level.escalation_assignee) if frappe.db.exists("User", user)
    ]

    if not level.get("assign_to_manager"):
        return fallback, "escalation assignee"

    managers = []
    for holder in get_current_assignees(ticket):
        manager = get_manager_of_user(holder)
        if manager and manager not in managers and is_available(manager):
            managers.append(manager)

    if managers:
        return managers, "manager of assignee"

    return fallback, "escalation assignee (manager unavailable)"


def unassign(ticket_name: str, user: str):
    """Cancel ``user``'s open assignment on the ticket.

    Never let a failed hand over abort the escalation: the level's agents are
    already assigned by the time this runs.
    """
    try:
        remove_assignment("HD Ticket", ticket_name, user, ignore_permissions=True)
    except Exception:
        frappe.log_error(
            frappe.get_traceback(),
            f"SLA Escalation could not unassign {user} from {ticket_name}",
        )


def escalate(ticket_name: str, sla, level) -> bool:
    """Assign ``level``'s agents to the ticket and record the escalation."""
    level_name = ESCALATION_LEVEL_NAMES.get(level.level, f"Level {level.level}")
    ticket = frappe.get_doc("HD Ticket", ticket_name)
    assignees, via = resolve_assignees(ticket, level)

    if not assignees:
        frappe.log_error(
            f"Escalation level {level.level} of SLA {sla.name} resolved to no valid"
            f" users (assignee: {level.escalation_assignee})",
            "SLA Escalation",
        )
        return False

    # An escalation is a hand over: whoever held the ticket keeps it only if
    # this level assigns it back to them.
    replaced = [user for user in get_current_assignees(ticket) if user not in assignees]

    assign(
        {
            "assign_to": assignees,
            "doctype": "HD Ticket",
            "name": ticket.name,
        }
    )
    for user in replaced:
        unassign(ticket.name, user)

    # ``assign_to`` writes ``_assign`` out of band, reload before saving so the
    # ticket does not overwrite it with the stale value.
    ticket.reload()

    ticket.escalation_level = level.level
    ticket.append(
        "custom_escalation_log",
        {
            "level": level.level,
            "escalation_type": level_name,
            "escalated_on": now_datetime(),
            "escalated_to": ", ".join(assignees),
        },
    )
    ticket.save(ignore_permissions=True)

    for user in assignees:
        try:
            ticket.notify_agent(user, "Assignment")
        except Exception:
            frappe.log_error(
                frappe.get_traceback(), f"SLA Escalation notification failed for {user}"
            )

    activity = (
        f"escalated to level {level.level} ({level_name}) via {via}:"
        f" {', '.join(assignees)}"
    )
    if replaced:
        activity += f", unassigned {', '.join(replaced)}"
    log_ticket_activity(ticket.name, activity)
    publish_event("helpdesk:ticket-assignee-update", {"name": ticket.name})
    return True


def run_sla_escalations():
    """Scheduled job: fire the next due escalation level on open tickets."""
    slas = frappe.get_all(
        "HD Service Level Agreement",
        filters={"enabled": 1, "custom_enable_escalation": 1},
        pluck="name",
    )

    for sla_name in slas:
        try:
            process_sla(sla_name)
        except Exception:
            frappe.db.rollback()
            frappe.log_error(frappe.get_traceback(), f"SLA Escalation failed for {sla_name}")


def iter_pending_levels(sla, ticket, levels, schedule=None):
    """Yield ``(level, due_on)`` for every level this ticket can still fire.

    Each level runs off a different SLA target, so a level that can never fire
    -- FAT once the ticket has been answered, say -- must not block the levels
    after it.
    """
    current_level = ticket.get("escalation_level") or 0

    for level in levels:
        if (level.level or 0) <= current_level:
            continue
        trigger_time = get_trigger_time(ticket, level.level)
        if not trigger_time:
            continue
        yield level, get_level_due_time(sla, trigger_time, level, schedule=schedule)


def get_next_level(sla, ticket, levels, schedule=None):
    """Return ``(level, due_on)`` for the next escalation, in level order.

    This is what the ticket shows as its upcoming escalation: level 1 until it
    has fired, then level 2. ``(None, None)`` means nothing is left to escalate.
    """
    for level, due_on in iter_pending_levels(sla, ticket, levels, schedule=schedule):
        return level, due_on
    return None, None


def get_due_level(sla, ticket, levels, now, schedule=None):
    """Return the lowest not-yet-fired level whose own target is overdue."""
    for level, due_on in iter_pending_levels(sla, ticket, levels, schedule=schedule):
        if now >= due_on:
            return level
    return None


def process_sla(sla_name: str):
    sla = frappe.get_doc("HD Service Level Agreement", sla_name)
    levels = get_sorted_levels(sla)
    if not levels:
        return

    max_level = levels[-1].level or 0
    tickets = frappe.get_all(
        "HD Ticket",
        filters={
            "sla": sla_name,
            "status": ["in", get_open_statuses(sla)],
        },
        # Tickets predating the escalation_level field have it unset, which
        # ``<`` would silently drop.
        or_filters=[
            ["escalation_level", "<", max_level],
            ["escalation_level", "is", "not set"],
        ],
        fields=TICKET_FIELDS,
    )

    now = now_datetime()
    for ticket in tickets:
        with sla_ticket_context(ticket):
            schedule = resolve_schedule(sla)
            due_level = get_due_level(sla, ticket, levels, now, schedule=schedule)
        if not due_level:
            continue

        try:
            if escalate(ticket.name, sla, due_level):
                frappe.db.commit()  # nosemgrep
        except Exception:
            frappe.db.rollback()
            frappe.log_error(
                frappe.get_traceback(),
                f"SLA Escalation failed for ticket {ticket.name}",
            )


# ---------------------------------------------------------------------------
# Escalation status, for the ticket UI
# ---------------------------------------------------------------------------

# What the ticket has left to escalate:
#   pending   -- a level is coming up, ``remaining_seconds`` counts down to it
#   breached  -- the escalation point has passed, or every level has fired
#   none      -- nothing to escalate: no escalation configured, or the ticket
#                met its targets and closed
STATUS_PENDING = "pending"
STATUS_BREACHED = "breached"
STATUS_NONE = "none"

STATUS_TICKET_FIELDS = TICKET_FIELDS + ["agreement_status"]

EMPTY_STATUS = {
    "status": STATUS_NONE,
    "enabled": False,
    "level": 0,
    "next_level": None,
    "next_level_name": None,
    "due_on": None,
    "remaining_seconds": None,
    "is_working_now": True,
    # Server clock at the time of the read. The UI runs its countdown against
    # this rather than the browser clock, so a machine whose time is off (or in
    # another timezone) still lands on zero exactly when escalation fires.
    "server_now": None,
    # Shift boundaries around `server_now`, for context in the UI.
    "working_until": None,
    "next_working_start": None,
    "last_escalated_on": None,
    "last_escalated_to": None,
}


def has_missed_sla(ticket) -> bool:
    """Did this ticket miss a target, whether or not a level escalated?"""
    if ticket.get("agreement_status") in ("Failed", "Overdue"):
        return True

    now = now_datetime()
    for target, met_on in (("response_by", "first_responded_on"), ("resolution_by", "resolution_date")):
        due = ticket.get(target)
        if not due:
            continue
        actual = ticket.get(met_on)
        if get_datetime(due) < (get_datetime(actual) if actual else now):
            return True
    return False


def get_last_escalations(ticket_names) -> dict:
    """Return ``{ticket: most recent escalation log row}`` in one query."""
    if not ticket_names:
        return {}

    rows = frappe.get_all(
        "HD Ticket Escalation Log",
        filters={"parent": ["in", ticket_names], "parenttype": "HD Ticket"},
        fields=["parent", "level", "escalation_type", "escalated_on", "escalated_to"],
        order_by="escalated_on asc",
        limit_page_length=0,
    )
    # Ascending, so the last row written for a ticket is the one that survives.
    return {row.parent: row for row in rows}


def get_last_escalation(ticket_name) -> dict:
    """Return the most recent row of the ticket's escalation log."""
    return get_last_escalations([ticket_name]).get(ticket_name, {})


def get_ticket_escalation_status(ticket, last_escalation=None) -> dict:
    """Return the upcoming escalation for a ticket, measured in working time.

    Drives the ticket's "Remaining Escalation Business Time": the countdown runs
    to level 1 (first response target + Escalation Point) until that level has
    fired, then to level 2 (resolution target + Escalation Point). Once there is
    nothing left to escalate the ticket reads as SLA breached.
    """
    # HD Ticket names are integers, so accept either a name or a fetched row.
    if isinstance(ticket, (str, int)):
        ticket = frappe.db.get_value(
            "HD Ticket", ticket, STATUS_TICKET_FIELDS, as_dict=True
        )
    if not ticket or not ticket.get("sla"):
        return dict(EMPTY_STATUS)

    # The helpers below read ticket fields as attributes.
    ticket = frappe._dict(ticket)

    sla = frappe.get_cached_doc("HD Service Level Agreement", ticket["sla"])
    # Resolve holidays and workdays once, with the ticket in context so an SLA
    # set to use the assignee's holiday list actually gets it.
    with sla_ticket_context(ticket):
        schedule = resolve_schedule(sla)
    current_level = ticket.get("escalation_level") or 0
    last = (
        last_escalation
        if last_escalation is not None
        else get_last_escalation(ticket["name"])
    )

    status = dict(
        EMPTY_STATUS,
        server_now=now_datetime(),
        enabled=bool(sla.get("custom_enable_escalation")),
        level=current_level,
        last_escalated_on=last.get("escalated_on"),
        last_escalated_to=last.get("escalated_to"),
    )

    # Nothing upcoming to count down to: the ticket reads as breached if it
    # actually missed a target or already escalated, otherwise there is simply
    # no escalation time to show.
    def settled():
        status["status"] = (
            STATUS_BREACHED if (current_level or has_missed_sla(ticket)) else STATUS_NONE
        )
        return status

    # No escalation configured on this SLA -- the SLA can still be breached.
    levels = get_sorted_levels(sla) if status["enabled"] else []
    if not levels:
        return settled()

    # A ticket that is resolved, closed or on hold is off the clock. Whatever it
    # escalated still stands, but nothing new is coming.
    if ticket.get("status") not in get_open_statuses(sla):
        return settled()

    # Every level that could fire has fired, or none ever could.
    level, due_on = get_next_level(sla, ticket, levels, schedule=schedule)
    if not level:
        return settled()

    now = now_datetime()
    status.update(
        next_level=level.level,
        next_level_name=ESCALATION_LEVEL_NAMES.get(level.level, f"Level {level.level}"),
        due_on=due_on,
    )

    if now >= due_on:
        # Past the escalation point; the next scheduler run picks it up.
        status["status"] = STATUS_BREACHED
        status["remaining_seconds"] = 0
        return status

    working_until, next_working_start = get_working_boundaries(sla, now, schedule=schedule)
    status.update(
        status=STATUS_PENDING,
        remaining_seconds=business_seconds_between(sla, now, due_on, schedule=schedule),
        is_working_now=is_working_moment(sla, now, schedule=schedule),
        working_until=working_until,
        next_working_start=next_working_start,
    )
    return status


def get_escalation_status_map(tickets) -> dict:
    """Return ``{ticket name: escalation status}`` for a page of tickets.

    Takes ticket names or already fetched rows. Rows missing any field the clock
    needs are topped up in a single query, so a list view costs a couple of
    queries rather than a couple per row.
    """
    if not tickets:
        return {}

    rows = {}
    pending = []

    for ticket in tickets:
        if isinstance(ticket, (str, int)):
            pending.append(ticket)
        elif ticket and ticket.get("name"):
            row = frappe._dict(ticket)
            if any(field not in row for field in STATUS_TICKET_FIELDS):
                pending.append(row.name)
            else:
                rows[row.name] = row

    if pending:
        for row in frappe.get_all(
            "HD Ticket",
            filters={"name": ["in", pending]},
            fields=STATUS_TICKET_FIELDS,
            limit_page_length=0,
        ):
            rows[row.name] = row

    last_escalations = get_last_escalations(list(rows))
    return {
        name: get_ticket_escalation_status(
            row, last_escalation=last_escalations.get(name) or {}
        )
        for name, row in rows.items()
    }
