const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });
export const compareNames = (a, b) => collator.compare(a || "", b || "");

export const accountRegion = (account) =>
  account.allSites || ["HQ_ADMIN", "OPERATOR"].includes(account.role)
    ? "All regions"
    : account.branch?.zone || account.zone || [...(account.regionAccess || [])].sort(compareNames)[0] || "Unassigned";

export function groupByRegion(items, regionOf = (item) => item.zone) {
  const groups = new Map();
  for (const item of items) {
    const region = regionOf(item) || "Unassigned";
    if (!groups.has(region)) groups.set(region, []);
    groups.get(region).push(item);
  }
  const special = ["All regions", "Unassigned"];
  return [...groups].sort(([a], [b]) =>
    special.indexOf(a) - special.indexOf(b) || compareNames(a, b),
  );
}

export function groupAccountsByRegion(accounts) {
  return groupByRegion([...accounts].sort((a, b) => compareNames(a.name, b.name)), accountRegion);
}
