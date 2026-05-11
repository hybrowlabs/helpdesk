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

const holidayListData = createListResource({
  doctype: "HD Service Holiday List",
  fields: ["name", "holiday_list_name", "from_date", "to_date", "total_holidays", "description"],
  orderBy: "from_date desc",
  start: 0,
  pageLength: 999,
  auto: true,
});

provide("holidayList", holidayListData);
</script>
