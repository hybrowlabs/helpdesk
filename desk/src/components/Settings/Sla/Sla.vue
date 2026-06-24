<template>
  <div class="pb-8">
    <SlaPolicies v-if="slaActiveScreen.screen == 'list'" />
    <SlaPolicyView v-else-if="slaActiveScreen.screen == 'view'" />
  </div>
</template>

<script setup lang="ts">
import { slaActiveScreen } from "@/stores/sla";
import SlaPolicies from "./SlaPolicies.vue";
import SlaPolicyView from "./SlaPolicyView.vue";
import { createListResource, createResource } from "frappe-ui";
import { provide, ref, watch, computed, reactive } from "vue";

// Filter states
const employeeFilter = ref<any>(null);
const teamFilter = ref<any>(null);
const categoryFilter = ref("");
const subCategoryFilter = ref("");

// Fetch SLA policies list
const slaPolicyListData = createResource({
  url: "helpdesk.api.sla_filters.get_sla_list",
  makeParams: () => ({
    user: employeeFilter.value?.value || employeeFilter.value || "",
    team: teamFilter.value?.value || teamFilter.value || "",
    category: categoryFilter.value || "",
    sub_category: subCategoryFilter.value || "",
  }),
  auto: true,
});

// Fetch active agents for user filter
const agentsList = createListResource({
  doctype: "HD Agent",
  fields: ["name", "agent_name", "user"],
  filters: { is_active: 1 },
  auto: true,
  pageLength: 999,
});

// Fetch HD Teams list
const teamsList = createListResource({
  doctype: "HD Team",
  fields: ["name", "assignment_rule"],
  auto: true,
  pageLength: 999,
});


// Fetch categories
const categoriesResource = createResource({
  url: "helpdesk.api.category.get_categories",
  auto: true,
});

// Fetch sub-categories
const subCategoriesResource = createResource({
  url: "helpdesk.api.category.get_subcategories",
  makeParams: () => ({
    parent_category: categoryFilter.value,
  }),
});

// Watch category filter to reset sub-category filter on change and load new sub-categories
watch(categoryFilter, (newCategory) => {
  subCategoryFilter.value = "";
  if (newCategory) {
    subCategoriesResource.submit({
      parent_category: newCategory,
    });
  } else {
    subCategoriesResource.setData([]);
  }
});

// Watch filters to reload SLA policies list with new payload
watch(
  [employeeFilter, teamFilter, categoryFilter, subCategoryFilter],
  () => {
    slaPolicyListData.submit({
      user: employeeFilter.value?.value || employeeFilter.value || "",
      team: teamFilter.value?.value || teamFilter.value || "",
      category: categoryFilter.value || "",
      sub_category: subCategoryFilter.value || "",
    });
  },
  { deep: true }
);

// Computed: check if any filter is active
const hasActiveFilters = computed(() => {
  return (
    employeeFilter.value ||
    teamFilter.value ||
    categoryFilter.value !== "" ||
    subCategoryFilter.value !== ""
  );
});

// Proxy list resource to inject the filtered data while preserving reactivity
const proxiedSlaPolicyList = reactive({
  reload: () => slaPolicyListData.reload(),
  delete: createResource({
    url: "frappe.client.delete",
    makeParams: (name) => ({
      doctype: "HD Service Level Agreement",
      name: name,
    }),
    onSuccess: () => {
      slaPolicyListData.reload();
    },
  }),
  setValue: createResource({
    url: "frappe.client.set_value",
    makeParams: (params) => ({
      doctype: "HD Service Level Agreement",
      name: params.name,
      fieldname: "enabled",
      value: params.enabled,
    }),
    onSuccess: () => {
      slaPolicyListData.reload();
    },
  }),
  list: reactive({
    loading: computed(() => slaPolicyListData.loading),
    data: computed(() => slaPolicyListData.data || []),
  }),
});

// Provide states and filters
provide("slaPolicyList", proxiedSlaPolicyList);
provide("employeeFilter", employeeFilter);
provide("teamFilter", teamFilter);
provide("categoryFilter", categoryFilter);
provide("subCategoryFilter", subCategoryFilter);

provide("agentsList", agentsList);
provide("teamsList", teamsList);
provide("categoriesResource", categoriesResource);
provide("subCategoriesResource", subCategoriesResource);
provide("hasActiveFilters", hasActiveFilters);
</script>
