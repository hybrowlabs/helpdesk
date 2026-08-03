/**
 * Stock Transfer — presentation helpers.
 *
 * Pure functions turning the API record into what the tab renders: label/value
 * rows for the read-only blocks, and field descriptors for the editable ones.
 * Labels are resolved inside functions, never at module scope, because
 * translations load after app boot.
 */
import dayjs from "dayjs";

import { EMPTY_VALUE, t, type DetailRow, type FormFieldDescriptor } from "../accountOpening";

import {
  CONFIRMATION_STATUSES,
  DEPOSITORIES,
  EDITABLE_FIELDS,
  SIGNATURE_STATUSES,
  TRANSFER_MODES,
  TRANSFER_REASONS,
  TRANSFER_TYPES,
  type EditableField,
  type TransferClient,
  type TransferForm,
  type TransferSecurity,
} from "./types";

/** Field descriptors for this form's own keys. */
type TransferField = FormFieldDescriptor<keyof TransferForm>;

function text(value: string | null | undefined): string {
  const trimmed = (value ?? "").trim();
  return trimmed || EMPTY_VALUE;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return EMPTY_VALUE;
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format("DD MMM YYYY") : EMPTY_VALUE;
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return EMPTY_VALUE;
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format("DD MMM YYYY, HH:mm") : EMPTY_VALUE;
}

export function formatNumber(value: number | null | undefined): string {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return EMPTY_VALUE;
  return amount.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

export function emptyForm(): TransferForm {
  return {
    transferType: "",
    transferReason: "",
    transferMode: "",
    expectedTransferDate: null,
    tradingAccountNumber: "",
    dematAccountNumber: "",
    dpId: "",
    depository: "",
    isThirdPartyTransfer: false,
    targetClientName: "",
    targetPanNumber: "",
    targetDematAccountNumber: "",
    targetDpId: "",
    targetDpName: "",
    targetDepository: "",
    targetDpCmr: "",
    disSlipNumber: "",
    disDocument: "",
    annexureDocument: "",
    signatureVerificationStatus: "Pending",
    signatureRemarks: "",
    clientConfirmationStatus: "Pending",
    confirmationRemark: "",
    complianceRemark: "",
    executionReference: "",
    dpRemark: "",
    rejectionReason: "",
    caseEnteredBy: "",
    caseEntryDate: null,
    totalQuantity: 0,
    totalMarketValue: 0,
    securitiesSource: "",
    securitiesFetchedOn: null,
    clientMasterSource: "",
    clientMasterFetchedOn: null,
    documentsValidated: false,
    signatureVerifiedBy: "",
    signatureVerificationDate: null,
    confirmationDate: null,
    complianceRequired: false,
    complianceRequiredReason: "",
    complianceStatus: "Pending",
    complianceApprovedBy: "",
    complianceApprovalDate: null,
    dpExecutionStatus: "Pending",
    executedBy: "",
    executionDate: null,
    completedBy: "",
    completionDate: null,
    rejectedBy: "",
    rejectionDate: null,
  };
}

export function normalizeForm(
  input: Partial<Record<keyof TransferForm, unknown>> | null | undefined
): TransferForm {
  const base = emptyForm();
  if (!input) return base;

  const str = (key: keyof TransferForm) => String(input[key] ?? base[key] ?? "").trim();
  const date = (key: keyof TransferForm) => {
    const value = String(input[key] ?? "").trim();
    return value || null;
  };
  const num = (key: keyof TransferForm) => Number(input[key] ?? 0) || 0;

  return {
    ...base,
    transferType: str("transferType"),
    transferReason: str("transferReason"),
    transferMode: str("transferMode"),
    expectedTransferDate: date("expectedTransferDate"),
    tradingAccountNumber: str("tradingAccountNumber"),
    dematAccountNumber: str("dematAccountNumber"),
    dpId: str("dpId"),
    depository: str("depository"),
    isThirdPartyTransfer: Boolean(input.isThirdPartyTransfer),
    targetClientName: str("targetClientName"),
    targetPanNumber: str("targetPanNumber"),
    targetDematAccountNumber: str("targetDematAccountNumber"),
    targetDpId: str("targetDpId"),
    targetDpName: str("targetDpName"),
    targetDepository: str("targetDepository"),
    targetDpCmr: str("targetDpCmr"),
    disSlipNumber: str("disSlipNumber"),
    disDocument: str("disDocument"),
    annexureDocument: str("annexureDocument"),
    signatureVerificationStatus: str("signatureVerificationStatus") || "Pending",
    signatureRemarks: String(input.signatureRemarks ?? ""),
    clientConfirmationStatus: str("clientConfirmationStatus") || "Pending",
    confirmationRemark: String(input.confirmationRemark ?? ""),
    complianceRemark: String(input.complianceRemark ?? ""),
    executionReference: str("executionReference"),
    dpRemark: String(input.dpRemark ?? ""),
    rejectionReason: String(input.rejectionReason ?? ""),
    caseEnteredBy: str("caseEnteredBy"),
    caseEntryDate: date("caseEntryDate"),
    totalQuantity: num("totalQuantity"),
    totalMarketValue: num("totalMarketValue"),
    securitiesSource: str("securitiesSource"),
    securitiesFetchedOn: date("securitiesFetchedOn"),
    clientMasterSource: str("clientMasterSource"),
    clientMasterFetchedOn: date("clientMasterFetchedOn"),
    documentsValidated: Boolean(input.documentsValidated),
    signatureVerifiedBy: str("signatureVerifiedBy"),
    signatureVerificationDate: date("signatureVerificationDate"),
    confirmationDate: date("confirmationDate"),
    complianceRequired: Boolean(input.complianceRequired),
    complianceRequiredReason: String(input.complianceRequiredReason ?? ""),
    complianceStatus: str("complianceStatus") || "Pending",
    complianceApprovedBy: str("complianceApprovedBy"),
    complianceApprovalDate: date("complianceApprovalDate"),
    dpExecutionStatus: str("dpExecutionStatus") || "Pending",
    executedBy: str("executedBy"),
    executionDate: date("executionDate"),
    completedBy: str("completedBy"),
    completionDate: date("completionDate"),
    rejectedBy: str("rejectedBy"),
    rejectionDate: date("rejectionDate"),
  };
}

export function emptySecurity(): TransferSecurity {
  return { isin: "", securityName: "", quantity: 0, marketValue: 0 };
}

export function normalizeSecurities(
  rows: TransferSecurity[] | null | undefined
): TransferSecurity[] {
  if (!Array.isArray(rows)) return [];

  return rows.map((row) => ({
    name: row?.name,
    isin: String(row?.isin ?? "").trim().toUpperCase(),
    securityName: String(row?.securityName ?? "").trim(),
    quantity: Number(row?.quantity ?? 0) || 0,
    marketValue: Number(row?.marketValue ?? 0) || 0,
  }));
}

/** Only the editable subset is ever sent back; the rest is workflow-owned. */
export function toPayload(
  form: TransferForm,
  securities: TransferSecurity[]
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const key of EDITABLE_FIELDS) {
    payload[key] = form[key as EditableField];
  }

  // Blank lines are what an agent leaves behind after adding a row and
  // changing their mind; dropping them here keeps the ISIN rule off their back.
  payload.securities = securities
    .filter((row) => row.isin.trim() || row.securityName.trim() || row.quantity)
    .map((row) => ({
      isin: row.isin.trim().toUpperCase(),
      securityName: row.securityName.trim(),
      quantity: Number(row.quantity) || 0,
      marketValue: Number(row.marketValue) || 0,
    }));

  return payload;
}

export function toClientRows(client: TransferClient): DetailRow[] {
  return [
    { key: "clientName", label: t("Client Name"), value: text(client.clientName) },
    { key: "clientId", label: t("Client ID"), value: text(client.clientId) },
    { key: "panNumber", label: t("PAN Number"), value: text(client.panNumber) },
    {
      key: "tradingAccountNumber",
      label: t("Trading Account Number"),
      value: text(client.tradingAccountNumber),
    },
    {
      key: "dematAccountNumber",
      label: t("Demat Account Number"),
      value: text(client.dematAccountNumber),
    },
    { key: "dpId", label: t("DP ID"), value: text(client.dpId) },
    { key: "depository", label: t("Depository"), value: text(client.depository) },
    { key: "registeredMobile", label: t("Registered Mobile"), value: text(client.registeredMobile) },
    { key: "registeredEmail", label: t("Registered Email"), value: text(client.registeredEmail) },
    { key: "clientAddress", label: t("Address"), value: text(client.clientAddress) },
  ];
}

/** Intake — the transfer being requested. */
export function getRequestFields(): TransferField[] {
  return [
    {
      fieldname: "tradingAccountNumber",
      label: t("Trading Account Number"),
      fieldtype: "Text",
      required: 1,
      description: t("Enter this, then press Fetch to auto-fill the client's details."),
    },
    { fieldname: "dematAccountNumber", label: t("Demat Account Number"), fieldtype: "Text" },
    { fieldname: "dpId", label: t("DP ID"), fieldtype: "Text" },
    {
      fieldname: "depository",
      label: t("Depository"),
      fieldtype: "Select",
      options: DEPOSITORIES.join("\n"),
    },
    {
      fieldname: "transferType",
      label: t("Transfer Type"),
      fieldtype: "Select",
      options: TRANSFER_TYPES.join("\n"),
      required: 1,
    },
    {
      fieldname: "transferMode",
      label: t("Transfer Mode"),
      fieldtype: "Select",
      options: TRANSFER_MODES.join("\n"),
      required: 1,
    },
    {
      fieldname: "transferReason",
      label: t("Transfer Reason"),
      fieldtype: "Select",
      options: TRANSFER_REASONS.join("\n"),
    },
    {
      fieldname: "expectedTransferDate",
      label: t("Expected Transfer Date"),
      fieldtype: "Date",
    },
  ];
}

/** Where the securities are going. */
export function getTargetFields(form: TransferForm): TransferField[] {
  const fields: TransferField[] = [
    {
      fieldname: "isThirdPartyTransfer",
      label: t("Third Party Transfer"),
      fieldtype: "Checkbox",
      description: t("The receiving account belongs to someone other than the client."),
    },
  ];

  const required = form.isThirdPartyTransfer ? 1 : 0;

  fields.push(
    {
      fieldname: "targetClientName",
      label: t("Target Account Holder"),
      fieldtype: "Text",
      required,
    },
    { fieldname: "targetPanNumber", label: t("Target PAN Number"), fieldtype: "Text" },
    {
      fieldname: "targetDematAccountNumber",
      label: t("Target Demat Account Number"),
      fieldtype: "Text",
      required,
    },
    { fieldname: "targetDpId", label: t("Target DP ID"), fieldtype: "Text", required },
    { fieldname: "targetDpName", label: t("Target DP Name"), fieldtype: "Text" },
    {
      fieldname: "targetDepository",
      label: t("Target Depository"),
      fieldtype: "Select",
      options: DEPOSITORIES.join("\n"),
    },
    {
      fieldname: "targetDpCmr",
      label: t("Target DP Client Master Report"),
      fieldtype: "Text",
      required,
      description: t("File URL. Required for a third party transfer."),
    }
  );

  return fields;
}

/** The DIS paperwork and the signature check. */
export function getDocumentFields(): TransferField[] {
  return [
    { fieldname: "disSlipNumber", label: t("DIS Slip Number"), fieldtype: "Text", required: 1 },
    {
      fieldname: "disDocument",
      label: t("Scanned DIS Slip"),
      fieldtype: "Text",
      required: 1,
      description: t("File URL. Required before the signature can be marked verified."),
    },
    {
      fieldname: "annexureDocument",
      label: t("Annexure / Supporting Document"),
      fieldtype: "Text",
    },
    {
      fieldname: "signatureVerificationStatus",
      label: t("Signature Verification"),
      fieldtype: "Select",
      options: SIGNATURE_STATUSES.join("\n"),
      required: 1,
    },
    {
      fieldname: "signatureRemarks",
      label: t("Signature Remarks"),
      fieldtype: "TextArea",
      description: t("Required when the signature could not be verified."),
    },
  ];
}

/** The confirmation call. */
export function getConfirmationFields(): TransferField[] {
  return [
    {
      fieldname: "clientConfirmationStatus",
      label: t("Client Confirmation"),
      fieldtype: "Select",
      options: CONFIRMATION_STATUSES.join("\n"),
      required: 1,
    },
    {
      fieldname: "confirmationRemark",
      label: t("Confirmation Remark"),
      fieldtype: "TextArea",
      required: 1,
      description: t("Record the number called, the date, and the ISINs the client confirmed."),
    },
  ];
}

/** Compliance, execution and the outcome — remarks only; the rest is stamped. */
export function getProcessingFields(): TransferField[] {
  return [
    { fieldname: "complianceRemark", label: t("Compliance Remark"), fieldtype: "TextArea" },
    {
      fieldname: "executionReference",
      label: t("Execution Reference"),
      fieldtype: "Text",
      description: t("The depository's transaction reference for the executed transfer."),
    },
    { fieldname: "dpRemark", label: t("DP Remark"), fieldtype: "TextArea" },
    {
      fieldname: "rejectionReason",
      label: t("Rejection Reason"),
      fieldtype: "TextArea",
      description: t("Required when rejecting the case."),
    },
  ];
}

/** Read-only status, shown beside the editable blocks. */
export function toStatusRows(form: TransferForm): DetailRow[] {
  return [
    { key: "caseEnteredBy", label: t("Case Entered By"), value: text(form.caseEnteredBy) },
    { key: "caseEntryDate", label: t("Case Entry Date"), value: formatDate(form.caseEntryDate) },
    {
      key: "documentsValidated",
      label: t("Documents Validated"),
      value: form.documentsValidated ? t("Yes") : t("No"),
    },
    {
      key: "signatureVerifiedBy",
      label: t("Signature Verified By"),
      value: text(form.signatureVerifiedBy),
    },
    {
      key: "signatureVerificationDate",
      label: t("Signature Verification Date"),
      value: formatDate(form.signatureVerificationDate),
    },
    {
      key: "confirmationDate",
      label: t("Confirmation Date"),
      value: formatDate(form.confirmationDate),
    },
    {
      key: "complianceRequired",
      label: t("Compliance Review Required"),
      value: form.complianceRequired ? t("Yes") : t("No"),
    },
    { key: "complianceStatus", label: t("Compliance Status"), value: text(form.complianceStatus) },
    {
      key: "complianceApprovedBy",
      label: t("Compliance Approved By"),
      value: text(form.complianceApprovedBy),
    },
    {
      key: "complianceApprovalDate",
      label: t("Compliance Approval Date"),
      value: formatDate(form.complianceApprovalDate),
    },
    { key: "dpExecutionStatus", label: t("Execution Status"), value: text(form.dpExecutionStatus) },
    { key: "executedBy", label: t("Executed By"), value: text(form.executedBy) },
    { key: "executionDate", label: t("Execution Date"), value: formatDate(form.executionDate) },
    { key: "completedBy", label: t("Completed By"), value: text(form.completedBy) },
    { key: "completionDate", label: t("Completion Date"), value: formatDate(form.completionDate) },
    { key: "rejectedBy", label: t("Rejected By"), value: text(form.rejectedBy) },
    { key: "rejectionDate", label: t("Rejection Date"), value: formatDate(form.rejectionDate) },
    {
      key: "clientMasterSource",
      label: t("Client Master Source"),
      value: text(form.clientMasterSource),
    },
    {
      key: "clientMasterFetchedOn",
      label: t("Client Master Fetched On"),
      value: formatDateTime(form.clientMasterFetchedOn),
    },
    { key: "securitiesSource", label: t("Securities Source"), value: text(form.securitiesSource) },
    {
      key: "securitiesFetchedOn",
      label: t("Securities Fetched On"),
      value: formatDateTime(form.securitiesFetchedOn),
    },
  ];
}

/** ISIN is 12 characters: two country letters, nine alphanumerics, a check digit. */
export function isValidIsin(isin: string): boolean {
  const value = isin.trim().toUpperCase();
  return /^[A-Z]{2}[A-Z0-9]{9}\d$/.test(value);
}

/**
 * Client-side validation mirroring the case controller. The server copy is the
 * one that holds; this is for immediate feedback.
 */
export function validateForm(
  form: TransferForm
): Partial<Record<keyof TransferForm, string>> {
  const errors: Partial<Record<keyof TransferForm, string>> = {};

  const pan = (value: string) => /^[A-Z]{5}\d{4}[A-Z]$/.test(value.trim().toUpperCase());

  if (form.targetPanNumber.trim() && !pan(form.targetPanNumber)) {
    errors.targetPanNumber = t("Must be in the format ABCDE1234F");
  }

  if (form.signatureVerificationStatus === "Verified" && !form.disDocument.trim()) {
    errors.disDocument = t(
      "Attach the scanned DIS slip before marking the signature verified"
    );
  }

  if (form.signatureVerificationStatus === "Not Verified" && !form.signatureRemarks.trim()) {
    errors.signatureRemarks = t("Record why the signature could not be verified");
  }

  if (form.isThirdPartyTransfer) {
    if (!form.targetClientName.trim()) {
      errors.targetClientName = t("Required for a third party transfer");
    }
    if (!form.targetDematAccountNumber.trim()) {
      errors.targetDematAccountNumber = t("Required for a third party transfer");
    }
    if (!form.targetDpId.trim()) {
      errors.targetDpId = t("Required for a third party transfer");
    }
  }

  const confirmed =
    form.clientConfirmationStatus === "Confirmed" ||
    form.clientConfirmationStatus === "Declined";
  if (confirmed) {
    const digits = (form.confirmationRemark.match(/\d/g) || []).length;
    if (digits < 8) {
      errors.confirmationRemark = t(
        "Record the phone number used for verification and the date of the call"
      );
    }
  }

  return errors;
}

/** Row-level validation for the securities grid, keyed by row index. */
export function validateSecurities(
  rows: TransferSecurity[]
): Record<number, string> {
  const errors: Record<number, string> = {};

  rows.forEach((row, index) => {
    const isBlank = !row.isin.trim() && !row.securityName.trim() && !row.quantity;
    if (isBlank) return;

    if (!isValidIsin(row.isin)) {
      errors[index] = t("Not a valid ISIN — expected 12 characters, e.g. INE002A01018");
      return;
    }
    if (!(Number(row.quantity) > 0)) {
      errors[index] = t("Quantity must be greater than zero");
    }
  });

  return errors;
}

export { EMPTY_VALUE };
