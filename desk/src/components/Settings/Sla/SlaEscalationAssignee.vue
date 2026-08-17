<template>
  <div class="space-y-1.5">
    <FormLabel v-if="label" :label="label" />
    <div
      class="flex flex-wrap items-center gap-1 rounded border border-outline-gray-2 bg-surface-white p-1.5 min-h-[2.25rem]"
    >
      <Button
        v-for="user in selected"
        :key="user"
        :label="labelFor(user)"
        theme="gray"
        variant="subtle"
        size="sm"
        class="rounded-full"
      >
        <template #suffix>
          <FeatherIcon class="h-3.5" name="x" @click.stop="removeUser(user)" />
        </template>
      </Button>
      <div class="flex-1 min-w-[8rem]">
        <Combobox v-model="picked" nullable>
          <Popover v-model:show="showOptions" class="w-full">
            <template #target="{ togglePopover }">
              <ComboboxInput
                class="form-input w-full border-none bg-surface-white hover:bg-surface-white focus:border-none focus:!shadow-none focus-visible:!ring-0"
                type="text"
                :value="query"
                autocomplete="off"
                :placeholder="selected.length ? '' : placeholder"
                @change="
                  (e) => {
                    query = e.target.value;
                    showOptions = true;
                  }
                "
                @focus="() => togglePopover()"
              />
            </template>
            <template #body="{ isOpen }">
              <div v-show="isOpen">
                <div class="mt-1 rounded-lg bg-surface-white py-1 text-base shadow-2xl">
                  <ComboboxOptions class="my-1 max-h-[12rem] overflow-y-auto px-1.5" static>
                    <ComboboxOption
                      v-for="option in options"
                      :key="option.value"
                      v-slot="{ active }"
                      :value="option"
                    >
                      <li
                        :class="[
                          'flex cursor-pointer items-center rounded px-2 py-1 text-base',
                          { 'bg-surface-gray-2': active },
                        ]"
                      >
                        <UserAvatar class="mr-2" :name="option.value" size="lg" />
                        <div class="flex flex-col gap-1 p-1 text-ink-gray-8">
                          <div class="text-base font-medium">{{ option.label }}</div>
                          <div class="text-sm text-ink-gray-6">{{ option.value }}</div>
                        </div>
                      </li>
                    </ComboboxOption>
                    <li
                      v-if="options.length === 0"
                      class="rounded-md px-2 py-1.5 text-base text-ink-gray-6"
                    >
                      No agents found
                    </li>
                  </ComboboxOptions>
                </div>
              </div>
            </template>
          </Popover>
        </Combobox>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { UserAvatar } from "@/components/";
import {
  Combobox,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
} from "@headlessui/vue";
import { watchDebounced } from "@vueuse/core";
import { createListResource, FormLabel, Popover } from "frappe-ui";
import { computed, ref } from "vue";

const props = defineProps({
  label: { type: String, default: "" },
  placeholder: { type: String, default: "Add an assignee" },
});

// Stored the way the child doctype stores it: comma separated user ids.
const value = defineModel<string>();

const query = ref("");
const showOptions = ref(false);

const selected = computed(() =>
  (value.value || "")
    .split(",")
    .map((user) => user.trim())
    .filter(Boolean)
);

const agentsList = createListResource({
  doctype: "HD Agent",
  fields: ["name", "agent_name", "user"],
  filters: { is_active: 1 },
  pageLength: 10,
  auto: true,
});

watchDebounced(
  query,
  (val) => {
    agentsList.update({
      filters: val
        ? { is_active: 1, agent_name: ["like", `%${val}%`] }
        : { is_active: 1 },
    });
    agentsList.reload();
  },
  { debounce: 300 }
);

const options = computed(() =>
  (agentsList.data || [])
    .map((agent) => ({
      label: agent.agent_name || agent.name,
      value: agent.user || agent.name,
    }))
    .filter((option) => !selected.value.includes(option.value))
);

const labelFor = (user: string) => {
  const agent = (agentsList.data || []).find((a) => (a.user || a.name) === user);
  return agent?.agent_name || user;
};

const picked = computed({
  get: () => "",
  set: (option: any) => {
    query.value = "";
    showOptions.value = false;
    if (option?.value) addUser(option.value);
  },
});

const addUser = (user: string) => {
  if (selected.value.includes(user)) return;
  value.value = [...selected.value, user].join(", ");
};

const removeUser = (user: string) => {
  value.value = selected.value.filter((u) => u !== user).join(", ");
};
</script>
