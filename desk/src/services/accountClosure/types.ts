/**
 * FR-11 Account Closure — API contract.
 *
 * Served by `pc_helpdesk.customizations.api.account_closure`, which uses the same
 * `{success, data, error}` envelope as the account-opening and modification
 * endpoints, so the error type and unwrapping are shared rather than duplicated.
 *
 * One thing here has no equivalent in FR-10 or FR-14: `writableFields`. Phase 1
 * puts five departments on the same document at the same time, and the server
 * only accepts the block the calling user's role owns. The tab reads this list
 * to render the blocks it cannot write as read-only, instead of letting an agent
 * type into a field that would be silently dropped.
 */
import type { DetailRow, FormFieldDescriptor } from "../accountOpening";

export const HOLDING_STATUSES = [
  "Closure Request",
  "Shares Held - Transfer Required",
  "NIL Holding - No Transfer Required",
] as const;

export type HoldingStatus = (typeof HOLDING_STATUSES)[number];

export const HOLDING_NIL = "NIL Holding - No Transfer Required";
export const HOLDING_SHARES_HELD = "Shares Held - Transfer Required";

export const SIGNATURE_STATUSES = ["Pending", "Verified", "Rejected"] as const;

export const CONFIRMATION_STATUSES = ["Pending", "Confirmed", "Rejected"] as const;

export const TECHPLUS_STATUSES = [
  "Pending",
  "Entered",
  "Updated",
  "Closed",
  "Rejected",
] as const;

export const COMPLETING_TEAMS = ["DP Team", "Account Opening Team"] as const;

/** Master data, auto-filled from the client master. Read-only in the UI. */
export interface ClosureClient {
  clientId: string;
  clientName: string;
  panNumber: string;
  tradingAccountNumber: string;
  dematAccountNumber: string;
  dpId: string;
  registeredMobile: string;
  registeredEmail: string;
  clientAddress: string;
}

/** The case, editable and stamped fields together. */
export interface ClosureForm {
  // Case entry — FR-11.3 / FR-11.7
  techplusCaseId: string;
  techplusStatus: string;

  // Accounts in scope — FR-11.1
  closeTradingAccount: boolean;
  closeNsdlAccount: boolean;
  closeCdslAccount: boolean;
  tradingAccountNumber: string;
  dematAccountNumber: string;
  dpId: string;

  // Client
  clientId: string;
  clientName: string;
  panNumber: string;
  isEmployeeAccount: boolean;
  registeredMobile: string;
  registeredEmail: string;
  clientAddress: string;

  // Remark and holding — FR-11.4
  holdingStatus: string;
  closureRemark: string;
  isThirdPartyTransfer: boolean;
  isClosureCumTransfer: boolean;

  // Documents — FR-11.5
  accountClosureForm: string;
  disId: string;
  disDocument: string;
  targetDpName: string;
  targetDpCmr: string;

  // Signature — FR-11.6
  signatureVerificationStatus: string;
  signatureDocument: string;
  signatureVerificationRemarks: string;

  // Holdings — FR-11.12
  holdingValue: number;
  debitBalance: number;

  // Phase 1 — FR-11.9
  dpConfirmationStatus: string;
  dpDebitProcessed: boolean;
  dpOutstandingDemand: boolean;
  dpOutstandingDemandAmount: number;
  dpRemark: string;
  ctclConfirmationStatus: string;
  tradingAccountFrozen: boolean;
  dematAccountFrozen: boolean;
  ctclRemark: string;
  riskConfirmationStatus: string;
  accountDeactivated: boolean;
  riskRemark: string;
  paymentsConfirmationStatus: string;
  outstandingBalanceExists: boolean;
  tradingDebitConfirmed: boolean;
  paymentsRemark: string;
  accountsConfirmationStatus: string;
  accountingClearanceConfirmed: boolean;
  accountsRemark: string;

  // Phase 2 remarks — the approvals themselves are workflow actions
  rmRemark: string;
  hodRemark: string;
  complianceRemark: string;
  managementRemark: string;

  // Completion — FR-11.13
  closureCompletedByTeam: string;

  // Rejection — FR-11.14
  rejectionReason: string;
  rejectionEmailSent: boolean;

  // --- stamped by the workflow and the controller; never sent back ---
  caseType: string;
  caseEnteredBy: string;
  caseEntryDate: string | null;
  techplusUpdatedOn: string | null;
  nilHolding: boolean;
  transferRequired: boolean;
  documentsValidated: boolean;
  signatureVerifiedBy: string;
  signatureVerificationDate: string | null;
  holdingsSource: string;
  holdingsFetchedOn: string | null;
  departmentalConfirmationsComplete: boolean;
  dpConfirmedBy: string;
  dpConfirmationDate: string | null;
  ctclConfirmedBy: string;
  ctclConfirmationDate: string | null;
  riskConfirmedBy: string;
  riskConfirmationDate: string | null;
  paymentsConfirmedBy: string;
  paymentsConfirmationDate: string | null;
  accountsConfirmedBy: string;
  accountsConfirmationDate: string | null;
  approvalsComplete: boolean;
  complianceRequired: boolean;
  complianceRequiredReason: string;
  rmApprovalStatus: string;
  rmApprovedBy: string;
  rmApprovalDate: string | null;
  hodApprovalStatus: string;
  hodApprovedBy: string;
  hodApprovalDate: string | null;
  complianceApprovalStatus: string;
  complianceApprovedBy: string;
  complianceApprovalDate: string | null;
  managementApprovalStatus: string;
  managementApprovedBy: string;
  managementApprovalDate: string | null;
  closureCompletedBy: string;
  closureCompletionDate: string | null;
  forwardingEmailSent: boolean;
  forwardingEmailSentOn: string | null;
  forwardingRecipients: string;
  rejectionStage: string;
  rejectedBy: string;
  rejectionDate: string | null;
  rejectionEmailSentOn: string | null;
  rejectionCcList: string;
}

/**
 * Fields the server will accept back, mirroring FIELD_GROUPS in
 * `api/account_closure.py`. Whether a given user may write a given one of them
 * is answered by `writableFields` on the record, not by this list.
 */
export const EDITABLE_FIELDS = [
  "techplusCaseId",
  "techplusStatus",
  "closeTradingAccount",
  "closeNsdlAccount",
  "closeCdslAccount",
  "tradingAccountNumber",
  "dematAccountNumber",
  "dpId",
  "clientId",
  "clientName",
  "panNumber",
  "isEmployeeAccount",
  "registeredMobile",
  "registeredEmail",
  "clientAddress",
  "holdingStatus",
  "closureRemark",
  "isThirdPartyTransfer",
  "isClosureCumTransfer",
  "accountClosureForm",
  "disId",
  "disDocument",
  "targetDpName",
  "targetDpCmr",
  "signatureVerificationStatus",
  "signatureDocument",
  "signatureVerificationRemarks",
  "holdingValue",
  "debitBalance",
  "dpConfirmationStatus",
  "dpDebitProcessed",
  "dpOutstandingDemand",
  "dpOutstandingDemandAmount",
  "dpRemark",
  "ctclConfirmationStatus",
  "tradingAccountFrozen",
  "dematAccountFrozen",
  "ctclRemark",
  "riskConfirmationStatus",
  "accountDeactivated",
  "riskRemark",
  "paymentsConfirmationStatus",
  "outstandingBalanceExists",
  "tradingDebitConfirmed",
  "paymentsRemark",
  "accountsConfirmationStatus",
  "accountingClearanceConfirmed",
  "accountsRemark",
  "rmRemark",
  "hodRemark",
  "complianceRemark",
  "managementRemark",
  "closureCompletedByTeam",
  "rejectionReason",
  "rejectionEmailSent",
] as const;

export type EditableField = (typeof EDITABLE_FIELDS)[number];

export const CHECK_FIELDS: readonly string[] = [
  "closeTradingAccount",
  "closeNsdlAccount",
  "closeCdslAccount",
  "isEmployeeAccount",
  "isThirdPartyTransfer",
  "isClosureCumTransfer",
  "dpDebitProcessed",
  "dpOutstandingDemand",
  "tradingAccountFrozen",
  "dematAccountFrozen",
  "accountDeactivated",
  "outstandingBalanceExists",
  "tradingDebitConfirmed",
  "accountingClearanceConfirmed",
  "rejectionEmailSent",
];

export const CURRENCY_FIELDS: readonly string[] = [
  "holdingValue",
  "debitBalance",
  "dpOutstandingDemandAmount",
];

export interface ClosureMeta {
  lastUpdatedOn: string | null;
  /** FR-11.12 — false when no back-office source is configured. */
  holdingsLookupConfigured: boolean;
}

/**
 * A closure case document (CL0001…), linked to the ticket it was raised from.
 * It is its own DocType, not a block of HD Ticket fields, because a separate
 * DocType is the only way it can carry a workflow independent of Account Opening
 * and Client Modification, and because FR-11.1 asks for a closure case type.
 */
export interface ClosureRecord {
  /** The case name, e.g. "CL0001". */
  name: string;
  ticket: string;
  workflowState: string;
  /** Null until the client master has been fetched — an empty state. */
  client: ClosureClient | null;
  form: ClosureForm;
  /** The camelCase field names this user's roles own. */
  writableFields: string[];
  meta: ClosureMeta;
}

/** FR-11.15 — one row of the case's audit trail. */
export interface ClosureAuditRow {
  name: string;
  historyType: string;
  user: string;
  actionDate: string | null;
  actionTime: string;
  action: string;
  previousStatus: string;
  newStatus: string;
  remarks: string;
}

export const CASE_DOCTYPE = "Account Closure";

export type { DetailRow, FormFieldDescriptor };
