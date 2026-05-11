import json

import frappe


def _normalize_conditions(conditions):
    """Return a canonical JSON string for condition_json comparisons."""
    return json.dumps(conditions or [], sort_keys=True, separators=(",", ":"))


def _normalize_schedule(schedule):
    """Return a canonical representation of support_and_resolution rows for comparison."""
    normalized = [
        {"workday": r.get("workday", ""), "start_time": str(r.get("start_time", ""))[:8], "end_time": str(r.get("end_time", ""))[:8]}
        for r in schedule
    ]
    return json.dumps(sorted(normalized, key=lambda x: x["workday"]), sort_keys=True)


def find_duplicate_sla_condition(condition_json, support_and_resolution, exclude_name=None):
    """Return the duplicate SLA name if the same conditions and schedule already exist."""
    if isinstance(condition_json, str):
        new_conditions = json.loads(condition_json)
    else:
        new_conditions = condition_json

    if not new_conditions:
        return None

    normalized_new_conditions = _normalize_conditions(new_conditions)

    if isinstance(support_and_resolution, str):
        new_schedule = json.loads(support_and_resolution)
    else:
        new_schedule = support_and_resolution or []

    normalized_new_schedule = _normalize_schedule(new_schedule)

    filters = {}
    if exclude_name:
        filters["name"] = ["!=", exclude_name]

    all_slas = frappe.get_all(
        "HD Service Level Agreement",
        filters=filters,
        fields=["name", "condition_json"],
    )

    for sla in all_slas:
        if not sla.condition_json:
            continue
        try:
            normalized_existing_conditions = _normalize_conditions(
                json.loads(sla.condition_json)
            )
        except (json.JSONDecodeError, TypeError):
            continue

        if normalized_new_conditions != normalized_existing_conditions:
            continue

        existing_schedule = frappe.get_all(
            "HD Service Day",
            filters={"parent": sla.name},
            fields=["workday", "start_time", "end_time"],
        )
        if normalized_new_schedule == _normalize_schedule(existing_schedule):
            return sla.name

    return None


@frappe.whitelist()
def check_duplicate_sla_condition(condition_json, support_and_resolution, exclude_name=None):
    """Check if another SLA policy with identical condition_json AND support_and_resolution exists."""
    try:
        duplicate_name = find_duplicate_sla_condition(
            condition_json, support_and_resolution, exclude_name
        )
        return {"exists": bool(duplicate_name), "name": duplicate_name}
    except Exception as e:
        frappe.log_error(f"Error checking duplicate SLA condition: {str(e)}")
        return {"exists": False, "name": None}


@frappe.whitelist()
def duplicate_sla(docname, new_name):
    doc = frappe.get_doc("HD Service Level Agreement", docname)
    doc.name = ""
    doc.service_level = new_name
    doc.default_sla = False
    doc.insert()
    return doc


@frappe.whitelist()
def get_sla(docname):
    sla = frappe.get_doc("HD Service Level Agreement", docname)
    return sla
