<template>
  <div class="flex flex-col">
    <LayoutHeader v-if="ticket.data">
      <template #left-header>
        <Breadcrumbs :items="breadcrumbs" class="breadcrumbs">
          <template #prefix="{ item }">
            <Icon
              v-if="item.icon"
              :icon="item.icon"
              class="mr-1 h-4 flex items-center justify-center self-center"
            />
          </template>
        </Breadcrumbs>
      </template>
      <template #right-header>
        <CustomActions
          v-if="ticket.data._customActions"
          :actions="ticket.data._customActions"
        />
        <div v-if="ticket.data.assignees?.length">
          <component :is="ticket.data.assignees.length == 1 ? 'Button' : 'div'">
            <MultipleAvatar
              :avatars="ticket.data.assignees"
              @click="showAssignmentModal = true"
            />
          </component>
        </div>
        <button
          v-else
          class="rounded bg-gray-100 px-2 py-1.5 text-base text-gray-800"
          @click="showAssignmentModal = true"
        >
          Assign
        </button>
        <Dropdown :options="dropdownOptions">
          <template #default="{ open }">
            <Button :label="ticket.data.status">
              <template #prefix>
                <IndicatorIcon
                  :class="ticketStatusStore.textColorMap[ticket.data.status]"
                />
              </template>
              <template #suffix>
                <FeatherIcon
                  :name="open ? 'chevron-up' : 'chevron-down'"
                  class="h-4"
                />
              </template>
            </Button>
          </template>
        </Dropdown>
        <!-- Resolution Satisfaction Controls -->
        <div v-if="showResolutionSatisfactionControls" class="flex items-center gap-3 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg max-w-md">
          <div class="flex items-center gap-2 flex-1">
            <Icon icon="lucide:help-circle" class="h-4 w-4 text-blue-600 flex-shrink-0" />
            <span class="text-sm text-blue-900 font-medium">Is this resolution satisfactory?</span>
          </div>
          <div class="flex items-center gap-2 flex-shrink-0">
            <Button
              v-if="canMarkSatisfied"
              label="Yes"
              theme="green"
              variant="solid"
              class="text-xs px-3 py-1.5"
              @click="triggerMarkSatisfied()"
            >
              <template #prefix>
                <Icon icon="lucide:thumbs-up" class="h-3 w-3" />
              </template>
            </Button>
            <Button
              v-if="canRejectResolution"
              label="No"
              theme="red"
              variant="outline"
              class="text-xs px-3 py-1.5"
              @click="triggerRejectResolution()"
            >
              <template #prefix>
                <Icon icon="lucide:thumbs-down" class="h-3 w-3" />
              </template>
            </Button>
          </div>
        </div>
        <div class="relative">
          <Button
            v-if="canCloseTicket && ticket.data.status !== 'Closed'"
            :label="(isAdmin || hasValidResolution) ? 'Close' : 'Close (Resolution Required)'"
            :variant="(isAdmin || hasValidResolution) ? 'solid' : 'outline'"
            :theme="(isAdmin || hasValidResolution) ? 'red' : 'gray'"
            :disabled="isAdmin ? false : !hasValidResolution"
            :class="{ 'opacity-60': !isAdmin && !hasValidResolution }"
            @click="triggerClose()"
          />
          <Button
            v-else-if="canRequestClosure && ticket.data.status !== 'Closed'"
            label="Request Closure"
            variant="solid"
            theme="gray"
            @click="triggerRequestClosure()"
          />
        </div>
      </template>
    </LayoutHeader>
    <div v-if="ticket.data" class="flex h-full overflow-hidden">
      <div class="flex flex-1 flex-col max-w-[calc(100%-382px)]">
        <!-- ticket activities -->
        <div class="overflow-y-hidden flex flex-1 !h-full flex-col">
          <Tabs v-model="tabIndex" :tabs="tabs">
            <TabList />
            <TabPanel v-slot="{ tab }" class="h-full">
              <TicketResolutionSection
                v-if="tab.name === 'resolution'"
                :ticket="ticket.data"
                :ticket-id="ticketId"
                @update="
                  () => {
                    ticket.reload();
                  }
                "
              />
              <TicketAgentActivities
                v-else
                ref="ticketAgentActivitiesRef"
                :activities="filterActivities(tab.name)"
                :title="tab.label"
                :ticket-status="ticket.data?.status"
                @update="
                  () => {
                    ticket.reload();
                  }
                "
                @email:reply="
                  (e) => {
                    communicationAreaRef.replyToEmail(e);
                  }
                "
              />
            </TabPanel>
          </Tabs>
        </div>
        <CommunicationArea
          ref="communicationAreaRef"
          v-model="ticket.data"
          :to-emails="[ticket.data?.raised_by]"
          :cc-emails="[]"
          :bcc-emails="[]"
          :key="ticket.data?.name"
          @update="
            () => {
              ticket.reload();
              ticketAgentActivitiesRef.scrollToLatestActivity();
            }
          "
        />
      </div>
      <TicketAgentSidebar
        :ticket="ticket.data"
        @update="({ field, value }) => updateTicket(field, value)"
        @email:open="(e) => communicationAreaRef.toggleEmailBox()"
        @reload="ticket.reload()"
      />
    </div>
    <AssignmentModal
      v-if="ticket.data && showAssignmentModal"
      v-model="showAssignmentModal"
      :assignees="ticket.data.assignees"
      :docname="ticketId"
      :team="ticket.data?.agent_group"
      doctype="HD Ticket"
      @update="
        () => {
          ticket.reload();
        }
      "
    />
    <!-- Rename Subject Dialog -->
    <Dialog v-model="showSubjectDialog" :options="{ title: 'Rename Subject' }">
      <template #body-content>
        <div class="flex flex-col flex-1 gap-3">
          <FormControl
            v-model="renameSubject"
            type="textarea"
            size="sm"
            variant="subtle"
            :disabled="false"
          />
          <Button
            variant="solid"
            :loading="isLoading"
            label="Rename"
            @click="handleRename"
          />
        </div>
      </template>
    </Dialog>
    <!-- Request Closure Dialog -->
    <Dialog v-model="showRequestClosureDialog" :options="{ title: 'Request Closure' }">
      <template #body-content>
        <div class="flex flex-col flex-1 gap-3">
          <p class="text-p-base text-ink-gray-7">
            Request that this ticket be closed by providing resolution details.
          </p>
          <div
            v-if="requestClosureError"
            class="text-red-600 text-sm p-2 bg-red-50 border border-red-200 rounded"
          >
            {{ requestClosureError }}
          </div>
          <FormControl
            v-model="requestClosureNotes"
            type="textarea"
            placeholder="Describe how this ticket was resolved..."
            :rows="4"
          />
          <div class="flex gap-2 justify-end">
            <Button
              variant="subtle"
              label="Cancel"
              @click="showRequestClosureDialog = false"
            />
            <Button
              variant="solid"
              theme="gray"
              label="Request Closure"
              :loading="requestClosureLoading"
              @click="submitRequestClosure"
            />
          </div>
        </div>
      </template>
    </Dialog>
    <!-- Close Ticket Dialog -->
    <Dialog v-model="showCloseDialog" :options="{ title: 'Close Ticket' }">
      <template #body-content>
        <div class="flex flex-col flex-1 gap-3">
          <p class="text-p-base text-ink-gray-7">
            Please provide resolution details to close this ticket.
          </p>
          <div
            v-if="closeError"
            class="text-red-600 text-sm p-2 bg-red-50 border border-red-200 rounded"
          >
            {{ closeError }}
          </div>
          <FormControl
            v-model="closeNotes"
            type="textarea"
            placeholder="Describe how this ticket was resolved..."
            :rows="4"
          />
          <div class="flex gap-2 justify-end">
            <Button
              variant="subtle"
              label="Cancel"
              @click="showCloseDialog = false"
            />
            <Button
              variant="solid"
              theme="red"
              label="Close Ticket"
              :loading="closeLoading"
              @click="submitClose"
            />
          </div>
        </div>
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import {
  Breadcrumbs,
  Button,
  Dialog,
  Dropdown,
  FormControl,
  TabList,
  TabPanel,
  Tabs,
  call,
  createResource,
  toast,
} from "frappe-ui";
import { computed, h, onMounted, onUnmounted, provide, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { storeToRefs } from "pinia";

import {
  AssignmentModal,
  CommunicationArea,
  Icon,
  LayoutHeader,
  MultipleAvatar,
  TextEditor,
} from "@/components";
import {
  ActivityIcon,
  CommentIcon,
  EmailIcon,
  IndicatorIcon,
  TicketIcon,
} from "@/components/icons";
import { TicketAgentActivities, TicketAgentSidebar } from "@/components/ticket";
import TicketResolutionSection from "@/components/ticket/TicketResolutionSection.vue";
import { setupCustomizations } from "@/composables/formCustomisation";
import { useView } from "@/composables/useView";
import { socket } from "@/socket";
import { globalStore } from "@/stores/globalStore";
import { useTicketStatusStore } from "@/stores/ticketStatus";
import { useUserStore } from "@/stores/user";
import { useAuthStore } from "@/stores/auth";
import { TabObject, TicketTab, View } from "@/types";
import { getIcon } from "@/utils";
import { ComputedRef } from "vue";
import { showAssignmentModal } from "./modalStates";
const route = useRoute();
const router = useRouter();

const ticketStatusStore = useTicketStatusStore();
const { getUser } = useUserStore();
const authStore = useAuthStore();
const { userId, isAdmin, isAgent } = storeToRefs(authStore);
const { $dialog } = globalStore();

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
const ticketAgentActivitiesRef = ref(null);
const communicationAreaRef = ref(null);
const renameSubject = ref("");
const isLoading = ref(false);

// Request Closure dialog state
const showRequestClosureDialog = ref(false);
const requestClosureNotes = ref("");
const requestClosureLoading = ref(false);
const requestClosureError = ref("");

// Close Ticket dialog state
const showCloseDialog = ref(false);
const closeNotes = ref("");
const closeLoading = ref(false);
const closeError = ref("");

const props = defineProps({
  ticketId: {
    type: String,
    required: true,
  },
});
watch(
  () => props.ticketId,
  () => {
    ticket.reload();
  }
);

const { findView } = useView("HD Ticket");

provide("communicationArea", communicationAreaRef);

const showSubjectDialog = ref(false);

const ticket = createResource({
  url: "helpdesk.helpdesk.doctype.hd_ticket.api.get_one",
  auto: true,
  makeParams: () => ({
    name: props.ticketId,
  }),
  transform: (data) => {
    if (data._assign) {
      data.assignees = JSON.parse(data._assign).map((assignee) => {
        return {
          name: assignee,
          image: getUser(assignee).user_image,
          label: getUser(assignee).full_name,
        };
      });
    }
    renameSubject.value = data.subject;
  },
  onSuccess: (data) => {
    document.title = data.subject;
    setupCustomizations(ticket, {
      doc: data,
      call,
      router,
      toast,
      $dialog,
      updateField,
      createToast: toast.create,
    });
  },
});
function updateField(name: string, value: string, callback = () => {}) {
  updateTicket(name, value);
  callback();
}

const breadcrumbs = computed(() => {
  let items = [{ label: "Tickets", route: { name: "TicketsAgent" } }];
  if (route.query.view) {
    const currView: ComputedRef<View> = findView(route.query.view as string);
    if (currView) {
      items.push({
        label: currView.value?.label,
        icon: getIcon(currView.value?.icon),
        route: { name: "TicketsAgent", query: { view: currView.value?.name } },
      });
    }
  }
  items.push({
    label: ticket.data?.subject,
    onClick: () => {
      showSubjectDialog.value = true;
    },
  });
  return items;
});

const isRaiser = computed(() => {
  if (!ticket.data || !currentUserId.value) return false;
  return currentUserId.value === ticket.data.raised_by;
});

const isRaisedForCurrentUser = computed(() => {
  if (!ticket.data || !currentUserId.value) return false;
  // Check if ticket was raised for another employee and current user is that employee
  // Since custom_raise_for_employee stores Employee ID, we need to check if raised_by matches current user
  // The backend should have already set raised_by to the employee's user_id
  if (ticket.data.custom_raise_for_employee) {
    return ticket.data.raised_by === currentUserId.value;
  }
  return false;
});

const isAssignedAgent = () => {
  if (!ticket.data || !currentUserId.value) return false;

  // Check if user is directly assigned
  if (ticket.data.assignees && Array.isArray(ticket.data.assignees)) {
    const assignedUsers = ticket.data.assignees.map(a => a.name);
    if (assignedUsers.includes(currentUserId.value)) return true;
  }

  return false;
};

const hasValidResolution = computed(() => {
  if (!ticket.data) return false;

  // Check if resolution was submitted
  if (ticket.data.resolution_submitted) {
    return true;
  }

  // Check if resolution details exist and are not empty/default
  const resolution = ticket.data.resolution_details;
  return resolution &&
         resolution.trim() &&
         resolution.trim() !== '<p></p>' &&
         resolution.trim() !== '';
});

const canCloseTicket = computed(() => {
  if (!ticket.data || !currentUserId.value) return false;

  // Admin can always close any ticket
  if (isAdmin.value) {
    return true;
  }

  // User who raised the ticket can close if:
  // 1. They raised it for themselves (no custom_raise_for_employee)
  // 2. OR ticket is raised_by current user
  if (isRaiser.value) {
    // If there's no custom_raise_for_employee, or it's empty, raiser can close
    if (!ticket.data.custom_raise_for_employee) {
      return true;
    }
  }

  // If ticket was raised for someone else, check if current user is that person
  // The raised_by field should be set to the employee's user_id
  if (ticket.data.custom_raise_for_employee && ticket.data.raised_by === currentUserId.value) {
    return true;
  }

  return false;
});

const canRequestClosure = computed(() => {
  if (!ticket.data || !currentUserId.value) return false;

  // Ticket already closed - no action needed
  if (ticket.data.status === 'Closed') {
    return false;
  }

  // If user can close, they don't need to request
  if (canCloseTicket.value) {
    return false;
  }

  // Assigned agent can request closure
  if (isAssignedAgent()) {
    return true;
  }

  // Any agent can request closure (fallback for agents working on tickets)
  if (isAgent.value) {
    return true;
  }

  return false;
});

const canRejectResolution = computed(() => {
  if (!ticket.data || !currentUserId.value) return false;

  // Only allow rejection if ticket is Resolved or Closed with resolution
  if (ticket.data.status !== 'Resolved' && ticket.data.status !== 'Closed') {
    return false;
  }

  // Must have resolution to reject and it must have been submitted at least once
  if (!ticket.data.resolution_details || !ticket.data.resolution_details.trim()) {
    return false;
  }
  
  if (!ticket.data.resolution_ever_submitted) {
    return false;
  }

  // User can reject if they are the raised_by user
  if (ticket.data.raised_by === currentUserId.value) {
    return true;
  }

  return false;
});

const canMarkSatisfied = computed(() => {
  if (!ticket.data || !currentUserId.value) return false;
  // Only allow marking satisfied if ticket status is Resolved
  if (ticket.data.status !== 'Resolved') {
    return false;
  }
  // Must have resolution that was submitted
  if (!ticket.data.resolution_details || !ticket.data.resolution_details.trim()) {
    return false;
  }
  if (!ticket.data.resolution_ever_submitted) {
    return false;
  }
  // Check if resolution is not already marked as satisfied by checking history
  // For now, allow marking satisfied if ticket is in Resolved status
  // User can mark satisfied if they are the raised_by user
  if (ticket.data.raised_by === currentUserId.value) {
    return true;
  }
  return false;
});

const showResolutionSatisfactionControls = computed(() => {
  // Only show if user can perform satisfaction actions and ticket has resolution
  return (canRejectResolution.value || canMarkSatisfied.value) &&
         ticket.data &&
         ticket.data.status === 'Resolved' &&
         ticket.data.resolution_details;
});

const handleRename = () => {
  if (renameSubject.value === ticket.data?.subject) return;
  updateTicket("subject", renameSubject.value);
  showSubjectDialog.value = false;
};

const dropdownOptions = computed(() =>
  ticketStatusStore.options.map((o) => ({
    label: o,
    value: o,
    onClick: () => updateTicket("status", o),
    icon: () =>
      h(IndicatorIcon, {
        class: ticketStatusStore.textColorMap[o],
      }),
  }))
);

// watch(
//   () => ticket.data,
//   (val) => {
//     console.log("CUSTOM ACTIONSSS");
//     // console.log(val._customActions);
//   },
//   { deep: true }
// );

const tabIndex = ref(0);
const tabs = computed(() => {
  const baseTabs: TabObject[] = [
    {
      name: "activity",
      label: "Activity",
      icon: ActivityIcon,
    },
    {
      name: "email",
      label: "Emails",
      icon: EmailIcon,
    },
    {
      name: "comment",
      label: "Comments",
      icon: CommentIcon,
    },
  ];
  
  // Only show Resolution tab if ticket has been replied to or is in later stages
  const allowedStatuses = ["Replied", "Resolved", "Closed", "Reopened"];
  if (ticket.data && allowedStatuses.includes(ticket.data.status)) {
    baseTabs.push({
      name: "resolution",
      label: "Resolution",
      icon: TicketIcon,
    });
  }
  
  return baseTabs;
});

const activities = computed(() => {
  const emailProps = ticket.data.communications.map((email, idx: number) => {
    return {
      subject: email.subject,
      content: email.content,
      sender: { name: email.user.email, full_name: email.user.name },
      to: email.recipients,
      type: "email",
      key: email.creation,
      cc: email.cc,
      bcc: email.bcc,
      creation: email.communication_date || email.creation,
      attachments: email.attachments,
      name: email.name,
      deliveryStatus: email.delivery_status,
      isFirstEmail: idx === 0,
    };
  });

  const commentProps = ticket.data.comments.map((comment) => {
    return {
      name: comment.name,
      type: "comment",
      key: comment.creation,
      commentedBy: comment.commented_by,
      commenter: comment.user.name,
      creation: comment.creation,
      content: comment.content,
      attachments: comment.attachments,
    };
  });

  const historyProps = [...ticket.data.history, ...ticket.data.views].map(
    (h) => {
      return {
        type: "history",
        key: h.creation,
        content: h.action ? h.action : "viewed this",
        creation: h.creation,
        user: h.user.name + " ",
      };
    }
  );

  const sorted = [...emailProps, ...commentProps, ...historyProps].sort(
    (a, b) => new Date(a.creation) - new Date(b.creation)
  );

  const data = [];
  let i = 0;

  while (i < sorted.length) {
    const currentActivity = sorted[i];
    if (currentActivity.type === "history") {
      currentActivity.relatedActivities = [currentActivity];
      for (let j = i + 1; j < sorted.length + 1; j++) {
        const nextActivity = sorted[j];

        if (nextActivity && nextActivity.user === currentActivity.user) {
          currentActivity.relatedActivities.push(nextActivity);
        } else {
          data.push(currentActivity);
          i = j - 1;
          break;
        }
      }
    } else {
      data.push(currentActivity);
    }
    i++;
  }
  return data;
});

function filterActivities(eventType: TicketTab) {
  if (eventType === "activity") {
    return activities.value;
  }
  return activities.value.filter((activity) => activity.type === eventType);
}
const isErrorTriggered = ref(false);
function updateTicket(fieldname: string, value: string) {
  isErrorTriggered.value = false;
  if (value === ticket.data[fieldname]) return;
  updateOptimistic(fieldname, value);

  createResource({
    url: "frappe.client.set_value",
    params: {
      doctype: "HD Ticket",
      name: props.ticketId,
      fieldname,
      value,
    },
    debounce: 500,
    auto: true,
    onSuccess: () => {
      isLoading.value = false;
      isErrorTriggered.value = false;
      ticket.reload();
    },
    onError: (error) => {
      if (isErrorTriggered.value) return;
      isErrorTriggered.value = true;

      const text = error.exc_type
        ? (error.messages || error.message || []).join(", ")
        : error.message;
      toast.error(text);

      ticket.reload();
    },
  });
}

function updateOptimistic(fieldname: string, value: string) {
  ticket.data[fieldname] = value;
  toast.success("Ticket updated");
}

async function triggerClose() {
  // Validate that resolution exists before allowing close
  const hasResolution = ticket.data.resolution_details &&
                       ticket.data.resolution_details.trim() &&
                       ticket.data.resolution_details.trim() !== '<p></p>';

  // Check if resolution details are already filled
  if (hasResolution) {
    try {
      await call("helpdesk.api.resolution.close_ticket", {
        ticket_id: props.ticketId,
      });
      toast.success("Ticket closed successfully");
      ticket.reload();
    } catch (err) {
      toast.error(err.message || "Failed to close ticket");
    }
    return;
  }

  // No resolution details, show dialog to collect them
  closeNotes.value = "";
  closeError.value = "";
  closeLoading.value = false;
  showCloseDialog.value = true;
}

async function submitClose() {
  if (!closeNotes.value.trim()) {
    closeError.value = "Resolution details are required";
    return;
  }

  try {
    closeLoading.value = true;

    // Save resolution with history tracking
    await call("helpdesk.api.resolution.save_resolution_with_history", {
      ticket_id: props.ticketId,
      resolution_content: closeNotes.value,
    });

    // Close the ticket
    await call("helpdesk.api.resolution.close_ticket", {
      ticket_id: props.ticketId,
    });

    toast.success("Ticket closed successfully");
    ticket.reload();
    showCloseDialog.value = false;
  } catch (err) {
    closeError.value = err.message || "Failed to close ticket";
  } finally {
    closeLoading.value = false;
  }
}


function triggerRejectResolution() {
  $dialog({
    title: "Reject Resolution",
    message: "Please explain why this resolution doesn't solve your issue.",
    actions: [],
    render: ({ close }) => {
      const reason = ref("");
      const isLoading = ref(false);
      const error = ref("");

      return h("div", { class: "flex flex-col gap-3" }, [
        error.value && h("div", {
          class: "text-red-600 text-sm p-2 bg-red-50 border border-red-200 rounded"
        }, error.value),
        h("div", { class: "text-sm text-gray-600 mb-2" }, "Explain why the provided resolution doesn't solve your issue."),
        h(FormControl, {
          type: "textarea",
          placeholder: "The resolution provided doesn't solve my issue because...",
          rows: 4,
          modelValue: reason.value,
          "onUpdate:modelValue": (v: string) => {
            reason.value = v;
            error.value = "";
          },
        }),
        h("div", { class: "flex gap-2 justify-end" }, [
          h(
            Button,
            {
              variant: "subtle",
              label: "Cancel",
              onClick: close,
            },
            {}
          ),
          h(
            Button,
            {
              variant: "solid",
              theme: "red",
              label: "Reject Resolution",
              loading: isLoading.value,
              onClick: async () => {
                if (!reason.value.trim()) {
                  error.value = "Please provide a reason for rejection";
                  return;
                }

                try {
                  isLoading.value = true;
                  await call("helpdesk.helpdesk.doctype.hd_ticket.ticket_closure_workflow.reject_resolution", {
                    ticket_id: props.ticketId,
                    rejection_reason: reason.value,
                  });
                  toast.success("Resolution rejected and ticket reopened");
                  ticket.reload();
                  close();
                } catch (err) {
                  error.value = err.message || "Failed to reject resolution";
                } finally {
                  isLoading.value = false;
                }
              },
            },
            {}
          ),
        ]),
      ]);
    },
  });
}

async function triggerMarkSatisfied() {
  try {
    await call("helpdesk.helpdesk.doctype.hd_ticket.ticket_closure_workflow.mark_resolution_satisfied", {
      ticket_id: props.ticketId,
    });

    toast.success("Resolution marked as satisfied");
    ticket.reload();
  } catch (error) {
    console.error('Error marking resolution as satisfied:', error);
    toast.error(error.message || "Failed to mark resolution as satisfied");
  }
}

async function triggerRequestClosure() {
  // Check if resolution already exists
  const hasResolution = ticket.data.resolution_details &&
                       ticket.data.resolution_details.trim() &&
                       ticket.data.resolution_details.trim() !== '<p></p>';

  // If resolution exists, directly request closure without asking for details again
  if (hasResolution) {
    try {
      const response = await call("pw_helpdesk.customizations.ticket_closure_workflow.request_closure", {
        ticket_id: props.ticketId,
        resolution_notes: ticket.data.resolution_details,
      });
      toast.success(response?.message || "Closure request submitted successfully");
      ticket.reload();
    } catch (err) {
      toast.error(err.message || "Failed to submit closure request");
    }
    return;
  }

  // No resolution exists, show template-based dialog to collect details
  requestClosureNotes.value = "";
  requestClosureError.value = "";
  requestClosureLoading.value = false;
  showRequestClosureDialog.value = true;
}

async function submitRequestClosure() {
  if (!requestClosureNotes.value.trim()) {
    requestClosureError.value = "Resolution details are required";
    return;
  }

  try {
    requestClosureLoading.value = true;

    // Only call request_closure — it handles save_resolution_with_history internally.
    // The backend dedup logic prevents duplicates if called again with same content.
    const response = await call("pw_helpdesk.customizations.ticket_closure_workflow.request_closure", {
      ticket_id: props.ticketId,
      resolution_notes: requestClosureNotes.value,
    });

    toast.success(response?.message || "Closure request submitted successfully");
    ticket.reload();
    showRequestClosureDialog.value = false;
  } catch (err) {
    requestClosureError.value = err.message || "Failed to submit closure request";
  } finally {
    requestClosureLoading.value = false;
  }
}

onMounted(() => {
  socket.on("helpdesk:ticket-update", (ticketID) => {
    if (ticketID === Number(props.ticketId)) {
      ticket.reload();
    }
  });
});

// Debug button visibility
watch(
  () => ticket.data,
  (val) => {
    if (val) {
      console.log('=== TICKET AGENT DEBUG ===');
      console.log('userId (from store):', userId.value);
      console.log('sessionUser (from cookie):', sessionUser.value);
      console.log('currentUserId (computed):', currentUserId.value);
      console.log('Ticket raised_by:', val.raised_by);
      console.log('Ticket custom_raise_for_employee:', val.custom_raise_for_employee);
      console.log('Ticket status:', val.status);
      console.log('isRaiser:', isRaiser.value);
      console.log('isAdmin (from store):', isAdmin.value);
      console.log('isAgent (from store):', isAgent.value);
      console.log('isAssignedAgent:', isAssignedAgent());
      console.log('Assignees:', val.assignees);
      console.log('canCloseTicket:', canCloseTicket.value);
      console.log('canRequestClosure:', canRequestClosure.value);
      console.log('=========================');
    }
  },
  { deep: true, immediate: true }
);

onUnmounted(() => {
  document.title = "Helpdesk";
  socket.off("helpdesk:ticket-update");
});
</script>

<style>
.breadcrumbs button {
  background-color: inherit !important;
  &:hover,
  &:focus {
    background-color: inherit !important;
  }
}
</style>
