/**
 * Stock Transfer — API contract.
 *
 * Served by `pc_helpdesk.customizations.api.stock_transfer`, which uses the same
 * `{success, data, error}` envelope as the other case endpoints, so the error
 * type and unwrapping are shared rather than duplicated.
 */
import type { DetailRow, FormFieldDescriptor } from "../accountOpening";

export const TRANSFER_TYPES = [
  "POA Stock Transfer",
  "Non-POA Stock Transfer",
  "Off-Market Transfer",
  "Inter-Depository Transfer",
  "Closure cum Transfer",
] as const;

export const TRANSFER_REASONS = [
  "Gift / Family Transfer",
  "Account Closure",
  "Broker Change",
  "Consolidation",
  "Other",
] as const;

export const TRANSFER_MODES = ["Physical DIS", "eDIS", "Online (POA)"] as const;

export const DEPOSITORIES = ["NSDL", "CDSL"] as const;

export const SIGNATURE_STATUSES = ["Pending", "Verified", "Not Verified"] as const;

export const CONFIRMATION_STATUSES = [
  "Pending",
  "Confirmed",
  "Not Reachable",
  "Declined",
] as const;

/** Master data, auto-filled from the client master. Read-only in the UI. */
export interface TransferClient {
  clientId: string;
  clientName: string;
  panNumber: string;
  tradingAccountNumber: string;
  dematAccountNumber: string;
  dpId: string;
  depository: string;
  registeredMobile: string;
  registeredEmail: string;
  clientAddress: string;
}

/** One line of the transfer — what is moving, and how much of it. */
export interface TransferSecurity {
  /** The child row name; blank for a line the agent has just added. */
  name?: string;
  isin: string;
  securityName: string;
  quantity: number;
  marketValue: number;
}

/** The editable case, plus the fields the workflow and controller stamp. */
export interface TransferForm {
  transferType: string;
  transferReason: string;
  transferMode: string;
  expectedTransferDate: string | null;
  tradingAccountNumber: string;
  dematAccountNumber: string;
  dpId: string;
  depository: string;
  isThirdPartyTransfer: boolean;
  targetClientName: string;
  targetPanNumber: string;
  targetDematAccountNumber: string;
  targetDpId: string;
  targetDpName: string;
  targetDepository: string;
  targetDpCmr: string;
  disSlipNumber: string;
  disDocument: string;
  annexureDocument: string;
  signatureVerificationStatus: string;
  signatureRemarks: string;
  clientConfirmationStatus: string;
  confirmationRemark: string;
  complianceRemark: string;
  executionReference: string;
  dpRemark: string;
  rejectionReason: string;

  // Stamped server-side — returned for context, never sent back.
  caseEnteredBy: string;
  caseEntryDate: string | null;
  totalQuantity: number;
  totalMarketValue: number;
  securitiesSource: string;
  securitiesFetchedOn: string | null;
  clientMasterSource: string;
  clientMasterFetchedOn: string | null;
  documentsValidated: boolean;
  signatureVerifiedBy: string;
  signatureVerificationDate: string | null;
  confirmationDate: string | null;
  complianceRequired: boolean;
  complianceRequiredReason: string;
  complianceStatus: string;
  complianceApprovedBy: string;
  complianceApprovalDate: string | null;
  dpExecutionStatus: string;
  executedBy: string;
  executionDate: string | null;
  completedBy: string;
  completionDate: string | null;
  rejectedBy: string;
  rejectionDate: string | null;
}

/** Fields the server accepts back. Everything else is workflow-owned. */
export const EDITABLE_FIELDS = [
  "transferType",
  "transferReason",
  "transferMode",
  "expectedTransferDate",
  "tradingAccountNumber",
  "dematAccountNumber",
  "dpId",
  "depository",
  "isThirdPartyTransfer",
  "targetClientName",
  "targetPanNumber",
  "targetDematAccountNumber",
  "targetDpId",
  "targetDpName",
  "targetDepository",
  "targetDpCmr",
  "disSlipNumber",
  "disDocument",
  "annexureDocument",
  "signatureVerificationStatus",
  "signatureRemarks",
  "clientConfirmationStatus",
  "confirmationRemark",
  "complianceRemark",
  "executionReference",
  "dpRemark",
  "rejectionReason",
] as const;

export type EditableField = (typeof EDITABLE_FIELDS)[number];

export const CHECK_FIELDS: readonly string[] = ["isThirdPartyTransfer"];

export interface TransferMeta {
  lastUpdatedOn: string | null;
  /**
   * The client master / holdings came from the placeholder source, not the
   * client's systems. The tab says so rather than presenting it as real.
   */
  usingPlaceholderData: boolean;
}

/**
 * A stock transfer case document (ST0001…), linked to the ticket it was raised
 * from. Its own DocType, like the other three flows, because that is the only
 * way it can carry a workflow of its own.
 */
export interface TransferRecord {
  name: string;
  ticket: string;
  workflowState: string;
  /** Null until the client master has been fetched — an empty state. */
  client: TransferClient | null;
  securities: TransferSecurity[];
  form: TransferForm;
  meta: TransferMeta;
}

export const CASE_DOCTYPE = "Stock Transfer";

export type { DetailRow, FormFieldDescriptor };
