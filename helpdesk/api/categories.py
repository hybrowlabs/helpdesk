import frappe
from frappe import _

@frappe.whitelist()
def get_categories():
    """Get all parent categories that have at least one subcategory"""
    try:
        # Get names of parent categories that have children
        parents_with_children = frappe.db.get_all(
            "HD Ticket Type",
            filters={"parent_hd_ticket_type": ["not in", ["", None]]},
            pluck="parent_hd_ticket_type",
            distinct=True
        )

        if not parents_with_children:
            return []

        categories = frappe.get_all(
            "HD Ticket Type",
            fields=["name", "description"],
            filters={
                "name": ["in", parents_with_children],
                "parent_hd_ticket_type": ["in", ["", None]],
                "is_sub_category": 0
            },
            order_by="name asc"
        )
        return categories
    except Exception as e:
        frappe.log_error(f"Error fetching categories: {str(e)}")
        return []

@frappe.whitelist()
def get_subcategories(parent_category=None):
    """Get subcategories for a given parent category"""
    try:
        if not parent_category:
            return []
        
        subcategories = frappe.get_all(
            "HD Ticket Type",
            fields=["name", "description"],
            filters={"parent_hd_ticket_type": parent_category},
            order_by="name asc"
        )
        return subcategories
    except Exception as e:
        frappe.log_error(f"Error fetching subcategories: {str(e)}")
        return []

@frappe.whitelist()
def get_category_tree():
    """Get complete category tree structure"""
    try:
        # Get all parent categories
        parents = frappe.get_all(
            "HD Ticket Type",
            fields=["name", "description"],
            filters={"parent_hd_ticket_type": ["in", ["", None]]},
            order_by="name asc"
        )
        
        # For each parent, get its children
        category_tree = []
        for parent in parents:
            children = frappe.get_all(
                "HD Ticket Type",
                fields=["name", "description"],
                filters={"parent_hd_ticket_type": parent["name"]},
                order_by="name asc"
            )
            
            category_tree.append({
                "name": parent["name"],
                "description": parent.get("description", ""),
                "children": children
            })
        
        return category_tree
    except Exception as e:
        frappe.log_error(f"Error fetching category tree: {str(e)}")
        return []

@frappe.whitelist()
def validate_category_selection(category, subcategory=None):
    """Validate that subcategory belongs to the selected category"""
    try:
        if not subcategory:
            # Only category selected, which is valid
            return {"valid": True}
        
        # Check if subcategory belongs to the category
        parent = frappe.db.get_value(
            "HD Ticket Type",
            subcategory,
            "parent_hd_ticket_type"
        )
        
        if parent == category:
            return {"valid": True}
        else:
            return {
                "valid": False,
                "message": _("Subcategory {0} does not belong to category {1}").format(
                    subcategory, category
                )
            }
    except Exception as e:
        frappe.log_error(f"Error validating category selection: {str(e)}")
        return {
            "valid": False,
            "message": _("Error validating selection: {0}").format(str(e))
        }