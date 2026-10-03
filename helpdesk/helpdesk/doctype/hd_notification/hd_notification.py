import frappe
from frappe.model.document import Document


class HDNotification(Document):
    def format_message(self):
        user_from = self.get_from()
        if self.notification_type == "Mention":
            if self.reference_comment:
                return f"{user_from} mentioned you in a comment"
            return f"{user_from} mentioned you"
        return ""

    def get_from(self):
        return frappe.db.get_value(
            "User", {"name": self.user_from}, fieldname="full_name"
        )

    def get_button_label(self):
        if self.reference_comment:
            return "See Comment"
        return "Visit"

    def get_url(self):
        res = "/helpdesk"
        if self.reference_ticket:
            res += "/tickets/" + str(self.reference_ticket)
        if self.reference_comment:
            res += "#" + self.reference_comment
        return frappe.utils.get_url(res)

    def parse_html(self):
        from bs4 import BeautifulSoup

        soup = BeautifulSoup(self.message, "html.parser")
        if soup.find("img"):
            img = soup.find("img")
            img["src"] = ("").join([frappe.utils.get_url(), img["src"]])
            return str(soup)
        return str(soup)

    def get_args(self):
        if self.notification_type == "Mention":
            return {
                "title": self.format_message(),
                "button_label": self.get_button_label(),
                "callback_url": self.get_url(),
                "comment": self.parse_html(),
            }

    def after_insert(self):
        # The bell is a list the client fetched once, so an entry written
        # while an agent is working stayed invisible until they reloaded the
        # page. Told here rather than at each producer: assignment, mention
        # and the AOF mail flow all insert this doctype, and a nudge wired
        # into one of them leaves the others refresh-only.
        #
        # Addressed to the recipient alone — not helpdesk's publish_event,
        # which passes room="website" and so broadcasts to every client
        # (publish_realtime only derives the user room when no room is
        # given, frappe/realtime.py:58-66).
        #
        # after_commit, because the row has to be readable by the time the
        # client refetches; publishing inside the transaction races it.
        # Before the Mention branch below, which returns early.
        frappe.publish_realtime(
            "helpdesk:new-notification",
            message={"ticket": self.reference_ticket},
            user=self.user_to,
            after_commit=True,
        )

        if self.notification_type == "Mention":
            skip_email_workflow = frappe.db.get_single_value(
                "HD Settings", "skip_email_workflow"
            )

            if skip_email_workflow:
                return

            frappe.sendmail(
                recipients=self.user_to,
                subject="New notification",
                message=self.format_message(),
                template="notification",
                args=self.get_args(),
            )
