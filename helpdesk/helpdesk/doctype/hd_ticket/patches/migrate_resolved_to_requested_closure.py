import frappe


def execute():
    """The 'Resolved' status has been removed from HD Ticket; the resolution flow
    now uses 'Requested Closure' for the same intermediate state. Migrate any
    existing tickets (and the SLA status-config child tables that reference the
    old value) so nothing points at the now-invalid 'Resolved' option."""

    # Tickets currently sitting in the removed status.
    frappe.db.sql(
        """
        UPDATE `tabHD Ticket`
        SET status = 'Requested Closure'
        WHERE status = 'Resolved'
        """
    )

    # SLA "fulfilled on" / "pause on" status child rows that referenced 'Resolved'.
    for doctype in (
        "HD Service Level Agreement Fulfilled On Status",
        "HD Pause Service Level Agreement On Status",
    ):
        if frappe.db.exists("DocType", doctype):
            frappe.db.sql(
                """
                UPDATE `tab{0}`
                SET status = 'Requested Closure'
                WHERE status = 'Resolved'
                """.format(doctype)
            )
