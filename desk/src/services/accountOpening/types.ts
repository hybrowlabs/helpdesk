
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

export interface AccountOpeningRecord {
  application: AccountOpeningApplication;
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


export interface FormFieldDescriptor {
  fieldname: keyof VerificationDetails;
  label: string;
  fieldtype: "Text" | "Date" | "TextArea" | "Select" | "Link";
  options?: string;
  required?: 0 | 1;
  description?: string;
}
