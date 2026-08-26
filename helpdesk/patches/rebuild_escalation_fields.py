"""Replace the old two-level escalation config with the multi-level one.

Existing ``first_*``/``second_*`` escalation timestamps on tickets are folded
into the new ``custom_escalation_log`` child table before the flat fields go
away, so no escalation history is lost.
"""

import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields

from helpdesk.escalation import ESCALATION_CUSTOM_FIELDS, LEGACY_ESCALATION_FIELDS


def execute():
    create_custom_fields(ESCALATION_CUSTOM_FIELDS, ignore_validate=True)
    normalize_escalation_level()
    migrate_ticket_history()
    drop_legacy_fields()


def normalize_escalation_level():
    """Tickets predating the field have it unset, which breaks range filters."""
    frappe.db.sql(
        "update `tabHD Ticket` set escalation_level = 0 where escalation_level is null"
    )
    frappe.db.commit()  # nosemgrep


def migrate_ticket_history():
    legacy_columns = [
        column
        for column in ("first_escalation_on", "first_escalated_to", "second_escalation_on", "second_escalated_to")
        if frappe.db.has_column("HD Ticket", column)
    ]
    if not legacy_columns:
        return

    tickets = frappe.get_all(
        "HD Ticket",
        filters={"escalation_level": [">", 0]},
        fields=["name"] + legacy_columns,
    )

    for ticket in tickets:
        rows = []
        if ticket.get("first_escalation_on"):
            rows.append((1, ticket.get("first_escalation_on"), ticket.get("first_escalated_to")))
        if ticket.get("second_escalation_on"):
            rows.append((2, ticket.get("second_escalation_on"), ticket.get("second_escalated_to")))
        if not rows:
            continue

        # A partially migrated site could be re-running this patch.
        if frappe.db.exists(
            "HD Ticket Escalation Log", {"parent": ticket.name, "parenttype": "HD Ticket"}
        ):
            continue

        doc = frappe.get_doc("HD Ticket", ticket.name)
        for level, escalated_on, escalated_to in rows:
            doc.append(
                "custom_escalation_log",
                {
                    "level": level,
                    "escalation_type": "Legacy",
                    "escalated_on": escalated_on,
                    "escalated_to": escalated_to,
                },
            )
        doc.flags.ignore_validate = True
        doc.flags.ignore_mandatory = True
        doc.save(ignore_permissions=True)

    frappe.db.commit()  # nosemgrep


def drop_legacy_fields():
    for doctype, fieldnames in LEGACY_ESCALATION_FIELDS.items():
        for fieldname in fieldnames:
            name = f"{doctype}-{fieldname}"
            if frappe.db.exists("Custom Field", name):
                frappe.delete_doc("Custom Field", name, ignore_permissions=True, force=True)

    frappe.db.commit()  # nosemgrep
