import frappe
from frappe import _


def hidden_categories_for_user(user=None):
    """Return the set of HD Category names this user must NOT see.

    Visibility rule (see HD Category `user_assignment`):
      * A category with one or more User Assignments (Dynamic User Assignment)
        is visible only to the users those assignments resolve to, via
        `Assigned Users.user_id`.
      * A category with no User Assignment stays visible to everyone.
      * A sub-category under a hidden parent is hidden too.
      * No role bypass -- a restricted category is shown only to assigned users.

    Used by every HD Category get API below AND by the
    permission_query_conditions hook, so all read paths agree.
    """
    user = user or frappe.session.user

    # The assignment child table is provided by pw_helpdesk. If it isn't
    # installed, nothing is restricted (fail-open = visible to all).
    if not frappe.db.table_exists("HD Category User Assignment"):
        return set()

    # Raw SQL on purpose: frappe.get_all drops the child Link field
    # `dynamic_user_assignment` from results, so query the table directly.
    links = frappe.db.sql(
        """SELECT parent, dynamic_user_assignment
           FROM `tabHD Category User Assignment`
           WHERE parenttype = 'HD Category' AND dynamic_user_assignment IS NOT NULL""",
        as_dict=True,
    )
    if not links:
        return set()

    my_assignments = set(
        frappe.db.sql_list(
            """SELECT DISTINCT parent FROM `tabAssigned Users`
               WHERE parenttype = 'Dynamic User Assignment' AND user_id = %s""",
            (user,),
        )
    )

    restricted = {l.parent for l in links}
    visible = {l.parent for l in links if l.dynamic_user_assignment in my_assignments}
    hidden = restricted - visible
    if not hidden:
        return hidden

    # Cascade the restriction down to sub-categories of hidden parents.
    frontier = set(hidden)
    while frontier:
        names_sql = ", ".join(frappe.db.escape(n) for n in frontier)
        children = set(
            frappe.db.sql_list(
                f"""SELECT name FROM `tabHD Category`
                    WHERE is_sub_category = 1 AND parent_category IN ({names_sql})"""
            )
        )
        new_hidden = children - hidden - visible
        if not new_hidden:
            break
        hidden |= new_hidden
        frontier = new_hidden

    return hidden


def get_permission_query_conditions(user=None):
    """permission_query_conditions hook for HD Category.

    Covers read paths that go through frappe.get_list / frappe.client.get_list
    (desk list view, Link fields, and the pw_helpdesk HD Ticket form script).
    The api functions below use frappe.get_all (which ignores this hook), so
    they filter explicitly via hidden_categories_for_user.
    """
    hidden = hidden_categories_for_user(user)
    if not hidden:
        return ""
    names_sql = ", ".join(frappe.db.escape(n) for n in hidden)
    return f"`tabHD Category`.`name` not in ({names_sql})"


@frappe.whitelist()
def get_categories():
    """Return only categories that have at least one subcategory"""
    try:
        hidden = hidden_categories_for_user()

        # Get all parent_category values from subcategories
        parent_categories = frappe.get_all(
            "HD Category",
            filters={
                "is_active": 1,
                "is_sub_category": 1
            },
            pluck="parent_category"
        )

        # Remove duplicates and any the user isn't allowed to see
        parent_categories = [c for c in set(parent_categories) if c and c not in hidden]

        if not parent_categories:
            return []

        # Fetch only those categories
        categories = frappe.get_all(
            "HD Category",
            filters={
                "is_active": 1,
                "is_sub_category": 0,
                "name": ["in", parent_categories]
            },
            fields=[
                "name", "category_name", "category_code", "description",
                "make_attachment_mandatory",
                "same_attachment_setting_as_category",
                "hide_attachment_field"
            ],
            order_by="category_name asc"
        )

        return [c for c in categories if c["name"] not in hidden]

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Get Categories Error")
        return []


@frappe.whitelist()
def get_subcategories(parent_category):
    """Get subcategories for a specific parent category"""
    try:
        if not parent_category:
            return []

        hidden = hidden_categories_for_user()
        # If the parent itself is hidden, none of its sub-categories are visible.
        if parent_category in hidden:
            return []

        subcategories = frappe.get_all(
            "HD Category",
            filters={
                "is_active": 1,
                "is_sub_category": 1,
                "parent_category": parent_category
            },
            fields=["name", "category_name", "category_code", "description",
                    "make_attachment_mandatory", "same_attachment_setting_as_category", "hide_attachment_field"],
            order_by="category_name asc"
        )

        return [c for c in subcategories if c["name"] not in hidden]
    except Exception as e:
        frappe.log_error(f"Error fetching subcategories: {str(e)}")
        return []


@frappe.whitelist()
def get_category_hierarchy():
    """Get complete category hierarchy as a tree structure"""
    try:
        hidden = hidden_categories_for_user()

        # Get all active categories the user is allowed to see
        all_categories = frappe.get_all(
            "HD Category",
            filters={"is_active": 1},
            fields=[
                "name", "category_name", "category_code",
                "description", "is_sub_category", "parent_category"
            ],
            order_by="is_sub_category asc, category_name asc"
        )
        all_categories = [c for c in all_categories if c["name"] not in hidden]

        # Build hierarchy
        hierarchy = []
        category_map = {}

        # First pass: create map of all categories
        for cat in all_categories:
            category_map[cat["name"]] = {
                **cat,
                "children": []
            }

        # Second pass: build hierarchy
        for cat in all_categories:
            if cat["is_sub_category"] and cat["parent_category"] in category_map:
                category_map[cat["parent_category"]]["children"].append(category_map[cat["name"]])
            elif not cat["is_sub_category"]:
                hierarchy.append(category_map[cat["name"]])

        return hierarchy
    except Exception as e:
        frappe.log_error(f"Error fetching category hierarchy: {str(e)}")
        return []


@frappe.whitelist()
def search_categories(txt="", limit=10):
    """Return only categories that have at least one subcategory"""
    try:
        txt = txt or ""
        hidden = hidden_categories_for_user()

        # Match the typed text against the label (category_name), the docname
        # (name) and the code (category_code) -- the picker shows the id, so
        # users often type e.g. "DI_1" which isn't in the human label.
        categories = frappe.db.sql("""
            SELECT parent.name, parent.category_name, parent.category_code
            FROM `tabHD Category` parent
            WHERE parent.is_active = 1
                AND parent.is_sub_category = 0
                AND (parent.category_name LIKE %(txt)s
                     OR parent.name LIKE %(txt)s
                     OR parent.category_code LIKE %(txt)s)
                AND EXISTS (
                    SELECT 1 FROM `tabHD Category` child
                    WHERE child.parent_category = parent.name
                    AND child.is_sub_category = 1
                )
            ORDER BY parent.category_name ASC
            LIMIT %(limit)s
        """, {
            "txt": f"%{txt}%",
            "limit": limit
        }, as_dict=True)

        return [
            {
                "value": cat.name,
                "label": cat.category_name,
                "description": cat.category_name
            }
            for cat in categories
            if cat.name not in hidden
        ]

    except Exception as e:
        frappe.log_error(f"Error searching categories: {str(e)}")
        return []


@frappe.whitelist()
def search_sub_categories(category,txt="", limit=10):
    """Search HD Categories for Link field - returns category_name as label"""
    try:
        if not txt:
            txt = ""

        hidden = hidden_categories_for_user()
        # If the parent itself is hidden, none of its sub-categories are visible.
        if category in hidden:
            return []

        # Match against label, docname and code (the picker shows the id, so
        # users often type the code rather than the human label).
        categories = frappe.get_all(
            "HD Category",
            filters={
                "is_active": 1,
                "is_sub_category": 1,
                "parent_category": category,
            },
            or_filters=[
                ["category_name", "like", f"%{txt}%"],
                ["name", "like", f"%{txt}%"],
                ["category_code", "like", f"%{txt}%"],
            ],
            fields=["name", "category_name", "category_code"],
            order_by="category_name asc",
            limit=limit
        )

        # Format for frappe search_link API format
        result = []
        for cat in categories:
            if cat["name"] in hidden:
                continue
            result.append({
                "value": cat["name"],
                "label": cat["category_name"],
                "description": cat["category_name"]
            })

        return result
    except Exception as e:
        frappe.log_error(f"Error searching categories: {str(e)}")
        return []
