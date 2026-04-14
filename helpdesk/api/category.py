import frappe
from frappe import _


@frappe.whitelist()
def get_categories():
    """Get all categories with their subcategories"""
    try:
        # Get all categories
        categories = frappe.get_all(
            "HD Category",
            filters={"is_active": 1, "is_sub_category": 0},
            fields=["name", "category_name", "category_code", "description",
                    "make_attachment_mandatory", "same_attachment_setting_as_category", "hide_attachment_field"],
            order_by="category_name asc"
        )

        # Get subcategories for each category
        for category in categories:
            subcategories = frappe.get_all(
                "HD Category",
                filters={
                    "is_active": 1,
                    "is_sub_category": 1,
                    "parent_category": category["name"]
                },
                fields=["name", "category_name", "category_code", "description",
                        "make_attachment_mandatory", "same_attachment_setting_as_category", "hide_attachment_field"],
                order_by="category_name asc"
            )
            category["subcategories"] = subcategories

        return categories
    except Exception as e:
        frappe.log_error(f"Error fetching categories: {str(e)}")
        return []


@frappe.whitelist()
def get_subcategories(parent_category):
    """Get subcategories for a specific parent category"""
    try:
        if not parent_category:
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

        return subcategories
    except Exception as e:
        frappe.log_error(f"Error fetching subcategories: {str(e)}")
        return []


@frappe.whitelist()
def get_category_hierarchy():
    """Get complete category hierarchy as a tree structure"""
    try:
        # Get all active categories
        all_categories = frappe.get_all(
            "HD Category",
            filters={"is_active": 1},
            fields=[
                "name", "category_name", "category_code", 
                "description", "is_sub_category", "parent_category"
            ],
            order_by="is_sub_category asc, category_name asc"
        )
        
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
    """Search HD Categories for Link field - returns category_name as label"""
    try:
        if not txt:
            txt = ""

        # Use LIKE search on category_name for better user experience
        categories = frappe.get_all(
            "HD Category",
            filters={
                "is_active": 1,
                "is_sub_category":0,
                "category_name": ["like", f"%{txt}%"]
            },
            fields=["name", "category_name", "category_code"],
            order_by="category_name asc",
            limit=limit
        )

        # Format for frappe search_link API format
        result = []
        for cat in categories:
            result.append({
                "value": cat["name"],
                "label": cat["category_name"],
                "description": cat["category_name"]
            })

        return result
    except Exception as e:
        frappe.log_error(f"Error searching categories: {str(e)}")
        return []
    

@frappe.whitelist()
def search_sub_categories(category,txt="", limit=10):
    """Search HD Categories for Link field - returns category_name as label"""
    try:
        if not txt:
            txt = ""

        # Use LIKE search on category_name for better user experience
        categories = frappe.get_all(
            "HD Category",
            filters={
                "is_active": 1,
                "is_sub_category":1,
                "parent_category": category,
                "category_name": ["like", f"%{txt}%"]
            },
            fields=["name", "category_name", "category_code"],
            order_by="category_name asc",
            limit=limit
        )

        # Format for frappe search_link API format
        result = []
        for cat in categories:
            result.append({
                "value": cat["name"],
                "label": cat["category_name"],
                "description": cat["category_name"]
            })

        return result
    except Exception as e:
        frappe.log_error(f"Error searching categories: {str(e)}")
        return []