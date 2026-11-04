# SPEC-HDK-01: Helpdesk fork delta inventory against upstream

<a id="spec-hdk-01"></a>

- Stable ID: `SPEC-HDK-01`
- Described at: repo `hybrowlabs/helpdesk`, branch `develop`, commit `09f178e3aee5686eb7b5effe6c7b378a52786db9` (committer date `2026-07-15 11:49:06 +0530`)
- Also read at: branch `main`, commit `c661773682746da9683bddf93a97e6f6797a8793`; differs: `main` is the fork feature line (383 commits after merge base `4b9f13c0f4c352e02a235c436bd1745b51e4fcda`) while `develop` has only two packaging commits after upstream `develop` commit `8902fad23b36f4c1dba5ca6e020bcce8202614ae`; PW build mapping lists `main`, not `develop`.
- Author: Developer Agent (Yashwanth). Reviewer: Code Reviewer (Yashwanth).
- Status: DRAFT

## 1. Purpose

This delta spec records changes in the fork `hybrowlabs/helpdesk`, rather than describing upstream Helpdesk. The issue named `develop`, but the branch used by the PW build map is `main`; both are recorded because they are materially different lines. `main` contains workflow and feature changes after a common upstream merge base, while `develop` changes only project packaging.

## 2. Boundaries

- In: fork branch history and files changed relative to the upstream `helpdesk` remote.
- Out: the upstream Helpdesk product, customer-named fork branches, and runtime verification of Desk UI screens.
- Extension points: backend APIs, DocTypes, Frappe patches and the Vue Desk UI are listed by delta group below; their full upstream behaviour is out of scope.

## 3. Behaviour rules

### A1: Default `develop` delta

- A1.1: The default fork branch `develop` ends at `09f178e3aee5686eb7b5effe6c7b378a52786db9`; its two commits after upstream commit `8902fad23b36f4c1dba5ca6e020bcce8202614ae` add and then remove the `frappe-dependencies` table in `pyproject.toml`, leaving a blank line before `dependencies` and the same Frappe range (`pyproject.toml:5-19`, at the `develop` commit in the header).

### A2: `main` fork feature delta

- A2.1: `main` ends at `c661773682746da9683bddf93a97e6f6797a8793`; its merge base with upstream is `4b9f13c0f4c352e02a235c436bd1745b51e4fcda`. The fork has 383 commits after that base, of which 293 are non-merge commits not reachable from fetched upstream refs. A patch-id comparison finds 186 equivalent changes on an upstream ref and 107 fork-only patches; the remaining table describes the latter grouping. This is history evidence, not a claim about runtime effects.
- A2.2: SLA and holiday changes add SLA APIs and settings UI, service-holiday handling, response/resolution timing and escalation models (`helpdesk/api/sla.py`, `helpdesk/api/sla_conditions.py`, `helpdesk/api/sla_filters.py`, `helpdesk/api/holidays.py`, `helpdesk/escalation.py`, `helpdesk/helpdesk/doctype/hd_service_level_agreement/hd_service_level_agreement.py`, `helpdesk/helpdesk/doctype/hd_sla_escalation_level/hd_sla_escalation_level.json`, `desk/src/components/Settings/Sla/Sla.vue`, `desk/src/components/Settings/Holiday/Holidays.vue`).
- A2.3: Assignment-rule changes add assignment APIs, customisation and dynamic-assignment child DocTypes (`helpdesk/api/assignment_rule.py`, `helpdesk/api/dynamic_user_assignment.py`, `helpdesk/helpdesk/custom/assignment_rule_custom.py`, `helpdesk/helpdesk/doctype/assignment_rule_dynamic_assignment/assignment_rule_dynamic_assignment.json`, `desk/src/components/Settings/Assignment Rules/AssignmentRules.vue`).
- A2.4: Ticket workflow changes add resolution history and closure transitions, agent/customer Desk surfaces, category/subcategory APIs and ticket fields (`helpdesk/api/resolution.py`, `helpdesk/api/category.py`, `helpdesk/api/categories.py`, `helpdesk/helpdesk/doctype/hd_ticket/ticket_closure_workflow.py`, `helpdesk/helpdesk/doctype/hd_resolution_history/hd_resolution_history.json`, `helpdesk/helpdesk/doctype/hd_ticket/hd_ticket.py`, `desk/src/pages/ticket/TicketAgent.vue`, `desk/src/pages/ticket/TicketCustomer.vue`).
- A2.5: Supporting fork changes add contact, team, holiday-list and escalation endpoints, a ToDo override, patches and install/hooks changes (`helpdesk/api/contact.py`, `helpdesk/api/team.py`, `helpdesk/api/holiday_list.py`, `helpdesk/overrides/todo.py`, `helpdesk/patches.txt`, `helpdesk/setup/install.py`, `helpdesk/hooks.py`).
- A2.6: The fork adds root-level bench tests `test_sla.py` and `test_datetime.py` and changes selected DocType tests, but they require a compatible bench; no mapped runtime case is claimed by this inventory (`test_sla.py:1-5`, `test_datetime.py:1-5`, `helpdesk/helpdesk/doctype/hd_ticket/test_hd_ticket.py:1-10`, all at the `main` commit in the header).

## 4. Data and permissions

- `main` adds DocType JSON for assignment dynamic assignment, resolution history and SLA escalation levels (A2.2-A2.4). Their permission matrix and migrations need a compatible bench; not inferred from file names.

## 5. Errors and edge behaviour

- None. This clause records source and history deltas; the error paths of the new APIs and Desk UI remain uncharacterized.

## 6. Configuration

- `develop` uses Frappe `>=16.0.0-dev,<17.0.0` through its packaging table (`pyproject.toml:17-19`, at the `develop` commit in the header). `main` is a separate feature line; compatibility needs a compatible Frappe bench.

## 7. Scheduled jobs, hooks and patches

- `main` changes `helpdesk/hooks.py`, `helpdesk/patches.txt` and adds patch modules, including assignment-rule fields and ticket-state migrations (`helpdesk/hooks.py:1-40`, `helpdesk/patches.txt:1-32`, `helpdesk/patches/add_fields_in_assignment_rule.py:1-11`, `helpdesk/helpdesk/doctype/hd_ticket/patches/migrate_replied_to_awaiting_user_response.py:1-28`, all at the `main` commit in the header). Patch execution order and idempotence were not run.

## 8. Static security and performance observations

- Security: the fork exposes new server API modules and runs patches; authentication/whitelist decorators and permissions need per-API source review before any security conclusion. No severity rating or security scan was run.
- Performance: No performance findings. Checked: (1) DB calls in loops, (2) unbounded reads, (3) unindexed filters, (4) scheduler jobs and hooks, (5) request-path slow work, (6) frontend fetch patterns: not assessed code-by-code because this is an inventory over 107 fork-only patches. The top repeated fork files include `helpdesk/helpdesk/doctype/hd_ticket/hd_ticket.py` (17 patches) and `helpdesk/search.py` (8); detailed performance analysis is uncovered.

## 9. Known gaps / open questions

- G1: `main` has 107 fork-only patches over the checked upstream set, while the branch named in the issue (`develop`) only has packaging churn. The PW build map names `main`. Issue: not filed: branch-selection fact; product/deployment owner decides which branch is authoritative for future maintenance.
- G2: The local Frappe 15 bench cannot import this Helpdesk line because it imports Frappe 16 `_remove` from `frappe.desk.form.assign_to`; no compatible local bench was available. Issue: not filed: environment blocker, not a product defect.
- G3: The Vue Desk delta has no Vitest files in `main` (checked `git ls-tree -r` for `*.test.*`/`*.spec.*`); it is inventoried, not tested. Issue: not filed: characterization scope needs a Node/Desk test setup.
- Statutory source: REQUIRED (supplier: product owner) for any future claim that a configured holiday/SLA policy implements legal leave or attendance requirements; this clause makes no such claim.

## 10. Uncovered behaviour

- Every A2 feature group: needs clauses per user-visible behaviour plus a compatible Frappe 16 bench; no case is written because an inventory row is not real coverage. Not filed: this issue is the fork inventory, not a feature spec.
- Desk Vue interactions: needs its test harness and a local UI flow; no Vitest tests are in this branch. Not filed: no compatible environment.
- Frappe patch execution and schema effects: needs migrate on a synthetic Frappe 16 site. Not filed: no compatible bench (PWHR-1272).

## 11. Acceptance cases

None.

No case is written: the clause is a git/source inventory. Each listed feature must receive a separate behavioural clause and a real test before it can be counted as covered.
