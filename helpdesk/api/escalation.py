import frappe

from helpdesk.escalation import get_ticket_escalation_status
from helpdesk.utils import agent_only, check_permissions


@frappe.whitelist()
@agent_only
def get_status(ticket: str) -> dict:
    """Return the ticket's upcoming escalation and remaining business time."""
    check_permissions("HD Ticket", None, doc=ticket)
    return get_ticket_escalation_status(ticket)
