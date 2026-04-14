import { computed, ref } from "vue";
import { defineStore } from "pinia";

export const useTicketStatusStore = defineStore("ticketStatus", () => {
  const options = ref(["Open", "Replied", "Resolved", "Closed", "Reopened", "Not Assigned", "Archived", "Requested Closure"]);
  const dropdown = computed(() =>
    options.value.map((o) => ({
      label: o,
      value: o,
    }))
  );

  const colorMap = {
    Open: "red",
    Replied: "blue",
    "Awaiting Response": "indigo",
    Resolved: "green",
    Closed: "gray",
    Reopened: "orange",
    "Not Assigned": "yellow",
    Archived: "zinc",
    "Requested Closure": "purple",
  };

  const textColorMap = {
    Open: "!text-red-600",
    Replied: "!text-blue-600",
    "Awaiting Response": "!text-indigo-600",
    Resolved: "!text-green-600",
    Closed: "!text-gray-700",
    Reopened: "!text-orange-600",
    "Not Assigned": "!text-yellow-600",
    Archived: "!text-zinc-600",
    "Requested Closure": "!text-purple-600",
  };

  const stateActive = ["Open", "Replied", "Reopened", "Awaiting Response"];
  const stateInactive = ["Resolved", "Closed", "Archived", "Requested Closure"];

  return {
    colorMap,
    dropdown,
    options,
    stateActive,
    stateInactive,
    textColorMap,
  };
});
