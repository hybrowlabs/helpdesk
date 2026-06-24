import json

import frappe
from frappe.model.document import Document
from frappe.query_builder import JoinType
from frappe.utils import now_datetime
from pypika import Criterion

from helpdesk.utils import get_context

DOCTYPE = "HD Service Level Agreement"


def get_sla(ticket: Document) -> Document:
    """
    Get Service Level Agreement for `ticket`

    SLAs are checked from most specific to least specific: the more filter
    clauses an SLA has in its `condition_json`, the higher its weight, and the
    earlier it is evaluated. The first SLA whose condition holds for the ticket
    wins. This way a narrowly scoped SLA (e.g. category + sub-category) is
    matched before a broader one (e.g. category only). Falls back to the default
    SLA when nothing matches.

    :param doc: Ticket to use
    :return: Applicable SLA
    """
    QBSla = frappe.qb.DocType(DOCTYPE)
    QBPriority = frappe.qb.DocType("HD Service Level Priority")
    now = now_datetime()
    priority = ticket.priority
    q = (
        frappe.qb.from_(QBSla)
        .select(QBSla.name, QBSla.condition, QBSla.condition_json)
        .where(QBSla.enabled == True)
        .where(QBSla.default_sla == False)
        .where(Criterion.any([QBSla.start_date.isnull(), QBSla.start_date <= now]))
        .where(Criterion.any([QBSla.end_date.isnull(), QBSla.end_date >= now]))
        .orderby(QBSla.name)
    )
    if priority:
        q = (
            q.join(QBPriority, JoinType.inner)
            .on(QBPriority.parent == QBSla.name)
            .where(QBPriority.priority == priority)
        )
    sla_list = q.run(as_dict=True)

    # Weight each SLA by how many filter clauses it carries, then check the most
    # specific ones first. A text-only condition (no structured filters) still
    # outranks an SLA with no condition at all. The sort is stable, so SLAs of
    # equal weight keep the query's name ordering.
    for sla in sla_list:
        weight = _condition_weight(sla.get("condition_json"))
        if weight == 0 and sla.get("condition"):
            weight = 1
        sla["weight"] = weight
    sla_list.sort(key=lambda s: s["weight"], reverse=True)

    context = get_context(ticket)
    for sla in sla_list:
        cond = sla.get("condition")
        if not cond or frappe.safe_eval(cond, None, context):
            return sla

    return get_default()


def _condition_weight(condition_json) -> int:
    """
    Number of filter clauses in an SLA's `condition_json`.

    More filters => more specific SLA => checked earlier. Returns 0 for
    empty/invalid `condition_json` (an SLA that matches everything).
    """
    if not condition_json:
        return 0
    try:
        parsed = (
            json.loads(condition_json)
            if isinstance(condition_json, str)
            else condition_json
        )
    except (json.JSONDecodeError, TypeError):
        return 0
    return _count_clauses(parsed)


def _count_clauses(node) -> int:
    """
    Recursively count `[field, operator, value]` clauses in a parsed
    `condition_json`, ignoring the `"and"`/`"or"` join tokens and counting
    clauses inside nested groups.
    """
    if not isinstance(node, list):
        return 0
    if (
        len(node) >= 3
        and isinstance(node[0], str)
        and isinstance(node[1], str)
        and node[1] not in ("and", "or")
    ):
        return 1
    return sum(_count_clauses(item) for item in node)


def get_default() -> Document:
    """
    Get default Service Level Agreement

    :return: Default SLA
    """
    return frappe.get_last_doc(
        DOCTYPE,
        filters={
            "enabled": True,
            "default_sla": True,
        },
    )


def apply(ticket: Document):
    """
    Apply SLA to a ticket

    :param ticket: Ticket document to apply SLA to
    """
    sla = get_sla(ticket)
    if sla:
        sla_doc = frappe.get_doc(DOCTYPE, sla.name)
        sla_doc.apply(ticket)
