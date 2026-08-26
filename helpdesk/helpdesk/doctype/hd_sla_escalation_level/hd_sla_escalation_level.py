import frappe
from frappe.model.document import Document

UNIT_SECONDS = {
    "Minutes": 60,
    "Hours": 60 * 60,
    "Days": 24 * 60 * 60,
}


class HDSLAEscalationLevel(Document):
    def get_assignees(self) -> list[str]:
        """Return the configured assignees as a clean list of user ids."""
        return parse_assignees(self.escalation_assignee)

    def get_offset_in_seconds(self) -> int:
        """Return the escalation point converted to seconds."""
        return (self.escalation_point or 0) * UNIT_SECONDS.get(self.unit or "Hours", 3600)


def parse_assignees(value) -> list[str]:
    """Split a stored ``escalation_assignee`` value into user ids.

    Accepts a comma/newline separated string or an already-parsed list, which is
    what the portal sends before the document is saved.
    """
    if not value:
        return []

    if isinstance(value, (list, tuple)):
        raw = value
    else:
        raw = str(value).replace("\n", ",").split(",")

    seen = []
    for item in raw:
        user = (item or "").strip()
        if user and user not in seen:
            seen.append(user)
    return seen
