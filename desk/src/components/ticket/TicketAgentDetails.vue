<template>
  <div class="flex flex-col gap-3 border-b px-6 py-3">
    <div
      v-for="s in sections"
      :key="s.label"
      class="flex items-center text-base leading-5"
    >
      <Tooltip :text="s.label">
        <div class="w-[126px] shrink-0 text-sm leading-tight text-gray-600">
          {{ s.label }}
        </div>
      </Tooltip>
      <div class="flex items-center justify-between">
        <div v-if="s.value">{{ s.value }}</div>
        <Tooltip :text="s.tooltipValue">
          <Badge
            v-if="s.badgeText"
            class="-ml-1"
            :label="s.badgeText"
            variant="subtle"
            :theme="s.badgeColor"
          />
        </Tooltip>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { dayjs } from "@/dayjs";
import {
  dateFormat,
  dateTooltipFormat,
  formatTime,
  getTimeInSeconds,
} from "@/utils";
import { Badge, Tooltip } from "frappe-ui";
import { computed, onUnmounted, ref, watch } from "vue";

const props = defineProps({
  ticket: {
    type: Object,
    required: true,
  },
});

let firstResponseInterval = null;
let resolutionInterval = null;
let escalationInterval = null;

const firstResponseSeconds = ref(0);
const resolutionSeconds = ref(0);
// Server view of the escalation clock. Starts from the loaded ticket and is
// refreshed in place when the support desk opens or closes under us.
const escalation = ref(props.ticket.escalation ?? null);

const firstResponseBadge = computed(() => {
  let firstResponse = null;
  if (
    !props.ticket.first_responded_on &&
    dayjs().isBefore(dayjs(props.ticket.response_by))
  ) {
    let responseBy = formatTime(
      dayjs(props.ticket.response_by).diff(dayjs(), "s")
    );
    if (firstResponseInterval) {
      clearInterval(firstResponseInterval);
      firstResponseInterval = null;
    }
    handleFirstResponseInterval(responseBy);
    firstResponse = {
      label: `Due in ${formatTime(firstResponseSeconds.value)}`,
      color: "orange",
    };
  } else if (
    dayjs(props.ticket.first_responded_on).isBefore(
      dayjs(props.ticket.response_by)
    )
  ) {
    firstResponse = {
      label: `Fulfilled in ${formatTime(
        dayjs(props.ticket.first_responded_on).diff(
          dayjs(props.ticket.creation),
          "s"
        )
      )}`,
      color: "green",
    };
  } else {
    firstResponse = {
      label: "Failed",
      color: "red",
    };
  }
  return firstResponse;
});

const resolutionBadge = computed(() => {
  let resolution = null;
  if (resolutionInterval) {
    clearInterval(resolutionInterval);
  }
  if (
    props.ticket.status === "Awaiting User Response" &&
    props.ticket.on_hold_since &&
    dayjs(props.ticket.resolution_by).isAfter(dayjs(props.ticket.on_hold_since))
  ) {
    let timeLeft = dayjs(props.ticket.resolution_by).diff(dayjs(), "s");
    resolution = {
      label: `${formatTime(timeLeft)} left (On Hold)`,
      color: "blue",
    };
  } else if (
    !props.ticket.resolution_date &&
    dayjs().isBefore(props.ticket.resolution_by)
  ) {
    let resolutionBy = formatTime(
      dayjs(props.ticket.resolution_by).diff(dayjs(), "s")
    );
    handleResolutionInterval(resolutionBy);

    resolution = {
      label: `Due in ${formatTime(resolutionSeconds.value)}`,
      color: "orange",
    };
  } else if (
    dayjs(props.ticket.resolution_date).isBefore(props.ticket.resolution_by)
  ) {
    resolution = {
      label: `Fulfilled in ${formatTime(
        dayjs(props.ticket.resolution_date).diff(
          dayjs(props.ticket.creation),
          "s"
        )
      )}`,
      color: "green",
    };
  } else {
    resolution = {
      label: "Failed",
      color: "red",
    };
  }
  return resolution;
});

// Remaining Escalation Business Time: a running clock to the ticket's next
// escalation -- level 1 (first response target + escalation point) until that
// has fired, then level 2 (resolution target + escalation point). The due time
// itself is shift-aware: the escalation point is spent in the SLA's working
// hours, so a 4h point at 4pm comes due late next morning, not at 8pm. The
// countdown to it then runs continuously, landing on zero as it fires.
const now = ref(Date.now());
// Count against the server clock, not the browser's, so a skewed or
// differently-zoned machine still hits zero at the right moment.
const deadline = computed(() => {
  const due = escalation.value?.due_on;
  if (!due) return null;
  const dueAt = dayjs(due).valueOf();
  const serverNow = escalation.value?.server_now;
  return serverNow ? dueAt + (Date.now() - dayjs(serverNow).valueOf()) : dueAt;
});

const escalationSeconds = computed(() =>
  deadline.value === null
    ? 0
    : Math.max((deadline.value - now.value) / 1000, 0)
);

const escalationBadge = computed(() => {
  if (!escalation.value || escalation.value.status === "none") return null;

  // On hold: an escalation is still ahead, it just is not counting down.
  if (escalation.value.status === "paused") {
    return { label: "Paused", color: "blue" };
  }

  if (escalation.value.status === "pending" && escalationSeconds.value > 0) {
    return {
      label: `Due in ${formatTime(escalationSeconds.value)}`,
      color: escalation.value.is_working_now ? "orange" : "blue",
    };
  }

  return { label: "SLA Breached", color: "red" };
});

const escalationTooltip = computed(() => {
  const e = escalation.value;
  if (!e) return "";

  if (e.status === "pending" && e.due_on) {
    let text = `${e.next_level_name} due ${dateFormat(e.due_on, dateTooltipFormat)}`;
    if (e.remaining_seconds !== null) {
      text += ` — ${formatTime(e.remaining_seconds)} of shift time left`;
    }
    if (!e.is_working_now) text += " (desk currently closed)";
    return text;
  }

  if (e.status === "paused") {
    return "Waiting on the customer — the SLA clock is on hold";
  }

  if (e.last_escalated_on) {
    return `Escalated to ${e.last_escalated_to} on ${dateFormat(
      e.last_escalated_on,
      dateTooltipFormat
    )}`;
  }

  return "Escalation point passed";
});

function stopEscalationClock() {
  if (escalationInterval) {
    clearInterval(escalationInterval);
    escalationInterval = null;
  }
}

function startEscalationClock() {
  stopEscalationClock();
  if (escalation.value?.status !== "pending") return;

  now.value = Date.now();
  escalationInterval = setInterval(() => {
    now.value = Date.now();
  }, 1000);
}

watch(
  () => props.ticket.escalation,
  (value) => {
    escalation.value = value ?? null;
    startEscalationClock();
  },
  { deep: true, immediate: true }
);

function getCalculatedResolution() {
  let resolution = dayjs(props.ticket.resolution_by).add(
    props.ticket.total_hold_time,
    "s"
  );
  // let now = new Date()
  resolution = dayjs(resolution).diff(dayjs(), "s");
  return formatTime(resolution);
}

const sections = computed(() => [
  {
    label: "First Response",
    tooltipValue: dateFormat(
      props.ticket.first_responded_on || props.ticket.response_by,
      dateTooltipFormat
    ),
    badgeText: firstResponseBadge.value.label,
    badgeColor: firstResponseBadge.value.color,
  },
  {
    label: "Resolution",
    tooltipValue: dateFormat(
      props.ticket.resolution_date || props.ticket.resolution_by,
      dateTooltipFormat
    ),
    badgeText: resolutionBadge.value.label,
    badgeColor: resolutionBadge.value.color,
  },
  ...(escalationBadge.value
    ? [
        {
          label: "Remaining Escalation Business Time",
          tooltipValue: escalationTooltip.value,
          badgeText: escalationBadge.value.label,
          badgeColor: escalationBadge.value.color,
        },
      ]
    : []),
  {
    label: "Source",
    value: props.ticket.via_customer_portal ? "Portal" : "Mail",
  },
]);

// Watch for status changes and clear intervals
watch(
  () => props.ticket.status,
  (newStatus: string) => {
    if (newStatus !== "Open") {
      if (firstResponseInterval) {
        clearInterval(firstResponseInterval);
        firstResponseInterval = null;
      }
      if (resolutionInterval) {
        clearInterval(resolutionInterval);
        resolutionInterval = null;
      }
    }
  },
  { deep: true, immediate: true }
);

function handleFirstResponseInterval(time: string) {
  if (!time) return;
  if (props.ticket.status !== "Open") {
    return;
  }
  firstResponseSeconds.value = getTimeInSeconds(time);
  firstResponseInterval = setInterval(() => {
    if (firstResponseSeconds.value <= 0) {
      clearInterval(firstResponseInterval);
      return;
    }
    firstResponseSeconds.value--;
  }, 1000);
}

function handleResolutionInterval(time: string) {
  if (!time) return;
  if (props.ticket.status !== "Open") {
    return;
  }

  resolutionSeconds.value = getTimeInSeconds(time);
  resolutionInterval = setInterval(() => {
    if (resolutionSeconds.value <= 0) {
      clearInterval(resolutionInterval);
      return;
    }
    resolutionSeconds.value--;
  }, 1000);
}

onUnmounted(() => {
  if (firstResponseInterval) {
    clearInterval(firstResponseInterval);
  }
  if (resolutionInterval) {
    clearInterval(resolutionInterval);
  }
  stopEscalationClock();
  firstResponseInterval = null;
  resolutionInterval = null;
});
</script>
