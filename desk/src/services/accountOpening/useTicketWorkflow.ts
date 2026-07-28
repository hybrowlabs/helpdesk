
import { computed, ref, toValue, watch, type MaybeRefOrGetter } from "vue";

import { AccountOpeningError, type WorkflowStatus } from "./types";
import { applyWorkflowAction, fetchWorkflowStatus } from "./workflow";

function asError(cause: unknown): AccountOpeningError {
  return cause instanceof AccountOpeningError
    ? cause
    : new AccountOpeningError(
        "UNKNOWN",
        cause instanceof Error ? cause.message : String(cause)
      );
}

const EMPTY_STATUS: WorkflowStatus = {
  workflowName: null,
  state: null,
  style: "",
  canWrite: false,
  transitions: [],
};

export function useTicketWorkflow(ticketId: MaybeRefOrGetter<string | number>) {
  const status = ref<WorkflowStatus>({ ...EMPTY_STATUS });
  const loading = ref(false);
  const applying = ref(false);
  const error = ref<AccountOpeningError | null>(null);

  // Guards against a slow response for a previous ticket landing after the
  // agent has already navigated on — same approach as useAccountOpening.
  let requestToken = 0;

  async function load(): Promise<void> {
    const id = String(toValue(ticketId) ?? "");
    if (!id) {
      status.value = { ...EMPTY_STATUS };
      return;
    }

    const token = ++requestToken;
    loading.value = true;
    error.value = null;

    try {
      const result = await fetchWorkflowStatus(id);
      if (token !== requestToken) return;
      status.value = result;
    } catch (cause) {
      if (token !== requestToken) return;
      status.value = { ...EMPTY_STATUS };
      error.value = asError(cause);
    } finally {
      if (token === requestToken) loading.value = false;
    }
  }

  /** Returns the new status on success, or null with `error` set on failure. */
  async function apply(action: string): Promise<WorkflowStatus | null> {
    const id = String(toValue(ticketId) ?? "");
    if (!id || applying.value) return null;

    const token = ++requestToken;
    applying.value = true;
    error.value = null;

    try {
      const result = await applyWorkflowAction(id, action);
      if (token === requestToken) status.value = result;
      return result;
    } catch (cause) {
      error.value = asError(cause);
      // The action may have been rejected because the menu was stale, so
      // re-read rather than leaving the agent with the same bad options.
      void load();
      return null;
    } finally {
      applying.value = false;
    }
  }

  const state = computed(() => status.value.state);
  const style = computed(() => status.value.style);
  const transitions = computed(() => status.value.transitions);
  const canWrite = computed(() => status.value.canWrite);

  const hasWorkflow = computed(
    () => Boolean(status.value.workflowName) && Boolean(status.value.state)
  );

  /** The menu is only worth showing when there is something to do in it. */
  const hasActions = computed(
    () => canWrite.value && transitions.value.length > 0
  );

  watch(
    () => toValue(ticketId),
    () => {
      void load();
    },
    { immediate: true }
  );

  return {
    status,
    state,
    style,
    transitions,
    canWrite,
    hasWorkflow,
    hasActions,
    loading,
    applying,
    error,
    reload: load,
    apply,
  };
}

export type UseTicketWorkflow = ReturnType<typeof useTicketWorkflow>;
