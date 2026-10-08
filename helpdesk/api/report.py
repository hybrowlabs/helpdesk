import frappe

# Only this deployment's own reports. Stock Frappe and helpdesk reports are
# framework furniture: listing them would put a Reports button in front of
# every agent, including ones with nothing they can actually open.
CUSTOM_APPS = ("philips_captial",)


@frappe.whitelist()
def get_permitted_reports():
	"""Reports the current user may open, for the agent sidebar."""
	module_app = {
		m.name: m.app_name for m in frappe.get_all("Module Def", fields=["name", "app_name"])
	}

	reports = frappe.get_all(
		"Report",
		filters={"disabled": 0},
		fields=["name", "report_name", "ref_doctype", "report_type", "module"],
		order_by="report_name asc",
	)

	permitted = []
	for report in reports:
		if module_app.get(report.module) not in CUSTOM_APPS:
			continue
		# is_permitted() is the Has Role gate the desk itself enforces; a plain
		# has_permission("Report") would only test the Report doctype instead.
		if not frappe.get_cached_doc("Report", report.name).is_permitted():
			continue
		if report.ref_doctype and not frappe.has_permission(report.ref_doctype, "read"):
			continue
		permitted.append(
			{
				"name": report.name,
				"label": report.report_name or report.name,
				"ref_doctype": report.ref_doctype,
				"report_type": report.report_type,
			}
		)

	return permitted
