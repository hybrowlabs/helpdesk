<template>
  <div
    class="md:mx-10 md:my-4 flex items-center justify-between text-lg font-medium mx-6 mb-4 !mt-8"
  >
    <div class="flex h-8 items-center text-xl font-semibold text-gray-800">
      {{ title }}
    </div>

    <div class="flex items-center gap-2">
      <Button
        v-if="parsedCreationData"
        variant="outline"
        @click="showCreationModal = true"
      >
        Creation Form
      </Button>

      <Button
        v-if="parsedClosingData"
        variant="outline"
        @click="showClosingModal = true"
      >
        Close Form
      </Button>

      <Button
        v-if="title === 'Emails' && ticketStatus !== 'Closed'"
        variant="solid"
        @click="communicationAreaRef?.toggleEmailBox?.()"
      >
        <template #prefix>
          <FeatherIcon name="plus" class="h-4 w-4" />
        </template>
        <span>New Email</span>
      </Button>

      <Button
        v-else-if="title === 'Comments' && ticketStatus !== 'Closed'"
        variant="solid"
        @click="communicationAreaRef?.toggleCommentBox?.()"
      >
        <template #prefix>
          <FeatherIcon name="plus" class="h-4 w-4" />
        </template>
        <span>New Comment</span>
      </Button>

      <Dropdown v-else-if="ticketStatus !== 'Closed'" :options="defaultActions" @click.stop>
        <template v-slot="{ open }">
          <Button variant="solid" class="flex items-center gap-1">
            <template #prefix>
              <FeatherIcon name="plus" class="h-4 w-4" />
            </template>
            <span>New</span>
            <template #suffix>
              <FeatherIcon
                :name="open ? 'chevron-up' : 'chevron-down'"
                class="h-4 w-4"
              />
            </template>
          </Button>
        </template>
      </Dropdown>
    </div>
  </div>

  <!-- Creation Data Modal -->
  <Dialog
    v-model="showCreationModal"
    :options="{ title: 'Creation Form Data' }"
  >
    <template #body-content>
      <div
        v-if="creationFormSchema"
        class="py-2 max-h-[60vh] overflow-y-auto"
        ref="creationFormContainerRef"
      >
        <Form
          :key="creationFormKey"
          :form="creationFormSchema"
          :submission="creationSubmission"
          :options="formOptions"
        />
        <FormioAttachmentPreview :containerRef="creationFormContainerRef" :formKey="creationFormKey" />
      </div>

      <div
        v-else-if="creationFallbackEntries.length"
        class="flex flex-col gap-3 py-2 max-h-[60vh] overflow-y-auto"
      >
        <div
          v-for="item in creationFallbackEntries"
          :key="item.key"
          class="flex flex-col pb-2 border-b border-gray-100 last:border-0"
        >
          <span class="text-sm font-medium text-gray-500 capitalize">
            {{ item.label }}
          </span>
          <span class="text-base text-gray-800 mt-1 whitespace-pre-wrap">
            {{ item.value }}
          </span>
        </div>
      </div>
    </template>
  </Dialog>

  <!-- Closing Data Modal -->
  <Dialog
    v-model="showClosingModal"
    :options="{ title: 'Closing Form Data' }"
  >
    <template #body-content>
      <div
        v-if="closingFormSchema"
        class="py-2 max-h-[60vh] overflow-y-auto"
        ref="closingFormContainerRef"
      >
        <Form
          :key="closingFormKey"
          :form="closingFormSchema"
          :submission="closingSubmission"
          :options="formOptions"
        />
        <FormioAttachmentPreview :containerRef="closingFormContainerRef" :formKey="closingFormKey" />
      </div>

      <div
        v-else-if="closingFallbackEntries.length"
        class="flex flex-col gap-3 py-2 max-h-[60vh] overflow-y-auto"
      >
        <div
          v-for="item in closingFallbackEntries"
          :key="item.key"
          class="flex flex-col pb-2 border-b border-gray-100 last:border-0"
        >
          <span class="text-sm font-medium text-gray-500 capitalize">
            {{ item.label }}
          </span>
          <span class="text-base text-gray-800 mt-1 whitespace-pre-wrap">
            {{ item.value }}
          </span>
        </div>
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, h, inject, ref } from "vue";
import { Dropdown, Dialog, Button } from "frappe-ui";
import { Form } from "@formio/vue";
import "@formio/js/dist/formio.full.min.css";
import { CommentIcon, EmailIcon } from "@/components/icons";
import FormioAttachmentPreview from "./FormioAttachmentPreview.vue";

type FormioComponent = {
  key?: string;
  label?: string;
  components?: FormioComponent[];
};

type FormioSchema = {
  display?: string;
  components?: FormioComponent[];
  [key: string]: any;
};

type FormioPayload = {
  schema?: FormioSchema;
  answer?: Record<string, any>;
  [key: string]: any;
};

const props = defineProps({
  title: {
    type: String,
    required: true,
  },
  ticketStatus: {
    type: String,
    default: "",
  },
  ticket: {
    type: Object,
    default: () => ({}),
  },
});

const showCreationModal = ref(false);
const showClosingModal = ref(false);
const creationFormContainerRef = ref<HTMLElement | null>(null);
const closingFormContainerRef = ref<HTMLElement | null>(null);

const communicationAreaRef = inject<any>("communicationArea", null);

const formOptions = {
  readOnly: true,
  noAlerts: true,
  highlightErrors: false,
};

function safeParseJson(value: unknown): any | null {
  if (!value) return null;
  if (typeof value === "object") return value;
  if (typeof value !== "string") return null;

  try {
    return JSON.parse(value);
  } catch (error) {
    console.error("Failed to parse form data:", error);
    return null;
  }
}

function normalizeFormPayload(rawValue: unknown): FormioPayload | null {
  const parsed = safeParseJson(rawValue);
  if (!parsed || typeof parsed !== "object") return null;

  // Case 1: saved as { schema, answer }
  if ("schema" in parsed || "answer" in parsed) {
    return {
      schema: parsed.schema ?? null,
      answer: parsed.answer ?? {},
      ...parsed,
    };
  }

  // Case 2: raw Form.io schema saved directly
  if (Array.isArray(parsed.components)) {
    return {
      schema: parsed,
      answer: {},
    };
  }

  return null;
}

function getAllSchemaKeys(schema: FormioSchema | null | undefined): Set<string> {
  const keys = new Set<string>();

  const walk = (components?: FormioComponent[]) => {
    if (!Array.isArray(components)) return;

    for (const component of components) {
      if (component?.key) keys.add(component.key);
      if (Array.isArray(component?.components)) {
        walk(component.components);
      }
    }
  };

  walk(schema?.components);
  return keys;
}

function normalizeAnswer(
  schema: FormioSchema | null | undefined,
  answer: Record<string, any> | null | undefined
): Record<string, any> {
  if (!answer || typeof answer !== "object") return {};

  const schemaKeys = getAllSchemaKeys(schema);
  if (schemaKeys.size === 0) {
    return { ...answer };
  }

  const normalized: Record<string, any> = {};
  for (const [key, value] of Object.entries(answer)) {
    if (schemaKeys.has(key)) {
      normalized[key] = value;
    }
  }

  return normalized;
}

function buildFallbackEntries(
  payload: FormioPayload | null
): { key: string; label: string; value: string }[] {
  if (!payload) return [];

  const answer = payload.answer ?? {};
  const entries = Object.entries(answer);

  return entries.map(([key, value]) => ({
    key,
    label: String(key).replace(/_/g, " "),
    value:
      typeof value === "string"
        ? value
        : Array.isArray(value)
          ? value.map((item) => {
              if (item && typeof item === "object") {
                return item.originalName ?? item.name ?? JSON.stringify(item);
              }
              return String(item);
            }).join(", ")
          : value !== null && value !== undefined
            ? JSON.stringify(value, null, 2)
            : "",
  }));
}

const parsedCreationData = computed(() =>
  normalizeFormPayload((props.ticket as any)?.creation_form_data)
);

const parsedClosingData = computed(() =>
  normalizeFormPayload((props.ticket as any)?.closing_form_data)
);

const creationFormSchema = computed<FormioSchema | null>(() => {
  const payload = parsedCreationData.value;
  const schema = payload?.schema ?? null;

  if (schema && Array.isArray(schema.components) && schema.components.length > 0) {
    return {
      display: schema.display ?? "form",
      ...schema,
    };
  }

  return null;
});

const closingFormSchema = computed<FormioSchema | null>(() => {
  const payload = parsedClosingData.value;
  const schema = payload?.schema ?? null;

  if (schema && Array.isArray(schema.components) && schema.components.length > 0) {
    return {
      display: schema.display ?? "form",
      ...schema,
    };
  }

  return null;
});

const creationSubmission = computed(() => {
  const payload = parsedCreationData.value;
  return {
    data: normalizeAnswer(payload?.schema, payload?.answer),
  };
});

const closingSubmission = computed(() => {
  const payload = parsedClosingData.value;
  return {
    data: normalizeAnswer(payload?.schema, payload?.answer),
  };
});

const creationFormKey = computed(() =>
  JSON.stringify(creationFormSchema.value ?? {})
);

const closingFormKey = computed(() =>
  JSON.stringify(closingFormSchema.value ?? {})
);

const creationFallbackEntries = computed(() =>
  buildFallbackEntries(parsedCreationData.value)
);

const closingFallbackEntries = computed(() =>
  buildFallbackEntries(parsedClosingData.value)
);

const defaultActions = computed(() => [
  {
    icon: h(EmailIcon, { class: "h-4 w-4" }),
    label: "Email",
    onClick: () => communicationAreaRef?.value?.toggleEmailBox?.(),
  },
  {
    icon: h(CommentIcon, { class: "h-4 w-4" }),
    label: "Comment",
    onClick: () => communicationAreaRef?.value?.toggleCommentBox?.(),
  },
]);
</script>

<style src="@/formio.custom.css"></style>