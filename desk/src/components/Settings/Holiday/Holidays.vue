<template>
  <div class="px-10 py-8">
    <SettingsLayoutHeader
      title="Business Holidays"
      description="Holidays applicable to your team based on your employee profile."
    >
      <template #actions>
        <!-- Hide New Holiday creation for now can be used later if needed -->
        <!-- <Button
          label="New"
          theme="gray"
          variant="solid"
          @click="goToNew()"
          icon-left="plus"
        /> -->
      </template>
    </SettingsLayoutHeader>
  </div>
  <div class="overflow-y-auto pb-8 px-10">
    <HolidayList />
  </div>
</template>

<script setup lang="ts">
import {
  holidayListActiveScreen,
  resetHolidayData,
} from "@/stores/holidayList";
import HolidayList from "./HolidayList.vue";
import SettingsLayoutHeader from "../SettingsLayoutHeader.vue";

const goToNew = () => {
  resetHolidayData();
  holidayListActiveScreen.value = {
    screen: "view",
    data: null,
  };
};
</script>
