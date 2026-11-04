# SPEC-HDK-02: Helpdesk `main` feature-line delta inventory

<a id="spec-hdk-02"></a>

- Stable ID: `SPEC-HDK-02`
- Described at: repo `hybrowlabs/helpdesk`, branch `main`, commit `c661773682746da9683bddf93a97e6f6797a8793` (committer date `2026-09-21 13:47:11 +0530`)
- Author: Developer Agent (Yashwanth). Reviewer: Code Reviewer (Yashwanth).
- Status: DRAFT

## 1. Purpose

This clause inventories the `main` feature line against upstream Helpdesk without merging the feature line into `develop`. The PW build mapping names `main`; the deployable feature behaviour therefore belongs to this branch-specific inventory, not to the docs-only `develop` PR.

## 2. Boundaries

- In: source/history reachable from `main` at the header commit.
- Out: adding those feature files to `develop`, upstream feature specification and customer-named branches.
- Extension points: backend API modules, DocTypes, Frappe patches and Vue Desk modules named below.

## 3. Behaviour rules

### A1: Source delta

- A1.1: `main` has merge base `4b9f13c0f4c352e02a235c436bd1745b51e4fcda` with upstream and has 383 commits after it; 293 non-merge commits are not reachable from fetched upstream refs. Patch-id comparison identifies 107 fork-only patches. These are history facts, not runtime coverage.
- A1.2: Fork-only patches group into SLA and holidays (`helpdesk/api/sla.py`, `helpdesk/api/sla_conditions.py`, `helpdesk/api/sla_filters.py`, `helpdesk/api/holidays.py`, `helpdesk/escalation.py`, `helpdesk/helpdesk/doctype/hd_service_level_agreement/hd_service_level_agreement.py`, `desk/src/components/Settings/Sla/Sla.vue`, `desk/src/components/Settings/Holiday/Holidays.vue`), assignment rules (`helpdesk/api/assignment_rule.py`, `helpdesk/api/dynamic_user_assignment.py`, `helpdesk/helpdesk/custom/assignment_rule_custom.py`, `desk/src/components/Settings/Assignment Rules/AssignmentRules.vue`), and ticket closure/resolution/category work (`helpdesk/api/resolution.py`, `helpdesk/api/category.py`, `helpdesk/helpdesk/doctype/hd_ticket/ticket_closure_workflow.py`, `helpdesk/helpdesk/doctype/hd_resolution_history/hd_resolution_history.json`, `desk/src/pages/ticket/TicketAgent.vue`).
- A1.3: Supporting fork changes add contact/team/holiday-list APIs, ToDo override, hooks and Frappe patches (`helpdesk/api/contact.py`, `helpdesk/api/team.py`, `helpdesk/api/holiday_list.py`, `helpdesk/overrides/todo.py`, `helpdesk/hooks.py`, `helpdesk/patches.txt`).

## 4. Data and permissions

- `main` adds assignment-dynamic-assignment, resolution-history and SLA-escalation DocType JSON (`helpdesk/helpdesk/doctype/assignment_rule_dynamic_assignment/assignment_rule_dynamic_assignment.json`, `helpdesk/helpdesk/doctype/hd_resolution_history/hd_resolution_history.json`, `helpdesk/helpdesk/doctype/hd_sla_escalation_level/hd_sla_escalation_level.json`). Permissions require a compatible bench; they are not inferred.

## 5. Errors and edge behaviour

- None documented by this inventory. Feature APIs and UI error paths need their own clauses and tests.

## 6. Configuration

- `main` is a separate feature line. Its Frappe compatibility needs a Frappe 16 bench; local Frappe 15 import fails on `_remove` from `frappe.desk.form.assign_to`.

## 7. Scheduled jobs, hooks and patches

- `main` changes hooks, manifest and patches (`helpdesk/hooks.py:1-40`, `helpdesk/patches.txt:1-32`, `helpdesk/patches/add_fields_in_assignment_rule.py:1-11`, `helpdesk/helpdesk/doctype/hd_ticket/patches/migrate_replied_to_awaiting_user_response.py:1-28`). Patch order, idempotence and schema effect were not run.

## 8. Static security and performance observations

- Security: fork-only API and patch modules need endpoint-level permission/whitelist review before any security claim. No scan or severity rating was run.
- Performance: No performance findings. Checked: this is a source inventory; DB loops, reads, filters, scheduler/hooks, request work and frontend fetches are not assessed feature by feature. `hd_ticket.py` appears in 17 fork-only patches and `helpdesk/search.py` in 8, so targeted future review should begin there.

## 9. Known gaps / open questions

- G1: `main` has 107 fork-only patches and is the PW-mapped branch, but this docs PR intentionally targets `develop`. Issue: not filed: this branch-specific clause is the safe documentation result; feature changes must not be pulled into the docs PR.
- G2: No in-tree Vue Vitest files were found in `main`; Desk UI is inventoried only. Issue: not filed: needs a test harness.
- Statutory source: REQUIRED (supplier: product owner) for a future legal claim about SLA or holiday policy; no such claim is made here.

## 10. Uncovered behaviour

- SLA, assignment, ticket, category, patch and Desk feature groups need user-visible behavioural clauses plus a Frappe 16 bench; no fake case is claimed.
- Desk UI needs a local UI flow and test harness; Frappe patches need synthetic-site migration. Not filed: no compatible environment.

## 11. Acceptance cases

None.

No case is written: this is a cross-branch inventory. It does not claim that source file presence proves a user-visible feature.
