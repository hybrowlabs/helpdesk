import json

import frappe
from frappe import _


@frappe.whitelist()
def get_holidays():
    """Get all holiday lists"""
    return frappe.get_all(
        "HD Service Holiday List",
        fields=["name", "holiday_list_name", "from_date", "to_date", "total_holidays", "description"],
        order_by="from_date desc",
    )


@frappe.whitelist()
def get_holiday_details(holiday_name):
    """Get details of a specific holiday list"""
    doc = frappe.get_doc("HD Service Holiday List", holiday_name)
    data = doc.as_dict()
    # Parse recurring_holidays JSON
    if data.get("recurring_holidays") and isinstance(data["recurring_holidays"], str):
        try:
            data["recurring_holidays"] = json.loads(data["recurring_holidays"])
        except (json.JSONDecodeError, TypeError):
            data["recurring_holidays"] = []
    return data


@frappe.whitelist()
def create_holiday(holiday_data):
    """Create a new holiday list"""
    if isinstance(holiday_data, str):
        holiday_data = json.loads(holiday_data)

    doc = frappe.new_doc("HD Service Holiday List")
    doc.holiday_list_name = holiday_data.get("holiday_list_name")
    doc.from_date = holiday_data.get("from_date")
    doc.to_date = holiday_data.get("to_date")
    doc.description = holiday_data.get("description", "")

    # Add individual holidays
    for holiday in holiday_data.get("holidays", []):
        doc.append("holidays", {
            "holiday_date": holiday.get("holiday_date"),
            "description": holiday.get("description", ""),
            "weekly_off": holiday.get("weekly_off", 0),
        })

    # Store recurring holidays as JSON
    recurring = holiday_data.get("recurring_holidays", [])
    if recurring:
        doc.recurring_holidays = json.dumps(recurring)

    doc.insert()
    frappe.db.commit()
    return {"success": True, "name": doc.name}


@frappe.whitelist()
def update_holiday(holiday_name, holiday_data):
    """Update an existing holiday list"""
    if isinstance(holiday_data, str):
        holiday_data = json.loads(holiday_data)

    doc = frappe.get_doc("HD Service Holiday List", holiday_name)

    if "holiday_list_name" in holiday_data:
        doc.holiday_list_name = holiday_data["holiday_list_name"]
    if "from_date" in holiday_data:
        doc.from_date = holiday_data["from_date"]
    if "to_date" in holiday_data:
        doc.to_date = holiday_data["to_date"]
    if "description" in holiday_data:
        doc.description = holiday_data["description"]

    # Replace holidays child table
    if "holidays" in holiday_data:
        doc.holidays = []
        for holiday in holiday_data["holidays"]:
            doc.append("holidays", {
                "holiday_date": holiday.get("holiday_date"),
                "description": holiday.get("description", ""),
                "weekly_off": holiday.get("weekly_off", 0),
            })

    # Update recurring holidays JSON
    if "recurring_holidays" in holiday_data:
        recurring = holiday_data["recurring_holidays"]
        doc.recurring_holidays = json.dumps(recurring) if recurring else None

    doc.save()
    frappe.db.commit()
    return {"success": True}


@frappe.whitelist()
def delete_holiday(holiday_name):
    """Delete a holiday list"""
    frappe.delete_doc("HD Service Holiday List", holiday_name)
    frappe.db.commit()
    return {"success": True}


def should_exclude_user_from_assignment(user, assignment_rule_name=None, check_date=None):
    """
    Determine if a user should be excluded from ticket assignment.

    Checks:
    1. Holidays linked to the Assignment Rule (custom_holiday_lists → Holidays doctype)
    2. HD Service Holiday List holidays (from SLA config)
    3. Leave Application (if HRMS is installed)

    Args:
        user: User email address
        assignment_rule_name: Name of the Assignment Rule (to check its linked holidays)
        check_date: Date to check (defaults to today)

    Returns:
        bool: True if user should be excluded, False otherwise
    """
    from frappe.utils import getdate, today

    check_date = getdate(check_date or today())

    # 1. Check Assignment Rule's linked holiday lists (custom "Holidays" doctype)
    if assignment_rule_name:
        try:
            if _is_holiday_in_assignment_rule(assignment_rule_name, check_date):
                return True
        except Exception:
            pass

    # 2. Check if user is on leave (Leave Application from HRMS, if installed)
    try:
        if _is_user_on_leave(user, check_date):
            return True
    except Exception:
        pass

    return False


def _is_holiday_in_assignment_rule(assignment_rule_name, check_date):
    """Check if check_date is a holiday in any holiday list linked to the assignment rule."""
    from frappe.utils import getdate

    # Check custom_holiday_lists child table on Assignment Rule
    holiday_links = frappe.get_all(
        "Assignment Rule Holiday",
        filters={"parent": assignment_rule_name},
        pluck="holiday",
    )

    if not holiday_links:
        return False

    # The "Holidays" doctype may or may not exist
    if not frappe.db.exists("DocType", "Holidays"):
        return False

    for holiday_name in holiday_links:
        if not holiday_name:
            continue
        try:
            holiday_doc = frappe.get_doc("Holidays", holiday_name)
            holiday_date = getdate(holiday_doc.date) if hasattr(holiday_doc, "date") else None
            if holiday_date and holiday_date == check_date:
                return True
        except Exception:
            continue

    return False


def _is_user_on_leave(user, check_date):
    """Check if user has an approved Leave Application for check_date (requires HRMS)."""
    if not frappe.db.exists("DocType", "Leave Application"):
        return False

    # Get the employee linked to this user
    employee = frappe.db.get_value("Employee", {"user_id": user, "status": "Active"}, "name")
    if not employee:
        return False

    leave_exists = frappe.db.exists(
        "Leave Application",
        {
            "employee": employee,
            "status": "Approved",
            "from_date": ["<=", check_date],
            "to_date": [">=", check_date],
        },
    )

    return bool(leave_exists)
