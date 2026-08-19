<template>
  <div>
    <div class="flex flex-col gap-1">
      <span class="text-lg font-semibold text-ink-gray-8">Escalation</span>
      <span class="text-p-sm text-ink-gray-6">
        Hand the ticket to another set of agents when a target is missed.
      </span>
    </div>
    <div class="mt-5 space-y-5">
      <Checkbox
        label="Enable Escalation"
        :model-value="slaData.custom_enable_escalation"
        @update:model-value="(val) => (slaData.custom_enable_escalation = val)"
        class="text-ink-gray-6 text-base font-medium"
      />

      <template v-if="slaData.custom_enable_escalation">
        <div
          v-for="(level, index) in slaData.custom_escalation_levels"
          :key="level.level"
          class="space-y-4"
        >
          <div class="flex flex-col gap-0.5">
            <div class="text-base font-medium text-ink-gray-7">
              {{ escalationLevelName(level.level) }}
            </div>
            <div class="text-p-sm text-ink-gray-5">
              {{ escalationLevelHint(level.level) }}
            </div>
          </div>

          <Checkbox
            label="Assign to Manager"
            :model-value="level.assign_to_manager"
            @update:model-value="(val) => (level.assign_to_manager = val)"
            class="text-ink-gray-6 text-base font-medium"
          />

          <div class="md:w-1/2">
            <SlaEscalationAssignee
              :label="
                level.assign_to_manager
                  ? 'Escalation Assignee (fallback)'
                  : 'Escalation Assignee'
              "
              v-model="level.escalation_assignee"
            />
            <div
              v-if="level.assign_to_manager"
              class="text-p-sm text-ink-gray-5 mt-1.5 italic"
            >
              Goes to the manager of whoever holds the ticket. If there is no
              manager, or the manager is on leave, these agents get it instead.
            </div>
          </div>

          <div class="flex items-end gap-5">
            <div class="flex-1 grid grid-cols-1 md:grid-cols-2 gap-5">
              <FormControl
                type="number"
                size="sm"
                variant="subtle"
                label="Escalation Point"
                :model-value="level.escalation_point"
                @update:model-value="
                  (val) => (level.escalation_point = val === '' ? null : Number(val))
                "
                placeholder="e.g. 3"
              />
              <FormControl
                type="select"
                size="sm"
                variant="subtle"
                label="Unit"
                v-model="level.unit"
                :options="escalationUnitOptions"
              />
            </div>
            <Button
              variant="ghost"
              icon="trash-2"
              class="mb-0.5"
              :disabled="!isEscalationLevelFilled(level)"
              @click="clearLevel(index)"
            />
          </div>
        </div>

        <ErrorMessage :message="errors.escalation_levels" />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  escalationLevelHint,
  escalationLevelName,
  escalationUnitOptions,
  isEscalationLevelFilled,
  slaData,
} from "@/stores/sla";
import { Button, Checkbox, ErrorMessage, FormControl } from "frappe-ui";
import { computed } from "vue";
import SlaEscalationAssignee from "./SlaEscalationAssignee.vue";

const props = defineProps<{
  errors: { escalation_levels?: string };
}>();

const errors = computed(() => props.errors || {});

const clearLevel = (index: number) => {
  const level = slaData.value.custom_escalation_levels[index];
  level.assign_to_manager = false;
  level.escalation_assignee = "";
  level.escalation_point = null;
  level.unit = "Hours";
};
</script>
