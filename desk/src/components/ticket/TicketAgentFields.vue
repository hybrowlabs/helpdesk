<template>
  <div class="flex flex-1 flex-col overflow-hidden overflow-y-auto border-b">
    <UniInput2
      v-for="field in fields"
      :key="field.fieldname"
      :field="field"
      :value="ticket[field.fieldname]"
      :readonly="READ_ONLY_FIELDS.has(field.fieldname)"
      @change="(data) => update(data.fieldname, data.value)"
    />
  </div>
</template>

<script setup lang="ts">
import { Field, FieldValue } from "@/types";
import { toast } from "frappe-ui";
import { computed } from "vue";
import UniInput2 from "../UniInput2.vue";
const emit = defineEmits(["update"]);

const props = defineProps({
  ticket: {
    type: Object,
    required: true,
  },
});

// Shown in the sidebar but never edited from it: who the ticket is for is
// settled when it is raised, and the team follows the category (changing the
// category re-routes the ticket).
const READ_ONLY_FIELDS = new Set([
  "customer",
  "agent_group",
  "ticket_type",
  "custom_for_myself",
  "custom_for_others",
  "custom_raise_for_employee",
]);

const fields = computed(() => {
  return props.ticket.fields.filter((field) => field.fieldname !== "priority");
});

function update(field: Field["fieldname"], value: FieldValue, event = null) {
  if (field === "subject" && value === "") {
    toast.error("Subject is required");
    event.target.value = props.ticket.subject;
    return;
  }
  emit("update", { field, value });
}
</script>
<style scoped>
:deep(.form-control input:not([type="checkbox"])),
:deep(.form-control select),
:deep(.form-control textarea),
:deep(.form-control button) {
  border-color: transparent;
  background: white;
}
:deep(.form-control textarea) {
  field-sizing: content;
}

:deep(.form-control button) {
  gap: 0;
}
:deep(.form-control [type="checkbox"]) {
  margin-left: 9px;
  cursor: pointer;
}

:deep(.form-control button > div) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:deep(.form-control button svg) {
  color: white;
  width: 0;
}
</style>
