import json

import frappe
from frappe import _

from helpdesk.api.category import hidden_categories_for_user

SLA_DOCTYPE = "HD Service Level Agreement"
SLA_LIST_FIELDS = ["name", "default_sla", "enabled", "description"]


# ---------------------------------------------------------------------------
# Helpers: resolve the Team <-> Assignment Rule <-> User relationships
# ---------------------------------------------------------------------------
def _teams_for_user(user):
	"""Return the set of HD Team names a user belongs to.

	A user is considered part of a team when EITHER:
	  * the user is listed in the team's own members (``HD Team.users`` ->
	    ``HD Team Member.user``), OR
	  * the user is listed in the Assignment Rule the team links to
	    (``HD Team.assignment_rule`` -> ``Assignment Rule.users`` ->
	    ``Assignment Rule User.user``).
	"""
	if not user:
		return set()

	teams = set()

	# 1) Direct team membership.
	teams.update(
		frappe.get_all(
			"HD Team Member",
			filters={"parenttype": "HD Team", "user": user},
			pluck="parent",
		)
	)

	# 2) Membership via the team's Assignment Rule.
	rules = frappe.get_all(
		"Assignment Rule User",
		filters={"parenttype": "Assignment Rule", "user": user},
		pluck="parent",
	)
	if rules:
		teams.update(
			frappe.get_all(
				"HD Team",
				filters={"assignment_rule": ["in", list(set(rules))]},
				pluck="name",
			)
		)

	return teams


def _users_for_team(team):
	"""Return the set of user emails attached to a team (members + rule users)."""
	if not team:
		return set()

	users = set(
		frappe.get_all(
			"HD Team Member",
			filters={"parenttype": "HD Team", "parent": team},
			pluck="user",
		)
	)

	assignment_rule = frappe.db.get_value("HD Team", team, "assignment_rule")
	if assignment_rule:
		users.update(
			frappe.get_all(
				"Assignment Rule User",
				filters={"parenttype": "Assignment Rule", "parent": assignment_rule},
				pluck="user",
			)
		)

	return {u for u in users if u}


def _sla_references_field(sla, fieldname, value):
	"""True if an SLA's condition targets ``fieldname == value``.

	SLAs do not link to a Team / Category directly -- they reference them
	inside their filter condition. We check both the structured
	``condition_json`` (a list of ``{fieldname, operator, value}`` rows) and
	the raw ``condition`` Python expression so either authoring path matches.

	  * team          -> ``agent_group``
	  * category       -> ``custom_category``
	  * sub_category   -> ``custom_sub_category``
	"""
	if not value:
		return False

	# Structured condition first -- most precise.
	if sla.get("condition_json"):
		try:
			for row in json.loads(sla["condition_json"]) or []:
				if row.get("fieldname") != fieldname:
					continue
				row_value = row.get("value")
				if isinstance(row_value, (list, tuple)):
					if value in row_value:
						return True
				elif row_value == value:
					return True
		except (json.JSONDecodeError, TypeError):
			pass

	# Fall back to the raw expression (e.g. ``agent_group == "Support"``).
	condition = sla.get("condition") or ""
	if fieldname in condition and value in condition:
		return True

	return False


# ---------------------------------------------------------------------------
# SLA list API  (mirrors frappe.client.get_list, adds team / user filters)
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
	(``name``, ``default_sla``, ``enabled``, ``description``). All of the
	following filters are optional and combine with AND -- an SLA must satisfy
	every supplied filter to be returned:

	  * ``user``          -- SLAs for teams this user belongs to, where
	    membership is resolved through the team's Assignment Rule (and direct
	    team members). This is the "users defined in assignment rule" filter.
	  * ``team``          -- SLAs whose condition targets this HD Team
	    (``agent_group``).
	  * ``category``      -- SLAs whose condition targets this category
	    (``custom_category``).
	  * ``sub_category``  -- SLAs whose condition targets this sub-category
	    (``custom_sub_category``).

	``filters`` (dict or JSON string) is passed straight through to the query
	for any standard field filtering (e.g. ``{"enabled": 1}``).
	"""
	if isinstance(filters, str):
		filters = frappe.parse_json(filters) or {}
	filters = filters or {}

	# Pull every SLA matching the plain field filters, plus the condition
	# columns we need to evaluate the team/user/category filters.
	rows = frappe.get_all(
		SLA_DOCTYPE,
		filters=filters,
		fields=SLA_LIST_FIELDS + ["condition", "condition_json", "creation"],
		order_by=order_by,
	)

	# user -> the set of teams to restrict to (via Assignment Rule + members).
	if user:
		user_teams = _teams_for_user(user)
		if not user_teams:
			return []
		rows = [
			r for r in rows if any(_sla_references_field(r, "agent_group", t) for t in user_teams)
		]

	# Direct condition-field filters. Each is independent and ANDs with the rest.
	for fieldname, value in (
		("agent_group", team),
		("custom_category", category),
		("custom_sub_category", sub_category),
	):
		if value:
			rows = [r for r in rows if _sla_references_field(r, fieldname, value)]

	# Trim to the public field set and apply pagination.
	limit_start = int(limit_start or 0)
	limit_page_length = int(limit_page_length or 0)
	if limit_page_length:
		rows = rows[limit_start : limit_start + limit_page_length]
	else:
		rows = rows[limit_start:]

	return [{f: r.get(f) for f in SLA_LIST_FIELDS} for r in rows]


@frappe.whitelist()
def get_sla_team_users(team):
	"""Return the users attached to a team (members + its Assignment Rule)."""
	return sorted(_users_for_team(team))


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
