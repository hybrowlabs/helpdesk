# SPEC-HDK-01: Helpdesk `develop` packaging delta

<a id="spec-hdk-01"></a>

- Stable ID: `SPEC-HDK-01`
- Described at: repo `hybrowlabs/helpdesk`, branch `develop`, commit `09f178e3aee5686eb7b5effe6c7b378a52786db9` (committer date `2026-07-15 11:49:06 +0530`)
- Author: Developer Agent (Yashwanth). Reviewer: Code Reviewer (Yashwanth).
- Status: DRAFT

## 1. Purpose

This clause records the small default-branch delta of `hybrowlabs/helpdesk` against upstream Helpdesk. It does not describe the divergent `main` feature line; that is `SPEC-HDK-02`.

## 2. Boundaries

- In: `develop` at the named commit and its packaging metadata.
- Out: upstream Helpdesk runtime behaviour, `main` feature changes, customer branches and Desk UI.
- Extension points: none.

## 3. Behaviour rules

### A1: Packaging

- A1.1: The fork `develop` head is two commits after upstream commit `8902fad23b36f4c1dba5ca6e020bcce8202614ae`; the first adds and the second removes a `frappe-dependencies` table, leaving a blank line before `dependencies` and the Frappe range `>=16.0.0-dev,<17.0.0` (`pyproject.toml:5-19`).
- A1.2: The fetched upstream `develop` is 4,080 commits ahead of this fork head; the fork head is an old source snapshot, not a current upstream base. This is a git-history fact, not runtime behaviour.

## 4. Data and permissions

- None. Packaging metadata adds no DocType, role or endpoint (`pyproject.toml:1-19`).

## 5. Errors and edge behaviour

- None. No runtime code differs on this branch.

## 6. Configuration

- The package requires Python 3.10 or later and declares Frappe `>=16.0.0-dev,<17.0.0` in the bench dependency table (`pyproject.toml:5-19`).

## 7. Scheduled jobs, hooks and patches

- None. This branch's two commits change only `pyproject.toml`.

## 8. Static security and performance observations

- Security: no application security code is changed by this branch.
- Performance: No performance findings. Checked: (1) DB loops, (2) unbounded reads, (3) unindexed filters, (4) scheduler/hooks, (5) request-path work and (6) frontend fetches are all outside this packaging-only delta.

## 9. Known gaps / open questions

- G1: Whether `develop` is still deployed is not found in this repository. Issue: not filed: deployment-owner decision.
- Statutory source: not applicable; no tax, leave or attendance rule is stated here.

## 10. Uncovered behaviour

- The package dependency resolution needs a compatible Frappe 16 environment. Not filed: no compatible bench is available locally.

## 11. Acceptance cases

None.

No case is written: this is a package/history delta and no observable runtime behaviour changed.
