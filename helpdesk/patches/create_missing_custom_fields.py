import frappe

from helpdesk.setup.install import get_custom_fields


def execute():
    """Create custom fields defined in get_custom_fields() only if they don't already exist."""
    for doctype, fields in get_custom_fields().items():
        for field in fields:
            fieldname = field.get("fieldname")
            if not frappe.db.exists("Custom Field", {"dt": doctype, "fieldname": fieldname}):
                frappe.get_doc(
                    {
                        "doctype": "Custom Field",
                        "dt": doctype,
                        **field,
                    }
                ).insert(ignore_permissions=True)
                frappe.db.commit()
