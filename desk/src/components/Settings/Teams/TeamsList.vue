<template>
  <div class="w-full h-full flex flex-col">
    <!-- Header -->
    <SettingsLayoutHeader
      title="Teams"
      description="Create and manage teams and assign agents to specific teams."
    >
      <template #actions>
        <Button
          label="New"
          theme="gray"
          variant="solid"
          @click="() => (showForm = !showForm)"
          icon-left="plus"
        />
      </template>
      <template #bottom-section>
        <div class="flex items-end gap-4 flex-wrap">
          <!-- Search field -->
          <div class="flex flex-col gap-1.5">
            <span class="text-xs font-medium text-gray-600">Filter by Team Name</span>
            <FormControl
              v-model="search"
              :placeholder="'Filter by Team Name'"
              type="text"
              :debounce="300"
              class="w-60"
            >
              <template #prefix>
                <LucideSearch class="h-4 w-4 text-gray-500" />
              </template>
            </FormControl>
          </div>
          <!-- Member filter -->
          <div class="flex flex-col gap-1.5 min-w-[200px]">
            <span class="text-xs font-medium text-gray-600">Filter by Employee</span>
            <MultiSelectCombobox
              v-model="memberFilter"
              :options="agentOptions"
              :multiple="true"
              placeholder="Filter by Employee"
              class="w-full"
            >
              <template #target="{ open, togglePopover }">
                <Button
                  class="flex items-center justify-between w-full h-7 text-base text-gray-800 bg-gray-100 hover:bg-gray-200"
                  @click="togglePopover"
                >
                  <template #prefix>
                    <LucideUsers class="h-4 w-4 text-gray-500 mr-1" />
                  </template>
                  <span class="truncate text-left flex-1">
                    {{ memberFilterLabel }}
                  </span>
                  <template #suffix>
                    <FeatherIcon
                      :name="open ? 'chevron-up' : 'chevron-down'"
                      class="h-4 w-4 text-gray-600"
                    />
                  </template>
                </Button>
              </template>
            </MultiSelectCombobox>
          </div>
          <!-- Clear all filters -->
          <Button
            v-if="hasActiveFilters"
            variant="ghost"
            icon="x"
            label="Clear"
            class="!text-gray-600 mb-0.5"
            @click="clearAllFilters"
          />
        </div>
      </template>
    </SettingsLayoutHeader>
    <!-- List -->
    <div
      v-if="!teams.loading && teams.data?.length > 0"
      class="divide-y w-full h-full hide-scrollbar overflow-y-scroll mt-4"
    >
      <div
        v-for="team in teams.data"
        :key="team.name"
        class="flex items-center gap-2 py-2 group justify-between cursor-pointer"
        @click="() => emit('update:step', 'team-edit', team.name)"
      >
        <div class="flex items-center gap-2">
          <Avatar :label="team.name" size="sm" />
          <p :key="team.name" class="text-p-base text-gray-700">
            {{ team.name }}
          </p>
        </div>
      </div>
    </div>
    <!-- Loading State -->
    <div v-if="teams.loading" class="flex mt-28 justify-between w-full h-full">
      <Button
        :loading="teams.loading"
        variant="ghost"
        class="w-full"
        size="2xl"
      />
    </div>
    <!-- Empty State -->
    <div
      v-if="!teams.data?.length"
      class="flex mt-28 justify-between w-full h-full"
    >
      <p class="text-sm text-gray-500 w-full flex justify-center">
        No teams found
      </p>
    </div>
  </div>
  <NewTeamModal
    v-model="showForm"
    @create="
      () => {
        teams.reload();
      }
    "
  />
</template>

<script setup lang="ts">
import {
  Avatar,
  FormControl,
  createListResource,
  FeatherIcon,
  Button,
} from "frappe-ui";
import { ref, watch, computed } from "vue";
import NewTeamModal from "../NewTeamModal.vue";
import MultiSelectCombobox from "@/components/frappe-ui/MultiSelectCombobox.vue";
import LucideSearch from "~icons/lucide/search";
import LucideUsers from "~icons/lucide/users";
import SettingsLayoutHeader from "../SettingsLayoutHeader.vue";

interface E {
  (event: "update:step", step: string, team: string): void;
}

const emit = defineEmits<E>();

const teams = createListResource({
  doctype: "HD Team",
  fields: ["name", "assignment_rule", "ignore_restrictions"],
  auto: true,
  orderBy: "`tabHD Team`.modified desc",
  groupBy: "`tabHD Team`.name",
});

const search = ref("");
const showForm = ref(false);
const memberFilter = ref<any[]>([]);

// Fetch active agents for member filter
const agentsList = createListResource({
  doctype: "HD Agent",
  fields: ["name", "agent_name", "user"],
  filters: { is_active: 1 },
  auto: true,
  pageLength: 999,
});

const agentOptions = computed(() => {
  if (!agentsList.data) return [];
  return agentsList.data.map((agent: any) => ({
    label: agent.agent_name || agent.user || agent.name,
    value: agent.user || agent.name,
    description: agent.user || agent.name,
  }));
});

const memberFilterLabel = computed(() => {
  if (!memberFilter.value || memberFilter.value.length === 0) {
    return "All Employees";
  }
  if (memberFilter.value.length === 1) {
    return memberFilter.value[0].label;
  }
  return `${memberFilter.value.length} Employees`;
});

const hasActiveFilters = computed(() => {
  return (
    search.value !== "" ||
    (memberFilter.value && memberFilter.value.length > 0)
  );
});

function applyFilters() {
  const filters: any[] = [];

  // Name search
  if (search.value) {
    filters.push(["name", "like", `%${search.value}%`]);
  }

  // Member filter — uses Frappe child table filter syntax with "in"
  if (memberFilter.value && memberFilter.value.length > 0) {
    const selectedEmails = memberFilter.value.map((opt: any) => opt.value || opt);
    filters.push(["HD Team Member", "user", "in", selectedEmails]);
  }

  teams.filters = filters;
  teams.start = 0;
  teams.pageLength = 999;
  teams.reload();
}

function clearAllFilters() {
  search.value = "";
  memberFilter.value = [];
  teams.filters = {};
  teams.start = 0;
  teams.pageLength = 999;
  teams.reload();
}

watch(search, () => {
  applyFilters();
});

watch(
  memberFilter,
  () => {
    applyFilters();
  },
  { deep: true }
);
</script>

<style scoped></style>
