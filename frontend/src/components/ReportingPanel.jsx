import { useEffect, useState } from "react";
import { Activity, ArrowDownLeft, ArrowUpRight, BarChart3, CheckCheck, RefreshCw } from "lucide-react";

const dateText = (value) => value ? new Date(value).toLocaleString("en-MY", { timeZone: "Asia/Kuala_Lumpur", dateStyle: "medium", timeStyle: "short" }) : "—";
function EventChart({ series, title, caption }) {
  const width = 720, height = 260, left = 42, bottom = 32, top = 18;
  const max = Math.max(1, ...series.flatMap((point) => [point.opened, point.closed]));
  const ceiling = Math.max(4, Math.ceil(max / 4) * 4), plotHeight = height - top - bottom;
  const slot = (width - left - 12) / Math.max(1, series.length), bar = Math.min(20, slot * .28);
  return <section className="panel report-chart"><div className="report-panel-head"><div><h2><BarChart3 size={18}/> {title}</h2><p className="muted">{caption}</p></div><div className="report-legend"><span><i className="opened"/>Opened</span><span><i className="closed"/>Closed</span></div></div>
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${title}: opened and closed ticket events`}>
      <title>{title}</title>
      {[0, 1, 2, 3, 4].map((i) => { const y = top + plotHeight - plotHeight * i / 4; return <g key={i}><line x1={left} x2={width - 10} y1={y} y2={y} className="report-grid"/><text x={left - 8} y={y + 4} textAnchor="end" className="report-axis">{ceiling * i / 4}</text></g>; })}
      {series.map((point, i) => { const x = left + slot * (i + .5); return <g key={point.key} tabIndex={0} aria-label={`${point.key}: ${point.opened} opened, ${point.closed} closed`}><title>{point.key}: {point.opened} opened · {point.closed} closed</title>
        <rect x={x - bar - 2} y={top + plotHeight - point.opened / ceiling * plotHeight} width={bar} height={point.opened / ceiling * plotHeight} rx={3} className="report-bar-open"/>
        <rect x={x + 2} y={top + plotHeight - point.closed / ceiling * plotHeight} width={bar} height={point.closed / ceiling * plotHeight} rx={3} className="report-bar-closed"/>
        {(series.length <= 12 || i % 5 === 0 || i === series.length - 1) && <text x={x} y={height - 10} textAnchor="middle" className="report-axis">{point.label}</text>}
      </g>; })}
    </svg>
    {!series.some((point) => point.opened || point.closed) && <p className="report-zero muted">No ticket events in this period.</p>}
    <details className="report-data-table"><summary>View exact daily / monthly counts</summary><div className="staff-table-scroll"><table><thead><tr><th>Period</th><th>Opened</th><th>Closed</th></tr></thead><tbody>{series.map((point) => <tr key={point.key}><td>{point.key}</td><td>{point.opened}</td><td>{point.closed}</td></tr>)}</tbody></table></div></details>
  </section>;
}
export default function ReportingPanel({ api }) {
  const [data, setData] = useState(null), [error, setError] = useState(""), [period, setPeriod] = useState("year"), [busy, setBusy] = useState(false), [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    const load = () => { setBusy(true); api.get("/api/reports/public", { timeout: 15000 }).then(({ data }) => { if (active) { setData(data); setError(""); } }).catch(() => { if (active) setError("Unable to load the shared report. Please retry."); }).finally(() => { if (active) setBusy(false); }); };
    load(); const timer = setInterval(load, 60000); return () => { active = false; clearInterval(timer); };
  }, [api, refresh]);
  return <div className="reporting-page page-enter">
    <div className="report-intro"><div><span className="operator-kicker"><Activity size={15}/> SHARED OPERATIONS REPORT</span><h2>Ticket activity at a glance</h2><p className="muted">Public reporting across every region and site. Dates use Malaysia time.</p></div><button className="secondary" disabled={busy} onClick={() => setRefresh((n) => n + 1)}><RefreshCw size={16} className={busy ? "spin" : ""}/> Refresh</button></div>
    {error && <p className="error" role="alert">{error}</p>}
    {!data ? <p className="panel muted" role="status">{error ? "Report unavailable." : "Loading ticket activity…"}</p> : <>
      <div className="report-summary"><article className="panel"><ArrowUpRight/><span>Opened in {data.year}</span><strong>{data.totals.opened.toLocaleString()}</strong></article><article className="panel"><ArrowDownLeft/><span>Closed in {data.year}</span><strong>{data.totals.closed.toLocaleString()}</strong></article><article className="panel"><CheckCheck/><span>Latest update</span><b>{dateText(data.generatedAt)}</b><small>Refreshes every minute</small></article></div>
      <div className="report-period" aria-label="Report period"><button className={period === "year" ? "primary" : "secondary"} aria-pressed={period === "year"} onClick={() => setPeriod("year")}>This year</button><button className={period === "month" ? "primary" : "secondary"} aria-pressed={period === "month"} onClick={() => setPeriod("month")}>This month</button></div>
      <EventChart series={period === "year" ? data.yearly : data.monthly} title={period === "year" ? `${data.year} · monthly activity` : `${data.month} · daily activity`} caption="Opened counts creation events; closed counts formal closure events."/>
      <div className="report-bottom"><EventChart series={data.weekly} title="Last 7 days" caption="Daily ticket openings and closures, including today."/>
        <section className="panel report-latest"><h2>Latest tickets</h2><p className="muted">Recent activity and resolution outcomes</p><div>{data.latest.map((ticket, i) => <article key={`${ticket.openedAt}-${i}`}><div><b>{ticket.category} · {ticket.site}</b><span className={`ticket-status ${ticket.status.toLowerCase()}`}>{ticket.status.replaceAll("_", " ")}</span></div><small>{ticket.region === "EC" ? "East Coast" : ticket.region} · Opened {dateText(ticket.openedAt)}</small><p>{ticket.closedAt ? `Closed ${dateText(ticket.closedAt)}.` : ticket.resolvedAt ? `Resolved ${dateText(ticket.resolvedAt)}; awaiting formal closure.` : ticket.status === "WAITING" ? "Waiting for the next action." : "Resolution in progress."}{ticket.resolutionHours !== null ? ` Resolved in ${ticket.resolutionHours} hours.` : ""}</p></article>)}</div>{!data.latest.length && <p className="muted">No tickets yet.</p>}</section>
      </div><p className="report-footnote muted">This shared report contains counts and outcome timelines. Internal notes and personal account details remain in the signed-in workspace. Reopened tickets no longer count as closed because the current ticket model clears closure timestamps.</p>
    </>}
  </div>;
}
