from frappe.custom.doctype.custom_field.custom_field import create_custom_fields

from helpdesk.setup.install import get_custom_fields


def execute():
    """Create any custom fields defined in get_custom_fields() that are missing on the site."""
    create_custom_fields(get_custom_fields(), ignore_validate=True)
