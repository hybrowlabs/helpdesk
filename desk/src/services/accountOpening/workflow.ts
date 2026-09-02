
import { call } from "frappe-ui";

import { getCall } from "../http";
import { toAccountOpeningError, unwrap } from "./envelope";
import {
  AccountOpeningError,
  type AccountOpeningEnvelope,
  type WorkflowStatus,
  type WorkflowTransition,
} from "./types";

const METHODS = {
  status: "pc_helpdesk.customizations.api.workflow.get_workflow_status",
  apply: "pc_helpdesk.customizations.api.workflow.apply_workflow_action",
} as const;

const EMPTY_STATUS: WorkflowStatus = {
  workflowName: null,
  state: null,
  style: "",
  canWrite: false,
  transitions: [],
};

function normalizeTransition(raw: Partial<WorkflowTransition>): WorkflowTransition {
  return {
    action: String(raw.action ?? ""),
    nextState: String(raw.nextState ?? ""),
    allowedRole: String(raw.allowedRole ?? ""),
    // Absent means allowed — only an explicit false blocks the action.
    allowed: raw.allowed !== false,
    blockedReason: raw.blockedReason ?? null,
  };
}

function normalizeStatus(raw: WorkflowStatus | null): WorkflowStatus {
  if (!raw) return { ...EMPTY_STATUS };

  return {
    workflowName: raw.workflowName ?? null,
    state: raw.state ?? null,
    style: raw.style ?? "",
    canWrite: Boolean(raw.canWrite),
    transitions: (raw.transitions ?? [])
      .map(normalizeTransition)
      .filter((t) => Boolean(t.action)),
    status: raw.status,
  };
}

/**
 * `doctype` defaults to HD Ticket (FR-10). FR-14 passes "Client Modification",
 * which carries its own, entirely separate workflow — Frappe allows one active
 * workflow per DocType, so separate flows mean separate DocTypes.
 */
export async function fetchWorkflowStatus(
  docname: string,
  doctype?: string
): Promise<WorkflowStatus> {
  let envelope: AccountOpeningEnvelope<WorkflowStatus>;
  try {
    envelope = await getCall(METHODS.status, { ticket_id: docname, doctype });
  } catch (cause) {
    throw toAccountOpeningError(cause);
  }

  return normalizeStatus(unwrap(envelope));
}

/**
 * Apply a transition. The server re-derives the allowed actions and re-runs
 * every validation, so a stale menu is rejected rather than trusted.
 */
export async function applyWorkflowAction(
  docname: string,
  action: string,
  doctype?: string
): Promise<WorkflowStatus> {
  if (!action) {
    throw new AccountOpeningError("VALIDATION", "No workflow action given");
  }

  let envelope: AccountOpeningEnvelope<WorkflowStatus>;
  try {
    envelope = await call(METHODS.apply, {
      ticket_id: docname,
      action,
      doctype,
    });
  } catch (cause) {
    throw toAccountOpeningError(cause);
  }

  return normalizeStatus(unwrap(envelope));
}
