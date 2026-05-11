# -*- coding: utf-8 -*-
# Copyright (c) 2018, Frappe Technologies Pvt. Ltd. and Contributors
# See license.txt
import json

import frappe
from frappe.tests import IntegrationTestCase
from frappe.utils import random_string

from helpdesk.test_utils import SLA_PRIORITY_NAME, make_sla, make_ticket


class TestHDServiceLevelAgreement(IntegrationTestCase):
    def setUp(self):
        pass

    def test_sla_creation(self):
        sla = make_sla("Test SLA")
        self.assertTrue(sla.name, "Test SLA")

    def test_sla_assignment(self):
        ticket = make_ticket(priority="High")
        sla = frappe.get_doc("HD Service Level Agreement", SLA_PRIORITY_NAME)
        self.assertEqual(ticket.sla, sla.name)
        self.assertEqual(ticket.priority, "High")

    def test_default_sla_assignment(self):
        ticket = make_ticket(priority="Low")
        self.assertEqual(ticket.sla, SLA_PRIORITY_NAME)

    def test_duplicate_condition_and_schedule_is_rejected_on_insert(self):
        source_sla = frappe.get_doc("HD Service Level Agreement", SLA_PRIORITY_NAME)
        condition_json = [["status", "==", "Open"]]

        first_sla = frappe.copy_doc(source_sla)
        first_sla.service_level = f"Test SLA Duplicate {random_string(6)}"
        first_sla.default_sla = 0
        first_sla.condition = "doc.status == 'Open'"
        first_sla.condition_json = json.dumps(condition_json)
        first_sla.insert(ignore_permissions=True)

        duplicate_sla = frappe.copy_doc(first_sla)
        duplicate_sla.service_level = f"Test SLA Duplicate {random_string(6)}"

        with self.assertRaises(frappe.ValidationError):
            duplicate_sla.insert(ignore_permissions=True)
