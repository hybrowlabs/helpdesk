<template>
  <div class="px-10 py-8">
    <SettingsLayoutHeader>
      <template #title>
        <h1 class="text-lg font-semibold text-ink-gray-8">
          Service Level Agreements (SLAs)
        </h1>
      </template>
      <template #description>
        <p class="text-p-sm max-w-md text-ink-gray-6">
          SLAs align your team and customers with defined timelines for a
          reliable experience.
          <a
            href="https://docs.frappe.io/helpdesk/service-level-agreement"
            target="_blank"
            class="underline"
            >Learn more about SLA
          </a>
        </p>
      </template>
      <template #actions>
        <Button
          label="New"
          theme="gray"
          variant="solid"
          @click="goToNew()"
          icon-left="plus"
        />
      </template>
      <template #bottom-section>
        <div class="flex items-end gap-4 flex-wrap mt-4">
          <!-- Employee Filter -->
          <div class="flex flex-col gap-1.5 min-w-[200px]">
            <span class="text-xs font-medium text-gray-600">Filter by Employee</span>
            <MultiSelectCombobox
              v-model="employeeFilter"
              :options="agentOptions"
              :multiple="false"
              placeholder="All Employees"
              class="w-full"
            >
              <template #target="{ open, togglePopover }">
                <Button
                  class="flex items-center justify-between w-full h-7 text-base text-gray-800 bg-white hover:bg-gray-50 border border-gray-300 rounded shadow-sm px-3"
                  @click="togglePopover"
                >
                  <template #prefix>
                    <LucideUsers class="h-4 w-4 text-gray-500 mr-2" />
                  </template>
                  <span class="truncate text-left flex-1">
                    {{ employeeFilterLabel }}
                  </span>
                  <template #suffix>
                    <FeatherIcon
                      :name="open ? 'chevron-up' : 'chevron-down'"
                      class="h-4 w-4 text-gray-600 ml-2"
                    />
                  </template>
                </Button>
              </template>
            </MultiSelectCombobox>
          </div>

          <!-- Team Filter -->
          <div class="flex flex-col gap-1.5 min-w-[200px]">
            <span class="text-xs font-medium text-gray-600">Filter by Team</span>
            <MultiSelectCombobox
              v-model="teamFilter"
              :options="teamOptions"
              :multiple="false"
              placeholder="All Teams"
              class="w-full"
            >
              <template #target="{ open, togglePopover }">
                <Button
                  class="flex items-center justify-between w-full h-7 text-base text-gray-800 bg-white hover:bg-gray-50 border border-gray-300 rounded shadow-sm px-3"
                  @click="togglePopover"
                >
                  <template #prefix>
                    <LucideUsers class="h-4 w-4 text-gray-500 mr-2" />
                  </template>
                  <span class="truncate text-left flex-1">
                    {{ teamFilterLabel }}
                  </span>
                  <template #suffix>
                    <FeatherIcon
                      :name="open ? 'chevron-up' : 'chevron-down'"
                      class="h-4 w-4 text-gray-600 ml-2"
                    />
                  </template>
                </Button>
              </template>
            </MultiSelectCombobox>
          </div>

          <!-- Category Filter -->
          <div class="flex flex-col gap-1.5 min-w-[165px]">
            <span class="text-xs font-medium text-gray-600">Filter by Category</span>
            <FormControl
              v-model="categoryFilter"
              type="select"
              :options="categoryOptions"
              class="w-full border border-gray-300 rounded shadow-sm"
            />
          </div>

          <!-- Sub Category Filter -->
          <div class="flex flex-col gap-1.5 min-w-[165px]">
            <span class="text-xs font-medium text-gray-600">Filter by Sub-Category</span>
            <FormControl
              v-model="subCategoryFilter"
              type="select"
              :options="subCategoryOptions"
              class="w-full border border-gray-300 rounded shadow-sm"
            />
          </div>

          <!-- Clear Filters -->
          <Button
            v-if="hasActiveFilters"
            variant="ghost"
            label="Clear"
            class="!text-gray-600 mb-0.5 h-7"
            @click="clearAllFilters"
          >
            <template #prefix>
              <FeatherIcon name="x" class="h-3 w-3 text-gray-500 mr-1" />
            </template>
          </Button>
        </div>
      </template>
    </SettingsLayoutHeader>
  </div>
  <div class="px-10 pb-8 overflow-y-auto">
    <SlaPolicyList />
  </div>
</template>

<script setup lang="ts">
import { resetSlaData, slaActiveScreen } from "@/stores/sla";
import { Button, FormControl, FeatherIcon } from "frappe-ui";
import SlaPolicyList from "./SlaPolicyList.vue";
import SettingsLayoutHeader from "../SettingsLayoutHeader.vue";
import MultiSelectCombobox from "@/components/frappe-ui/MultiSelectCombobox.vue";
import LucideUsers from "~icons/lucide/users";
import { inject, computed } from "vue";

// Inject SLA list and filter states from parent (Sla.vue)
const employeeFilter = inject<any>("employeeFilter");
const teamFilter = inject<any>("teamFilter");
const categoryFilter = inject<any>("categoryFilter");
const subCategoryFilter = inject<any>("subCategoryFilter");

const agentsList = inject<any>("agentsList");
const teamsList = inject<any>("teamsList");
const categoriesResource = inject<any>("categoriesResource");
const subCategoriesResource = inject<any>("subCategoriesResource");
const hasActiveFilters = inject<any>("hasActiveFilters");

const goToNew = () => {
  resetSlaData();
  slaActiveScreen.value = {
    screen: "view",
    data: null,
    fetchData: true,
  };
};

const agentOptions = computed(() => {
  if (!agentsList?.data) return [];
  return agentsList.data.map((agent: any) => ({
    label: agent.agent_name || agent.user || agent.name,
    value: agent.user || agent.name,
    description: agent.user || agent.name,
  }));
});

const teamOptions = computed(() => {
  if (!teamsList?.data) return [];
  return teamsList.data.map((team: any) => ({
    label: team.name,
    value: team.name,
  }));
});

const categoryOptions = computed(() => {
  const opts = [{ label: "All Categories", value: "" }];
  if (categoriesResource?.data) {
    categoriesResource.data.forEach((cat: any) => {
      opts.push({ label: cat.category_name || cat.name, value: cat.name });
    });
  }
  return opts;
});

const subCategoryOptions = computed(() => {
  const opts = [{ label: "All Sub-Categories", value: "" }];
  if (subCategoriesResource?.data) {
    subCategoriesResource.data.forEach((sub: any) => {
      opts.push({ label: sub.category_name || sub.name, value: sub.name });
    });
  }
  return opts;
});

const employeeFilterLabel = computed(() => {
  if (!employeeFilter?.value) {
    return "All Employees";
  }
  return employeeFilter.value.label || employeeFilter.value;
});

const teamFilterLabel = computed(() => {
  if (!teamFilter?.value) {
    return "All Teams";
  }
  return teamFilter.value.label || teamFilter.value;
});

const clearAllFilters = () => {
  if (employeeFilter) employeeFilter.value = null;
  if (teamFilter) teamFilter.value = null;
  if (categoryFilter) categoryFilter.value = "";
  if (subCategoryFilter) subCategoryFilter.value = "";
};
</script>
