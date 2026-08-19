"""Collapse escalation to the two fixed levels: FAT and TAT.

``custom_escalation_type`` is gone -- each level now carries its own trigger --
and any level beyond 2 configured under the old model is dropped so existing
SLAs still validate.
"""

import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields

from helpdesk.escalation import (
    ESCALATION_CUSTOM_FIELDS,
    ESCALATION_LEVEL_NAMES,
    LEGACY_ESCALATION_FIELDS,
)


def execute():
    create_custom_fields(ESCALATION_CUSTOM_FIELDS, ignore_validate=True)
    drop_extra_levels()
    drop_legacy_fields()


def drop_extra_levels():
    """Remove escalation rows for levels that no longer exist."""
    if not frappe.db.table_exists("HD SLA Escalation Level"):
        return

    stale = frappe.get_all(
        "HD SLA Escalation Level",
        filters={"level": ["not in", list(ESCALATION_LEVEL_NAMES)]},
        pluck="name",
    )
    for name in stale:
        frappe.db.delete("HD SLA Escalation Level", {"name": name})

    if stale:
        frappe.db.commit()  # nosemgrep


def drop_legacy_fields():
    for doctype, fieldnames in LEGACY_ESCALATION_FIELDS.items():
        for fieldname in fieldnames:
            name = f"{doctype}-{fieldname}"
            if frappe.db.exists("Custom Field", name):
                frappe.delete_doc("Custom Field", name, ignore_permissions=True, force=True)

    frappe.db.commit()  # nosemgrep
