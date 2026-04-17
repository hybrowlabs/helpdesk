import { createResource } from "frappe-ui";
import { defineStore } from "pinia";
import { computed, watch } from "vue";
import { useAuthStore } from "./auth";

export interface EmployeeHoliday {
  date: string;
  holiday_name: string;
  type: string;
}

export const useEmployeeStore = defineStore("employee", () => {
  const auth = useAuthStore();

  // Step 2: fetch holidays — triggered inside employeeResource.onSuccess
  const holidaysResource = createResource({
    url: "cn_leave_shift_managment.cn_leave_shift_managment.overrides.employee.get_employee_holidays",
    auto: false,
  });

  // Step 1: fetch Employee record linked to the current logged-in user.
  // frappe-ui automatically unwraps the `message` key, so data = { name: "EMP-XXXX" }
  const employeeResource = createResource({
    url: "frappe.client.get_value",
    auto: false,
    onSuccess(data) {
      const empId = data?.name;
      if (empId) {
        holidaysResource.update({ params: { employee: empId } });
        holidaysResource.fetch();
      }
    },
  });

  // frappe-ui unwraps message → data is { name: "EMP-XXXX" }
  const employeeId = computed<string | null>(
    () => employeeResource.data?.name ?? null
  );

  const rawHolidays = computed<EmployeeHoliday[]>(
    () => (holidaysResource.data as EmployeeHoliday[]) ?? []
  );

  // Deduplicate by date + holiday_name
  const holidays = computed<EmployeeHoliday[]>(() => {
    const seen = new Set<string>();
    return rawHolidays.value.filter((h) => {
      const key = `${h.date}::${h.holiday_name}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  });

  const loading = computed(
    () => employeeResource.loading || holidaysResource.loading
  );

  /** Fetch the employee record — holidays are chained via onSuccess. */
  function init() {
    const userId = auth.userId || auth.username;
    if (!userId) return;

    employeeResource.update({
      params: {
        doctype: "Employee",
        filters: { user_id: userId },
        fieldname: "name",
      },
    });
    employeeResource.fetch();
  }

  /** Re-fetch holidays (re-runs init if employee ID not yet known). */
  function reloadHolidays() {
    if (!employeeId.value) {
      init();
      return;
    }
    holidaysResource.update({ params: { employee: employeeId.value } });
    holidaysResource.fetch();
  }

  // Kick off as soon as the logged-in user is known
  watch(
    () => auth.userId || auth.username,
    (uid) => {
      if (uid) init();
    },
    { immediate: true }
  );

  return {
    employeeId,
    holidays,
    loading,
    init,
    reloadHolidays,
    reload: reloadHolidays,
  };
});
