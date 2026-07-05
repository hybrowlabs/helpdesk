import json

import frappe


def _normalize_conditions(conditions):
    """Return a canonical JSON string for condition_json comparisons."""
    return json.dumps(conditions or [], sort_keys=True, separators=(",", ":"))


def find_duplicate_sla_condition(condition_json, support_and_resolution=None, exclude_name=None):
    """Return the duplicate SLA name if the same conditions already exist.

    Matching is keyed on ``condition_json`` alone. ``support_and_resolution``
    (working hours) is intentionally ignored: ``get_sla`` selects the first SLA
    whose condition matches and never considers working hours, so two SLAs with
    the same condition are ambiguous regardless of their schedules.
    """
    if isinstance(condition_json, str):
        new_conditions = json.loads(condition_json)
    else:
        new_conditions = condition_json

    if not new_conditions:
        return None

    normalized_new_conditions = _normalize_conditions(new_conditions)

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

        if normalized_new_conditions == normalized_existing_conditions:
            return sla.name

    return None


@frappe.whitelist()
def check_duplicate_sla_condition(condition_json, support_and_resolution, exclude_name=None):
    """Check if another SLA policy with identical condition_json exists."""
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
