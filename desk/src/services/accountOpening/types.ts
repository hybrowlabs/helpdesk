
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

/** The read-only application record rendered on the Details tab. */
export interface AccountOpeningApplication {
  applicationNo: string;
  clientId: string;
  clientName: string;
  panNumber: string;
  email: string;
  mobile: string;
  /** ISO `yyyy-mm-dd`, or null when the upstream system has no value. */
  dateOfBirth: string | null;
  /** Whole years at the time of the request; null when `dateOfBirth` is unknown. */
  age: number | null;
  /**
   * Whether compliance requires video verification instead of a plain call.
   * Derived from `age` by the server — never sent up from the browser.
   */
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

/** The editable block rendered on the Form tab. */
export interface VerificationDetails {
  verificationDoneBy: string;
  /** ISO `yyyy-mm-dd`, or null when not yet verified. */
  verificationDate: string | null;
  verifiedRemark: string;
  extensionNumber: string;
  callVerificationStatus: CallVerificationStatus;
  /** Whether the client's signature on the form matches records. */
  signatureVerificationStatus: SignatureVerificationStatus;
  /** Outcome of the video call. Mandatory for clients aged 70 or above. */
  videoVerificationStatus: VideoVerificationStatus;
}

export interface AccountOpeningMeta {
  /** Which adapter served this record — useful in QA and in the UI badge. */
  source: "mock" | "api";
  /** ISO timestamp of the last verification save, or null if never saved. */
  lastUpdatedOn: string | null;
}

/** Everything the Account Opening tab needs for one ticket. */
export interface AccountOpeningRecord {
  application: AccountOpeningApplication;
  verification: VerificationDetails;
  meta: AccountOpeningMeta;
}

/**
 * Envelope returned by the backend.
 *
 * Adapters unwrap this and throw `AccountOpeningError` on `success: false`, so
 * callers only ever deal with the payload or an exception.
 */
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

/** Typed failure so the UI can distinguish "no data" from "request broke". */
export class AccountOpeningError extends Error {
  readonly code: AccountOpeningErrorCode;

  constructor(code: AccountOpeningErrorCode, message: string) {
    super(message);
    this.name = "AccountOpeningError";
    this.code = code;
  }
}

/**
 * The port the UI depends on. Swapping mock for live is a matter of returning
 * a different implementation from `services/accountOpening/index.ts`.
 */
export interface AccountOpeningService {
  /**
   * Fetch the account-opening record linked to a ticket.
   * Resolves to `null` when the ticket has no linked application (empty state).
   * Rejects with `AccountOpeningError` on failure.
   */
  fetch(ticketId: string): Promise<AccountOpeningRecord | null>;

  /** Persist the Form tab and return the stored verification block. */
  saveVerification(
    ticketId: string,
    verification: VerificationDetails
  ): Promise<VerificationDetails>;
}

/** One read-only row on the Details tab. */
export interface DetailRow {
  key: string;
  label: string;
  value: string;
}

/**
 * Descriptor consumed by `DynamicFormField.vue`. Kept structurally compatible
 * with that component's props so the Form tab stays data-driven.
 */
export interface FormFieldDescriptor {
  fieldname: keyof VerificationDetails;
  label: string;
  fieldtype: "Text" | "Date" | "TextArea" | "Select" | "Link";
  /** Newline-separated for Select; target doctype for Link. */
  options?: string;
  required?: 0 | 1;
  /** Hint rendered under the control — used to explain compliance rules. */
  description?: string;
}
