<template>
  <div class="flex flex-col gap-3 border-b px-6 py-3">
    <div class="flex flex-col gap-2">
      <span class="block text-sm font-medium text-gray-700">Raised For</span>
      <span class="text-base text-ink-gray-8">{{ raisedFor }}</span>
    </div>
    <div v-if="raisedFor === 'Others'" class="flex flex-col gap-2">
      <span class="block text-sm font-medium text-gray-700">Employee</span>
      <span class="text-base text-ink-gray-8">{{ employeeLabel }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Ticket } from "@/types";
import { call } from "frappe-ui";
import { computed, ref, watch } from "vue";

interface Props {
  ticket: Ticket;
}

const props = defineProps<Props>();

// Who the ticket was raised for is decided when the ticket is created and is
// only shown here -- it is never edited from the agent sidebar.
const raisedFor = computed(() => {
  if (props.ticket.custom_for_others) return "Others";
  if (props.ticket.custom_for_myself) return "Myself";
  // The backend fieldname carries a typo: custom_rasied_for
  const value =
    props.ticket.custom_rasied_for || props.ticket.custom_raised_for || "Myself";
  return value === "Other" ? "Others" : value;
});

// `custom_raise_for_employee_name` is fetched from the Employee on save, so it
// is empty on tickets raised before that field existed -- look the name up for
// those instead of showing a bare employee id.
const fetchedEmployeeName = ref("");

const employeeLabel = computed(
  () =>
    props.ticket.custom_raise_for_employee_name ||
    fetchedEmployeeName.value ||
    props.ticket.custom_raise_for_employee ||
    "-"
);

watch(
  () => props.ticket.custom_raise_for_employee,
  async (employeeId) => {
    fetchedEmployeeName.value = "";
    if (!employeeId || props.ticket.custom_raise_for_employee_name) return;
    try {
      const employee = await call("frappe.client.get", {
        doctype: "Employee",
        name: employeeId,
      });
      fetchedEmployeeName.value = employee?.employee_name || "";
    } catch (error) {
      console.warn("Error loading employee name:", error);
    }
  },
  { immediate: true }
);
</script>
