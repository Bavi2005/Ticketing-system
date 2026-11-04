export const roleName = (role) => ({
  OPERATOR: "Operator",
  HQ_ADMIN: "Administrator",
  BRANCH_MANAGER: "Site manager",
  STAFF: "Technician",
}[role] || role || "");
