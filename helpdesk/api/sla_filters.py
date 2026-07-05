import json

import frappe
from frappe import _

from helpdesk.api.category import hidden_categories_for_user

SLA_DOCTYPE = "HD Service Level Agreement"
SLA_LIST_FIELDS = ["name", "default_sla", "enabled", "description"]


# ---------------------------------------------------------------------------
# Condition matching (category / sub-category live inside condition_json)
# ---------------------------------------------------------------------------
def _condition_matches(node, fieldname, value):
	"""Recursively test a ``condition_json`` node for ``fieldname == value``.

	The structure is a nested list, e.g.::

	    [["custom_category", "==", "HW"], "and", ["custom_sub_category", "==", "Laptop"]]

	where each leaf is a ``[fieldname, operator, value]`` triple, conjunctions
	are bare strings (``"and"`` / ``"or"``) and groups are nested lists. We walk
	the whole tree so a match at any depth counts.
	"""
	if not isinstance(node, list):
		# Conjunction string or scalar -- nothing to match.
		return False

	# Leaf triple: [fieldname, operator, value] with a string fieldname.
	if len(node) == 3 and isinstance(node[0], str):
		if node[0] != fieldname:
			return False
		row_value = node[2]
		if isinstance(row_value, (list, tuple)):
			return value in row_value
		return row_value == value

	# Otherwise it's a group/container -- recurse into its children.
	return any(_condition_matches(child, fieldname, value) for child in node)


def _sla_condition_references(sla, fieldname, value):
	"""True if an SLA's ``condition_json`` targets ``fieldname == value``.

	Category and sub-category are not stored as columns on the SLA -- they live
	inside the filter condition, so we parse ``condition_json`` (and fall back to
	the raw ``condition`` expression).

	  * category       -> ``custom_category``
	  * sub_category   -> ``custom_sub_category``
	"""
	if not value:
		return False

	if sla.get("condition_json"):
		try:
			if _condition_matches(json.loads(sla["condition_json"]), fieldname, value):
				return True
		except (json.JSONDecodeError, TypeError):
			pass

	# Fall back to the raw expression (e.g. ``custom_category == "HW"``).
	condition = sla.get("condition") or ""
	if fieldname in condition and value in condition:
		return True

	return False


# ---------------------------------------------------------------------------
# SLA list API  (mirrors frappe.client.get_list, adds helpdesk filters)
# ---------------------------------------------------------------------------
@frappe.whitelist()
def get_sla_list(
	user=None,
	team=None,
	category=None,
	sub_category=None,
	filters=None,
	order_by="creation desc",
	limit_start=0,
	limit_page_length=999,
):
	"""List ``HD Service Level Agreement`` records with all helpdesk filters.

	Returns the same fields as the desk ``frappe.client.get_list`` call
	(``name``, ``default_sla``, ``enabled``, ``description``). Every filter is
	optional and they combine with AND:

	  * ``team``          -> SLA field ``custom_auto_assign_team`` (Link HD Team).
	  * ``user``          -> SLAs whose ``custom_assignment_rule`` (Link
	    Assignment Rule) lists this user in its ``users`` table. This is the
	    "users defined in assignment rule" filter.
	  * ``category``      -> ``custom_category`` inside ``condition_json``.
	  * ``sub_category``  -> ``custom_sub_category`` inside ``condition_json``.

	``filters`` (dict or JSON string) is passed straight through for any other
	standard field filtering (e.g. ``{"enabled": 1}``).
	"""
	if isinstance(filters, str):
		filters = frappe.parse_json(filters) or {}
	filters = dict(filters or {})

	# team -> direct Link field on the SLA.
	if team:
		filters["custom_auto_assign_team"] = team

	# user -> the Assignment Rules that list this user, then SLAs pointing at them.
	if user:
		rules = frappe.get_all(
			"Assignment Rule User",
			filters={"parenttype": "Assignment Rule", "user": user},
			pluck="parent",
		)
		rules = list(set(rules))
		if not rules:
			return []
		filters["custom_assignment_rule"] = ["in", rules]

	# DB-level filters (team, user, plus any caller-supplied field filters).
	rows = frappe.get_all(
		SLA_DOCTYPE,
		filters=filters,
		fields=SLA_LIST_FIELDS + ["condition", "condition_json"],
		order_by=order_by,
	)

	# category / sub_category -> matched against condition_json in Python.
	for fieldname, value in (
		("custom_category", category),
		("custom_sub_category", sub_category),
	):
		if value:
			rows = [r for r in rows if _sla_condition_references(r, fieldname, value)]

	# Trim to the public field set and apply pagination.
	limit_start = int(limit_start or 0)
	limit_page_length = int(limit_page_length or 0)
	if limit_page_length:
		rows = rows[limit_start : limit_start + limit_page_length]
	else:
		rows = rows[limit_start:]

	return [{f: r.get(f) for f in SLA_LIST_FIELDS} for r in rows]


@frappe.whitelist()
def get_assignment_rule_users(assignment_rule):
	"""Return the users listed in an Assignment Rule's ``users`` table."""
	if not assignment_rule:
		return []
	return frappe.get_all(
		"Assignment Rule User",
		filters={"parenttype": "Assignment Rule", "parent": assignment_rule},
		pluck="user",
	)


# ---------------------------------------------------------------------------
# Category / sub-category APIs  (HD Ticket custom_category & custom_sub_category)
# ---------------------------------------------------------------------------
CATEGORY_FIELDS = ["name", "category_name", "category_code", "description"]


@frappe.whitelist()
def get_categories():
	"""Return active parent categories for the ``custom_category`` field."""
	hidden = hidden_categories_for_user()
	categories = frappe.get_all(
		"HD Category",
		filters={"is_active": 1, "is_sub_category": 0},
		fields=CATEGORY_FIELDS,
		order_by="category_name asc",
	)
	return [c for c in categories if c["name"] not in hidden]


@frappe.whitelist()
def get_sub_categories(custom_category=None):
	"""Return active sub-categories for the ``custom_sub_category`` field.

	``custom_category`` is the selected parent category (HD Ticket's
	``custom_category``). When omitted, returns every visible sub-category.
	"""
	hidden = hidden_categories_for_user()
	if custom_category and custom_category in hidden:
		return []

	filters = {"is_active": 1, "is_sub_category": 1}
	if custom_category:
		filters["parent_category"] = custom_category

	sub_categories = frappe.get_all(
		"HD Category",
		filters=filters,
		fields=CATEGORY_FIELDS + ["parent_category"],
		order_by="category_name asc",
	)
	return [c for c in sub_categories if c["name"] not in hidden]
