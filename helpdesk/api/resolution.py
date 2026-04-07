from typing import Any, Dict, List

import frappe
from frappe import _


RESOLUTION_HISTORY_NAMING_SERIES = "RES-HIST-.YYYY.-"


def _normalize_ticket_id(ticket_id: str | int) -> str:
    if ticket_id is None or ticket_id == "":
        frappe.throw(_("Ticket ID is required"), frappe.ValidationError)

    return str(ticket_id)


def _get_ticket(ticket_id: str | int):
    ticket_id = _normalize_ticket_id(ticket_id)

    if not ticket_id:
        frappe.throw(_("Ticket ID is required"), frappe.ValidationError)

    if not frappe.db.exists("HD Ticket", ticket_id):
        frappe.throw(_("Ticket not found"), frappe.DoesNotExistError)

    return frappe.get_doc("HD Ticket", ticket_id)


def _assert_ticket_read_permission(ticket_doc) -> None:
    if not frappe.has_permission(doc=ticket_doc, ptype="read"):
        frappe.throw(
            _("You don't have permission to view this ticket"),
            frappe.PermissionError,
        )


def _update_ticket_resolution_fields(ticket_id: str, values: Dict[str, Any]) -> None:
    frappe.db.set_value("HD Ticket", ticket_id, values, update_modified=True)


@frappe.whitelist()
def get_resolution_history(ticket_id: str | int) -> List[Dict[str, Any]]:
    """
    Get resolution history for a ticket
    """
    ticket_id = _normalize_ticket_id(ticket_id)
    ticket_doc = _get_ticket(ticket_id)
    _assert_ticket_read_permission(ticket_doc)

    if not frappe.db.exists("DocType", "HD Resolution History"):
        return []

    # Get resolution history
    history = frappe.get_all(
        "HD Resolution History",
        filters={"ticket": ticket_id},
        fields=[
            "name",
            "version_number",
            "resolution_content",
            "submitted_by",
            "submitted_on",
            "satisfaction_status",
            "satisfaction_by",
            "satisfaction_on",
            "rejection_reason",
            "is_current_version"
        ],
        order_by="version_number desc"
    )

    # Add user full names for better display
    for item in history:
        if item.submitted_by:
            item.submitted_by_name = frappe.get_value("User", item.submitted_by, "full_name") or item.submitted_by
        if item.satisfaction_by:
            item.satisfaction_by_name = frappe.get_value("User", item.satisfaction_by, "full_name") or item.satisfaction_by

    return history


@frappe.whitelist()
def save_resolution_with_history(
    ticket_id: str | int, resolution_content: str
) -> Dict[str, Any]:
    """
    Save resolution with history tracking. This is the single entry point for all
    resolution updates to ensure history is never lost.

    1. If ticket already has resolution_details that differ from new content,
       archives the OLD resolution to HD Resolution History
    2. Updates resolution_details with new content
    3. Creates a NEW HD Resolution History entry marked as current
    4. Updates current_resolution_version on the ticket
    """
    ticket_id = _normalize_ticket_id(ticket_id)
    ticket_doc = _get_ticket(ticket_id)
    _assert_ticket_read_permission(ticket_doc)

    if not resolution_content or not resolution_content.strip():
        frappe.throw(_("Resolution content cannot be empty"), frappe.ValidationError)

    if not frappe.db.exists("DocType", "HD Resolution History"):
        frappe.throw(_("HD Resolution History DocType is not available"))

    resolution_content = resolution_content.strip()

    old_resolution = ticket_doc.resolution_details
    old_resolution_exists = (
        old_resolution and old_resolution.strip() and old_resolution.strip() != "<p></p>"
    )

    # Get the current max version number for this ticket
    max_version = frappe.db.get_value(
        "HD Resolution History",
        {"ticket": ticket_id},
        "MAX(version_number)"
    ) or 0

    # Dedup: if content is identical to existing resolution and current version is still pending, skip
    if old_resolution_exists and old_resolution.strip() == resolution_content:
        existing_current = frappe.db.get_value(
            "HD Resolution History",
            {"ticket": ticket_id, "is_current_version": 1},
            ["name", "version_number", "satisfaction_status"],
            as_dict=True
        )
        if existing_current and existing_current.satisfaction_status == "Pending":
            # Identical content with pending review — no new version needed
            submitted_time = frappe.utils.now_datetime()
            update_values = {
                "resolution_submitted": 1,
                "resolution_submitted_on": submitted_time,
                "resolution_ever_submitted": 1,
            }
            if hasattr(ticket_doc, "current_resolution_version"):
                update_values["current_resolution_version"] = (
                    existing_current.version_number
                )
            _update_ticket_resolution_fields(ticket_id, update_values)
            return {
                "success": True,
                "message": "Resolution unchanged",
                "resolution_id": existing_current.name,
                "version_number": existing_current.version_number
            }

    # If old resolution exists and differs from new, archive the old one
    if old_resolution_exists and old_resolution.strip() != resolution_content:
        # Check if old resolution already has a current history entry
        existing_current = frappe.db.get_value(
            "HD Resolution History",
            {"ticket": ticket_id, "is_current_version": 1},
            "name"
        )

        if existing_current:
            # Mark the existing current version as not current
            frappe.db.set_value("HD Resolution History", existing_current, "is_current_version", 0)
        else:
            # No history entry exists for the old resolution — create one to preserve it
            max_version += 1
            frappe.get_doc({
                "doctype": "HD Resolution History",
                "naming_series": RESOLUTION_HISTORY_NAMING_SERIES,
                "ticket": ticket_id,
                "version_number": max_version,
                "resolution_content": old_resolution,
                "submitted_by": ticket_doc.owner,
                "submitted_on": ticket_doc.resolution_submitted_on or ticket_doc.modified,
                "satisfaction_status": "Pending",
                "is_current_version": 0
            }).insert(ignore_permissions=True)
    elif not old_resolution_exists:
        # No old resolution — just unmark any stale current entries
        frappe.db.sql("""
            UPDATE `tabHD Resolution History`
            SET is_current_version = 0
            WHERE ticket = %s AND is_current_version = 1
        """, (ticket_id,))

    # Create new resolution history entry as current
    max_version = frappe.db.get_value(
        "HD Resolution History",
        {"ticket": ticket_id},
        "MAX(version_number)"
    ) or 0
    new_version = max_version + 1

    # Use a single timestamp so the before_save dedup in hd_ticket.py can match
    submitted_time = frappe.utils.now_datetime()

    resolution_doc = frappe.get_doc({
        "doctype": "HD Resolution History",
        "naming_series": RESOLUTION_HISTORY_NAMING_SERIES,
        "ticket": ticket_id,
        "version_number": new_version,
        "resolution_content": resolution_content,
        "submitted_by": frappe.session.user,
        "submitted_on": submitted_time,
        "satisfaction_status": "Pending",
        "is_current_version": 1
    })
    resolution_doc.insert(ignore_permissions=True)

    update_values = {
        "resolution_details": resolution_content,
        "resolution_submitted": 1,
        "resolution_submitted_on": submitted_time,
        "resolution_ever_submitted": 1,
    }
    if hasattr(ticket_doc, "current_resolution_version"):
        update_values["current_resolution_version"] = new_version
    _update_ticket_resolution_fields(ticket_id, update_values)

    return {
        "success": True,
        "message": "Resolution saved with history",
        "resolution_id": resolution_doc.name,
        "version_number": new_version
    }


@frappe.whitelist()
def close_ticket(ticket_id: str | int) -> Dict[str, Any]:
    """
    Close a ticket by setting its status to Closed.
    Uses flags.ignore_links to avoid LinkValidationError when
    linked documents (team, type, etc.) have been deleted.
    """
    ticket_id = _normalize_ticket_id(ticket_id)
    ticket_doc = frappe.get_doc("HD Ticket", ticket_id)

    from helpdesk.utils import is_admin
    if not (is_admin() or ticket_doc.raised_by == frappe.session.user):
        frappe.throw(_("You are not authorized to close this ticket"), frappe.PermissionError)

    ticket_doc.status = "Closed"
    ticket_doc.flags.ignore_links = True
    ticket_doc.save(ignore_permissions=True)

    return {
        "success": True,
        "message": "Ticket closed successfully",
    }


@frappe.whitelist()
def create_resolution_history(
    ticket_id: str | int, resolution_content: str
) -> Dict[str, Any]:
    """
    Create a new resolution history entry when agent submits resolution
    """
    ticket_id = _normalize_ticket_id(ticket_id)
    ticket_doc = frappe.get_doc("HD Ticket", ticket_id)

    # Check permissions - only agents should be able to create resolutions
    from helpdesk.utils import is_agent, is_admin
    if not (is_agent() or is_admin()):
        frappe.throw(_("Only agents can submit resolutions"), frappe.PermissionError)

    if not resolution_content.strip():
        frappe.throw(_("Resolution content cannot be empty"), frappe.ValidationError)

    # Create new resolution history entry
    resolution_doc = frappe.get_doc({
        "doctype": "HD Resolution History",
        "ticket": ticket_id,
        "resolution_content": resolution_content,
        "submitted_by": frappe.session.user,
        "satisfaction_status": "Pending",
        "is_current_version": 1
    })

    resolution_doc.insert(ignore_permissions=True)

    # Update ticket with current resolution info
    ticket_doc.resolution_details = resolution_content
    ticket_doc.resolution_submitted = 1
    ticket_doc.resolution_submitted_on = frappe.utils.now_datetime()
    ticket_doc.resolution_ever_submitted = 1
    ticket_doc.status = "Resolved"

    ticket_doc.flags.ignore_links = True
    ticket_doc.save(ignore_permissions=True)

    return {
        "success": True,
        "message": "Resolution submitted successfully",
        "resolution_id": resolution_doc.name,
        "version_number": resolution_doc.version_number
    }


@frappe.whitelist()
def get_resolution_satisfaction_permissions(ticket_id: str | int) -> Dict[str, bool]:
    """
    Check what resolution satisfaction actions the current user can perform
    """
    ticket_id = _normalize_ticket_id(ticket_id)
    ticket_doc = frappe.get_doc("HD Ticket", ticket_id)
    user = frappe.session.user

    from helpdesk.utils import is_admin

    # Check basic permissions
    can_reject = False
    can_mark_satisfied = False

    # System manager can always manage satisfaction
    if is_admin(user):
        can_reject = True
        can_mark_satisfied = True
    else:
        # User who raised the ticket can manage satisfaction
        if ticket_doc.raised_by == user:
            can_reject = True
            can_mark_satisfied = True

        # User for whom the ticket is raised (contact) can manage satisfaction
        if ticket_doc.contact == user:
            can_reject = True
            can_mark_satisfied = True

    # Additional checks based on current state
    if not ticket_doc.resolution_ever_submitted:
        can_reject = False
        can_mark_satisfied = False

    if ticket_doc.status not in ["Resolved", "Closed"]:
        can_reject = False
        can_mark_satisfied = False

    # Check resolution history for satisfaction status
    current_resolution_status = "Pending"
    if ticket_doc.resolution_ever_submitted:
        # Get current resolution satisfaction status from history
        resolution_history = frappe.db.get_value(
            "HD Resolution History",
            {
                "ticket": ticket_id,
                "is_current_version": 1
            },
            "satisfaction_status"
        )
        if resolution_history:
            current_resolution_status = resolution_history
            if resolution_history == "Satisfied":
                can_mark_satisfied = False
            elif resolution_history == "Not Satisfied":
                can_reject = False

    return {
        "can_reject": can_reject,
        "can_mark_satisfied": can_mark_satisfied,
        "current_status": current_resolution_status,
        "ticket_status": ticket_doc.status
    }


@frappe.whitelist()
def get_current_resolution_details(ticket_id: str | int) -> Dict[str, Any]:
    """
    Get details of the current resolution
    """
    ticket_id = _normalize_ticket_id(ticket_id)
    ticket_doc = frappe.get_doc("HD Ticket", ticket_id)

    # Check permissions
    if not frappe.has_permission("HD Ticket", "read", ticket_doc):
        frappe.throw(_("You don't have permission to view this ticket"), frappe.PermissionError)

    current_resolution = None
    if ticket_doc.current_resolution_version:
        current_resolution = frappe.db.get_value(
            "HD Resolution History",
            {
                "ticket": ticket_id,
                "is_current_version": 1
            },
            [
                "name",
                "version_number",
                "resolution_content",
                "submitted_by",
                "submitted_on",
                "satisfaction_status",
                "satisfaction_by",
                "satisfaction_on",
                "rejection_reason"
            ],
            as_dict=True
        )

        if current_resolution and current_resolution.submitted_by:
            current_resolution.submitted_by_name = frappe.get_value(
                "User", current_resolution.submitted_by, "full_name"
            ) or current_resolution.submitted_by

        if current_resolution and current_resolution.satisfaction_by:
            current_resolution.satisfaction_by_name = frappe.get_value(
                "User", current_resolution.satisfaction_by, "full_name"
            ) or current_resolution.satisfaction_by

    # Get satisfaction status from current resolution history
    satisfaction_status = "Pending"
    if current_resolution:
        satisfaction_status = current_resolution.get("satisfaction_status", "Pending")

    return {
        "current_resolution": current_resolution,
        "ticket_resolution_details": ticket_doc.resolution_details,
        "ticket_satisfaction_status": satisfaction_status,
        "total_versions": frappe.db.count("HD Resolution History", {"ticket": ticket_id})
    }


@frappe.whitelist()
def compare_resolution_versions(
    ticket_id: str | int, version1: int, version2: int
) -> Dict[str, Any]:
    """
    Compare two resolution versions
    """
    ticket_id = _normalize_ticket_id(ticket_id)
    ticket_doc = frappe.get_doc("HD Ticket", ticket_id)

    # Check permissions
    if not frappe.has_permission("HD Ticket", "read", ticket_doc):
        frappe.throw(_("You don't have permission to view this ticket"), frappe.PermissionError)

    # Get both versions
    version1_data = frappe.db.get_value(
        "HD Resolution History",
        {"ticket": ticket_id, "version_number": version1},
        [
            "name", "version_number", "resolution_content", "submitted_by",
            "submitted_on", "satisfaction_status", "rejection_reason"
        ],
        as_dict=True
    )

    version2_data = frappe.db.get_value(
        "HD Resolution History",
        {"ticket": ticket_id, "version_number": version2},
        [
            "name", "version_number", "resolution_content", "submitted_by",
            "submitted_on", "satisfaction_status", "rejection_reason"
        ],
        as_dict=True
    )

    if not version1_data or not version2_data:
        frappe.throw(_("One or both versions not found"), frappe.ValidationError)

    # Add user names
    for version_data in [version1_data, version2_data]:
        if version_data.submitted_by:
            version_data.submitted_by_name = frappe.get_value(
                "User", version_data.submitted_by, "full_name"
            ) or version_data.submitted_by

    return {
        "version1": version1_data,
        "version2": version2_data
    }
