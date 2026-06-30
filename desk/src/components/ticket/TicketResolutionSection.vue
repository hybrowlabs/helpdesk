<template>
  <div class="flex flex-col h-full">
    <div class="p-6 border-b">
      <h3 class="text-lg font-semibold text-gray-900">Resolution Details</h3>
      <p class="text-sm text-gray-600 mt-1">
        Provide detailed information about how this ticket was resolved.
      </p>
    </div>

    <div v-if="(ticket.status === 'Requested Closure' || ticket.status === 'Closed') && ticket.resolution_ever_submitted" class="flex-1 overflow-y-auto p-6">
      <div class="bg-green-50 border border-green-200 rounded-lg p-4">
        <div class="flex items-start">
          <TicketIcon class="h-5 w-5 text-green-600 mt-0.5 mr-3" />
          <div class="flex-1">
            <h4 class="text-sm font-medium text-green-800">
              {{ ticket.status === 'Closed' ? 'Ticket Closed' : 'Ticket Resolved' }}
            </h4>
            <div class="mt-2 text-sm text-green-700" v-html="ticket.resolution_details || 'No resolution details provided.'">
            </div>
            <div class="mt-3 space-y-1">
              <div class="text-xs text-green-600">
                {{ ticket.status === 'Closed' ? 'Closed' : 'Resolved' }} on {{ formatDate(ticket.resolution_date || ticket.modified) }}
              </div>
              <div v-if="ticket.resolution_submitted && ticket.resolution_submitted_on" class="text-xs text-green-600">
                Resolution submitted on {{ formatDate(ticket.resolution_submitted_on) }}
              </div>
            </div>
            <div v-if="canRejectResolution" class="mt-4 pt-3 border-t border-green-200">
              <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div class="flex flex-col gap-3">
                  <div class="flex items-center gap-2">
                    <Icon icon="lucide:help-circle" class="h-5 w-5 text-blue-600" />
                    <span class="text-sm font-medium text-blue-900">Is this resolution satisfactory?</span>
                  </div>
                  <div class="flex items-center gap-3">
                    <button
                      @click="markSatisfied"
                      class="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium text-sm rounded-lg transition-colors"
                    >
                      <Icon icon="lucide:thumbs-up" class="h-4 w-4" />
                      Yes, Satisfied
                    </button>
                    <button
                      @click="showRejectDialog = true"
                      class="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-700 hover:bg-red-50 font-medium text-sm rounded-lg transition-colors"
                    >
                      <Icon icon="lucide:thumbs-down" class="h-4 w-4" />
                      No, Needs Work
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Resolution History Timeline -->
      <div v-if="resolutionHistory.length > 1" class="mt-6">
        <h4 class="text-sm font-semibold text-gray-700 mb-3">Resolution History</h4>
        <div class="space-y-3">
          <div
            v-for="entry in resolutionHistory"
            :key="entry.name"
            class="border rounded-lg p-3"
            :class="{
              'border-green-200 bg-green-50': entry.is_current_version,
              'border-gray-200 bg-gray-50': !entry.is_current_version,
            }"
          >
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2">
                <span class="text-xs font-medium px-2 py-0.5 rounded-full"
                  :class="{
                    'bg-green-100 text-green-700': entry.is_current_version,
                    'bg-gray-200 text-gray-600': !entry.is_current_version,
                  }"
                >
                  v{{ entry.version_number }}
                </span>
                <span v-if="entry.is_current_version" class="text-xs text-green-600 font-medium">Current</span>
                <span
                  v-if="entry.satisfaction_status && entry.satisfaction_status !== 'Pending'"
                  class="text-xs font-medium px-2 py-0.5 rounded-full"
                  :class="{
                    'bg-green-100 text-green-700': entry.satisfaction_status === 'Satisfied',
                    'bg-red-100 text-red-700': entry.satisfaction_status === 'Not Satisfied',
                  }"
                >
                  {{ entry.satisfaction_status }}
                </span>
              </div>
              <div class="text-xs text-gray-500">
                {{ entry.submitted_by_name || entry.submitted_by }} &middot; {{ formatDate(entry.submitted_on) }}
              </div>
            </div>
            <div
              v-if="!entry.is_current_version"
              class="text-sm text-gray-600 line-clamp-3 cursor-pointer"
              :class="{ '!line-clamp-none': expandedHistoryEntries[entry.name] }"
              @click="expandedHistoryEntries[entry.name] = !expandedHistoryEntries[entry.name]"
              v-html="entry.resolution_content"
            />
            <div v-if="entry.rejection_reason" class="mt-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded p-2">
              <span class="font-medium">Rejection reason:</span> {{ entry.rejection_reason }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="flex-1 overflow-hidden">
      <div class="h-full flex flex-col">
        <div class="flex-1 overflow-hidden">
          <TextEditor
            ref="editorRef"
            v-model="resolutionDetails"
            :editor-class="'prose-sm max-w-full mx-6 py-3 min-h-[20rem] max-h-[calc(100vh-300px)] overflow-y-auto'"
            placeholder="Provide detailed resolution information..."
            autofocus
            @change="resolutionDetails = $event"
          >
            <template #bottom-right>
              <Button
                label="Submit Resolution"
                variant="solid"
                theme="green"
                :loading="isSubmitting"
                :disabled="!resolutionDetails || resolutionDetails.trim() === '' || resolutionDetails.trim() === '<p></p>'"
                @click="submitResolution"
              />
            </template>
          </TextEditor>
        </div>
      </div>
    </div>

    <!-- Reject Resolution Dialog -->
    <Dialog v-model="showRejectDialog" :options="{ title: 'Reject Resolution' }">
      <template #body-content>
        <div class="flex flex-col gap-3">
          <p class="text-sm text-gray-600">
            Please explain why this resolution doesn't solve your issue:
          </p>
          <FormControl
            v-model="rejectionReason"
            type="textarea"
            size="md"
            variant="subtle"
            placeholder="The resolution provided doesn't solve my issue because..."
            rows="4"
          />
          <div v-if="rejectionError" class="text-red-600 text-sm p-2 bg-red-50 border border-red-200 rounded">
            {{ rejectionError }}
          </div>
          <div class="flex gap-2 justify-end">
            <Button
              variant="subtle"
              label="Cancel"
              @click="showRejectDialog = false"
            />
            <Button
              variant="solid"
              theme="red"
              label="Reject Resolution"
              :loading="isRejecting"
              @click="rejectResolution"
            />
          </div>
        </div>
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, watch, onMounted } from "vue";
import { Button, Dialog, FormControl, call, toast } from "frappe-ui";
import { TextEditor } from "@/components";
import { TicketIcon } from "@/components/icons";
import { useAuthStore } from "@/stores/auth";
import { storeToRefs } from "pinia";

interface Props {
  ticket: any;
  ticketId: string;
}

interface Emits {
  (event: "update"): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const authStore = useAuthStore();
const { userId } = storeToRefs(authStore);

// Fallback to session user from cookie if auth store not loaded yet
const sessionUser = computed(() => {
  const cookies = new URLSearchParams(document.cookie.split("; ").join("&"));
  let _sessionUser = cookies.get("user_id");
  if (_sessionUser === "Guest") {
    _sessionUser = null;
  }
  return _sessionUser;
});

const currentUserId = computed(() => userId.value || sessionUser.value);

// Check if current user can reject resolution
const canRejectResolution = computed(() => {
  if (!props.ticket || !currentUserId.value) return false;

  // Only allow rejection if ticket has resolution
  if (!props.ticket.resolution_details || !props.ticket.resolution_details.trim()) {
    return false;
  }

  // User who raised the ticket can reject
  if (currentUserId.value === props.ticket.raised_by) {
    return true;
  }

  // Employee for whom ticket was raised can reject
  if (props.ticket.custom_raise_for_employee) {
    // The raised_by field should already be set to employee's user_id
    if (currentUserId.value === props.ticket.raised_by) {
      return true;
    }
  }

  return false;
});

const resolutionDetails = ref(`<h3>Resolution Summary</h3>

<p><strong>Issue:</strong> Brief description of the problem</p>

<p><strong>Solution:</strong></p>
<ul>
<li>Step 1: What was done</li>
<li>Step 2: Additional actions taken</li>
</ul>

<p><strong>Result:</strong> Issue resolved successfully</p>

<p><strong>Notes:</strong> Any additional information...</p>`);

const isSubmitting = ref(false);
const showRejectDialog = ref(false);
const rejectionReason = ref("");
const isRejecting = ref(false);
const rejectionError = ref("");

// Resolution history
const resolutionHistory = ref<any[]>([]);
const expandedHistoryEntries = reactive<Record<string, boolean>>({});

async function fetchResolutionHistory() {
  try {
    const history = await call("helpdesk.api.resolution.get_resolution_history", {
      ticket_id: props.ticketId,
    });
    resolutionHistory.value = history || [];
  } catch (err) {
    console.error("Failed to fetch resolution history:", err);
  }
}

// Fetch history on mount and when ticket updates
onMounted(fetchResolutionHistory);
watch(() => props.ticket?.modified, fetchResolutionHistory);

async function submitResolution() {
  if (!resolutionDetails.value.trim() || resolutionDetails.value.trim() === '<p></p>') {
    toast.error("Resolution details are required");
    return;
  }

  try {
    isSubmitting.value = true;

    // Use history-aware API to save resolution
    await call("helpdesk.api.resolution.save_resolution_with_history", {
      ticket_id: props.ticketId,
      resolution_content: resolutionDetails.value,
    });

    // Set status to Requested Closure
    await call("frappe.client.set_value", {
      doctype: "HD Ticket",
      name: props.ticketId,
      fieldname: "status",
      value: "Requested Closure",
    });

    toast.success("Resolution submitted successfully");
    emit("update");
  } catch (err) {
    toast.error(err.message || "Failed to submit resolution");
  } finally {
    isSubmitting.value = false;
  }
}

async function markSatisfied() {
  try {
    await call("helpdesk.helpdesk.doctype.hd_ticket.ticket_closure_workflow.mark_resolution_satisfied", {
      ticket_id: props.ticketId,
    });

    toast.success("Resolution marked as satisfied");
    emit("update");
  } catch (err) {
    toast.error(err.message || "Failed to mark resolution as satisfied");
  }
}

async function rejectResolution() {
  if (!rejectionReason.value.trim()) {
    rejectionError.value = "Please provide a reason for rejection";
    return;
  }

  try {
    isRejecting.value = true;
    rejectionError.value = "";

    await call("helpdesk.helpdesk.doctype.hd_ticket.ticket_closure_workflow.reject_resolution", {
      ticket_id: props.ticketId,
      rejection_reason: rejectionReason.value,
    });

    toast.success("Resolution rejected and ticket reopened");
    showRejectDialog.value = false;
    rejectionReason.value = "";
    emit("update");
  } catch (err) {
    rejectionError.value = err.message || "Failed to reject resolution";
  } finally {
    isRejecting.value = false;
  }
}

function formatDate(dateString: string) {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString();
}
</script>
