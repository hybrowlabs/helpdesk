# Copyright (c) 2024, Frappe Technologies and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import now_datetime


class HDResolutionHistory(Document):
    def before_insert(self):
        """Set submitted_on timestamp before inserting"""
        if not self.submitted_on:
            self.submitted_on = now_datetime()

        # Auto-set version number if not provided
        if not self.version_number:
            self.version_number = self.get_next_version_number()

    def before_save(self):
        """Set satisfaction timestamp when status changes"""
        if self.has_value_changed("satisfaction_status") and self.satisfaction_status != "Pending":
            if not self.satisfaction_on:
                self.satisfaction_on = now_datetime()
            if not self.satisfaction_by:
                self.satisfaction_by = frappe.session.user

    def after_insert(self):
        """Update ticket with current resolution version info"""
        if self.is_current_version:
            self.update_ticket_current_version()

    def after_save(self):
        """Handle satisfaction status changes"""
        if self.has_value_changed("satisfaction_status"):
            self.handle_satisfaction_change()

    def get_next_version_number(self):
        """Get the next version number for this ticket"""
        last_version = frappe.db.get_value(
            "HD Resolution History",
            {"ticket": self.ticket},
            "version_number",
            order_by="version_number desc"
        )
        return (last_version or 0) + 1

    def update_ticket_current_version(self):
        """Update ticket with current resolution version"""
        if self.is_current_version:
            # Mark all other versions as not current
            frappe.db.sql("""
                UPDATE `tabHD Resolution History`
                SET is_current_version = 0
                WHERE ticket = %s AND name != %s
            """, (self.ticket, self.name))

    def handle_satisfaction_change(self):
        """Handle changes in satisfaction status"""
        if self.satisfaction_status == "Not Satisfied":
            self.handle_resolution_rejection()
        elif self.satisfaction_status == "Satisfied":
            self.handle_resolution_acceptance()

    def handle_resolution_rejection(self):
        """Handle when resolution is rejected"""
        ticket_doc = frappe.get_doc("HD Ticket", self.ticket)

        # Reset ticket status to Awaiting User Response for new resolution
        ticket_doc.status = "Awaiting User Response"

        # Reset resolution submission flags to allow new resolution
        ticket_doc.resolution_submitted = 0
        ticket_doc.resolution_submitted_on = None

        # Mark this version as not current since it's rejected
        self.is_current_version = 0

        # Restart SLA if applicable
        self.restart_sla_timer(ticket_doc)

        ticket_doc.save(ignore_permissions=True)

        # Create activity log
        self.create_rejection_activity()

    def handle_resolution_acceptance(self):
        """Handle when resolution is accepted"""
        ticket_doc = frappe.get_doc("HD Ticket", self.ticket)

        # Keep current version active and ticket stays in Requested Closure status
        self.is_current_version = 1

        ticket_doc.save(ignore_permissions=True)

        # Create activity log
        self.create_acceptance_activity()

    def restart_sla_timer(self, ticket_doc):
        """Restart SLA resolution timer for rejected resolution"""
        if not ticket_doc.sla:
            return

        try:
            # Reset resolution timeline
            priority = frappe.get_doc("HD Ticket Priority", ticket_doc.priority)
            sla_doc = frappe.get_doc("HD Service Level Agreement", ticket_doc.sla)

            # Find the priority settings in SLA
            for sla_priority in sla_doc.priorities:
                if sla_priority.priority == ticket_doc.priority:
                    # Recalculate resolution by time
                    from helpdesk.helpdesk.doctype.hd_service_level_agreement.utils import apply
                    apply(ticket_doc)
                    break

        except Exception as e:
            frappe.log_error(f"Failed to restart SLA timer for ticket {ticket_doc.name}: {str(e)}")

    def create_rejection_activity(self):
        """Create activity log for resolution rejection"""
        from helpdesk.helpdesk.doctype.hd_ticket_activity.hd_ticket_activity import log_ticket_activity

        activity_message = f"Resolution version {self.version_number} rejected"
        if self.rejection_reason:
            activity_message += f": {self.rejection_reason}"

        log_ticket_activity(self.ticket, activity_message)

    def create_acceptance_activity(self):
        """Create activity log for resolution acceptance"""
        from helpdesk.helpdesk.doctype.hd_ticket_activity.hd_ticket_activity import log_ticket_activity

        log_ticket_activity(
            self.ticket,
            f"Resolution version {self.version_number} accepted as satisfactory"
        )