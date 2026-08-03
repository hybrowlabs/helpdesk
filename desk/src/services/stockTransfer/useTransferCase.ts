/**
 * Resolves a ticket to its stock transfer case name.
 *
 * The ticket header needs this to drive the Actions menu, and it has to work
 * whichever tab is open — so it cannot rely on the Transfer tab being mounted.
 * Deliberately minimal: the name and nothing else. The tab itself loads the
 * full case through `useStockTransfer`.
 */
import { computed, ref, toValue, watch, type MaybeRefOrGetter } from "vue";

import { fetchCase } from "./api";

export function useTransferCase(
  ticketId: MaybeRefOrGetter<string | number>,
  enabled: MaybeRefOrGetter<boolean>
) {
  const caseName = ref("");
  const loading = ref(false);

  // Guards against a slow response for a previous ticket landing late.
  let requestToken = 0;

  async function load(): Promise<void> {
    const id = String(toValue(ticketId) ?? "");

    if (!id || !toValue(enabled)) {
      caseName.value = "";
      return;
    }

    const token = ++requestToken;
    loading.value = true;
    try {
      const record = await fetchCase(id);
      if (token !== requestToken) return;
      caseName.value = record?.name ?? "";
    } catch {
      // A missing case is the normal state before one is opened, and the tab
      // reports any real failure. Nothing useful to surface from the header.
      if (token === requestToken) caseName.value = "";
    } finally {
      if (token === requestToken) loading.value = false;
    }
  }

  const hasCase = computed(() => Boolean(caseName.value));

  watch(
    () => [toValue(ticketId), toValue(enabled)],
    () => {
      void load();
    },
    { immediate: true }
  );

  return { caseName, hasCase, loading, reload: load };
}

export type UseTransferCase = ReturnType<typeof useTransferCase>;
