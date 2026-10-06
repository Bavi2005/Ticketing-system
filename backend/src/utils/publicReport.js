const localDate = (value) => new Date(new Date(value).getTime() + 8 * 3600000).toISOString().slice(0, 10);
function publicReport(tickets, latest, now = new Date()) {
  const today = localDate(now), year = today.slice(0, 4), month = today.slice(0, 7);
  const localNow = new Date(`${today}T00:00:00Z`);
  const days = new Date(Date.UTC(Number(year), Number(month.slice(5)), 0)).getUTCDate();
  const yearly = Array.from({ length: 12 }, (_, i) => ({ key: `${year}-${String(i + 1).padStart(2, "0")}`, label: new Date(Date.UTC(Number(year), i, 1)).toLocaleString("en", { month: "short", timeZone: "UTC" }), opened: 0, closed: 0 }));
  const monthly = Array.from({ length: days }, (_, i) => ({ key: `${month}-${String(i + 1).padStart(2, "0")}`, label: String(i + 1), opened: 0, closed: 0 }));
  const weekly = Array.from({ length: 7 }, (_, i) => { const date = new Date(localNow.getTime() - (6 - i) * 86400000); return { key: date.toISOString().slice(0, 10), label: date.toLocaleDateString("en", { weekday: "short", timeZone: "UTC" }), opened: 0, closed: 0 }; });
  for (const ticket of tickets) {
    for (const [event, timestamp] of [["opened", ticket.createdAt], ["closed", ticket.status === "CLOSED" ? ticket.closedAt : null]]) {
      if (!timestamp) continue;
      const date = localDate(timestamp); if (date > today || new Date(timestamp) > now) continue;
      for (const series of [yearly, monthly, weekly]) {
        const bucket = series.find((item) => date.startsWith(item.key)); if (bucket) bucket[event]++;
      }
    }
  }
  return {
    generatedAt: now, year: Number(year), month, yearly, monthly, weekly,
    totals: { opened: yearly.reduce((n, b) => n + b.opened, 0), closed: yearly.reduce((n, b) => n + b.closed, 0) },
    // Whitelist only public operational facts; never expose identity or comment content.
    latest: latest.map((ticket) => ({ category: ticket.category, status: ticket.status, site: ticket.branch?.name || "Unassigned", region: ticket.branch?.zone || "", openedAt: ticket.createdAt, resolvedAt: ticket.resolvedAt, closedAt: ticket.closedAt,
      resolutionHours: ticket.resolvedAt ? Math.max(0, Math.round((new Date(ticket.resolvedAt) - new Date(ticket.createdAt)) / 360000) / 10) : null,
    })),
  };
}
module.exports = { publicReport, localDate };
