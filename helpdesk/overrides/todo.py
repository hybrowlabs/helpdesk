import frappe


def get_ticket_todo_description(ticket) -> str:
    """Task line shown for an HD Ticket assignment, e.g. "Ticket #4021 - Payslip Access"."""
    subject = frappe.db.get_value("HD Ticket", ticket, "subject")
    return f"Ticket #{ticket} - {subject}" if subject else f"Ticket #{ticket}"


def before_insert(doc, method=None):
    """
    Describe every HD Ticket assignment the same way, whichever code path
    created it (assign_to, assignment rules, SLA / hierarchy routing,
    escalation). Set before insert so the assignment notification and the
    todo route (computed on before_save from custom_todo_type) see the values.
    """
    if doc.reference_type != "HD Ticket" or not doc.reference_name:
        return

    doc.description = get_ticket_todo_description(doc.reference_name)

    if not doc.get("type"):
        doc.type = "Help Desk"

    if not doc.get("custom_todo_type"):
        doc.custom_todo_type = "Helpdesk"
