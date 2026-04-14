from datetime import datetime

import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields
from frappe.permissions import add_permission, update_permission_property

from helpdesk.consts import DEFAULT_ARTICLE_CATEGORY

from .default_template import create_default_template
from .file import create_helpdesk_folder
from .ticket_feedback import create_ticket_feedback_options
from .ticket_type import create_fallback_ticket_type, create_ootb_ticket_types
from .welcome_ticket import create_welcome_ticket


def after_install():
    create_custom_fields(get_custom_fields())
    add_default_categories_and_articles()
    add_default_ticket_priorities()
    add_default_sla()
    add_default_agent_groups()
    update_agent_role_permissions()
    add_agent_manager_permissions()
    add_default_assignment_rule()
    create_default_template()
    create_fallback_ticket_type()
    create_helpdesk_folder()
    create_ootb_ticket_types()
    create_welcome_ticket()
    create_ticket_feedback_options()
    add_property_setters()


def add_default_categories_and_articles():
    category = frappe.db.exists("HD Article Category", DEFAULT_ARTICLE_CATEGORY)
    if not category:
        category = frappe.get_doc(
            {
                "doctype": "HD Article Category",
                "category_name": DEFAULT_ARTICLE_CATEGORY,
            }
        ).insert()
        category = category.name
    # TODO: create 4 articles sharing information about helpdesk
    frappe.get_doc(
        {
            "doctype": "HD Article",
            "title": "Introduction",
            "content": "Content for your Article",
            "category": category,
            "published": False,
        }
    ).insert()


def add_default_sla():
    add_default_ticket_priorities()
    add_default_holiday_list()
    if frappe.db.exists("HD Service Level Agreement", "Default"):
        return
    sla_doc = frappe.new_doc("HD Service Level Agreement")

    sla_doc.service_level = "Default"
    sla_doc.document_type = "HD Ticket"
    sla_doc.default_sla = 1
    sla_doc.enabled = 1

    low_priority = frappe.get_doc(
        {
            "doctype": "HD Service Level Priority",
            "default_priority": 0,
            "priority": "Low",
            "response_time": 60 * 60 * 24,
            "resolution_time": 60 * 60 * 72,
        }
    )

    medium_priority = frappe.get_doc(
        {
            "doctype": "HD Service Level Priority",
            "default_priority": 1,
            "priority": "Medium",
            "response_time": 60 * 60 * 8,
            "resolution_time": 60 * 60 * 24,
        }
    )

    high_priority = frappe.get_doc(
        {
            "doctype": "HD Service Level Priority",
            "default_priority": 0,
            "priority": "High",
            "response_time": 60 * 60 * 1,
            "resolution_time": 60 * 60 * 4,
        }
    )

    urgent_priority = frappe.get_doc(
        {
            "doctype": "HD Service Level Priority",
            "default_priority": 0,
            "priority": "Urgent",
            "response_time": 60 * 30,
            "resolution_time": 60 * 60 * 2,
        }
    )

    sla_doc.append("priorities", low_priority)
    sla_doc.append("priorities", medium_priority)
    sla_doc.append("priorities", high_priority)
    sla_doc.append("priorities", urgent_priority)

    sla_fullfilled_on_resolved = frappe.get_doc(
        {
            "doctype": "HD Service Level Agreement Fulfilled On Status",
            "status": "Resolved",
        }
    )

    sla_fullfilled_on_closed = frappe.get_doc(
        {
            "doctype": "HD Service Level Agreement Fulfilled On Status",
            "status": "Closed",
        }
    )

    sla_doc.append("sla_fulfilled_on", sla_fullfilled_on_resolved)
    sla_doc.append("sla_fulfilled_on", sla_fullfilled_on_closed)

    sla_paused_on_replied = frappe.get_doc(
        {"doctype": "HD Pause Service Level Agreement On Status", "status": "Replied"}
    )

    sla_doc.append("pause_sla_on", sla_paused_on_replied)

    sla_doc.holiday_list = "Default"

    for day in ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]:
        service_day = frappe.get_doc(
            {
                "doctype": "HD Service Day",
                "workday": day,
                "start_time": "10:00:00",
                "end_time": "18:00:00",
            }
        )
        sla_doc.append("support_and_resolution", service_day)

    sla_doc.insert()


def add_default_holiday_list():
    if frappe.db.exists("HD Service Holiday List", "Default"):
        return
    frappe.get_doc(
        {
            "doctype": "HD Service Holiday List",
            "holiday_list_name": "Default",
            "from_date": datetime.strptime(f"Jan 1 {datetime.now().year}", "%b %d %Y"),
            "to_date": datetime.strptime(
                f"Jan 1 {datetime.now().year + 1}", "%b %d %Y"
            ),
        }
    ).insert()


def add_default_ticket_priorities():
    ticket_priorities = {
        "Urgent": 100,
        "High": 200,
        "Medium": 300,
        "Low": 400,
    }

    for priority in ticket_priorities:
        if frappe.db.exists("HD Ticket Priority", priority):
            continue

        doc = frappe.new_doc("HD Ticket Priority")
        doc.name = priority
        doc.integer_value = ticket_priorities[priority]
        doc.insert()


def add_default_agent_groups():
    agent_groups = ["Billing", "Product Experts"]

    for agent_group in agent_groups:
        if not frappe.db.exists("HD Team", agent_group):
            agent_group_doc = frappe.new_doc("HD Team")
            agent_group_doc.team_name = agent_group
            agent_group_doc.insert()


def update_agent_role_permissions():
    if frappe.db.exists("Role", "Agent"):
        agent_role_doc = frappe.get_doc("Role", "Agent")
        agent_role_doc.search_bar = True
        agent_role_doc.notifications = True
        agent_role_doc.list_sidebar = True
        agent_role_doc.bulk_actions = True
        agent_role_doc.view_switcher = True
        agent_role_doc.form_sidebar = True
        agent_role_doc.form_sidebar = True
        agent_role_doc.timeline = True
        agent_role_doc.dashboard = True
        agent_role_doc.save()

        add_permission("File", "Agent", 0)
        add_permission("Contact", "Agent", 0)
        add_permission("Email Account", "Agent", 0)
        add_permission("Communication", "Agent", 0)


def add_agent_manager_permissions():
    if not frappe.db.exists("Role", "Agent Manager"):
        return

    ptype = ["create", "delete", "write"]
    doctypes = ["Email Account", "File", "Contact", "Communication"]
    for dt in doctypes:
        # this adds read permission to the role
        add_permission(dt, "Agent Manager")
        for p in ptype:
            # now we update the above role to have all permissions from the ptype
            update_permission_property(dt, "Agent Manager", 0, p, 1)


def add_default_assignment_rule():
    support_settings = frappe.get_doc("HD Settings")
    support_settings.create_base_support_rotation()


def add_property_setters():
    if not frappe.db.exists("Property Setter", {"name": "Contact-main-search_fields"}):
        doc = frappe.new_doc("Property Setter")
        doc.doctype_or_field = "DocType"
        doc.doc_type = "Contact"
        doc.property = "search_fields"
        doc.property_type = "Data"
        doc.value = "email_id"
        doc.insert()

    add_assignment_rule_property_setters()


def get_custom_fields():
    """Helpdesk specific custom fields that needs to be added to various DocTypes."""
    return {
        "HD Service Level Agreement": [
            # Second Level Escalation Section
            {
                "fieldname": "custom_second_level_escalation_section",
                "fieldtype": "Section Break",
                "label": "Second Level Escalation",
                "description": "Configure automatic second level escalation when first level doesn't resolve",
                "insert_after": "custom_use_assignee_holiday_list",
            },
            {
                "fieldname": "custom_second_level_escalation_enabled",
                "fieldtype": "Check",
                "label": "Enable Second Level Escalation",
                "default": "0",
                "insert_after": "custom_second_level_escalation_section",
            },
            {
                "fieldname": "custom_second_level_escalation_target",
                "fieldtype": "Select",
                "label": "Second Level Escalation Target",
                "options": "\nManager of Assignee\nManager of HRBP\nManager of HOD\nSpecific User\nSpecific Team",
                "depends_on": "eval: doc.custom_second_level_escalation_enabled",
                "insert_after": "custom_second_level_escalation_enabled",
            },
            {
                "fieldname": "custom_second_level_escalation_user",
                "fieldtype": "Link",
                "label": "Second Level User",
                "options": "HD Agent",
                "depends_on": "eval: doc.custom_second_level_escalation_target == 'Specific User'",
                "insert_after": "custom_second_level_escalation_target",
            },
            {
                "fieldname": "custom_second_level_escalation_team",
                "fieldtype": "Link",
                "label": "Second Level Team",
                "options": "HD Team",
                "depends_on": "eval: doc.custom_second_level_escalation_target == 'Specific Team'",
                "insert_after": "custom_second_level_escalation_user",
            },
            {
                "fieldname": "custom_second_level_escalation_delay_hours",
                "fieldtype": "Int",
                "label": "Second Level Escalation Delay (hours)",
                "default": "24",
                "depends_on": "eval: doc.custom_second_level_escalation_enabled",
                "insert_after": "custom_second_level_escalation_team",
            },
        ],
        "HD Ticket": [
            # Escalation Tracking Fields
            {
                "fieldname": "custom_escalation_tracking_section",
                "fieldtype": "Section Break",
                "label": "Escalation Tracking",
                "collapsible": 1,
                "insert_after": "resolution_date",
            },
            {
                "fieldname": "escalation_level",
                "fieldtype": "Int",
                "label": "Escalation Level",
                "default": "0",
                "read_only": 1,
                "insert_after": "custom_escalation_tracking_section",
            },
            {
                "fieldname": "first_escalation_on",
                "fieldtype": "Datetime",
                "label": "First Escalation Time",
                "read_only": 1,
                "insert_after": "escalation_level",
            },
            {
                "fieldname": "first_escalated_to",
                "fieldtype": "Link",
                "label": "First Escalated To",
                "options": "User",
                "read_only": 1,
                "insert_after": "first_escalation_on",
            },
            {
                "fieldname": "custom_escalation_col_break",
                "fieldtype": "Column Break",
                "insert_after": "first_escalated_to",
            },
            {
                "fieldname": "second_escalation_on",
                "fieldtype": "Datetime",
                "label": "Second Escalation Time",
                "read_only": 1,
                "insert_after": "custom_escalation_col_break",
            },
            {
                "fieldname": "second_escalated_to",
                "fieldtype": "Link",
                "label": "Second Escalated To",
                "options": "User",
                "read_only": 1,
                "insert_after": "second_escalation_on",
            },
        ],
        "Assignment Rule": [
            {
                "description": "Autogenerated field by Helpdesk App",
                "fieldname": "assign_condition_json",
                "fieldtype": "Code",
                "label": "Assign Condition JSON",
                "insert_after": "assign_condition",
                "depends_on": "eval: doc.assign_condition_json",
            },
            {
                "description": "Autogenerated field by Helpdesk App",
                "fieldname": "unassign_condition_json",
                "fieldtype": "Code",
                "label": "Unassign Condition JSON",
                "insert_after": "unassign_condition",
                "depends_on": "eval: doc.unassign_condition_json",
            },
            {
                "fieldname": "custom_dynamic_assignment_section",
                "fieldtype": "Section Break",
                "label": "Dynamic Assignments",
                "description": "Link Dynamic User Assignment rules",
                "insert_after": "users",
            },
            {
                "fieldname": "custom_dynamic_user_assignment",
                "fieldtype": "Table MultiSelect",
                "label": "Dynamic User Assignments",
                "options": "Assignment Rule Dynamic Assignment",
                "description": "Select Dynamic User Assignment records to auto-populate assignees",
                "insert_after": "custom_dynamic_assignment_section",
            },
            {
                "fieldname": "custom_holiday_section",
                "fieldtype": "Section Break",
                "label": "Holiday Lists",
                "description": "Holiday lists considered for this rule",
                "insert_after": "custom_dynamic_user_assignment",
            },
            {
                "fieldname": "custom_holiday_lists",
                "fieldtype": "Table MultiSelect",
                "label": "Holiday Lists",
                "options": "Assignment Rule Holiday",
                "description": "Select holidays to exclude when routing tickets",
                "insert_after": "custom_holiday_section",
            },
        ],
        "HD Settings": [
            {
                "fieldname": "make_agent_status_read_only",
                "fieldtype": "Check",
                "label": "Make Agent Status Read Only",
                "description": "Agent Status Manual Field Read Only",
                "insert_after": "send_acknowledgement_email",
            },
        ],
    }


def add_assignment_rule_property_setters():
    """Add a property setter to the Assignment Rule DocType for assign_condition and unassign_condition."""

    default_fields = {
        "doctype": "Property Setter",
        "doctype_or_field": "DocField",
        "doc_type": "Assignment Rule",
        "property_type": "Data",
        "is_system_generated": 1,
    }

    if not frappe.db.exists(
        "Property Setter", {"name": "Assignment Rule-assign_condition-depends_on"}
    ):
        frappe.get_doc(
            {
                **default_fields,
                "name": "Assignment Rule-assign_condition-depends_on",
                "field_name": "assign_condition",
                "property": "depends_on",
                "value": "eval: !doc.assign_condition_json",
            }
        ).insert()
    else:
        frappe.db.set_value(
            "Property Setter",
            {"name": "Assignment Rule-assign_condition-depends_on"},
            "value",
            "eval: !doc.assign_condition_json",
        )
    if not frappe.db.exists(
        "Property Setter", {"name": "Assignment Rule-unassign_condition-depends_on"}
    ):
        frappe.get_doc(
            {
                **default_fields,
                "name": "Assignment Rule-unassign_condition-depends_on",
                "field_name": "unassign_condition",
                "property": "depends_on",
                "value": "eval: !doc.unassign_condition_json",
            }
        ).insert()
    else:
        frappe.db.set_value(
            "Property Setter",
            {"name": "Assignment Rule-unassign_condition-depends_on"},
            "value",
            "eval: !doc.unassign_condition_json",
        )
