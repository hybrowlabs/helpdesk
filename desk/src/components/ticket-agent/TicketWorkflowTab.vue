<template>
  <div class="flex flex-1 flex-col overflow-y-auto px-5 py-4">
    <div v-if="workflow.loading" class="flex items-center justify-center py-8">
      <Button :loading="true" variant="ghost" size="lg" />
    </div>
    <template v-else-if="data?.workflow">
      <!-- Linked record -->
      <template v-if="data.workflow.name">
        <div class="mb-4 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="text-lg font-semibold text-ink-gray-8">
              {{ data.workflow.name }}
            </span>
            <Badge
              v-if="data.workflow.status"
              :label="data.workflow.status.label"
              :theme="data.workflow.status.color"
              variant="subtle"
            />
          </div>
          <Button
            :label="__('Open in Desk')"
            variant="subtle"
            @click="openDesk(data.workflow.desk_url)"
          >
            <template #suffix>
              <LucideExternalLink class="h-4 w-4" />
            </template>
          </Button>
        </div>
        <div class="divide-y rounded border">
          <div
            v-for="row in data.workflow.rows"
            :key="row.label"
            class="flex items-center justify-between px-3 py-2"
          >
            <span class="text-base text-ink-gray-5">{{ __(row.label) }}</span>
            <span class="text-base text-ink-gray-8">{{ row.value || "—" }}</span>
          </div>
        </div>
      </template>
      <!-- No record yet -->
      <div v-else class="flex flex-1 flex-col items-center justify-center gap-3">
        <p class="text-base text-ink-gray-5">
          {{ __("No {0} linked to this ticket", [__(data.workflow.doctype)]) }}
        </p>
        <Button
          :label="__('Create {0}', [__(data.workflow.doctype)])"
          variant="solid"
          :loading="createDoc.loading"
          @click="createDoc.submit({ ticket: ticketId, doctype: data.workflow.doctype })"
        />
      </div>
    </template>
    <div v-else class="flex flex-1 items-center justify-center">
      <p class="text-base text-ink-gray-5">
        {{ __("No workflow configured for this ticket category") }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { TicketSymbol } from "@/types";
import { __ } from "@/translation.ts";
import { Badge, Button, createResource, toast } from "frappe-ui";
import LucideExternalLink from "~icons/lucide/external-link";
import { computed, inject } from "vue";

const ticket = inject(TicketSymbol);
const ticketId = computed(() => String(ticket.value?.doc?.name));

const workflow = createResource({
  url: "philips_captial.api.get_ticket_workflow_doc",
  params: { ticket: ticketId.value },
  auto: true,
  cache: ["ticket_workflow", ticketId.value],
});

const data = computed(() => workflow.data);

const createDoc = createResource({
  url: "philips_captial.api.create_workflow_doc_from_ticket",
  onSuccess(res: { desk_url: string }) {
    openDesk(res.desk_url);
    workflow.reload();
  },
  onError(err: Error) {
    toast.error(err.message || __("Failed to create record"));
  },
});

function openDesk(url: string) {
  window.open(url, "_blank");
}
</script>
