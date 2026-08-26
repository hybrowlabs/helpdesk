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


CATEGORY_FIELD = "custom_category"
SUB_CATEGORY_FIELD = "custom_sub_category"


def _collect_condition_values(node, fieldname, found):
    """Collect every value ``fieldname`` is compared against in a condition tree.

    ``condition_json`` nests as ``[[field, op, value], "and", [...]]``, so walk
    the whole tree and pick up leaves at any depth.
    """
    if not isinstance(node, list):
        return

    # Leaf triple: [fieldname, operator, value] with a string fieldname.
    if len(node) == 3 and isinstance(node[0], str):
        if node[0] == fieldname:
            value = node[2]
            if isinstance(value, (list, tuple)):
                found.update(item for item in value if item)
            elif value:
                found.add(value)
        return

    for child in node:
        _collect_condition_values(child, fieldname, found)


def get_sla_category_pairs(sla):
    """Return the ``(category, sub_category)`` pairs an SLA targets.

    Two sources feed this: the category/sub-category filters inside
    ``condition_json``, and the ``custom_applicable_categories`` table. A
    category with no sub-category is paired with ``None``, which is a distinct
    target from the same category narrowed to one sub-category.
    """
    categories, sub_categories = set(), set()

    condition_json = sla.get("condition_json")
    if condition_json:
        try:
            tree = json.loads(condition_json)
        except (json.JSONDecodeError, TypeError):
            tree = None
        if tree:
            _collect_condition_values(tree, CATEGORY_FIELD, categories)
            _collect_condition_values(tree, SUB_CATEGORY_FIELD, sub_categories)

    pairs = set()
    for category in categories:
        if sub_categories:
            pairs.update((category, sub) for sub in sub_categories)
        else:
            pairs.add((category, None))

    # A sub-category named without its parent still identifies one target.
    if sub_categories and not categories:
        for sub in sub_categories:
            parent = frappe.db.get_value("HD Category", sub, "parent_category")
            pairs.add((parent, sub))

    for selected in get_applicable_categories(sla):
        is_sub, parent = frappe.db.get_value(
            "HD Category", selected, ["is_sub_category", "parent_category"]
        ) or (0, None)
        if is_sub:
            pairs.add((parent, selected))
        else:
            pairs.add((selected, None))

    return pairs


def get_applicable_categories(sla):
    """Return category names from ``custom_applicable_categories``."""
    rows = sla.get("custom_applicable_categories") or []
    categories = []
    for row in rows:
        category = row.get("category") if isinstance(row, dict) else getattr(row, "category", None)
        if category:
            categories.append(category)
    return categories


def find_duplicate_sla_category(sla, exclude_name=None):
    """Return ``(sla_name, category, sub_category)`` for the first clash found.

    Another SLA targeting the same category and sub-category is ambiguous:
    ``get_sla`` picks the first matching policy, so which one applies to a
    ticket would come down to ordering.
    """
    pairs = get_sla_category_pairs(sla)
    if not pairs:
        return None

    filters = {"name": ["!=", exclude_name]} if exclude_name else {}
    others = frappe.get_all(
        "HD Service Level Agreement",
        filters=filters,
        fields=["name", "condition_json"],
    )
    if not others:
        return None

    selections = frappe.get_all(
        "HD Category Selection",
        filters={
            "parenttype": "HD Service Level Agreement",
            "parent": ["in", [other.name for other in others]],
        },
        fields=["parent", "category"],
    )
    by_parent = {}
    for row in selections:
        by_parent.setdefault(row.parent, []).append({"category": row.category})

    for other in others:
        other["custom_applicable_categories"] = by_parent.get(other.name, [])
        clash = pairs & get_sla_category_pairs(other)
        if clash:
            category, sub_category = sorted(clash, key=lambda pair: (pair[0] or "", pair[1] or ""))[0]
            return other.name, category, sub_category

    return None


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


def get_writable_fields():
    """Fieldnames the portal is allowed to write, child tables included."""
    from frappe.model import no_value_fields

    meta = frappe.get_meta("HD Service Level Agreement")
    fields = set()
    for df in meta.fields:
        if df.fieldtype in ("Table", "Table MultiSelect"):
            fields.add(df.fieldname)
        elif df.fieldtype not in no_value_fields:
            fields.add(df.fieldname)
    return fields


@frappe.whitelist(methods=["POST"])
def save_sla(data, docname=None):
    """Create or update an SLA policy from the portal.

    The portal edits the whole policy in one form, so it needs a single write
    that covers custom fields and child tables (priorities, working hours,
    escalation levels) rather than a per-field set_value.
    """
    data = frappe.parse_json(data)
    writable = get_writable_fields()

    if docname:
        doc = frappe.get_doc("HD Service Level Agreement", docname)
    else:
        doc = frappe.new_doc("HD Service Level Agreement")

    for fieldname, value in data.items():
        if fieldname in writable:
            doc.set(fieldname, value)

    if docname:
        doc.save()
    else:
        doc.insert()

    return doc
