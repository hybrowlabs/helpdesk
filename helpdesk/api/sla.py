import json

import frappe


def _normalize_schedule(schedule):
    """Return a canonical representation of support_and_resolution rows for comparison."""
    normalized = [
        {"workday": r.get("workday", ""), "start_time": str(r.get("start_time", ""))[:8], "end_time": str(r.get("end_time", ""))[:8]}
        for r in schedule
    ]
    return json.dumps(sorted(normalized, key=lambda x: x["workday"]), sort_keys=True)


@frappe.whitelist()
def check_duplicate_sla_condition(condition_json, support_and_resolution, exclude_name=None):
    """Check if another SLA policy with identical condition_json AND support_and_resolution exists."""
    try:
        # Parse condition_json
        if isinstance(condition_json, str):
            new_conditions = json.loads(condition_json)
        else:
            new_conditions = condition_json

        # Empty assignment conditions skip the condition_json match (default SLA scenario)
        if not new_conditions:
            return {"exists": False, "name": None}

        normalized_new_conditions = json.dumps(new_conditions, sort_keys=True)

        # Parse support_and_resolution
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
                normalized_existing_conditions = json.dumps(
                    json.loads(sla.condition_json), sort_keys=True
                )
            except (json.JSONDecodeError, TypeError):
                continue

            if normalized_new_conditions != normalized_existing_conditions:
                continue

            # Conditions match — now check schedule
            existing_schedule = frappe.get_all(
                "HD Service Day",
                filters={"parent": sla.name},
                fields=["workday", "start_time", "end_time"],
            )
            if normalized_new_schedule == _normalize_schedule(existing_schedule):
                return {"exists": True, "name": sla.name}

        return {"exists": False, "name": None}
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
