frappe.ui.form.on('HD Ticket', {
    refresh: function(frm) {
        // Set up category and subcategory filtering
        setup_category_filters(frm);
        // Lock the fields for everyone who may not re-categorise the ticket
        apply_category_permissions(frm);
    },

    custom_category: function(frm) {
        // When category changes, clear subcategory and update filter
        frm.set_value('custom_sub_category', '');

        // Update subcategory filter
        if (frm.doc.custom_category) {
            frm.set_query('custom_sub_category', function() {
                return {
                    filters: {
                        'is_sub_category': 1,
                        'parent_category': frm.doc.custom_category,
                        'is_active': 1
                    }
                };
            });

            // Enable subcategory field
            frm.toggle_enable('custom_sub_category', true);
        } else {
            // Disable subcategory field if no category selected
            frm.toggle_enable('custom_sub_category', false);
        }
    }
});

function setup_category_filters(frm) {
    // Set filter for main category field (only parent categories)
    frm.set_query('custom_category', function() {
        return {
            filters: {
                'is_sub_category': 0,
                'is_active': 1
            }
        };
    });

    // Set filter for subcategory field based on selected category
    if (frm.doc.custom_category) {
        frm.set_query('custom_sub_category', function() {
            return {
                filters: {
                    'is_sub_category': 1,
                    'parent_category': frm.doc.custom_category,
                    'is_active': 1
                }
            };
        });
    } else {
        // If no category selected, disable subcategory
        frm.toggle_enable('custom_sub_category', false);
    }
}

function apply_category_permissions(frm) {
    // Only System Managers and Agent Managers may re-categorise a ticket. On a
    // ticket that came in over e-mail the agent it was first assigned to may do
    // it too, so ask the server rather than guessing from roles alone. The same
    // rule is enforced in `HDTicket.check_category_update_perms`; this only
    // keeps the form from offering an edit that would fail on save.
    if (frm.is_new()) {
        return;
    }

    frappe.call({
        method: 'helpdesk.api.category.can_change_ticket_category',
        args: { ticket: frm.doc.name },
        callback: function(r) {
            const read_only = r.message ? 0 : 1;
            frm.set_df_property('custom_category', 'read_only', read_only);
            frm.set_df_property('custom_sub_category', 'read_only', read_only);
        }
    });
}
