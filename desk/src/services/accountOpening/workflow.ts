
import { call } from "frappe-ui";

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

export async function fetchWorkflowStatus(
  ticketId: string
): Promise<WorkflowStatus> {
  let envelope: AccountOpeningEnvelope<WorkflowStatus>;
  try {
    envelope = await call(METHODS.status, { ticket_id: ticketId });
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
  ticketId: string,
  action: string
): Promise<WorkflowStatus> {
  if (!action) {
    throw new AccountOpeningError("VALIDATION", "No workflow action given");
  }

  let envelope: AccountOpeningEnvelope<WorkflowStatus>;
  try {
    envelope = await call(METHODS.apply, {
      ticket_id: ticketId,
      action,
    });
  } catch (cause) {
    throw toAccountOpeningError(cause);
  }

  return normalizeStatus(unwrap(envelope));
}
