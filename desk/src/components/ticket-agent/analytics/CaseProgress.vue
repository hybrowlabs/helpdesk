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
      <span v-if="pressureLine" class="text-p-sm text-ink-gray-5">
        {{ pressureLine }}
      </span>
    </div>

    <!-- The chase cycle: every mail of it, the ones already sent with what
         the mail server did with them, and the ones still to come with the
         day they are due. One view answers "what has gone out" and "what is
         next", which otherwise needs the Emails tab and a calendar. -->
    <div
      v-if="schedule.length"
      class="flex flex-col gap-3 rounded-md border border-outline-gray-1 bg-surface-base p-4"
    >
      <div class="flex items-center justify-between gap-3">
        <span class="text-base text-ink-gray-5">{{ data.pressure?.label }}</span>
        <span v-if="data.pressure?.stopped" class="text-sm text-ink-gray-5">
          {{ __("Stopped") }}
        </span>
      </div>

      <div class="flex flex-col">
        <div
          v-for="(mail, i) in schedule"
          :key="mail.number"
          class="flex items-start gap-3"
        >
          <div class="flex flex-col items-center self-stretch">
            <div
              class="mt-1.5 size-2 shrink-0 rounded-full"
              :class="{
                'bg-surface-gray-7': mail.state === 'sent',
                'bg-surface-amber-3': mail.state === 'raised',
                'bg-surface-red-4': mail.state === 'overdue',
                'bg-surface-gray-3':
                  mail.state === 'scheduled' || mail.state === 'stopped',
              }"
            />
            <div
              v-if="i < schedule.length - 1"
              class="w-px flex-1 bg-outline-gray-1"
            />
          </div>
          <div class="flex flex-1 flex-col gap-0.5 pb-3">
            <div class="flex flex-wrap items-baseline justify-between gap-x-3">
              <span
                class="text-p-base"
                :class="
                  mail.state === 'sent' || mail.state === 'raised'
                    ? 'text-ink-gray-8'
                    : 'text-ink-gray-6'
                "
              >
                {{ mail.label }}
              </span>
              <span class="text-p-sm text-ink-gray-5">{{ mailDate(mail) }}</span>
            </div>
            <span
              v-if="deliveryLine(mail)"
              class="text-p-sm"
              :class="mail.delivery?.sent ? 'text-ink-gray-5' : 'text-ink-red-3'"
            >
              {{ deliveryLine(mail) }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { __ } from "@/translation";
import { createResource } from "frappe-ui";
import { computed, watch } from "vue";
import type { CaseAnalytics, CaseReminder } from "./types";

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

const pressureLine = computed(() => {
  const p = data.value?.pressure;
  if (!p || !p.raised) return "";
  // "Raised" not "sent": the rows record what the system produced. When the
  // queue is holding them, saying "sent" would be the one claim this panel
  // exists to stop making.
  const line =
    p.sent === p.raised
      ? __("{0} sent: {1}", [p.label, p.sent])
      : __("{0} raised: {1}, sent: {2}", [p.label, p.raised, p.sent]);
  return p.last ? __("{0}, last on {1}", [line, p.last]) : line;
});

const schedule = computed(() => data.value?.pressure?.schedule ?? []);

function mailDate(mail: CaseReminder) {
  if (!mail.date) return "";
  // A raised mail carries the date the cycle reached it, same as a sent one:
  // what differs is the delivery line underneath, not when it was due.
  if (mail.state === "sent" || mail.state === "raised") return mail.date;
  if (mail.state === "stopped") return __("Not needed");
  if (mail.state === "overdue") return __("Was due {0}", [mail.date]);
  return __("Due {0}", [mail.date]);
}

// A sent row says the system raised the mail. Whether it left is a separate
// fact, and the one worth printing when it is not "Sent" — a suspended queue
// or a refused relay looks identical on the row itself.
function deliveryLine(mail: CaseReminder) {
  const d = mail.delivery;
  if (!d) return "";
  if (d.sent) return d.at ? __("Sent {0}", [d.at]) : __("Sent");
  return d.error ? __("{0}: {1}", [d.status, d.error]) : d.status;
}
</script>
