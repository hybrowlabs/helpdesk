<template>
  <div class="flex flex-col overflow-y-auto">
    <LayoutHeader>
      <template #left-header>
        <Breadcrumbs :items="breadcrumbs" />
      </template>
      <template #right-header>
        <CustomActions
          v-if="template.data?._customActions"
          :actions="template.data?._customActions"
        />
      </template>
    </LayoutHeader>
    <!-- Container -->
    <div
      class="flex flex-col gap-5 py-6 h-full flex-1 self-center overflow-auto mx-auto w-full max-w-4xl px-5"
    >
      <!-- custom fields descriptions -->
      <div v-if="Boolean(template.data?.about)" class="">
        <div class="prose-f" v-html="sanitize(template.data.about)" />
      </div>
      <!-- Raise For Others fields -->
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div class="flex flex-col gap-2">
          <span class="block text-sm text-gray-700">
            Raised For
          </span>
          <FormControl
            v-model="custom_rasied_for"
            type="select"
            :options="raisedForOptions"
            placeholder="Select an option"
            @change="onRaisedForChange"
          />
        </div>
        <div v-if="custom_rasied_for === 'Others'" class="flex flex-col gap-2">
          <span class="block text-sm text-gray-700">
            Employee
          </span>
          <EmployeeLink
            :model-value="custom_raise_for_employee"
            @update:model-value="(val) => onEmployeeChange(val)"
          />
        </div>
      </div>
      <!-- category and subcategory fields -->
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div class="flex flex-col gap-2">
          <span class="block text-sm text-gray-700">
            Category
            <span class="place-self-center text-red-500"> * </span>
          </span>
          <FormControl
            v-model="custom_category"
            type="select"
            :options="categoriesOptions"
            placeholder="Select a category"
            @change="onCategoryChange"
          />
        </div>
        <div v-if="custom_category && subcategoriesOptions.length > 0" class="flex flex-col gap-2">
          <span class="block text-sm text-gray-700">
            Subcategory
          </span>
          <FormControl
            v-model="custom_sub_category"
            type="select"
            :options="subcategoriesOptions"
            placeholder="Select a subcategory"
          />
        </div>
      </div>
      <!-- existing fields -->
      <div
        class="flex flex-col"
        :class="(subject.length >= 2 || description.length) && 'gap-5'"
      >
        <div class="flex flex-col gap-2">
          <span class="block text-sm text-gray-700">
            Subject
            <span class="place-self-center text-red-500"> * </span>
          </span>
          <FormControl
            v-model="subject"
            type="text"
            placeholder="A short description"
          />
        </div>
        <SearchArticles
          v-if="isCustomerPortal"
          :query="subject"
          class="shadow"
        />
        <div v-if="isCustomerPortal">
          <h4
            v-show="subject.length <= 2 && description.length === 0"
            class="text-p-sm text-gray-500 ml-1"
          >
            Please enter a subject to continue
          </h4>
          <TicketTextEditor
            v-show="subject.length > 2 || description.length > 0"
            ref="editor"
            v-model:attachments="attachments"
            v-model:content="description"
            placeholder="Detailed explanation"
            expand
            :uploadFunction="(file:any)=>uploadFunction(file)"
          >
            <template #bottom-right>
              <Button
                label="Submit"
                theme="gray"
                variant="solid"
                :disabled="
                  ($refs.editor as any)?.editor?.isEmpty || ticket.loading || !subject
                "
                @click="() => ticket.submit()"
              />
            </template>
          </TicketTextEditor>
        </div>
      </div>

      <!-- for agent portal -->
      <div v-if="!isCustomerPortal">
        <TicketTextEditor
          ref="editor"
          v-model:attachments="attachments"
          v-model:content="description"
          placeholder="Detailed explanation"
          expand
        >
          <template #bottom-right>
            <Button
              label="Submit"
              theme="gray"
              variant="solid"
              :disabled="
                ($refs.editor as any)?.editor?.isEmpty || ticket.loading || !subject
              "
              @click="() => ticket.submit()"
            />
          </template>
        </TicketTextEditor>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { LayoutHeader } from "@/components";
import EmployeeLink from "../../components/ticket/EmployeeLink.vue";
import { useAuthStore } from "@/stores/auth";
import { globalStore } from "@/stores/globalStore";
import { capture } from "@/telemetry";
// Field type removed - templateFields no longer used
import { isCustomerPortal, uploadFunction } from "@/utils";
import {
  Breadcrumbs,
  Button,
  call,
  createResource,
  FormControl,
  toast,
  usePageMeta,
} from "frappe-ui";
import { useOnboarding } from "frappe-ui/frappe";
import { isEmpty } from "lodash";
import sanitizeHtml from "sanitize-html";
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import SearchArticles from "../../components/SearchArticles.vue";
import TicketTextEditor from "./TicketTextEditor.vue";

interface P {
  templateId?: string;
}

const props = withDefaults(defineProps<P>(), {
  templateId: "",
});

const route = useRoute();
const router = useRouter();
const { $dialog } = globalStore();
const { updateOnboardingStep } = useOnboarding("helpdesk");
const { isManager, userId: userID } = useAuthStore();

const subject = ref("");
const description = ref("");
const attachments = ref([]);
// templateFields removed - no longer needed
const custom_category = ref("");
const custom_sub_category = ref("");
const categoriesOptions = ref([]);
const subcategoriesOptions = ref([]);
// Raise For Others fields
const custom_rasied_for = ref("Myself");
const custom_raise_for_employee = ref("");
const raisedForOptions = [
  { label: "Myself", value: "Myself" },
  { label: "Others", value: "Others" },
];

const template = createResource({
  url: "helpdesk.helpdesk.doctype.hd_ticket_template.api.get_one",
  makeParams: () => ({
    name: props.templateId || "Default",
  }),
  auto: true,
  onSuccess: (data) => {
    description.value = data.description_template || "";
    // TemplateFields removed - no longer needed
  },
});

// TemplateFields removed - no longer needed

async function ensureEmployeeNameDisplay(employeeId: string) {
  if (!employeeId) return;
  
  try {
    // Fetch employee document to get employee_name
    const employeeRes = await call("frappe.client.get", {
      doctype: "Employee",
      name: employeeId,
    });
    
    if (employeeRes?.message) {
      const employee = employeeRes.message;
      const employeeName = employee.employee_name || employee.name;
      
      // Cache the link title using Frappe's link title cache mechanism
      // This ensures the Vue Link component displays the name instead of ID
      const frappeWindow = window as any;
      if (frappeWindow.frappe?.utils?.add_link_title) {
        frappeWindow.frappe.utils.add_link_title("Employee", employeeId, employeeName);
      } else if (frappeWindow.frappe?.link_title_cache) {
        // Fallback: directly set in cache if add_link_title doesn't exist
        if (!frappeWindow.frappe.link_title_cache["Employee"]) {
          frappeWindow.frappe.link_title_cache["Employee"] = {};
        }
        frappeWindow.frappe.link_title_cache["Employee"][employeeId] = employeeName;
      }
      
      // Trigger search_link API call to ensure the Link component refreshes
      // This will use the cached title or fetch it from the server
      await call("frappe.desk.search.search_link", {
        doctype: "Employee",
        txt: employeeId,
        filters: {},
        page_length: 1,
      });
    }
  } catch (error) {
    console.warn("Error loading employee name:", error);
  }
}

// handleOnFieldChange removed - templateFields no longer used

const ticket = createResource({
  url: "helpdesk.helpdesk.doctype.hd_ticket.api.new",
  debounce: 300,
  makeParams: () => {
    // Ensure value is never "Other" - always use "Others"
    let raisedForValue = custom_rasied_for.value;
    if (raisedForValue === "Other") {
      console.warn("[TICKET DEBUG] Warning: 'Other' detected, converting to 'Others'");
      raisedForValue = "Others";
      custom_rasied_for.value = "Others";
    }
    
    // Build doc payload - do not include templateFields
    const docPayload = {
      description: description.value,
      subject: subject.value,
      template: props.templateId,
      custom_category: custom_category.value,
      custom_sub_category: custom_sub_category.value,
      custom_rasied_for: raisedForValue,
      custom_raise_for_employee: custom_raise_for_employee.value,
      custom_for_myself: raisedForValue === "Myself" ? 1 : 0,
      custom_for_others: raisedForValue === "Others" ? 1 : 0,
    };
    
    // Debug logs
    console.log("=== TICKET CREATION DEBUG ===");
    console.log("custom_rasied_for value:", raisedForValue);
    console.log("custom_raise_for_employee value:", custom_raise_for_employee.value);
    console.log("custom_for_myself:", docPayload.custom_for_myself);
    console.log("custom_for_others:", docPayload.custom_for_others);
    console.log("Full doc payload:", JSON.stringify(docPayload, null, 2));
    console.log("============================");
    
    return {
      doc: docPayload,
      attachments: attachments.value,
    };
  },
  validate: (params) => {
    // Basic validation
    const requiredFields = ["subject", "description"];
    // custom_category is only required if categories are available
    if (categoriesOptions.value.length > 0) {
      requiredFields.push("custom_category");
    }
    for (const field of requiredFields) {
      if (isEmpty(params.doc[field])) {
        const label = field.replace("custom_", "").replace(/_/g, " ");
        toast.error(`${label} is required`);
        return `${field} is required`;
      }
    }
  },
  onSuccess: (data) => {
    router.push({
      name: isCustomerPortal.value ? "TicketCustomer" : "TicketAgent",
      params: {
        ticketId: data.name,
      },
    });
    if (isManager) {
      updateOnboardingStep("create_first_ticket", true, false, () =>
        localStorage.setItem("firstTicket", data.name)
      );
    }
    // only capture telemetry for customer portal
    if (isCustomerPortal.value) {
      capture("new_ticket_submitted", {
        data: {
          user: userID,
          ticketID: data.name,
          subject: subject.value,
          description: description.value,
        },
      });
    }
  },
  onError: (error) => {
    toast.error(error.messages?.[0] || error.message || "Failed to create ticket");
  },
});

function sanitize(html: string) {
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img"]),
  });
}

const breadcrumbs = computed(() => {
  const items = [
    {
      label: "Tickets",
      route: {
        name: isCustomerPortal.value ? "TicketsCustomer" : "TicketsAgent",
      },
    },
    {
      label: "New Ticket",
      route: {
        name: "TicketNew",
      },
    },
  ];
  return items;
});

usePageMeta(() => ({
  title: "New Ticket",
}));

async function loadCategories() {
  try {
    const response = await call("helpdesk.api.category.get_categories");
    categoriesOptions.value = response.map(cat => ({
      label: cat.category_name,
      value: cat.name
    }));
  } catch (error) {
    console.error("Error loading categories:", error);
  }
}

function onRaisedForChange() {
  console.log("[TICKET DEBUG] onRaisedForChange called, value:", custom_rasied_for.value);
  if (custom_rasied_for.value === "Myself") {
    custom_raise_for_employee.value = "";
    console.log("[TICKET DEBUG] Cleared custom_raise_for_employee (Myself selected)");
  } else if (custom_rasied_for.value === "Other") {
    // Safety check: convert "Other" to "Others"
    console.warn("[TICKET DEBUG] Warning: 'Other' detected in onRaisedForChange, converting to 'Others'");
    custom_rasied_for.value = "Others";
  }
}

async function onEmployeeChange(employeeId: string) {
  console.log("[TICKET DEBUG] onEmployeeChange called, employeeId:", employeeId);
  custom_raise_for_employee.value = employeeId;
  console.log("[TICKET DEBUG] custom_raise_for_employee.value set to:", custom_raise_for_employee.value);
  if (employeeId) {
    await ensureEmployeeNameDisplay(employeeId);
  }
}

async function onCategoryChange() {
  custom_sub_category.value = "";
  subcategoriesOptions.value = [];
  
  if (custom_category.value) {
    try {
      const response = await call(
        "helpdesk.api.category.get_subcategories",
        { parent_category: custom_category.value }
      );
      subcategoriesOptions.value = response.map(sub => ({
        label: sub.category_name,
        value: sub.name
      }));
    } catch (error) {
      console.error("Error loading subcategories:", error);
    }
  }
}

// Watch for employee field changes to ensure name is displayed
watch(
  () => custom_raise_for_employee.value,
  (newValue) => {
    if (newValue) {
      ensureEmployeeNameDisplay(newValue);
    }
  },
  { immediate: true }
);

onMounted(() => {
  capture("new_ticket_page", {
    data: {
      user: userID,
    },
  });
  loadCategories();
  
  // Ensure employee name is displayed if field already has a value
  if (custom_raise_for_employee.value) {
    ensureEmployeeNameDisplay(custom_raise_for_employee.value);
  }
});
</script>
