import frappe


def execute():
    """The 'Replied' status has been renamed to 'Awaiting User Response' on
    HD Ticket. Migrate existing tickets and the SLA status-config child tables
    that referenced the old value so nothing points at the removed option."""

    frappe.db.sql(
        """
        UPDATE `tabHD Ticket`
        SET status = 'Awaiting User Response'
        WHERE status = 'Replied'
        """
    )

    for doctype in (
        "HD Service Level Agreement Fulfilled On Status",
        "HD Pause Service Level Agreement On Status",
    ):
        if frappe.db.exists("DocType", doctype):
            frappe.db.sql(
                """
                UPDATE `tab{0}`
                SET status = 'Awaiting User Response'
                WHERE status = 'Replied'
                """.format(doctype)
            )
