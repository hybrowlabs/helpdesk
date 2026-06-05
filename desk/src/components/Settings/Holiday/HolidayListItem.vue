<template>
  <div class="flex items-center hover:bg-gray-50 rounded py-3 pl-2">
    <div class="w-full">
      <div class="text-base text-ink-gray-7 font-medium">{{ data.holiday_name }}</div>
      <div class="flex items-center gap-4 mt-1">
        <div class="text-sm text-ink-gray-5">
          {{ formatDate(data.date) }}
        </div>
        <div v-if="data.type" class="text-xs px-2 py-0.5 rounded bg-gray-100 text-ink-gray-6">
          {{ data.type }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const formatDate = (dateStr: string) => {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

defineProps({
  data: {
    type: Object,
    required: true,
  },
});
</script>
