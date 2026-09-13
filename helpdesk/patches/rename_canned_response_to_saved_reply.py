import frappe


def execute():
    old = "HD Canned Response"
    new = "HD Saved Reply"

    if frappe.db.exists("DocType", new):
        return

    # Some v15 backups already contain the destination table without its v16
    # DocType metadata. Preserve both physical tables rather than attempting a
    # rename that MariaDB will reject with 1050. Never hide legacy rows.
    if frappe.db.table_exists(new):
        if not frappe.db.table_exists(old):
            return

        old_count = frappe.db.sql(f"SELECT COUNT(*) FROM `tab{old}`")[0][0]
        if old_count:
            frappe.throw(
                f"Cannot reconcile {old}: {old_count} legacy rows remain while {new} already exists."
            )

        frappe.logger("migration").warning(
            f"Preserving empty legacy table tab{old}; destination table tab{new} already exists."
        )
        return

    if not frappe.db.exists("DocType", old):
        return

    frappe.rename_doc("DocType", old, new, ignore_if_exists=True)
    print("Migrated", old, "to", new)
