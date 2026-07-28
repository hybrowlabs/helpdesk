/**
 * FR-14 Client Modification — API contract.
 *
 * Served by `pc_helpdesk.customizations.api.client_modification`, which uses the
 * same `{success, data, error}` envelope as the account-opening endpoints, so
 * the error type and unwrapping are shared rather than duplicated.
 */
import type { DetailRow, FormFieldDescriptor } from "../accountOpening";

export const MODIFICATION_TYPES = [
  "KYC Update",
  "Nominee Details Update",
  "Multiple Field Updates",
  "Default Bank Account Change",
  "Bank Account Addition",
  "Contact Details Update",
  "Data Privacy Request (GDPR)",
] as const;

export type ModificationType = (typeof MODIFICATION_TYPES)[number];

export const MODIFICATION_SUB_TYPES = [
  "Mobile Number Change",
  "Email Address Change",
] as const;

export const ACCOUNT_SCOPES = [
  "Trading + DP (Both)",
  "Trading Only",
  "DP Only",
] as const;

export type AccountScope = (typeof ACCOUNT_SCOPES)[number];

export const CALL_STATUSES = ["Pending", "Complete", "Incomplete"] as const;

export const IPV_FLAGS = ["Not Applicable", "Pending", "Done"] as const;

/**
 * Bank details live on the trading account, so a bank-related change can never
 * be DP Only. Mirrors TRADING_ONLY_TYPES in client_modification/validations.py.
 */
export const TRADING_ONLY_TYPES: readonly string[] = [
  "Default Bank Account Change",
  "Bank Account Addition",
];

/** Master data, auto-filled from the client master. Read-only in the UI. */
export interface ModificationClient {
  clientId: string;
  clientName: string;
  panNumber: string;
  tradingAccountNumber: string;
  dematAccountNumber: string;
  registeredMobile: string;
  registeredEmail: string;
  address: string;
  bankDetails: string;
}

/** The editable case, plus the fields the workflow stamps. */
export interface ModificationForm {
  modificationType: string;
  modificationSubType: string;
  accountScope: string;
  tradingAccountNumber: string;
  dematAccountNumber: string;
  signatureVerified: boolean;
  signatureDocument: string;
  ipvFlag: string;
  firstCallStatus: string;
  secondCallStatus: string;
  thirdCallStatus: string;
  cssRemark: string;
  accopRemark: string;

  // Stamped by the workflow — returned for context, never sent back.
  cssStatus: string;
  cssApprovedDate: string | null;
  caseModifiedBy: string;
  makerLevel: string;
  makerCompleteDate: string | null;
  checkerUser: string;
  checkerLevel: string;
  accopStatus: string;
  accopApprovedDate: string | null;
  accopRejectDate: string | null;
}

/** Fields the server accepts back. Everything else is workflow-owned. */
export const EDITABLE_FIELDS = [
  "modificationType",
  "modificationSubType",
  "accountScope",
  "tradingAccountNumber",
  "dematAccountNumber",
  "signatureVerified",
  "signatureDocument",
  "ipvFlag",
  "firstCallStatus",
  "secondCallStatus",
  "thirdCallStatus",
  "cssRemark",
  "accopRemark",
] as const;

export type EditableField = (typeof EDITABLE_FIELDS)[number];

export interface ModificationMeta {
  lastUpdatedOn: string | null;
}

/**
 * A modification case document (MO0001…), linked to the ticket it was raised
 * from. It is its own DocType, not a block of HD Ticket fields, because
 * FR-14.23 requires MO#### sequential numbering and because a separate DocType
 * is the only way it can carry a workflow independent of Account Opening.
 */
export interface ModificationRecord {
  /** The case name, e.g. "MO0001". */
  name: string;
  ticket: string;
  workflowState: string;
  /** Null until the client master has been fetched — an empty state. */
  client: ModificationClient | null;
  form: ModificationForm;
  meta: ModificationMeta;
}

export const CASE_DOCTYPE = "Client Modification";

export type { DetailRow, FormFieldDescriptor };
