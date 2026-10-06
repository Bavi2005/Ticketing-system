import { useEffect, useState } from "react";
import { Activity, Bot, CalendarDays, CreditCard, Database, Mail, MessageCircle, PlugZap, ShieldCheck, UsersRound } from "lucide-react";

const integrations = [
  [MessageCircle, "WhatsApp", "Not configured"],
  [Mail, "Email", "Not configured"],
  [CalendarDays, "Calendar", "Not configured"],
  [Bot, "AI assistant", "Not configured"],
];

export default function OperatorControlCenter({ api, headers, summary, manage }) {
  const [accounts, setAccounts] = useState(null);
  const [accountError, setAccountError] = useState("");
  const [database, setDatabase] = useState("Checking");
  const authorization = headers.Authorization;
  useEffect(() => {
    let active = true;
    const refresh = () => {
      api.get("/api/staff", { headers: { Authorization: authorization } })
        .then(({ data }) => { if (active) { setAccounts(data); setAccountError(""); } })
        .catch(() => { if (active) { setAccounts(null); setAccountError("Workforce unavailable. Refresh to retry."); } });
      api.get("/ready", { timeout: 10000 })
        .then(({ data }) => { if (active) setDatabase(data.database === "connected" ? "Connected" : "Unavailable"); })
        .catch(() => { if (active) setDatabase("Unavailable"); });
    };
    refresh();
    const timer = setInterval(refresh, 60000);
    return () => { active = false; clearInterval(timer); };
  }, [api, authorization]);
  const count = (role) => accounts ? accounts.filter((item) => item.role === role).length : "—";
  const health = summary?.total ? Math.round((summary.within / summary.total) * 100) : null;
  return <section className="operator-command" aria-label="Operator control centre">
    <div className="operator-command-head">
      <div><span className="operator-kicker"><ShieldCheck size={15}/> SYSTEM CONTROL</span><h2>Operator command centre</h2><p>Oversight of HQ, people, ticket delivery, and platform services.</p></div>
      <button className="primary" onClick={manage}><UsersRound size={16}/> Manage access</button>
    </div>
    {accountError && <p className="error" role="alert">{accountError}</p>}
    <div className="operator-overview-grid">
      <article className="operator-stat primary-stat"><UsersRound/><span>Managed workforce</span><strong>{accounts?.length ?? "—"}</strong><small>{count("HQ_ADMIN")} HQ · {count("BRANCH_MANAGER")} managers · {count("STAFF")} staff</small></article>
      <article className="operator-stat"><Activity/><span>Ticket health · current scope</span><strong>{health === null ? "—" : `${health}%`}</strong><small>{summary?.total ? `${summary.unresolved} open · ${summary.missed} missed SLA` : "No tickets in this period and scope"}</small></article>
      <article className="operator-stat"><Database/><span>Database</span><strong>{database}</strong><small>PostgreSQL · checked every minute</small></article>
      <article className="operator-stat"><CreditCard/><span>Billing & payments</span><strong>Not linked</strong><small>Billing provider is not configured</small></article>
    </div>
    <div className="operator-detail-grid">
      <article className="panel"><div className="panel-heading"><div><span className="operator-kicker"><PlugZap size={14}/> CONNECTIVITY</span><h3>Integration status</h3></div><span className="muted">0 / 4 configured</span></div><div className="integration-list">{integrations.map(([Icon, name, detail]) => <div key={name}><span className="integration-icon"><Icon size={17}/></span><span><b>{name}</b><small>{detail}</small></span></div>)}</div></article>
      <article className="panel operator-platform"><span className="operator-kicker">PLATFORM OVERVIEW</span><h3>System & subscription</h3><dl>
        <div><dt>Database check</dt><dd>{database}</dd></div>
        <div><dt>Subscription / payment</dt><dd>Not linked</dd></div>
        <div><dt>Update management</dt><dd>GitHub / deployment provider</dd></div>
        <div><dt>Last ticket update</dt><dd>{summary?.generatedAt ? new Date(summary.generatedAt).toLocaleString("en-MY", { timeZone: "Asia/Kuala_Lumpur" }) : "Unavailable"}</dd></div>
      </dl><p className="muted">Use Reporting for scoped ticket reports and Access control for account administration.</p></article>
    </div>
  </section>;
}
