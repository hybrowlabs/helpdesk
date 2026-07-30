/**
 * FR-11 Account Closure — presentation helpers.
 *
 * Pure functions turning the API record into what the tab renders: label/value
 * rows for the read-only blocks, and field descriptors for the editable ones.
 * Labels are resolved inside functions, never at module scope, because
 * translations load after app boot.
 *
 * The field descriptors are grouped the way the BRD groups the work — intake,
 * documents, the five departments, the approval remarks — because the tab shows
 * one group at a time and each group has a different owner.
 */
import dayjs from "dayjs";

import { EMPTY_VALUE, t, type DetailRow, type FormFieldDescriptor } from "../accountOpening";

import {
  COMPLETING_TEAMS,
  CONFIRMATION_STATUSES,
  CURRENCY_FIELDS,
  EDITABLE_FIELDS,
  HOLDING_NIL,
  HOLDING_SHARES_HELD,
  HOLDING_STATUSES,
  SIGNATURE_STATUSES,
  TECHPLUS_STATUSES,
  type ClosureClient,
  type ClosureForm,
  type EditableField,
} from "./types";

/** Field descriptors for this form's own keys. */
export type ClosureField = FormFieldDescriptor<keyof ClosureForm>;

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
  return parsed.isValid() ? parsed.format("DD MMM YYYY HH:mm") : EMPTY_VALUE;
}

function money(value: number | null | undefined): string {
  if (!value) return EMPTY_VALUE;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

function yesNo(value: boolean): string {
  return value ? t("Yes") : t("No");
}

export function emptyForm(): ClosureForm {
  return {
    techplusCaseId: "",
    techplusStatus: "Pending",

    closeTradingAccount: false,
    closeNsdlAccount: false,
    closeCdslAccount: false,
    tradingAccountNumber: "",
    dematAccountNumber: "",
    dpId: "",

    clientId: "",
    clientName: "",
    panNumber: "",
    isEmployeeAccount: false,
    registeredMobile: "",
    registeredEmail: "",
    clientAddress: "",

    holdingStatus: "",
    closureRemark: "",
    isThirdPartyTransfer: false,
    isClosureCumTransfer: false,

    accountClosureForm: "",
    disId: "",
    disDocument: "",
    targetDpName: "",
    targetDpCmr: "",

    signatureVerificationStatus: "Pending",
    signatureDocument: "",
    signatureVerificationRemarks: "",

    holdingValue: 0,
    debitBalance: 0,

    dpConfirmationStatus: "Pending",
    dpDebitProcessed: false,
    dpOutstandingDemand: false,
    dpOutstandingDemandAmount: 0,
    dpRemark: "",
    ctclConfirmationStatus: "Pending",
    tradingAccountFrozen: false,
    dematAccountFrozen: false,
    ctclRemark: "",
    riskConfirmationStatus: "Pending",
    accountDeactivated: false,
    riskRemark: "",
    paymentsConfirmationStatus: "Pending",
    outstandingBalanceExists: false,
    tradingDebitConfirmed: false,
    paymentsRemark: "",
    accountsConfirmationStatus: "Pending",
    accountingClearanceConfirmed: false,
    accountsRemark: "",

    rmRemark: "",
    hodRemark: "",
    complianceRemark: "",
    managementRemark: "",

    closureCompletedByTeam: "",

    rejectionReason: "",
    rejectionEmailSent: false,

    caseType: "Account Closure",
    caseEnteredBy: "",
    caseEntryDate: null,
    techplusUpdatedOn: null,
    nilHolding: false,
    transferRequired: false,
    documentsValidated: false,
    signatureVerifiedBy: "",
    signatureVerificationDate: null,
    holdingsSource: "",
    holdingsFetchedOn: null,
    departmentalConfirmationsComplete: false,
    dpConfirmedBy: "",
    dpConfirmationDate: null,
    ctclConfirmedBy: "",
    ctclConfirmationDate: null,
    riskConfirmedBy: "",
    riskConfirmationDate: null,
    paymentsConfirmedBy: "",
    paymentsConfirmationDate: null,
    accountsConfirmedBy: "",
    accountsConfirmationDate: null,
    approvalsComplete: false,
    complianceRequired: false,
    complianceRequiredReason: "",
    rmApprovalStatus: "Pending",
    rmApprovedBy: "",
    rmApprovalDate: null,
    hodApprovalStatus: "Pending",
    hodApprovedBy: "",
    hodApprovalDate: null,
    complianceApprovalStatus: "Pending",
    complianceApprovedBy: "",
    complianceApprovalDate: null,
    managementApprovalStatus: "Pending",
    managementApprovedBy: "",
    managementApprovalDate: null,
    closureCompletedBy: "",
    closureCompletionDate: null,
    forwardingEmailSent: false,
    forwardingEmailSentOn: null,
    forwardingRecipients: "",
    rejectionStage: "",
    rejectedBy: "",
    rejectionDate: null,
    rejectionEmailSentOn: null,
    rejectionCcList: "",
  };
}

const CHECK_KEYS = new Set<keyof ClosureForm>([
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
  "nilHolding",
  "transferRequired",
  "documentsValidated",
  "departmentalConfirmationsComplete",
  "approvalsComplete",
  "complianceRequired",
  "forwardingEmailSent",
]);

const CURRENCY_KEYS = new Set<string>(CURRENCY_FIELDS);

const DATE_KEYS = new Set<keyof ClosureForm>([
  "caseEntryDate",
  "techplusUpdatedOn",
  "signatureVerificationDate",
  "dpConfirmationDate",
  "ctclConfirmationDate",
  "riskConfirmationDate",
  "paymentsConfirmationDate",
  "accountsConfirmationDate",
  "rmApprovalDate",
  "hodApprovalDate",
  "complianceApprovalDate",
  "managementApprovalDate",
  "closureCompletionDate",
  "rejectionDate",
  "rejectionEmailSentOn",
  "holdingsFetchedOn",
  "forwardingEmailSentOn",
]);

export function normalizeForm(
  input: Partial<Record<keyof ClosureForm, unknown>> | null | undefined
): ClosureForm {
  const base = emptyForm();
  if (!input) return base;

  const next = { ...base } as Record<string, unknown>;

  for (const key of Object.keys(base) as (keyof ClosureForm)[]) {
    const raw = input[key];

    if (CHECK_KEYS.has(key)) {
      next[key] = Boolean(raw);
    } else if (CURRENCY_KEYS.has(key)) {
      next[key] = Number(raw ?? 0) || 0;
    } else if (DATE_KEYS.has(key)) {
      const value = String(raw ?? "").trim();
      next[key] = value || null;
    } else if (raw === undefined || raw === null) {
      next[key] = base[key];
    } else {
      next[key] = String(raw);
    }
  }

  return next as ClosureForm;
}

/** Only the editable subset is ever sent back; the rest is workflow-owned. */
export function toPayload(form: ClosureForm): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const key of EDITABLE_FIELDS) {
    payload[key] = form[key as EditableField];
  }
  return payload;
}

export function toClientRows(client: ClosureClient): DetailRow[] {
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
    { key: "registeredMobile", label: t("Registered Mobile"), value: text(client.registeredMobile) },
    { key: "registeredEmail", label: t("Registered Email"), value: text(client.registeredEmail) },
    { key: "clientAddress", label: t("Address"), value: text(client.clientAddress) },
  ];
}

/**
 * The CSS team's intake block — BRD steps 1 to 4, plus the FR-11.5 documents.
 * `transferRequired` is derived server-side, so the transfer questions and the
 * documents they demand only appear once the agent has said shares are held.
 */
export function getIntakeFields(form: ClosureForm): ClosureField[] {
  const fields: ClosureField[] = [
    {
      fieldname: "tradingAccountNumber",
      label: t("Trading Account Number"),
      fieldtype: "Text",
      description: t("Enter this, then press Fetch to auto-fill the client's details."),
    },
    { fieldname: "dematAccountNumber", label: t("Demat Account Number"), fieldtype: "Text" },
    { fieldname: "dpId", label: t("DP ID"), fieldtype: "Text" },
    {
      fieldname: "closeTradingAccount",
      label: t("Close Trading Account"),
      fieldtype: "Checkbox",
    },
    {
      fieldname: "closeNsdlAccount",
      label: t("Close NSDL Demat Account"),
      fieldtype: "Checkbox",
    },
    {
      fieldname: "closeCdslAccount",
      label: t("Close CDSL Demat Account"),
      fieldtype: "Checkbox",
      description: t("One case covers trading, NSDL and CDSL together."),
    },
    {
      fieldname: "isEmployeeAccount",
      label: t("Employee Account"),
      fieldtype: "Checkbox",
      description: t("An employee account always requires Compliance approval."),
    },
    {
      fieldname: "holdingStatus",
      label: t("Holding Status"),
      fieldtype: "Select",
      options: HOLDING_STATUSES.join("\n"),
      required: 1,
      description:
        form.holdingStatus === HOLDING_NIL
          ? t("NIL Holding is recorded on this case — it is not a separate workflow.")
          : t("Whether shares are held and must be transferred to another demat account."),
    },
    {
      fieldname: "closureRemark",
      label: t("Closure Remark"),
      fieldtype: "TextArea",
      required: 1,
      description: t("Record that this is a closure request, and the transfer position."),
    },
  ];

  if (form.holdingStatus === HOLDING_SHARES_HELD) {
    fields.push(
      {
        fieldname: "isThirdPartyTransfer",
        label: t("Third-Party Stock Transfer"),
        fieldtype: "Checkbox",
        description: t("A Delivery Instruction Slip becomes mandatory."),
      },
      {
        fieldname: "isClosureCumTransfer",
        label: t("Closure-cum-Transfer"),
        fieldtype: "Checkbox",
        description: t("Both the closure form and the target DP's CMR become mandatory."),
      }
    );
  }

  fields.push(
    {
      fieldname: "techplusCaseId",
      label: t("Tech+ Center Case ID"),
      fieldtype: "Text",
    },
    {
      fieldname: "techplusStatus",
      label: t("Tech+ Center Status"),
      fieldtype: "Select",
      options: TECHPLUS_STATUSES.join("\n"),
    }
  );

  return fields;
}

/** FR-11.5 / FR-11.6 — the documents and the signature check. */
export function getDocumentFields(form: ClosureForm): ClosureField[] {
  const fields: ClosureField[] = [
    {
      fieldname: "accountClosureForm",
      label: t("Account Closure Form"),
      fieldtype: "Text",
      required: 1,
      description: t("File URL. Every closure case needs the signed form from the client."),
    },
  ];

  if (form.isThirdPartyTransfer) {
    fields.push(
      { fieldname: "disId", label: t("DIS ID"), fieldtype: "Text", required: 1 },
      {
        fieldname: "disDocument",
        label: t("Delivery Instruction Slip"),
        fieldtype: "Text",
        required: 1,
        description: t("File URL. Mandatory for a third-party transfer."),
      }
    );
  }

  if (form.isThirdPartyTransfer || form.isClosureCumTransfer) {
    fields.push({ fieldname: "targetDpName", label: t("Target DP"), fieldtype: "Text" });
  }

  if (form.isClosureCumTransfer) {
    fields.push({
      fieldname: "targetDpCmr",
      label: t("Client Master Report (Target DP)"),
      fieldtype: "Text",
      required: 1,
      description: t("File URL. Mandatory for a closure-cum-transfer case."),
    });
  }

  fields.push(
    {
      fieldname: "signatureVerificationStatus",
      label: t("Signature Verification Status"),
      fieldtype: "Select",
      options: SIGNATURE_STATUSES.join("\n"),
      required: 1,
      description: t("Mandatory before the case can be entered in Tech+ Center."),
    },
    {
      fieldname: "signatureDocument",
      label: t("Scanned Signature Document"),
      fieldtype: "Text",
      description: t("File URL. Required before the signature can be marked verified."),
    },
    {
      fieldname: "signatureVerificationRemarks",
      label: t("Verification Remarks"),
      fieldtype: "TextArea",
      description: t("Required when the signature is rejected."),
    },
    {
      fieldname: "holdingValue",
      label: t("Holding Value"),
      fieldtype: "Text",
      description: t("Drives the Compliance threshold rule. Fetch pulls it from the back office."),
    },
    { fieldname: "debitBalance", label: t("Debit Balance"), fieldtype: "Text" }
  );

  return fields;
}

/**
 * FR-11.9 — the five departmental blocks, each with the role that owns it. The
 * tab renders one card per department and disables the ones this user's roles do
 * not cover.
 */
export interface DepartmentBlock {
  key: string;
  label: string;
  statusField: keyof ClosureForm;
  confirmedByField: keyof ClosureForm;
  confirmationDateField: keyof ClosureForm;
  duty: string;
  fields: ClosureField[];
}

export function getDepartmentBlocks(form: ClosureForm): DepartmentBlock[] {
  return [
    {
      key: "dp",
      label: t("DP Team"),
      statusField: "dpConfirmationStatus",
      confirmedByField: "dpConfirmedBy",
      confirmationDateField: "dpConfirmationDate",
      duty: t("Confirm and process any debit against the demat account, and check for an outstanding demand."),
      fields: [
        {
          fieldname: "dpConfirmationStatus",
          label: t("DP Confirmation"),
          fieldtype: "Select",
          options: CONFIRMATION_STATUSES.join("\n"),
        },
        {
          fieldname: "dpDebitProcessed",
          label: t("Demat Debit Processed"),
          fieldtype: "Checkbox",
          description: t("Required before the DP Team can confirm."),
        },
        {
          fieldname: "dpOutstandingDemand",
          label: t("Outstanding Demand Exists"),
          fieldtype: "Checkbox",
        },
        ...(form.dpOutstandingDemand
          ? ([
              {
                fieldname: "dpOutstandingDemandAmount",
                label: t("Outstanding Demand Amount"),
                fieldtype: "Text",
                required: 1,
              },
            ] as ClosureField[])
          : []),
        { fieldname: "dpRemark", label: t("DP Remark"), fieldtype: "TextArea" },
      ],
    },
    {
      key: "ctcl",
      label: t("CTCL / Risk — Freeze"),
      statusField: "ctclConfirmationStatus",
      confirmedByField: "ctclConfirmedBy",
      confirmationDateField: "ctclConfirmationDate",
      duty: t("Freeze the trading account and the demat account to prevent further transactions."),
      fields: [
        {
          fieldname: "ctclConfirmationStatus",
          label: t("CTCL Confirmation"),
          fieldtype: "Select",
          options: CONFIRMATION_STATUSES.join("\n"),
        },
        {
          fieldname: "tradingAccountFrozen",
          label: t("Trading Account Frozen"),
          fieldtype: "Checkbox",
        },
        {
          fieldname: "dematAccountFrozen",
          label: t("Demat Account Frozen"),
          fieldtype: "Checkbox",
          description: t("Both freezes are required before CTCL can confirm."),
        },
        { fieldname: "ctclRemark", label: t("CTCL Remark"), fieldtype: "TextArea" },
      ],
    },
    {
      key: "risk",
      label: t("Risk — Deactivation"),
      statusField: "riskConfirmationStatus",
      confirmedByField: "riskConfirmedBy",
      confirmationDateField: "riskConfirmationDate",
      duty: t("Deactivate the account."),
      fields: [
        {
          fieldname: "riskConfirmationStatus",
          label: t("Risk Confirmation"),
          fieldtype: "Select",
          options: CONFIRMATION_STATUSES.join("\n"),
        },
        {
          fieldname: "accountDeactivated",
          label: t("Account Deactivated"),
          fieldtype: "Checkbox",
        },
        { fieldname: "riskRemark", label: t("Risk Remark"), fieldtype: "TextArea" },
      ],
    },
    {
      key: "payments",
      label: t("Payments Team"),
      statusField: "paymentsConfirmationStatus",
      confirmedByField: "paymentsConfirmedBy",
      confirmationDateField: "paymentsConfirmationDate",
      duty: t("Confirm the trading debit payment if an outstanding balance exists."),
      fields: [
        {
          fieldname: "paymentsConfirmationStatus",
          label: t("Payments Confirmation"),
          fieldtype: "Select",
          options: CONFIRMATION_STATUSES.join("\n"),
        },
        {
          fieldname: "outstandingBalanceExists",
          label: t("Outstanding Balance Exists"),
          fieldtype: "Checkbox",
        },
        ...(form.outstandingBalanceExists
          ? ([
              {
                fieldname: "tradingDebitConfirmed",
                label: t("Trading Debit Confirmed"),
                fieldtype: "Checkbox",
                description: t("Required before Payments can confirm."),
              },
            ] as ClosureField[])
          : []),
        { fieldname: "paymentsRemark", label: t("Payments Remark"), fieldtype: "TextArea" },
      ],
    },
    {
      key: "accounts",
      label: t("Accounts Team"),
      statusField: "accountsConfirmationStatus",
      confirmedByField: "accountsConfirmedBy",
      confirmationDateField: "accountsConfirmationDate",
      duty: t("Confirm accounting clearance."),
      fields: [
        {
          fieldname: "accountsConfirmationStatus",
          label: t("Accounts Confirmation"),
          fieldtype: "Select",
          options: CONFIRMATION_STATUSES.join("\n"),
        },
        {
          fieldname: "accountingClearanceConfirmed",
          label: t("Accounting Clearance Confirmed"),
          fieldtype: "Checkbox",
        },
        { fieldname: "accountsRemark", label: t("Accounts Remark"), fieldtype: "TextArea" },
      ],
    },
  ];
}

/**
 * Phase 2. The approvals themselves are workflow actions taken from the ticket
 * header, so only the remarks, the completing team, and the rejection record are
 * typed here.
 */
export function getApprovalFields(): ClosureField[] {
  return [
    { fieldname: "rmRemark", label: t("RM Remark"), fieldtype: "TextArea" },
    { fieldname: "hodRemark", label: t("HOD Remark"), fieldtype: "TextArea" },
    { fieldname: "complianceRemark", label: t("Compliance Remark"), fieldtype: "TextArea" },
    { fieldname: "managementRemark", label: t("Management Remark"), fieldtype: "TextArea" },
    {
      fieldname: "closureCompletedByTeam",
      label: t("Completed By Team"),
      fieldtype: "Select",
      options: COMPLETING_TEAMS.join("\n"),
      description: t("Required before the closure can be completed."),
    },
    {
      fieldname: "rejectionReason",
      label: t("Rejection Reason"),
      fieldtype: "TextArea",
      description: t("Required to reject, and pushed to Tech+ Center with the status update."),
    },
    {
      fieldname: "rejectionEmailSent",
      label: t("Rejection Email Sent"),
      fieldtype: "Checkbox",
      description: t("The rejection email is sent manually by the team — tick this once it has gone."),
    },
  ];
}

/** FR-11.10 — the phase 1 barrier, rendered as a checklist. */
export function toPhaseOneRows(form: ClosureForm): DetailRow[] {
  return getDepartmentBlocks(form).map((block) => ({
    key: block.key,
    label: block.label,
    value: `${text(form[block.statusField] as string)} · ${text(
      form[block.confirmedByField] as string
    )} · ${formatDate(form[block.confirmationDateField] as string | null)}`,
  }));
}

/** FR-11.10 / FR-11.11 — the approval chain, with the skip made explicit. */
export function toPhaseTwoRows(form: ClosureForm): DetailRow[] {
  return [
    {
      key: "rm",
      label: t("Relationship Manager"),
      value: `${text(form.rmApprovalStatus)} · ${text(form.rmApprovedBy)} · ${formatDate(
        form.rmApprovalDate
      )}`,
    },
    {
      key: "hod",
      label: t("Head of Department"),
      value: `${text(form.hodApprovalStatus)} · ${text(form.hodApprovedBy)} · ${formatDate(
        form.hodApprovalDate
      )}`,
    },
    {
      key: "compliance",
      label: form.complianceRequired ? t("Compliance (required)") : t("Compliance (skipped)"),
      value: `${text(form.complianceApprovalStatus)} · ${text(
        form.complianceApprovedBy
      )} · ${formatDate(form.complianceApprovalDate)}`,
    },
    {
      key: "management",
      label: t("Management"),
      value: `${text(form.managementApprovalStatus)} · ${text(
        form.managementApprovedBy
      )} · ${formatDate(form.managementApprovalDate)}`,
    },
  ];
}

/** The read-only summary the tab shows above the editable blocks. */
export function toStatusRows(form: ClosureForm): DetailRow[] {
  return [
    { key: "caseType", label: t("Case Type"), value: text(form.caseType) },
    { key: "caseEnteredBy", label: t("Case Entered By"), value: text(form.caseEnteredBy) },
    { key: "caseEntryDate", label: t("Case Entry Date"), value: formatDate(form.caseEntryDate) },
    {
      key: "techplusUpdatedOn",
      label: t("Tech+ Center Updated On"),
      value: formatDate(form.techplusUpdatedOn),
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
    { key: "nilHolding", label: t("NIL Holding"), value: yesNo(form.nilHolding) },
    {
      key: "transferRequired",
      label: t("Stock Transfer Required"),
      value: yesNo(form.transferRequired),
    },
    {
      key: "documentsValidated",
      label: t("Documents Validated"),
      value: yesNo(form.documentsValidated),
    },
    { key: "holdingValue", label: t("Holding Value"), value: money(form.holdingValue) },
    { key: "debitBalance", label: t("Debit Balance"), value: money(form.debitBalance) },
    { key: "holdingsSource", label: t("Holdings Source"), value: text(form.holdingsSource) },
    {
      key: "holdingsFetchedOn",
      label: t("Holdings Fetched On"),
      value: formatDateTime(form.holdingsFetchedOn),
    },
    {
      key: "complianceRequired",
      label: t("Compliance Approval Required"),
      value: form.complianceRequired
        ? `${t("Yes")} — ${form.complianceRequiredReason}`
        : t("No"),
    },
    {
      key: "departmentalConfirmationsComplete",
      label: t("Phase 1 Complete"),
      value: yesNo(form.departmentalConfirmationsComplete),
    },
    { key: "approvalsComplete", label: t("Phase 2 Complete"), value: yesNo(form.approvalsComplete) },
    {
      key: "closureCompletedBy",
      label: t("Closure Completed By"),
      value: text(form.closureCompletedBy),
    },
    {
      key: "closureCompletionDate",
      label: t("Closure Completion Date"),
      value: formatDate(form.closureCompletionDate),
    },
    {
      key: "forwardingEmailSent",
      label: t("Forwarding Email"),
      value: form.forwardingEmailSent
        ? `${t("Sent")} ${formatDateTime(form.forwardingEmailSentOn)}`
        : t("Not sent"),
    },
    {
      key: "forwardingRecipients",
      label: t("Forwarding Recipients"),
      value: text(form.forwardingRecipients),
    },
  ];
}

/** FR-11.14 — only meaningful once the case has actually been rejected. */
export function toRejectionRows(form: ClosureForm): DetailRow[] {
  return [
    { key: "rejectionStage", label: t("Rejected At Stage"), value: text(form.rejectionStage) },
    { key: "rejectedBy", label: t("Rejected By"), value: text(form.rejectedBy) },
    { key: "rejectionDate", label: t("Rejection Date"), value: formatDate(form.rejectionDate) },
    {
      key: "rejectionEmailSentOn",
      label: t("Rejection Email Sent On"),
      value: formatDate(form.rejectionEmailSentOn),
    },
    {
      key: "rejectionCcList",
      label: t("Rejection Email CC"),
      value: text(form.rejectionCcList),
    },
  ];
}

/**
 * Client-side validation mirroring `account_closure/validations.py`. The server
 * copy is the one that holds; this is for immediate feedback.
 */
export function validateForm(
  form: ClosureForm
): Partial<Record<keyof ClosureForm, string>> {
  const errors: Partial<Record<keyof ClosureForm, string>> = {};

  if (form.signatureVerificationStatus === "Verified" && !form.signatureDocument.trim()) {
    errors.signatureDocument = t(
      "Attach the scanned signature document before marking the signature verified"
    );
  }

  if (
    form.signatureVerificationStatus === "Rejected" &&
    !form.signatureVerificationRemarks.trim()
  ) {
    errors.signatureVerificationRemarks = t("Required when the signature is rejected");
  }

  if (form.dpConfirmationStatus === "Confirmed" && !form.dpDebitProcessed) {
    errors.dpDebitProcessed = t("Confirm the demat debit has been processed");
  }

  if (form.dpOutstandingDemand && !form.dpOutstandingDemandAmount) {
    errors.dpOutstandingDemandAmount = t("Record the amount of the outstanding demand");
  }

  if (
    form.ctclConfirmationStatus === "Confirmed" &&
    !(form.tradingAccountFrozen && form.dematAccountFrozen)
  ) {
    errors.dematAccountFrozen = t("Both accounts must be frozen before CTCL confirms");
  }

  if (form.riskConfirmationStatus === "Confirmed" && !form.accountDeactivated) {
    errors.accountDeactivated = t("The account must be deactivated before Risk confirms");
  }

  if (
    form.paymentsConfirmationStatus === "Confirmed" &&
    form.outstandingBalanceExists &&
    !form.tradingDebitConfirmed
  ) {
    errors.tradingDebitConfirmed = t("Confirm the trading debit payment");
  }

  if (
    form.accountsConfirmationStatus === "Confirmed" &&
    !form.accountingClearanceConfirmed
  ) {
    errors.accountingClearanceConfirmed = t("Confirm accounting clearance");
  }

  return errors;
}

export { EMPTY_VALUE, formatDate, formatDateTime, money };
