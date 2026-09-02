/**
 * Account Opening — presentation helpers.
 *
 * Pure functions that turn the typed API record into what the two tabs render:
 * flat label/value rows for Details, and field descriptors for Form. Keeping
 * this separate from the adapters means the mock and the live API share one
 * rendering path, and neither the UI nor the service knows about the other.
 *
 * Labels are resolved lazily (inside functions, never at module scope) because
 * translations are fetched after app boot.
 */
import dayjs from "dayjs";

import { t } from "./i18n";
import {
  CALL_VERIFICATION_STATUSES,
  SIGNATURE_VERIFICATION_STATUSES,
  VIDEO_VERIFICATION_MIN_AGE,
  VIDEO_VERIFICATION_STATUSES,
  type AccountOpeningApplication,
  type AccountOpeningNominee,
  type DetailRow,
  type FormFieldDescriptor,
  type VerificationDetails,
} from "./types";

export const EMPTY_VALUE = "—";

export function formatDate(value: string | null | undefined): string {
  if (!value) return EMPTY_VALUE;
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format("DD MMM YYYY") : EMPTY_VALUE;
}

/** Whole years since `dateOfBirth`, or null when it is unknown or unparseable. */
export function computeAge(dateOfBirth: string | null | undefined): number | null {
  if (!dateOfBirth) return null;
  const parsed = dayjs(dateOfBirth);
  if (!parsed.isValid()) return null;

  const years = dayjs().diff(parsed, "year");
  return years >= 0 ? years : null;
}

/**
 * Compliance rule: clients aged {@link VIDEO_VERIFICATION_MIN_AGE} or above are
 * verified over video, not by call alone. An unknown date of birth does not
 * trigger the rule — the server is the authority, this keeps the mock honest.
 */
export function isVideoVerificationRequired(
  age: number | null | undefined
): boolean {
  return typeof age === "number" && age >= VIDEO_VERIFICATION_MIN_AGE;
}

function text(value: string | null | undefined): string {
  const trimmed = (value ?? "").trim();
  return trimmed || EMPTY_VALUE;
}

function formatNominees(nominees: AccountOpeningNominee[]): string {
  if (!nominees?.length) return EMPTY_VALUE;
  return nominees
    .map((n) => `${n.name} (${n.relationship}, ${n.sharePercentage}%)`)
    .join(", ");
}

function formatAddress(application: AccountOpeningApplication): string {
  const { address } = application;
  const parts = [
    address.line1,
    address.line2,
    address.city,
    address.district,
    address.state,
    address.pincode,
    address.country,
  ].filter((part) => Boolean(part?.trim()));
  return parts.length ? parts.join(", ") : EMPTY_VALUE;
}


export function toDetailRows(
  application: AccountOpeningApplication
): DetailRow[] {
  const { address, bank, salesRepresentative } = application;

  return [
    { key: "applicationNo", label: t("Application No"), value: text(application.applicationNo) },
    { key: "status", label: t("Application Status"), value: text(application.status) },
    { key: "applicationDate", label: t("Application Date"), value: formatDate(application.applicationDate) },
    { key: "clientId", label: t("Client ID"), value: text(application.clientId) },
    { key: "clientName", label: t("Client Name"), value: text(application.clientName) },
    { key: "panNumber", label: t("PAN Number"), value: text(application.panNumber) },
    { key: "dateOfBirth", label: t("Date of Birth"), value: formatDate(application.dateOfBirth) },
    { key: "age", label: t("Age"), value: application.age === null ? EMPTY_VALUE : String(application.age) },
    {
      key: "videoVerificationRequired",
      label: t("Video Verification Required"),
      value: application.videoVerificationRequired ? t("Yes") : t("No"),
    },
    { key: "email", label: t("Email"), value: text(application.email) },
    { key: "mobile", label: t("Mobile"), value: text(application.mobile) },
    { key: "accountType", label: t("Type of Account"), value: text(application.accountType) },
    { key: "clientType", label: t("Client Type"), value: text(application.clientType) },
    { key: "holderType", label: t("Holder Type"), value: text(application.holderType) },
    { key: "depository", label: t("Depository"), value: text(application.depository) },
    { key: "dpId", label: t("DP ID"), value: text(application.dpId) },
    { key: "sebiRegistrationNo", label: t("SEBI Registration No"), value: text(application.sebiRegistrationNo) },
    { key: "city", label: t("City"), value: text(address.city) },
    { key: "district", label: t("District"), value: text(address.district) },
    { key: "state", label: t("State"), value: text(address.state) },
    { key: "pincode", label: t("Pincode"), value: text(address.pincode) },
    { key: "address", label: t("Address"), value: formatAddress(application) },
    { key: "bankName", label: t("Bank Name"), value: text(bank.bankName) },
    { key: "accountNumber", label: t("Bank Account Number"), value: text(bank.accountNumber) },
    { key: "ifscCode", label: t("IFSC Code"), value: text(bank.ifscCode) },
    { key: "branchName", label: t("Branch Name"), value: text(bank.branchName) },
    { key: "nominees", label: t("Nominee Details"), value: formatNominees(application.nominees) },
    { key: "salesRepresentative", label: t("Sales Representative"), value: text(salesRepresentative.name) },
    { key: "salesRepBranch", label: t("Sales Rep Branch"), value: text(salesRepresentative.branch) },
  ];
}


export function getVerificationFields(
  options: { videoVerificationRequired?: boolean } = {}
): FormFieldDescriptor[] {
  const videoRequired = Boolean(options.videoVerificationRequired);

  return [
    // Identity first: these are what resolve the ticket to an application, so
    // they are the fields an agent fills before anything else can be fetched.
    {
      fieldname: "panNumber",
      label: t("PAN Number"),
      fieldtype: "Text",
      description: t("Used to fetch the application. Format ABCDE1234F."),
    },
    {
      fieldname: "clientId",
      label: t("Client ID"),
      fieldtype: "Text",
      description: t("Used only when no PAN is available."),
    },
    {
      fieldname: "clientName",
      label: t("Client Name"),
      fieldtype: "Text",
    },
    {
      fieldname: "clientDateOfBirth",
      label: t("Client Date of Birth"),
      fieldtype: "Date",
      description: t(
        "Decides whether video verification is mandatory. Save to apply the rule."
      ),
    },
    {
      fieldname: "verificationDoneBy",
      label: t("Verification Done By"),
      fieldtype: "Link",
      options: "User",
      required: 1,
    },
    {
      fieldname: "verificationDate",
      label: t("Verification Date"),
      fieldtype: "Date",
    },
    {
      fieldname: "verifiedRemark",
      label: t("Verified Remark"),
      fieldtype: "TextArea",
    },
    {
      fieldname: "extensionNumber",
      label: t("Extension Number"),
      fieldtype: "Text",
    },
    {
      fieldname: "callVerificationStatus",
      label: t("Call Verification Status"),
      fieldtype: "Select",
      options: CALL_VERIFICATION_STATUSES.join("\n"),
      required: 1,
    },
    {
      fieldname: "signatureVerificationStatus",
      label: t("Signature Verification"),
      fieldtype: "Select",
      options: SIGNATURE_VERIFICATION_STATUSES.join("\n"),
      required: 1,
    },
    {
      fieldname: "videoVerificationStatus",
      label: t("Video Verification Status"),
      fieldtype: "Select",
      options: VIDEO_VERIFICATION_STATUSES.join("\n"),
      required: videoRequired ? 1 : 0,
      description: videoRequired
        ? t("Mandatory — the client is 70 or above.")
        : t("Optional — record it only if a video call was actually done."),
    },
  ];
}

export function emptyVerification(): VerificationDetails {
  return {
    panNumber: "",
    clientId: "",
    clientName: "",
    clientDateOfBirth: null,
    verificationDoneBy: "",
    verificationDate: null,
    verifiedRemark: "",
    extensionNumber: "",
    callVerificationStatus: "Pending",
    signatureVerificationStatus: "Pending",
    videoVerificationStatus: "Pending",
  };
}

function isCallStatus(
  value: string
): value is VerificationDetails["callVerificationStatus"] {
  return (CALL_VERIFICATION_STATUSES as readonly string[]).includes(value);
}

function isSignatureStatus(
  value: string
): value is VerificationDetails["signatureVerificationStatus"] {
  return (SIGNATURE_VERIFICATION_STATUSES as readonly string[]).includes(value);
}

function isVideoStatus(
  value: string
): value is VerificationDetails["videoVerificationStatus"] {
  return (VIDEO_VERIFICATION_STATUSES as readonly string[]).includes(value);
}

/**
 * Coerce a loosely-typed payload (mock store, API response, or the form's
 * working copy) into a valid `VerificationDetails`. An unknown status falls
 * back to "Pending" rather than leaking a bad enum into the UI.
 */
export function normalizeVerification(
  input: Partial<Record<keyof VerificationDetails, unknown>> | null | undefined
): VerificationDetails {
  const base = emptyVerification();
  if (!input) return base;

  const status = String(input.callVerificationStatus ?? "");
  const signature = String(input.signatureVerificationStatus ?? "");
  const video = String(input.videoVerificationStatus ?? "");
  const date = String(input.verificationDate ?? "").trim();
  const dateOfBirth = String(input.clientDateOfBirth ?? "").trim();

  return {
    // Upper-cased here as well as on the server, so the field reads back the
    // way it will be stored without waiting for a round-trip.
    panNumber: String(input.panNumber ?? "").trim().toUpperCase(),
    clientId: String(input.clientId ?? "").trim(),
    clientName: String(input.clientName ?? "").trim(),
    clientDateOfBirth: dateOfBirth || null,
    verificationDoneBy: String(input.verificationDoneBy ?? "").trim(),
    verificationDate: date || null,
    verifiedRemark: String(input.verifiedRemark ?? ""),
    extensionNumber: String(input.extensionNumber ?? "").trim(),
    callVerificationStatus: isCallStatus(status)
      ? status
      : base.callVerificationStatus,
    signatureVerificationStatus: isSignatureStatus(signature)
      ? signature
      : base.signatureVerificationStatus,
    videoVerificationStatus: isVideoStatus(video)
      ? video
      : base.videoVerificationStatus,
  };
}

/**
 * Client-side validation mirroring what the backend enforces.
 * Returns a map of fieldname → message; an empty map means valid.
 */
export function validateVerification(
  verification: VerificationDetails,
  options: { videoVerificationRequired?: boolean } = {}
): Partial<Record<keyof VerificationDetails, string>> {
  const errors: Partial<Record<keyof VerificationDetails, string>> = {};

  // Mirrors _is_valid_pan() on the server. Empty is allowed — a ticket may be
  // worked before the PAN is known.
  if (verification.panNumber && !/^[A-Z]{5}\d{4}[A-Z]$/.test(verification.panNumber)) {
    errors.panNumber = t("PAN must be in the format ABCDE1234F");
  }

  // Any check that has moved off Pending has to say who did it, and when.
  const isResolved =
    verification.callVerificationStatus !== "Pending" ||
    verification.signatureVerificationStatus !== "Pending" ||
    verification.videoVerificationStatus !== "Pending";
  if (isResolved && !verification.verificationDoneBy) {
    errors.verificationDoneBy = t("Required once a verification is recorded");
  }
  if (isResolved && !verification.verificationDate) {
    errors.verificationDate = t("Required once a verification is recorded");
  }

  // Rejecting a client, or failing their signature, needs a reason on record.
  const needsRemark =
    verification.callVerificationStatus === "Rejected" ||
    verification.videoVerificationStatus === "Rejected" ||
    verification.signatureVerificationStatus === "Not Verified";
  if (needsRemark && !verification.verifiedRemark.trim()) {
    errors.verifiedRemark = t(
      "A remark is required when rejecting or marking a signature not verified"
    );
  }

  // Compliance: a 70+ client cannot be signed off on the call alone. The server
  // is the authority, but the date of birth the agent has just typed is checked
  // too — otherwise the rule only appears after a save that will be rejected.
  const videoRequired =
    Boolean(options.videoVerificationRequired) ||
    isVideoVerificationRequired(computeAge(verification.clientDateOfBirth));

  if (
    videoRequired &&
    verification.callVerificationStatus === "Done" &&
    verification.videoVerificationStatus === "Pending"
  ) {
    errors.videoVerificationStatus = t(
      "Video verification is mandatory for clients aged 70 or above"
    );
  }

  if (
    verification.extensionNumber &&
    !/^\d{2,6}$/.test(verification.extensionNumber)
  ) {
    errors.extensionNumber = t("Extension must be 2 to 6 digits");
  }

  return errors;
}
