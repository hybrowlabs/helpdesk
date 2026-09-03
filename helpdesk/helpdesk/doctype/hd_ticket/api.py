import frappe
from frappe import _
from frappe.model.document import get_controller
from frappe.utils import get_user_info_for_avatar, now_datetime
from frappe.utils.caching import redis_cache
from pypika import Criterion, Order

from helpdesk.api.category import CATEGORY_FIELDS, can_change_category
from helpdesk.consts import DEFAULT_TICKET_TEMPLATE
from helpdesk.escalation import get_ticket_escalation_status
from helpdesk.helpdesk.doctype.hd_form_script.hd_form_script import get_form_script
from helpdesk.helpdesk.doctype.hd_ticket_template.api import get_fields_meta
from helpdesk.helpdesk.doctype.hd_ticket_template.api import get_one as get_template
from helpdesk.utils import agent_only, check_permissions, get_customer, is_agent


@frappe.whitelist()
# flake8: noqa
def new(doc, attachments=[]):
    doc["doctype"] = "HD Ticket"
    doc["via_customer_portal"] = bool(frappe.session.user)
    doc["attachments"] = attachments
    d = frappe.get_doc(doc)
    
    # Ensure agent_group is set from category before insert
    # This ensures assignment hooks have agent_group available
    # Use fallback method directly to avoid import issues on deployed sites
    _set_agent_group_fallback(d)
    
    # Try to use pw_helpdesk function if available (for better logic)
    try:
        from pw_helpdesk.customizations.ticket_events import ensure_agent_group_from_category
        ensure_agent_group_from_category(d)
    except:
        # If import fails, fallback already set agent_group above
        pass
    
    d.insert()
    return d


def _set_agent_group_fallback(doc):
    """Fallback method to set agent_group - works without pw_helpdesk imports"""
    if doc.agent_group or not doc.custom_category:
        return
    
    try:
        # Try to get agent_group from category's SLA
        sla_agreements = frappe.db.sql("""
            SELECT DISTINCT parent, custom_auto_assign_team
            FROM `tabHD Category MultiSelect` cms
            JOIN `tabHD Service Level Agreement` sla ON cms.parent = sla.name
            WHERE cms.category = %s AND sla.enabled = 1
            ORDER BY sla.creation ASC
            LIMIT 1
        """, (doc.custom_category,), as_dict=True)
        
        if sla_agreements and sla_agreements[0].get("custom_auto_assign_team"):
            doc.agent_group = sla_agreements[0]["custom_auto_assign_team"]
            return
        
        # Try to get agent_group from SLA if doc has sla set
        if doc.sla:
            sla_team = frappe.db.get_value("HD Service Level Agreement", doc.sla, "custom_auto_assign_team")
            if sla_team:
                doc.agent_group = sla_team
                return
        
        # Fallback: Get first available active team
        teams = frappe.get_all("HD Team", filters={"is_active": 1}, limit=1, pluck="name")
        if teams:
            doc.agent_group = teams[0]
    except Exception:
        # Silently fail - assignment hooks will handle it
        pass


@frappe.whitelist()
def get_one(name, is_customer_portal=False):
    check_permissions("HD Ticket", None, doc=name)
    QBContact = frappe.qb.DocType("Contact")
    QBTicket = frappe.qb.DocType("HD Ticket")

    _is_agent = is_agent()

    query = (
        frappe.qb.from_(QBTicket)
        .select(QBTicket.star)
        .where(QBTicket.name == name)
        .limit(1)
    )

    if not _is_agent:
        query = query.where(get_customer_criteria())

    ticket = query.run(as_dict=True)
    if not len(ticket):
        frappe.throw(_("Ticket not found"), frappe.DoesNotExistError)
    ticket = ticket.pop()

    contact = (
        frappe.qb.from_(QBContact)
        .select(
            QBContact.company_name,
            QBContact.email_id,
            QBContact.image,
            QBContact.mobile_no,
            QBContact.name,
            QBContact.phone,
        )
        .where(QBContact.name == ticket.contact)
        .run(as_dict=True)
    )
    if contact:
        contact = contact[0]
    else:
        contact = {
            "email_id": ticket.raised_by,
            "name": ticket.raised_by.split("@")[0],
        }
    template = ticket.template or DEFAULT_TICKET_TEMPLATE
    return {
        **ticket,
        # Escalation timings are internal: agents only, never the customer portal.
        "escalation": get_ticket_escalation_status(ticket) if _is_agent else None,
        "comments": get_comments(name),
        "communications": get_communications(name),
        "contact": contact,
        "history": get_history(name),
        "tags": get_tags(name),
        "template": get_template(template),
        "views": get_views(name),
        "_form_script": get_form_script(
            "HD Ticket", is_customer_portal=is_customer_portal
        ),
        "fields": get_meta(template),
        # Drives the read-only state of the category fields in the sidebar
        "can_change_category": can_change_category(ticket),
    }


def get_meta(template: str):
    default_fields = ["ticket_type", "agent_group", "priority", "customer"]
    DocField = frappe.qb.DocType("DocField")

    fields = (
        frappe.qb.from_(DocField)
        .select(DocField.star)
        .where(DocField.parent == "HD Ticket")
        .where(DocField.fieldname.isin(default_fields))
        .run(as_dict=True)
    )
    meta_fields = get_fields_meta(template)
    meta_fields = [f for f in meta_fields if f["fieldname"] not in default_fields]

    fields.extend(meta_fields)
    # The category fields have a section of their own in the sidebar
    fields = [f for f in fields if f["fieldname"] not in CATEGORY_FIELDS]
    return fields


def get_customer_criteria():
    QBTicket = frappe.qb.DocType("HD Ticket")
    user = frappe.session.user
    conditions = [
        QBTicket.contact == user,
        QBTicket.raised_by == user,
        QBTicket.owner == user,
    ]
    customer = get_customer(user)
    for c in customer:
        conditions.append(QBTicket.customer == c)
    return Criterion.any(conditions)


def get_assignee(_assign: str):
    j = frappe.parse_json(_assign)
    if not j or len(j) < 1:
        return
    return get_user_info_for_avatar(j.pop())


def get_communications(ticket: str):
    QBCommunication = frappe.qb.DocType("Communication")
    communications = (
        frappe.qb.from_(QBCommunication)
        .select(
            QBCommunication.bcc,
            QBCommunication.cc,
            QBCommunication.content,
            QBCommunication.creation,
            QBCommunication.communication_date,
            QBCommunication.name,
            QBCommunication.sender,
            QBCommunication.recipients,
            QBCommunication.subject,
            QBCommunication.delivery_status,
        )
        .where(QBCommunication.reference_doctype == "HD Ticket")
        .where(QBCommunication.reference_name == ticket)
        .orderby(QBCommunication.creation, order=Order.asc)
        .run(as_dict=True)
    )
    for c in communications:
        c.attachments = get_attachments("Communication", c.name)
        c.user = get_user_info_for_avatar(c.sender)
    return communications


def get_comments(ticket: str):
    if not frappe.has_permission("HD Ticket Comment", "read"):
        return []
    QBComment = frappe.qb.DocType("HD Ticket Comment")
    comments = (
        frappe.qb.from_(QBComment)
        .select(
            QBComment.commented_by,
            QBComment.content,
            QBComment.creation,
            QBComment.is_pinned,
            QBComment.name,
        )
        .where(QBComment.reference_ticket == ticket)
        .orderby(QBComment.creation, order=Order.asc)
        .run(as_dict=True)
    )
    for c in comments:
        c.user = get_user_info_for_avatar(c.commented_by)
        c.attachments = get_attachments("HD Ticket Comment", c.name)
    return comments


def get_history(ticket: str):
    if not frappe.has_permission("HD Ticket Activity", "read"):
        return []
    QBActivity = frappe.qb.DocType("HD Ticket Activity")
    history = (
        frappe.qb.from_(QBActivity)
        .select(
            QBActivity.name, QBActivity.action, QBActivity.owner, QBActivity.creation
        )
        .where(QBActivity.ticket == str(ticket))
        .orderby(QBActivity.creation, order=Order.desc)
    )
    history = history.run(as_dict=True)
    for h in history:
        h.user = get_user_info_for_avatar(h.owner)
    return history


def get_views(ticket: str):
    QBViewLog = frappe.qb.DocType("View Log")
    views = (
        frappe.qb.from_(QBViewLog)
        .select(
            QBViewLog.creation,
            QBViewLog.name,
            QBViewLog.viewed_by,
        )
        .where(QBViewLog.reference_doctype == "HD Ticket")
        .where(QBViewLog.reference_name == ticket)
        .orderby(QBViewLog.creation, order=Order.desc)
        .run(as_dict=True)
    )
    for v in views:
        v.user = get_user_info_for_avatar(v.viewed_by)
    return views


def get_tags(ticket: str):
    QBTag = frappe.qb.DocType("Tag Link")
    rows = (
        frappe.qb.from_(QBTag)
        .select(QBTag.tag)
        .where(QBTag.document_type == "HD Ticket")
        .where(QBTag.document_name == ticket)
        .orderby(QBTag.creation, order=Order.asc)
        .run(as_dict=True)
    )
    res = []
    for tag in rows:
        res.append(tag.tag)
    return res


@redis_cache()
def get_attachments(doctype, name):
    QBFile = frappe.qb.DocType("File")

    return (
        frappe.qb.from_(QBFile)
        .select(QBFile.name, QBFile.file_url, QBFile.file_name)
        .where(QBFile.attached_to_doctype == doctype)
        .where(QBFile.attached_to_name == name)
        .run(as_dict=True)
    )


@frappe.whitelist()
@agent_only
def merge_ticket(source: int, target: int):
    # check if source and target exists
    if not frappe.db.exists("HD Ticket", source):
        frappe.throw(_("Source ticket does not exist"))
    if not frappe.db.exists("HD Ticket", target):
        frappe.throw(_("Target ticket does not exist"))
    if source == target:
        frappe.throw(_("Source and target ticket cannot be same"))

    controller = get_controller("HD Ticket")

    source_comments = frappe.db.get_list(
        "HD Ticket Comment", filters={"reference_ticket": source}, pluck="name"
    )
    duplicate_list_retain_timestamp(
        "HD Ticket Comment", source_comments, target, controller
    )

    source_communications = frappe.db.get_list(
        "Communication",
        filters={"reference_doctype": "HD Ticket", "reference_name": source},
        pluck="name",
    )
    duplicate_list_retain_timestamp(
        "Communication", source_communications, target, controller
    )

    source_attachments = frappe.db.get_list(
        "File",
        filters={"attached_to_doctype": "HD Ticket", "attached_to_name": source},
        pluck="name",
    )
    duplicate_list_retain_timestamp("File", source_attachments, target, controller)

    doc = frappe.get_doc("HD Ticket", source)

    doc.status = "Closed"
    doc.is_merged = 1
    doc.merged_with = target
    doc.save()

    message = _(
        "This ticket (#{0}) has been merged with ticket <a href = '/helpdesk/tickets/{1}'>#{1}</a>."
    ).format(source, target)
    controller.reply_via_agent(
        doc,
        message=message,
    )

    # comment in target ticket that
    c = frappe.new_doc("HD Ticket Comment")
    c.commented_by = frappe.session.user
    c.reference_ticket = target
    source_link = frappe.utils.get_url("/helpdesk/tickets/" + str(source))
    target_link = frappe.utils.get_url("/helpdesk/tickets/" + str(target))
    c.content = _(
        f"Ticket <a href={source_link}> #{source}</a>  has been merged with ticket #{target}."
    )
    c.save()


def duplicate_list_retain_timestamp(doctype, activities: list, target: int, controller):
    for activity in activities:
        attachments = get_attachments(
            "HD Ticket Comment",
            activity,
        )

        original_doc = frappe.get_doc(doctype, activity)

        duplicate_doc = frappe.copy_doc(original_doc)

        if doctype == "Communication":
            duplicate_doc.reference_name = target
            attachments = get_attachments(
                "Communication",
                activity,
            )

        elif doctype == "HD Ticket Comment":
            duplicate_doc.reference_ticket = target
            attachments = get_attachments(
                "Communication",
                activity,
            )

        elif doctype == "File":
            duplicate_doc.attached_to_name = target

        duplicate_doc.insert(ignore_permissions=True)

        if doctype == "File":
            return

        attachments = get_attachments(
            doctype,
            activity,
        )
        for attachment in attachments:
            controller.attach_file_with_doc(
                duplicate_doc, doctype, duplicate_doc.name, attachment["file_url"]
            )

        frappe.db.set_value(
            duplicate_doc.doctype,
            duplicate_doc.name,
            {
                "creation": original_doc.creation,
                "modified": original_doc.modified,
                "owner": original_doc.owner,
                "modified_by": original_doc.modified_by,
            },
            update_modified=False,
        )


@frappe.whitelist()
@agent_only
def split_ticket(subject: str, communication_id: str):

    communicaton_creation_time = frappe.db.get_value(
        "Communication", communication_id, "creation"
    )

    ticket_id = frappe.db.get_value("Communication", communication_id, "reference_name")
    ticket_doc = frappe.get_doc("HD Ticket", ticket_id)
    new_ticket = duplicate_ticket(ticket_doc, subject)

    # update emails
    frappe.db.set_value(
        "Communication",
        {
            "reference_doctype": "HD Ticket",
            "reference_name": ticket_id,
            "creation": [">=", communicaton_creation_time],
        },
        "reference_name",
        new_ticket,
        update_modified=False,
    )

    # update comments
    frappe.db.set_value(
        "HD Ticket Comment",
        {
            "reference_ticket": ticket_id,
            "creation": [">=", communicaton_creation_time],
        },
        "reference_ticket",
        new_ticket,
        update_modified=False,
    )

    # update activities
    frappe.db.set_value(
        "HD Ticket Activity",
        {
            "ticket": ticket_id,
            "creation": [">=", communicaton_creation_time],
        },
        "ticket",
        new_ticket,
        update_modified=False,
    )

    # update attachments
    frappe.db.set_value(
        "File",
        {
            "attached_to_doctype": "HD Ticket",
            "attached_to_name": ticket_id,
            "creation": [">=", communicaton_creation_time],
        },
        "attached_to_name",
        new_ticket,
        update_modified=False,
    )

    new_ticket_link = frappe.utils.get_url("/helpdesk/tickets/" + str(new_ticket))

    controller = get_controller("HD Ticket")
    controller.reply_via_agent(
        ticket_doc,
        message=_(
            "This ticket has been split to a new ticket. Please follow up on ticket <a href={0}>#{1}</a>."
        ).format(new_ticket_link, new_ticket),
    )

    # Email on the old ticket that it has been split to new_ticket
    return new_ticket


def duplicate_ticket(ticket_doc, subject):
    from copy import deepcopy

    new_ticket = deepcopy(ticket_doc)
    new_ticket.subject = subject
    new_ticket.status = "Open"
    new_ticket.ticket_split_from = ticket_doc.name
    new_ticket.description = None
    new_ticket.first_response_time = 0
    new_ticket.first_responded_on = None

    new_ticket.creation = now_datetime()
    new_ticket.opening_date = frappe.utils.nowdate()
    new_ticket.opening_time = frappe.utils.nowtime()

    new_ticket.is_merged = 0
    new_ticket.merged_with = None

    if new_ticket.sla:
        new_ticket.sla = None
        new_ticket.agreement_status = "First Response Due"
        new_ticket.resolution_by = None
        new_ticket.service_level_agreement_creation = now_datetime()
        new_ticket.on_hold_since = None
        new_ticket.total_hold_time = None
        new_ticket.response_by = None
        new_ticket.response_date = None
        new_ticket.resolution_date = None
        new_ticket.resolution_time = None
        new_ticket.user_resolution_time = None

    new_ticket.insert(ignore_permissions=True)

    return new_ticket.name
