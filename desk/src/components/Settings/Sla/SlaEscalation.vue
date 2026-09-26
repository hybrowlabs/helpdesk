<template>
  <div class="flex flex-col gap-1">
    <span class="text-lg-semibold text-ink-gray-8">
      {{ __("Escalation") }}
    </span>
    <span class="text-p-sm text-ink-gray-6 max-w-lg">
      {{
        __(
          "Hand a ticket to another team automatically when this policy is breached. The ticket is reassigned round robin within that team."
        )
      }}
    </span>
  </div>

  <div class="mt-5 flex flex-col gap-4">
    <div class="rounded-md border border-outline-gray-2 p-4">
      <div class="flex items-start justify-between gap-4">
        <div class="flex flex-col gap-1">
          <span class="text-base-medium text-ink-gray-8">
            {{ __("First level") }}
          </span>
          <span class="text-p-sm text-ink-gray-6">
            {{ __("Runs once the first response time has been breached.") }}
          </span>
        </div>
        <Switch size="sm" v-model="firstLevelEnabled" />
      </div>

      <div
        v-if="firstLevelEnabled"
        class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-5"
      >
        <Link
          doctype="HD Team"
          size="sm"
          variant="subtle"
          :label="__('Escalate to team')"
          :placeholder="__('Select a team')"
          v-model="slaData.custom_first_level_escalation_team"
          @update:model-value="validateSlaData('escalation')"
        />
        <FormControl
          type="number"
          size="sm"
          variant="subtle"
          min="0"
          :label="__('Wait after breach (hours)')"
          :description="__('Leave at 0 to escalate on the next hourly run.')"
          v-model="firstLevelDelay"
        />
      </div>
    </div>

    <div class="rounded-md border border-outline-gray-2 p-4">
      <div class="flex items-start justify-between gap-4">
        <div class="flex flex-col gap-1">
          <span class="text-base-medium text-ink-gray-8">
            {{ __("Second level") }}
          </span>
          <span class="text-p-sm text-ink-gray-6">
            {{
              __(
                "Runs when a ticket is still unresolved after the first escalation."
              )
            }}
          </span>
        </div>
        <Switch size="sm" v-model="secondLevelEnabled" />
      </div>

      <div
        v-if="secondLevelEnabled"
        class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-5"
      >
        <FormControl
          type="select"
          size="sm"
          variant="subtle"
          :label="__('Escalate to')"
          :options="secondLevelTargets"
          v-model="secondLevelTarget"
        />
        <FormControl
          type="number"
          size="sm"
          variant="subtle"
          min="1"
          :label="__('Wait after first escalation (hours)')"
          v-model="secondLevelDelay"
        />
        <Link
          v-if="secondLevelTarget === 'Specific Team'"
          doctype="HD Team"
          size="sm"
          variant="subtle"
          :label="__('Team')"
          :placeholder="__('Select a team')"
          v-model="slaData.custom_second_level_escalation_team"
          @update:model-value="validateSlaData('escalation')"
        />
        <Link
          v-if="secondLevelTarget === 'Specific User'"
          doctype="HD Agent"
          size="sm"
          variant="subtle"
          :label="__('Agent')"
          :placeholder="__('Select an agent')"
          v-model="slaData.custom_second_level_escalation_user"
          @update:model-value="validateSlaData('escalation')"
        />
      </div>
    </div>
  </div>

  <ErrorMessage :message="slaDataErrors.escalation" class="mt-3" />
</template>

<script setup lang="ts">
import { computed } from "vue";
import { ErrorMessage, FormControl, Switch } from "frappe-ui";
import Link from "@/components/frappe-ui/Link.vue";
import { slaData, slaDataErrors, validateSlaData } from "@/stores/sla";
import { __ } from "@/translation";

// Check fields arrive from the server as 0/1, Switch wants a boolean.
const firstLevelEnabled = computed({
  get: () => Boolean(slaData.value.custom_first_level_escalation_enabled),
  set: (value: boolean) => {
    slaData.value.custom_first_level_escalation_enabled = value;
    validateSlaData("escalation");
  },
});

const secondLevelEnabled = computed({
  get: () => Boolean(slaData.value.custom_second_level_escalation_enabled),
  set: (value: boolean) => {
    slaData.value.custom_second_level_escalation_enabled = value;
    if (value && !slaData.value.custom_second_level_escalation_target) {
      slaData.value.custom_second_level_escalation_target = "Specific Team";
    }
    validateSlaData("escalation");
  },
});

// The field also carries "Manager of Assignee", "Manager of HRBP" and
// "Manager of HOD". All three resolve through the HRMS Employee tree, which
// is not installed on this site, so they are left off the form rather than
// offered as choices that quietly never fire.
const secondLevelTargets = [
  { label: __("A team"), value: "Specific Team" },
  { label: __("A specific agent"), value: "Specific User" },
];

const secondLevelTarget = computed({
  get: () => slaData.value.custom_second_level_escalation_target || "Specific Team",
  set: (value: string) => {
    slaData.value.custom_second_level_escalation_target = value;
    validateSlaData("escalation");
  },
});

const firstLevelDelay = computed({
  get: () => slaData.value.custom_first_level_escalation_delay_hours ?? 0,
  set: (value: string | number) => {
    slaData.value.custom_first_level_escalation_delay_hours = Number(value) || 0;
    validateSlaData("escalation");
  },
});

const secondLevelDelay = computed({
  get: () => slaData.value.custom_second_level_escalation_delay_hours ?? 24,
  set: (value: string | number) => {
    slaData.value.custom_second_level_escalation_delay_hours =
      Number(value) || 0;
    validateSlaData("escalation");
  },
});
</script>
