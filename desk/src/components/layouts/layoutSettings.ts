import { createResource } from "frappe-ui";
import { ref } from "vue";
import LucideBookOpen from "~icons/lucide/book-open";
import LucideUsers from "~icons/lucide/users";
import LucideTicket from "~icons/lucide/ticket";
import LucideLayoutDashboard from "~icons/lucide/layout-dashboard";
import LucideFileBarChart from "~icons/lucide/file-bar-chart";
import { OrganizationsIcon } from "../icons";
import PhoneIcon from "../icons/PhoneIcon.vue";
import LucideHome from "~icons/lucide/home";
import { __ } from "@/translation";

/**
 * Shared rather than local to Sidebar.vue: the command palette opens it too, and
 * the palette is the discovery surface for the shortcut system.
 */
export const showShortcutsModal = ref(false);

/**
 * Reports this user may open. Shared by the sidebar, the command palette and
 * the Reports page so the list is fetched once rather than per surface.
 *
 * Not `auto`: this module is imported before login and by the customer
 * portal, and an automatic fetch would run as Guest and cache the 403.
 * AppSidebar triggers it once it knows the user is an agent.
 */
export const permittedReports = createResource({
  url: "helpdesk.api.report.get_permitted_reports",
  cache: "permittedReports",
});

export const agentPortalSidebarOptions = [
  {
    label: __("Home"),
    icon: LucideHome,
    to: "Home",
  },
  {
    label: __("Dashboard"),
    icon: LucideLayoutDashboard,
    to: "Dashboard"
  },
  {
    label: __("Tickets"),
    icon: LucideTicket,
    to: "TicketsAgent",
  },
  {
    label: __("Knowledge Base"),
    icon: LucideBookOpen,
    to: "AgentKnowledgeBase",
  },
  {
    label: __("Customers"),
    icon: OrganizationsIcon,
    to: "CustomerList",
  },
  {
    label: __("Contacts"),
    icon: LucideUsers,
    to: "ContactList",
  },
  {
    label: __("Call Logs"),
    icon: PhoneIcon,
    to: "CallLogs",
  },
  {
    label: __("Reports"),
    icon: LucideFileBarChart,
    to: "Reports",
  },
];

export const customerPortalSidebarOptions = [
  {
    label: __("Tickets"),
    icon: LucideTicket,
    to: "TicketsCustomer",
  },
  {
    label: __("Knowledge Base"),
    icon: LucideBookOpen,
    to: "CustomerKnowledgeBase",
  },
];
