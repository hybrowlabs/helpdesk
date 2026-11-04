# Helpdesk fork delta specification

This folder holds the delta specification for `hybrowlabs/helpdesk`: commits and source areas that differ from upstream Frappe Helpdesk. It does not spec upstream Helpdesk. Conventions, templates and checker tools were copied unchanged from `hybrowlabs/CN-HRMS-Core` `main` at `963aa7c367b14d4357c8b3e3e7086e050d0b6d25` for PWHR-1270 / PWHR-1387.

## IDs

Repo code `HDK`; clause IDs `SPEC-HDK-NN`; case IDs `HDK-NN-A<k>.<n><L>`. ADR-0001 proposed `FORK` for delta inventories; `HDK` distinguishes this repository from `FRK` and `FRH`. Architect decision remains open.

## Clause index

| ID | Title | Described at |
|---|---|---|
| `SPEC-HDK-01` | [Helpdesk `develop` packaging delta](clauses/01-develop-packaging-delta.md) | `develop` `09f178e3aee5686eb7b5effe6c7b378a52786db9` |
| `SPEC-HDK-02` | [Helpdesk `main` feature-line delta inventory](clauses/02-main-feature-line-inventory.md) | `main` `c661773682746da9683bddf93a97e6f6797a8793` |

## Branch result

`develop` is the fork default and contains two packaging commits after upstream `develop`. `main` is the feature line named by the PW build mapping: 383 commits after its upstream merge base, 107 identified fork-only patches after patch-id comparison. The clauses keep those source lines separate; the docs-only PR adds neither the `main` feature files nor a merge of that history.

## Tests and verification limits

No feature case is mapped: this spec is a source/history inventory and no compatible Frappe 16 bench or Desk UI test harness is available locally. The local Frappe 15 bench fails importing this Helpdesk line because Frappe 16's `_remove` API is absent. Thus every feature group is listed as uncovered rather than represented by a fake test.

Run checker tooling: `python3 tools/check_spec_cases.py --require-performance`, `python3 tools/check_spec_test_links.py`, and `cd tools && python3 -m unittest discover -s tests`. `ci-spec-check.md` is a template, not an installed workflow. Hosted CI is UNVERIFIED.
