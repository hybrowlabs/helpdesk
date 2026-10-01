<template>
  <div v-if="data" class="flex flex-col gap-4">
    <!-- Where the case is now. The one line a manager opens this tab for. -->
    <div
      class="flex flex-col gap-3 rounded-md border border-outline-gray-1 bg-surface-base p-4"
    >
      <div class="flex items-center justify-between gap-3">
        <span class="text-base text-ink-gray-5">{{ __("Case Progress") }}</span>
        <span v-if="data.case" class="text-sm text-ink-gray-5">
          {{ data.case }}
        </span>
      </div>

      <div v-if="!data.stages.length" class="text-p-base text-ink-gray-6">
        {{ __("This case has not been created yet.") }}
      </div>

      <template v-else>
        <div class="flex flex-col gap-1">
          <span class="text-lg-medium text-ink-gray-8">
            {{ current?.label ?? "–" }}
          </span>
          <span v-if="current" class="text-p-base text-ink-gray-6">
            {{ currentLine }}
          </span>
        </div>

        <!-- Each stage the case actually passed through, in the order it
             passed them, with the time it sat there. -->
        <div class="flex flex-col">
          <div
            v-for="(stage, i) in data.stages"
            :key="stage.status + i"
            class="flex items-start gap-3"
          >
            <div class="flex flex-col items-center self-stretch">
              <div
                class="mt-1.5 size-2 shrink-0 rounded-full"
                :class="stage.current ? 'bg-surface-gray-7' : 'bg-surface-gray-4'"
              />
              <div
                v-if="i < data.stages.length - 1"
                class="w-px flex-1 bg-outline-gray-1"
              />
            </div>
            <div class="flex flex-1 flex-wrap items-baseline justify-between gap-x-3 pb-3">
              <span
                class="text-p-base"
                :class="stage.current ? 'text-ink-gray-8' : 'text-ink-gray-6'"
              >
                {{ stage.label }}
                <span v-if="stage.owner" class="text-ink-gray-5">
                  · {{ stage.owner }}
                </span>
              </span>
              <span v-if="stage.duration" class="text-p-sm text-ink-gray-5">
                {{ stage.duration }}
              </span>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- Deadline, only while one is actually running. -->
    <div
      v-if="data.deadline"
      class="flex flex-col gap-2 rounded-md border p-4"
      :class="
        data.deadline.overdue
          ? 'border-outline-red-1 bg-surface-red-1'
          : 'border-outline-gray-1 bg-surface-base'
      "
    >
      <span class="text-base text-ink-gray-5">{{ data.deadline.label }}</span>
      <span
        class="text-lg-medium"
        :class="data.deadline.overdue ? 'text-ink-red-3' : 'text-ink-gray-8'"
      >
        {{ deadlineText }}
      </span>
      <div
        v-if="data.deadline.detail"
        class="flex flex-col gap-0.5 border-t border-outline-gray-1 pt-2"
      >
        <span class="text-p-sm text-ink-gray-5">
          {{ data.deadline.detail_label }}
        </span>
        <span class="text-p-base text-ink-gray-7">{{ data.deadline.detail }}</span>
      </div>
      <span v-if="pressure" class="text-p-sm text-ink-gray-5">
        {{ pressure }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { __ } from "@/translation";
import { createResource } from "frappe-ui";
import { computed, watch } from "vue";
import type { CaseAnalytics } from "./types";

const props = defineProps<{ ticketId: string; status?: string }>();

const resource = createResource({
  url: "philips_captial.pc_core.case_analytics.get_case_analytics",
  makeParams: () => ({ ticket: props.ticketId }),
  auto: true,
});

// A stage change is exactly what this panel measures, so it must refetch when
// the status moves — not only when the ticket changes.
watch(
  () => [props.ticketId, props.status],
  () => resource.reload()
);

const data = computed<CaseAnalytics | null>(() => resource.data ?? null);
const current = computed(() => data.value?.stages.find((s) => s.current));

// A flow whose doctype keeps no history can state where the case is but not
// how long it has been there, so the duration is dropped rather than guessed.
const currentLine = computed(() => {
  const s = current.value;
  if (!s) return "";
  if (!s.duration) return s.owner ? __("With {0}", [s.owner]) : "";
  return s.owner
    ? __("With {0} for {1}", [s.owner, s.duration])
    : __("For {0}", [s.duration]);
});

const deadlineText = computed(() => {
  const d = data.value?.deadline;
  if (!d) return "";
  if (d.cleared) return __("Received · due {0}", [d.due]);
  if (d.overdue) return __("Overdue by {0} days · due {1}", [-d.days, d.due]);
  if (d.days === 0) return __("Due today");
  return __("{0} days left · due {1}", [d.days, d.due]);
});

const pressure = computed(() => {
  const p = data.value?.pressure;
  if (!p) return "";
  return p.last
    ? __("{0}: {1}, last on {2}", [p.label, p.count, p.last])
    : __("{0}: {1}", [p.label, p.count]);
});
</script>
