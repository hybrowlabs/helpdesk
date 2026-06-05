<template>
  <div class="pb-8">
    <Holidays v-if="holidayListActiveScreen.screen == 'list'" />
    <SimpleHolidayView v-else-if="holidayListActiveScreen.screen == 'view'" />
  </div>
</template>

<script setup lang="ts">
import { holidayListActiveScreen } from "@/stores/holidayList";
import { useEmployeeStore } from "@/stores/employee";
import Holidays from "./Holidays.vue";
import SimpleHolidayView from "./SimpleHolidayView.vue";
import { provide } from "vue";

const employeeStore = useEmployeeStore();
provide("holidayList", employeeStore);
</script>
