import frappe
from frappe import _
from helpdesk.utils import is_agent, is_admin


@frappe.whitelist()
def request_closure(ticket_id: str, resolution_notes: str = ""):
    """
    Request closure of a ticket. This can be called by:
    - Employees/agents responsible for the resolution of the ticket
    - User who raised the ticket or for whom it is raised
    - System manager
    """
    ticket_doc = frappe.get_doc("HD Ticket", ticket_id)
    user = frappe.session.user

    # Check authorization
    if not _can_request_closure(ticket_doc, user):
        frappe.throw(_("You are not authorized to request closure for this ticket"), frappe.PermissionError)

    # Check if ticket is already closed
    if ticket_doc.status == "Closed":
        frappe.throw(_("Ticket is already closed"), frappe.ValidationError)

    # Store resolution notes
    if resolution_notes:
        ticket_doc.resolution = resolution_notes
        ticket_doc.save(ignore_permissions=True)

    # Create a comment about the closure request
    comment = frappe.new_doc("HD Ticket Comment")
    comment.commented_by = user
    comment.content = f"Requested closure of ticket. Resolution notes: {resolution_notes or 'No resolution notes provided.'}"
    comment.reference_ticket = ticket_id
    comment.save(ignore_permissions=True)

    # Send notification to assigned agents (if user is not an agent)
    if not is_agent(user):
        _notify_agents_of_closure_request(ticket_doc, user, resolution_notes)

    # Set status to indicate closure is requested
    ticket_doc.status = "Requested Closure"
    ticket_doc.save(ignore_permissions=True)

    return {"success": True, "message": "Closure request submitted"}


@frappe.whitelist()
def mark_as_resolved(ticket_id: str, resolution_notes: str = ""):
    """
    Mark ticket as resolved/closed. This can be called by:
    - Assigned agents
    - System manager
    - User who raised the ticket (if they have permission)
    """
    ticket_doc = frappe.get_doc("HD Ticket", ticket_id)
    user = frappe.session.user

    # Check authorization
    if not _can_close_ticket(ticket_doc, user):
        frappe.throw(_("You are not authorized to close this ticket"), frappe.PermissionError)

    # Check if ticket is already closed
    if ticket_doc.status == "Closed":
        frappe.throw(_("Ticket is already closed"), frappe.ValidationError)

    # Validate resolution notes if required
    settings = frappe.get_single("HD Settings")
    if getattr(settings, "require_resolution_notes", False) and not resolution_notes:
        frappe.throw(_("Resolution notes are required to close this ticket"), frappe.ValidationError)

    # Store resolution notes
    if resolution_notes:
        ticket_doc.resolution = resolution_notes

    # Set status to closed
    ticket_doc.status = "Closed"
    ticket_doc.resolution_date = frappe.utils.now_datetime()
    ticket_doc.save(ignore_permissions=True)

    # Create a comment about the closure
    comment = frappe.new_doc("HD Ticket Comment")
    comment.commented_by = user
    comment.content = f"Ticket closed. Resolution: {resolution_notes or 'No resolution notes provided.'}"
    comment.reference_ticket = ticket_id
    comment.save(ignore_permissions=True)

    # Send notification to ticket raiser if closed by agent
    if is_agent(user) and user != ticket_doc.raised_by:
        _notify_customer_of_closure(ticket_doc, resolution_notes)

    return {"success": True, "message": "Ticket closed successfully"}


@frappe.whitelist()
def reopen_ticket(ticket_id: str, reopen_reason: str = ""):
    """
    Reopen a closed or resolved ticket. This can be called by:
    - User who raised the ticket or for whom it is raised
    - Assigned agents
    - System manager
    """
    ticket_doc = frappe.get_doc("HD Ticket", ticket_id)
    user = frappe.session.user

    # Check authorization
    if not _can_reopen_ticket(ticket_doc, user):
        frappe.throw(_("You are not authorized to reopen this ticket"), frappe.PermissionError)

    # Check if ticket can be reopened
    if ticket_doc.status not in ["Closed", "Resolved"]:
        frappe.throw(_("Only closed or resolved tickets can be reopened"), frappe.ValidationError)

    # Reset resolution submission state to allow new resolution
    ticket_doc.resolution_submitted = 0
    ticket_doc.resolution_submitted_on = None

    # Set status to Reopened
    ticket_doc.status = "Reopened"
    ticket_doc.save(ignore_permissions=True)

    # Create a comment about the reopening
    comment = frappe.new_doc("HD Ticket Comment")
    comment.commented_by = user
    comment.content = f"Ticket reopened. Reason: {reopen_reason or 'No reason provided.'}"
    comment.reference_ticket = ticket_id
    comment.save(ignore_permissions=True)

    # Reset SLA if applicable
    _reset_sla_for_reopened_ticket(ticket_doc)

    # Send notification to assigned agents (if user is not an agent)
    if not is_agent(user):
        _notify_agents_of_reopen(ticket_doc, user, reopen_reason)

    return {"success": True, "message": "Ticket reopened successfully"}


def _can_reopen_ticket(ticket_doc, user):
    """
    Check if user can reopen this ticket
    """
    # System manager can always reopen
    if is_admin(user):
        return True

    # User who raised the ticket can reopen
    if ticket_doc.raised_by == user:
        return True

    # User for whom the ticket is raised (contact) can reopen
    if ticket_doc.contact == user:
        return True

    # Assigned agents can reopen
    if is_agent(user):
        assigned_agents = ticket_doc.get_assigned_agents()
        if assigned_agents:
            agent_names = [agent.get("name") for agent in assigned_agents]
            if user in agent_names:
                return True

        # Agents from the same team can reopen
        if ticket_doc.agent_group:
            team_members = frappe.get_all(
                "HD Team Member",
                filters={"parent": ticket_doc.agent_group},
                pluck="user"
            )
            if user in team_members:
                return True

    return False


def _reset_sla_for_reopened_ticket(ticket_doc):
    """
    Reset SLA timers for reopened ticket
    """
    if not ticket_doc.sla:
        return

    try:
        # Import SLA utilities
        from helpdesk.helpdesk.doctype.hd_service_level_agreement.utils import apply

        # Reset SLA agreement status
        ticket_doc.agreement_status = "First Response Due"
        ticket_doc.service_level_agreement_creation = frappe.utils.now_datetime()

        # Recalculate SLA timelines
        apply(ticket_doc)
        ticket_doc.save(ignore_permissions=True)

    except Exception as e:
        frappe.log_error(f"Failed to reset SLA for reopened ticket {ticket_doc.name}: {str(e)}")


def _notify_agents_of_reopen(ticket_doc, requester, reopen_reason):
    """
    Notify assigned agents about ticket reopening
    """
    assigned_agents = ticket_doc.get_assigned_agents()
    if not assigned_agents:
        return

    recipients = [agent.get("name") for agent in assigned_agents]

    subject = f"Ticket #{ticket_doc.name} has been reopened"
    message = f"""
    <p>Ticket #{ticket_doc.name} has been reopened by {requester}.</p>
    <p><strong>Subject:</strong> {ticket_doc.subject}</p>
    <p><strong>Reopen Reason:</strong> {reopen_reason or 'No reason provided.'}</p>
    <p><a href="{frappe.utils.get_url()}/helpdesk/tickets/{ticket_doc.name}">View Ticket</a></p>
    """

    frappe.sendmail(
        recipients=recipients,
        subject=subject,
        message=message,
        reference_doctype="HD Ticket",
        reference_name=ticket_doc.name,
        now=True
    )


def _can_request_closure(ticket_doc, user):
    """
    Check if user can request closure for this ticket
    """
    # System manager can always request closure
    if is_admin(user):
        return True

    # User who raised the ticket can request closure
    if ticket_doc.raised_by == user:
        return True

    # User for whom the ticket is raised (contact) can request closure
    if ticket_doc.contact == user:
        return True

    # Assigned agents can request closure
    if is_agent(user):
        assigned_agents = ticket_doc.get_assigned_agents()
        if assigned_agents:
            agent_names = [agent.get("name") for agent in assigned_agents]
            if user in agent_names:
                return True

        # Agents from the same team can request closure
        if ticket_doc.agent_group:
            team_members = frappe.get_all(
                "HD Team Member",
                filters={"parent": ticket_doc.agent_group},
                pluck="user"
            )
            if user in team_members:
                return True

    return False


def _can_close_ticket(ticket_doc, user):
    """
    Check if user can directly close this ticket
    """
    # System manager can always close
    if is_admin(user):
        return True

    # Assigned agents can close
    if is_agent(user):
        assigned_agents = ticket_doc.get_assigned_agents()
        if assigned_agents:
            agent_names = [agent.get("name") for agent in assigned_agents]
            if user in agent_names:
                return True

        # Agents from the same team can close
        if ticket_doc.agent_group:
            team_members = frappe.get_all(
                "HD Team Member",
                filters={"parent": ticket_doc.agent_group},
                pluck="user"
            )
            if user in team_members:
                return True

    # User who raised the ticket can close (if setting allows)
    settings = frappe.get_single("HD Settings")
    if getattr(settings, "allow_customer_to_close", True) and ticket_doc.raised_by == user:
        return True

    return False


def _notify_agents_of_closure_request(ticket_doc, requester, resolution_notes):
    """
    Notify assigned agents about closure request
    """
    assigned_agents = ticket_doc.get_assigned_agents()
    if not assigned_agents:
        return

    recipients = [agent.get("name") for agent in assigned_agents]

    subject = f"Closure requested for Ticket #{ticket_doc.name}"
    message = f"""
    <p>A closure request has been submitted for Ticket #{ticket_doc.name} by {requester}.</p>
    <p><strong>Subject:</strong> {ticket_doc.subject}</p>
    <p><strong>Resolution Notes:</strong> {resolution_notes or 'No resolution notes provided.'}</p>
    <p><a href="{frappe.utils.get_url()}/helpdesk/tickets/{ticket_doc.name}">View Ticket</a></p>
    """

    frappe.sendmail(
        recipients=recipients,
        subject=subject,
        message=message,
        reference_doctype="HD Ticket",
        reference_name=ticket_doc.name,
        now=True
    )


def _notify_customer_of_closure(ticket_doc, resolution_notes):
    """
    Notify customer about ticket closure
    """
    subject = f"Ticket #{ticket_doc.name} has been resolved"
    message = f"""
    <p>Hello,</p>
    <p>Your support ticket #{ticket_doc.name} has been resolved.</p>
    <p><strong>Subject:</strong> {ticket_doc.subject}</p>
    <p><strong>Resolution:</strong> {resolution_notes or 'No resolution details provided.'}</p>
    <p>If you have any further questions, please feel free to reach out to us.</p>
    <p>Best regards,<br>Support Team</p>
    """

    frappe.sendmail(
        recipients=[ticket_doc.raised_by],
        subject=subject,
        message=message,
        reference_doctype="HD Ticket",
        reference_name=ticket_doc.name,
        now=True
    )


@frappe.whitelist()
def reject_resolution(ticket_id: str, rejection_reason: str = ""):
    """
    Reject the current resolution and create a new version.
    This can be called by:
    - User who raised the ticket or for whom it is raised
    - System manager
    """
    ticket_doc = frappe.get_doc("HD Ticket", ticket_id)
    user = frappe.session.user

    # Check authorization
    if not _can_reject_resolution(ticket_doc, user):
        frappe.throw(_("You are not authorized to reject this resolution"), frappe.PermissionError)

    # Check if ticket has a resolution to reject
    if not ticket_doc.resolution_ever_submitted:
        frappe.throw(_("No resolution exists to reject"), frappe.ValidationError)

    # Check if already in a rejectable state
    if ticket_doc.status not in ["Resolved", "Closed"]:
        frappe.throw(_("Resolution cannot be rejected in current state"), frappe.ValidationError)

    # Get current resolution history record
    current_resolution = frappe.db.get_value(
        "HD Resolution History",
        {
            "ticket": ticket_id,
            "is_current_version": 1
        },
        "name"
    )

    if current_resolution:
        # Update existing resolution history record
        resolution_doc = frappe.get_doc("HD Resolution History", current_resolution)
        resolution_doc.satisfaction_status = "Not Satisfied"
        resolution_doc.satisfaction_by = user
        resolution_doc.satisfaction_on = frappe.utils.now_datetime()
        resolution_doc.rejection_reason = rejection_reason
        resolution_doc.save(ignore_permissions=True)
    else:
        # Create new resolution history record for current resolution
        frappe.get_doc({
            "doctype": "HD Resolution History",
            "ticket": ticket_id,
            "version_number": ticket_doc.current_resolution_version or 1,
            "resolution_content": ticket_doc.resolution_details,
            "submitted_by": ticket_doc.owner,  # Fallback to ticket owner
            "submitted_on": ticket_doc.resolution_submitted_on or ticket_doc.modified,
            "satisfaction_status": "Not Satisfied",
            "satisfaction_by": user,
            "satisfaction_on": frappe.utils.now_datetime(),
            "rejection_reason": rejection_reason,
            "is_current_version": 1
        }).insert(ignore_permissions=True)

    # Reset ticket for new resolution - back to Replied status for new resolution
    # Keep resolution_details for audit trail (already archived in HD Resolution History)
    ticket_doc.status = "Replied"
    ticket_doc.resolution_submitted = 0
    ticket_doc.resolution_submitted_on = None

    # Restart SLA if applicable
    _reset_sla_for_rejected_resolution(ticket_doc)

    ticket_doc.save(ignore_permissions=True)

    # Create a comment about the rejection
    comment = frappe.new_doc("HD Ticket Comment")
    comment.commented_by = user
    comment.content = f"Resolution rejected. Reason: {rejection_reason or 'No reason provided.'}"
    comment.reference_ticket = ticket_id
    comment.save(ignore_permissions=True)

    # Send notification to assigned agents
    _notify_agents_of_rejection(ticket_doc, user, rejection_reason)

    return {"success": True, "message": "Resolution rejected successfully"}


@frappe.whitelist()
def mark_resolution_satisfied(ticket_id: str):
    """
    Mark the current resolution as satisfied.
    This can be called by:
    - User who raised the ticket or for whom it is raised
    - System manager
    """
    ticket_doc = frappe.get_doc("HD Ticket", ticket_id)
    user = frappe.session.user

    # Check authorization
    if not _can_mark_satisfaction(ticket_doc, user):
        frappe.throw(_("You are not authorized to mark satisfaction for this resolution"), frappe.PermissionError)

    # Check if ticket has a resolution to mark as satisfied
    if not ticket_doc.resolution_ever_submitted:
        frappe.throw(_("No resolution exists to mark as satisfied"), frappe.ValidationError)

    # Check if in correct state
    if ticket_doc.status != "Resolved":
        frappe.throw(_("Resolution cannot be marked as satisfied in current state"), frappe.ValidationError)

    # Get current resolution history record
    current_resolution = frappe.db.get_value(
        "HD Resolution History",
        {
            "ticket": ticket_id,
            "is_current_version": 1
        },
        "name"
    )

    if current_resolution:
        # Update existing resolution history record
        resolution_doc = frappe.get_doc("HD Resolution History", current_resolution)
        resolution_doc.satisfaction_status = "Satisfied"
        resolution_doc.satisfaction_by = user
        resolution_doc.satisfaction_on = frappe.utils.now_datetime()
        resolution_doc.save(ignore_permissions=True)
    else:
        # Create new resolution history record for current resolution
        frappe.get_doc({
            "doctype": "HD Resolution History",
            "ticket": ticket_id,
            "version_number": ticket_doc.current_resolution_version or 1,
            "resolution_content": ticket_doc.resolution_details,
            "submitted_by": ticket_doc.owner,  # Fallback to ticket owner
            "submitted_on": ticket_doc.resolution_submitted_on or ticket_doc.modified,
            "satisfaction_status": "Satisfied",
            "satisfaction_by": user,
            "satisfaction_on": frappe.utils.now_datetime(),
            "is_current_version": 1
        }).insert(ignore_permissions=True)

    # Keep ticket in Resolved status but mark as satisfied in history
    ticket_doc.save(ignore_permissions=True)

    # Create a comment about the satisfaction
    comment = frappe.new_doc("HD Ticket Comment")
    comment.commented_by = user
    comment.content = "Resolution marked as satisfactory"
    comment.reference_ticket = ticket_id
    comment.save(ignore_permissions=True)

    return {"success": True, "message": "Resolution marked as satisfied"}


def _can_reject_resolution(ticket_doc, user):
    """
    Check if user can reject resolution for this ticket
    """
    # System manager can always reject
    if is_admin(user):
        return True

    # User who raised the ticket can reject
    if ticket_doc.raised_by == user:
        return True

    # User for whom the ticket is raised (contact) can reject
    if ticket_doc.contact == user:
        return True

    return False


def _can_mark_satisfaction(ticket_doc, user):
    """
    Check if user can mark satisfaction for this ticket
    """
    # System manager can always mark satisfaction
    if is_admin(user):
        return True

    # User who raised the ticket can mark satisfaction
    if ticket_doc.raised_by == user:
        return True

    # User for whom the ticket is raised (contact) can mark satisfaction
    if ticket_doc.contact == user:
        return True

    return False


def _reset_sla_for_rejected_resolution(ticket_doc):
    """
    Reset SLA timers for rejected resolution - comprehensive restart logic
    """
    if not ticket_doc.sla:
        return

    try:
        # Reset resolution-related SLA fields
        ticket_doc.resolution_date = None
        ticket_doc.resolution_time = None
        ticket_doc.user_resolution_time = None

        # Reset agreement status to indicate resolution is due again
        ticket_doc.agreement_status = "Resolution Due"

        # Recalculate resolution timeline from current time
        sla_doc = frappe.get_doc("HD Service Level Agreement", ticket_doc.sla)
        _recalculate_resolution_timeline(ticket_doc, sla_doc)

        # Log SLA restart activity
        from helpdesk.helpdesk.doctype.hd_ticket_activity.hd_ticket_activity import log_ticket_activity
        log_ticket_activity(
            ticket_doc.name,
            f"SLA resolution timer restarted due to resolution rejection"
        )

    except Exception as e:
        frappe.log_error(f"Failed to reset SLA for rejected resolution {ticket_doc.name}: {str(e)}")


def _recalculate_resolution_timeline(ticket_doc, sla_doc):
    """
    Recalculate resolution timeline for a ticket based on current time
    """
    from datetime import datetime, timedelta
    from frappe.utils import add_to_date, get_datetime

    # Find the priority configuration in SLA
    priority_config = None
    for priority in sla_doc.priorities:
        if priority.priority == ticket_doc.priority:
            priority_config = priority
            break

    if not priority_config or not priority_config.resolution_time:
        return

    # Calculate new resolution deadline
    current_time = frappe.utils.now_datetime()
    resolution_hours = priority_config.resolution_time

    # Handle working hours if defined
    if sla_doc.support_and_resolution:
        new_resolution_by = _calculate_resolution_with_working_hours(
            current_time, resolution_hours, sla_doc.support_and_resolution
        )
    else:
        # Simple hour addition if no working hours defined
        new_resolution_by = add_to_date(current_time, hours=resolution_hours)

    ticket_doc.resolution_by = new_resolution_by

    # Update agreement status based on new timeline
    if new_resolution_by < frappe.utils.now_datetime():
        ticket_doc.agreement_status = "Resolution Overdue"
    else:
        ticket_doc.agreement_status = "Resolution Due"


def _calculate_resolution_with_working_hours(start_time, resolution_hours, working_hours):
    """
    Calculate resolution deadline considering working hours
    """
    from frappe.utils import get_weekday, add_to_date, get_time

    current_time = start_time
    remaining_hours = resolution_hours

    # Simple calculation - for complex working hours, this would need more logic
    # For now, we'll add the hours directly and let the SLA system handle the rest
    return add_to_date(current_time, hours=remaining_hours)


@frappe.whitelist()
def restart_sla_for_ticket(ticket_id: str):
    """
    Manually restart SLA for a ticket (for admin use)
    """
    from helpdesk.utils import is_admin

    if not is_admin():
        frappe.throw(_("Only administrators can manually restart SLA"), frappe.PermissionError)

    ticket_doc = frappe.get_doc("HD Ticket", ticket_id)

    if not ticket_doc.sla:
        frappe.throw(_("This ticket does not have an SLA assigned"), frappe.ValidationError)

    # Reset and recalculate SLA
    _reset_sla_for_rejected_resolution(ticket_doc)
    ticket_doc.save(ignore_permissions=True)

    return {"success": True, "message": "SLA restarted successfully"}


def _notify_agents_of_rejection(ticket_doc, requester, rejection_reason):
    """
    Notify assigned agents about resolution rejection
    """
    assigned_agents = ticket_doc.get_assigned_agents()
    if not assigned_agents:
        return

    recipients = [agent.get("name") for agent in assigned_agents]

    subject = f"Resolution rejected for Ticket #{ticket_doc.name}"
    message = f"""
    <p>The resolution for Ticket #{ticket_doc.name} has been rejected by {requester}.</p>
    <p><strong>Subject:</strong> {ticket_doc.subject}</p>
    <p><strong>Rejection Reason:</strong> {rejection_reason or 'No reason provided.'}</p>
    <p>A new resolution is required.</p>
    <p><a href="{frappe.utils.get_url()}/helpdesk/tickets/{ticket_doc.name}">View Ticket</a></p>
    """

    try:
        frappe.sendmail(
            recipients=recipients,
            subject=subject,
            message=message,
            reference_doctype="HD Ticket",
            reference_name=ticket_doc.name,
            now=True
        )
    except Exception as e:
        frappe.log_error(f"Failed to send rejection notification: {str(e)}")