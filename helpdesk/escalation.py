"""SLA driven ticket escalation.

An SLA policy can enable escalation and configure two fixed levels, each with
its own SLA target as the trigger:

  * Level 1, **FAT Escalation** -- measured from the first response due time.
  * Level 2, **TAT Escalation** -- measured from the resolution (turnaround)
    due time.

A level names the agents to assign to and an ``Escalation Point``, the delay
after that target is missed. A scheduled job walks open tickets and fires the
next due level. The two clocks are independent: if the ticket was answered in
time, level 1 can never fire, but level 2 still can.
"""

import json

import frappe
from frappe.desk.form.assign_to import add as assign
from frappe.utils import add_to_date, get_datetime, now_datetime, today

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


def get_level_due_time(trigger_time, level):
    """Return when ``level`` becomes due, given the trigger time."""
    seconds = (level.escalation_point or 0) * UNIT_SECONDS.get(level.unit or "Hours", 3600)
    return add_to_date(trigger_time, seconds=seconds, as_datetime=True)


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

    assign(
        {
            "assign_to": assignees,
            "doctype": "HD Ticket",
            "name": ticket.name,
        }
    )
    # ``assign_to.add`` writes ``_assign`` out of band, reload before saving so
    # the ticket does not overwrite it with the stale value.
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

    log_ticket_activity(
        ticket.name,
        f"escalated to level {level.level} ({level_name}) via {via}:"
        f" {', '.join(assignees)}",
    )
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


def get_due_level(ticket, levels, now):
    """Return the lowest not-yet-fired level whose own target is overdue.

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
        if now >= get_level_due_time(trigger_time, level):
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
        due_level = get_due_level(ticket, levels, now)
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
