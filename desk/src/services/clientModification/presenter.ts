/**
 * FR-14 Client Modification — presentation helpers.
 *
 * Pure functions turning the API record into what the tab renders: label/value
 * rows for Details, and field descriptors for the two editable blocks. Labels
 * are resolved inside functions, never at module scope, because translations
 * load after app boot.
 */
import dayjs from "dayjs";

import { EMPTY_VALUE, t, type DetailRow, type FormFieldDescriptor } from "../accountOpening";

import {
  ACCOUNT_SCOPES,
  CALL_STATUSES,
  EDITABLE_FIELDS,
  IPV_FLAGS,
  MODIFICATION_SUB_TYPES,
  MODIFICATION_TYPES,
  TRADING_ONLY_TYPES,
  type EditableField,
  type ModificationClient,
  type ModificationForm,
} from "./types";

/** Field descriptors for this form's own keys. */
type ModificationField = FormFieldDescriptor<keyof ModificationForm>;

const CONTACT_UPDATE = "Contact Details Update";

function text(value: string | null | undefined): string {
  const trimmed = (value ?? "").trim();
  return trimmed || EMPTY_VALUE;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return EMPTY_VALUE;
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format("DD MMM YYYY") : EMPTY_VALUE;
}

export function emptyForm(): ModificationForm {
  return {
    modificationType: "",
    modificationSubType: "",
    accountScope: "",
    tradingAccountNumber: "",
    dematAccountNumber: "",
    signatureVerified: false,
    signatureDocument: "",
    ipvFlag: "",
    firstCallStatus: "Pending",
    secondCallStatus: "Pending",
    thirdCallStatus: "Pending",
    cssRemark: "",
    accopRemark: "",
    cssStatus: "Pending",
    cssApprovedDate: null,
    caseModifiedBy: "",
    makerLevel: "PENDING",
    makerCompleteDate: null,
    checkerUser: "",
    checkerLevel: "PENDING",
    accopStatus: "PENDING",
    accopApprovedDate: null,
    accopRejectDate: null,
  };
}

export function normalizeForm(
  input: Partial<Record<keyof ModificationForm, unknown>> | null | undefined
): ModificationForm {
  const base = emptyForm();
  if (!input) return base;

  const str = (key: keyof ModificationForm) =>
    String(input[key] ?? base[key] ?? "").trim();
  const date = (key: keyof ModificationForm) => {
    const value = String(input[key] ?? "").trim();
    return value || null;
  };

  return {
    ...base,
    modificationType: str("modificationType"),
    modificationSubType: str("modificationSubType"),
    accountScope: str("accountScope"),
    tradingAccountNumber: str("tradingAccountNumber"),
    dematAccountNumber: str("dematAccountNumber"),
    signatureVerified: Boolean(input.signatureVerified),
    signatureDocument: str("signatureDocument"),
    ipvFlag: str("ipvFlag"),
    firstCallStatus: str("firstCallStatus") || "Pending",
    secondCallStatus: str("secondCallStatus") || "Pending",
    thirdCallStatus: str("thirdCallStatus") || "Pending",
    cssRemark: String(input.cssRemark ?? ""),
    accopRemark: String(input.accopRemark ?? ""),
    cssStatus: str("cssStatus") || "Pending",
    cssApprovedDate: date("cssApprovedDate"),
    caseModifiedBy: str("caseModifiedBy"),
    makerLevel: str("makerLevel") || "PENDING",
    makerCompleteDate: date("makerCompleteDate"),
    checkerUser: str("checkerUser"),
    checkerLevel: str("checkerLevel") || "PENDING",
    accopStatus: str("accopStatus") || "PENDING",
    accopApprovedDate: date("accopApprovedDate"),
    accopRejectDate: date("accopRejectDate"),
  };
}

/** Only the editable subset is ever sent back; the rest is workflow-owned. */
export function toPayload(form: ModificationForm): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const key of EDITABLE_FIELDS) {
    payload[key] = form[key as EditableField];
  }
  return payload;
}

export function toClientRows(client: ModificationClient): DetailRow[] {
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
    { key: "registeredMobile", label: t("Registered Mobile"), value: text(client.registeredMobile) },
    { key: "registeredEmail", label: t("Registered Email"), value: text(client.registeredEmail) },
    { key: "address", label: t("Address"), value: text(client.address) },
    { key: "bankDetails", label: t("Bank Details"), value: text(client.bankDetails) },
  ];
}

/** The CSS team's block — BRD Step 2 to Step 7. */
export function getCssFields(form: ModificationForm): ModificationField[] {
  const fields: ModificationField[] = [
    {
      fieldname: "tradingAccountNumber",
      label: t("Trading Account Number"),
      fieldtype: "Text",
      required: 1,
      description: t("Enter this, then press Fetch to auto-fill the client's details."),
    },
    {
      fieldname: "dematAccountNumber",
      label: t("Demat Account Number"),
      fieldtype: "Text",
    },
    {
      fieldname: "modificationType",
      label: t("Modification Type"),
      fieldtype: "Select",
      options: MODIFICATION_TYPES.join("\n"),
      required: 1,
    },
  ];

  // Sub-type applies to Contact Details Update only.
  if (form.modificationType === CONTACT_UPDATE) {
    fields.push({
      fieldname: "modificationSubType",
      label: t("Modification Sub Type"),
      fieldtype: "Select",
      options: MODIFICATION_SUB_TYPES.join("\n"),
      required: 1,
    });
  }

  fields.push(
    {
      fieldname: "accountScope",
      label: t("Account Scope"),
      fieldtype: "Select",
      options: ACCOUNT_SCOPES.join("\n"),
      required: 1,
      description: TRADING_ONLY_TYPES.includes(form.modificationType)
        ? t("Bank changes are held on the trading account, so DP Only is not valid.")
        : undefined,
    },
    {
      fieldname: "signatureVerified",
      label: t("Signature Verified"),
      fieldtype: "Checkbox",
      description: t("The case cannot proceed until this is ticked."),
    },
    {
      fieldname: "signatureDocument",
      label: t("Scanned Signature Document"),
      fieldtype: "Text",
      description: t("File URL. Required before the signature can be marked verified."),
    },
    {
      fieldname: "ipvFlag",
      label: t("IPV Flag"),
      fieldtype: "Select",
      options: IPV_FLAGS.join("\n"),
      required: form.modificationType === "KYC Update" ? 1 : 0,
    },
    {
      fieldname: "firstCallStatus",
      label: t("First Call"),
      fieldtype: "Select",
      options: CALL_STATUSES.join("\n"),
      required: 1,
    },
    {
      fieldname: "secondCallStatus",
      label: t("Second Call"),
      fieldtype: "Select",
      options: CALL_STATUSES.join("\n"),
      required: 1,
    },
    {
      fieldname: "thirdCallStatus",
      label: t("Third Call"),
      fieldtype: "Select",
      options: CALL_STATUSES.join("\n"),
      required: 1,
    },
    {
      fieldname: "cssRemark",
      label: t("CSS Remark"),
      fieldtype: "TextArea",
      required: 1,
      description: t("Record the number called, the date, and what was confirmed."),
    }
  );

  return fields;
}

/** The Account Opening block — BRD Step 9 to Step 11. Mostly stamped. */
export function getAccOpFields(): ModificationField[] {
  return [
    {
      fieldname: "accopRemark",
      label: t("AccOp Remark"),
      fieldtype: "TextArea",
      description: t("Numbered entries, appended in sequence."),
    },
  ];
}

/** Read-only progress, shown beside the editable block. */
export function toProgressRows(form: ModificationForm): DetailRow[] {
  return [
    { key: "cssStatus", label: t("CSS Status"), value: text(form.cssStatus) },
    { key: "cssApprovedDate", label: t("CSS Approved Date"), value: formatDate(form.cssApprovedDate) },
    { key: "caseModifiedBy", label: t("Case Modified By (Maker)"), value: text(form.caseModifiedBy) },
    { key: "makerLevel", label: t("Maker Level"), value: text(form.makerLevel) },
    {
      key: "makerCompleteDate",
      label: t("Maker Complete Date"),
      value: formatDate(form.makerCompleteDate),
    },
    { key: "checkerUser", label: t("Checked By"), value: text(form.checkerUser) },
    { key: "checkerLevel", label: t("Checker Level"), value: text(form.checkerLevel) },
    { key: "accopStatus", label: t("AccOp Status"), value: text(form.accopStatus) },
    {
      key: "accopApprovedDate",
      label: t("AccOp Approved Date"),
      value: formatDate(form.accopApprovedDate),
    },
    { key: "accopRejectDate", label: t("AccOp Reject Date"), value: formatDate(form.accopRejectDate) },
  ];
}

/**
 * Client-side validation mirroring client_modification/validations.py. The
 * server copy is the one that holds; this is for immediate feedback.
 */
export function validateForm(
  form: ModificationForm
): Partial<Record<keyof ModificationForm, string>> {
  const errors: Partial<Record<keyof ModificationForm, string>> = {};

  if (form.signatureVerified && !form.signatureDocument.trim()) {
    errors.signatureDocument = t(
      "Attach the scanned signature document before marking the signature verified"
    );
  }

  if (form.modificationSubType && form.modificationType !== CONTACT_UPDATE) {
    errors.modificationSubType = t("Applies only to Contact Details Update");
  }

  if (form.accountScope === "DP Only" && TRADING_ONLY_TYPES.includes(form.modificationType)) {
    errors.accountScope = t(
      "Bank changes are held on the trading account and cannot be DP Only"
    );
  }

  const needsTrading =
    form.accountScope === "Trading Only" || form.accountScope === "Trading + DP (Both)";
  if (needsTrading && !form.tradingAccountNumber.trim()) {
    errors.tradingAccountNumber = t("Required for this account scope");
  }

  const needsDemat =
    form.accountScope === "DP Only" || form.accountScope === "Trading + DP (Both)";
  if (needsDemat && !form.dematAccountNumber.trim()) {
    errors.dematAccountNumber = t("Required for this account scope");
  }

  return errors;
}

export { EMPTY_VALUE };
