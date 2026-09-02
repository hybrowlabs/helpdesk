
export type AccountOpeningStatus =
  | "Draft"
  | "Submitted"
  | "Under Verification"
  | "Approved"
  | "Rejected"
  | "On Hold";

export type CallVerificationStatus = "Pending" | "Done" | "Rejected";

export const CALL_VERIFICATION_STATUSES: readonly CallVerificationStatus[] = [
  "Pending",
  "Done",
  "Rejected",
] as const;

export type SignatureVerificationStatus =
  | "Pending"
  | "Verified"
  | "Not Verified";

export const SIGNATURE_VERIFICATION_STATUSES: readonly SignatureVerificationStatus[] =
  ["Pending", "Verified", "Not Verified"] as const;

export type VideoVerificationStatus = "Pending" | "Done" | "Rejected";

export const VIDEO_VERIFICATION_STATUSES: readonly VideoVerificationStatus[] = [
  "Pending",
  "Done",
  "Rejected",
] as const;

/**
 * Compliance rule: clients of this age or older must be verified over video
 * rather than by call alone. Mirrored by `VIDEO_VERIFICATION_MIN_AGE` in
 * `pc_helpdesk/customizations/api/account_opening.py` — change both together.
 */
export const VIDEO_VERIFICATION_MIN_AGE = 70;

export type AccountType =
  | "Individual"
  | "Joint"
  | "Corporate"
  | "HUF"
  | "NRI"
  | "Minor";

export type ClientType = "Trading" | "Demat" | "Trading & Demat" | "Commodity";

export type HolderType = "Single" | "Joint" | "Either or Survivor";

export type Depository = "NSDL" | "CDSL";

export interface AccountOpeningAddress {
  line1: string;
  line2: string;
  city: string;
  district: string;
  state: string;
  pincode: string;
  country: string;
}

export interface AccountOpeningBank {
  bankName: string;
  /** Masked upstream — never expect a full account number here. */
  accountNumber: string;
  ifscCode: string;
  branchName: string;
}

export interface AccountOpeningNominee {
  name: string;
  relationship: string;
  sharePercentage: number;
}

export interface SalesRepresentative {
  name: string;
  employeeCode: string;
  branch: string;
  extensionNumber: string;
}

export interface AccountOpeningApplication {
  applicationNo: string;
  clientId: string;
  clientName: string;
  panNumber: string;
  email: string;
  mobile: string;
  dateOfBirth: string | null;
  age: number | null;
  
  videoVerificationRequired: boolean;
  applicationDate: string | null;
  status: AccountOpeningStatus;
  accountType: AccountType;
  clientType: ClientType;
  holderType: HolderType;
  depository: Depository;
  dpId: string;
  sebiRegistrationNo: string;
  address: AccountOpeningAddress;
  bank: AccountOpeningBank;
  nominees: AccountOpeningNominee[];
  salesRepresentative: SalesRepresentative;
}

export interface VerificationDetails {
  /**
   * Client identity, entered by the agent. These resolve the case to an
   * application upstream (PAN first, Client ID as fallback), so they stay
   * editable before any application has been fetched.
   */
  panNumber: string;
  clientId: string;
  clientName: string;
  /**
   * Drives the compliance rule server-side: the case's age, and with it
   * `videoVerificationRequired`, is derived from this and never sent back.
   */
  clientDateOfBirth: string | null;
  verificationDoneBy: string;
  verificationDate: string | null;
  verifiedRemark: string;
  extensionNumber: string;
  callVerificationStatus: CallVerificationStatus;
  signatureVerificationStatus: SignatureVerificationStatus;
  videoVerificationStatus: VideoVerificationStatus;
}

export interface AccountOpeningIdentifier {
  kind: "pan" | "clientId";
  value: string;
}

export interface AccountOpeningMeta {
  source: "mock" | "api";
  lastUpdatedOn: string | null;
  identifier?: AccountOpeningIdentifier | null;
}

/**
 * An account opening case document (AO0001…), linked to the ticket it was
 * raised from. It is its own DocType, not a block of HD Ticket fields, because
 * Frappe allows exactly one active Workflow per DocType — the only way FR-10 and
 * FR-14 can both stay live is for each to own a document.
 */
export interface AccountOpeningCase {
  /** The case name, e.g. "AO0001". */
  name: string;
  workflowState: string;
  /** Derived server-side from the date of birth. Never sent back. */
  clientAge: number | null;
  verificationType: string;
  videoVerificationRequired: boolean;
  kycSource: string;
  kycPdf: string;
}

export const CASE_DOCTYPE = "Account Opening";

export interface AccountOpeningRecord {
  /** Null until a case has been opened against the ticket — an empty state. */
  case: AccountOpeningCase | null;
  /**
   * Null when no application resolved — the case carries no identifier yet,
   * or the lookup found nothing. The verification block is still present, so
   * the Form tab can collect the PAN / Client ID that will resolve it.
   */
  application: AccountOpeningApplication | null;
  verification: VerificationDetails;
  meta: AccountOpeningMeta;
}


export interface AccountOpeningEnvelope<T> {
  success: boolean;
  data: T | null;
  error?: {
    code: AccountOpeningErrorCode;
    message: string;
  };
}

export type AccountOpeningErrorCode =
  | "NOT_FOUND"
  | "PERMISSION_DENIED"
  | "VALIDATION"
  | "NETWORK"
  | "UNKNOWN";

export class AccountOpeningError extends Error {
  readonly code: AccountOpeningErrorCode;

  constructor(code: AccountOpeningErrorCode, message: string) {
    super(message);
    this.name = "AccountOpeningError";
    this.code = code;
  }
}


export interface AccountOpeningService {

  fetch(ticketId: string): Promise<AccountOpeningRecord | null>;

  /** Opens a case against the ticket. Idempotent — one case per ticket. */
  createCase(ticketId: string): Promise<AccountOpeningRecord>;

  saveVerification(
    ticketId: string,
    verification: VerificationDetails
  ): Promise<VerificationDetails>;
}


export type WorkflowStyle =
  | ""
  | "Primary"
  | "Info"
  | "Success"
  | "Warning"
  | "Danger"
  | "Inverse";

export interface WorkflowTransition {
  action: string;
  nextState: string;
  allowedRole: string;
  
  allowed: boolean;
  blockedReason: string | null;
}

export interface WorkflowStatus {
  workflowName: string | null;
  state: string | null;
  style: WorkflowStyle;
  canWrite: boolean;
  transitions: WorkflowTransition[];
  
  status?: string;
}

export interface DetailRow {
  key: string;
  label: string;
  value: string;
}


export interface FormFieldDescriptor<
  TField extends string = keyof VerificationDetails,
> {
  fieldname: TField;
  label: string;
  fieldtype: "Text" | "Date" | "TextArea" | "Select" | "Link" | "Checkbox";
  options?: string;
  required?: 0 | 1;
  description?: string;
}
