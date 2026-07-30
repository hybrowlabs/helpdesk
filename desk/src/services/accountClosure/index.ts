export { useAccountClosure, type UseAccountClosure } from "./useAccountClosure";

export { useClosureCase, type UseClosureCase } from "./useClosureCase";

export {
  createCase,
  fetchAuditTrail,
  fetchCase,
  fetchClientMaster,
  fetchHoldings,
  saveCase,
} from "./api";

export {
  emptyForm,
  getApprovalFields,
  getDepartmentBlocks,
  getDocumentFields,
  getIntakeFields,
  normalizeForm,
  toClientRows,
  toPayload,
  toPhaseOneRows,
  toPhaseTwoRows,
  toRejectionRows,
  toStatusRows,
  validateForm,
  type ClosureField,
  type DepartmentBlock,
} from "./presenter";

export {
  CASE_DOCTYPE,
  CHECK_FIELDS,
  COMPLETING_TEAMS,
  CONFIRMATION_STATUSES,
  CURRENCY_FIELDS,
  EDITABLE_FIELDS,
  HOLDING_NIL,
  HOLDING_SHARES_HELD,
  HOLDING_STATUSES,
  SIGNATURE_STATUSES,
  TECHPLUS_STATUSES,
  type ClosureAuditRow,
  type ClosureClient,
  type ClosureForm,
  type ClosureMeta,
  type ClosureRecord,
  type EditableField,
  type HoldingStatus,
} from "./types";
