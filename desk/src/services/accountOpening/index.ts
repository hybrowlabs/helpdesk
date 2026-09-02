export { t } from "./i18n";

export {
  getAccountOpeningService,
  isUsingMockData,
  setAccountOpeningService,
  type AccountOpeningSource,
} from "./service";

export { useAccountOpening, type UseAccountOpening } from "./useAccountOpening";

export {
  useAccountOpeningCase,
  type UseAccountOpeningCase,
} from "./useAccountOpeningCase";

export {
  useTicketWorkflow,
  type UseTicketWorkflow,
} from "./useTicketWorkflow";

export { applyWorkflowAction, fetchWorkflowStatus } from "./workflow";

export {
  EMPTY_VALUE,
  computeAge,
  emptyVerification,
  formatDate,
  getVerificationFields,
  isVideoVerificationRequired,
  normalizeVerification,
  toDetailRows,
  validateVerification,
} from "./presenter";

export {
  AccountOpeningError,
  CALL_VERIFICATION_STATUSES,
  CASE_DOCTYPE,
  SIGNATURE_VERIFICATION_STATUSES,
  VIDEO_VERIFICATION_MIN_AGE,
  VIDEO_VERIFICATION_STATUSES,
  type AccountOpeningApplication,
  type AccountOpeningCase,
  type AccountOpeningEnvelope,
  type AccountOpeningErrorCode,
  type AccountOpeningIdentifier,
  type AccountOpeningRecord,
  type AccountOpeningService,
  type CallVerificationStatus,
  type DetailRow,
  type FormFieldDescriptor,
  type SignatureVerificationStatus,
  type VerificationDetails,
  type VideoVerificationStatus,
  type WorkflowStatus,
  type WorkflowStyle,
  type WorkflowTransition,
} from "./types";

export {
  MockAccountOpeningService,
  getMockScenario,
  resetMockStore,
  setMockScenario,
  type MockScenario,
} from "./mock";

export { HttpAccountOpeningService } from "./api";
