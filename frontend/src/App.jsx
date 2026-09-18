import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import {
  Activity,
  ArrowUpRight,
  BellRing,
  Building2,
  CalendarDays,
  CheckCheck,
  ChevronRight,
  CircleCheck,
  Clock3,
  Fan,
  Flame,
  Gauge,
  LayoutDashboard,
  ListFilter,
  LogOut,
  MapPin,
  Plus,
  Search,
  ShieldCheck,
  Ticket,
  Video,
  X,
  RefreshCw,
  Layers3,
} from "lucide-react";
import "./App.css";

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || "" });
const categories = [
  "HVAC",
  "CCTV",
  "Fire Alarm",
  "BAS",
  "Gas System",
  "Elevator",
];
const icons = [Fan, Video, BellRing, Gauge, Flame, Layers3];
const priorities = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
const statuses = [
  "NEW",
  "ACKNOWLEDGED",
  "IN_PROGRESS",
  "WAITING",
  "RESOLVED",
  "CLOSED",
];
const metrics = [
  ["total", "Total Tickets", Ticket, "blue"],
  ["unresolved", "Total Unresolved Tickets", Clock3, "amber"],
  ["resolved", "Total Resolved Tickets", CircleCheck, "lavender"],
  ["missed", "Total Missed SLA", BellRing, "rose"],
  ["within", "Total Within SLA", ShieldCheck, "violet"],
];
const label = (value) => value.replaceAll("_", " ").toLowerCase();
const dateText = (value) =>
  new Date(value).toLocaleString("en-MY", {
    timeZone: "Asia/Kuala_Lumpur",
    dateStyle: "medium",
    timeStyle: "short",
  });
const dateKey = (d) => d.toISOString().slice(0, 10);
function rangeFor(preset) {
  const now = new Date(Date.now() + 8 * 3600000),
    y = now.getUTCFullYear(),
    m = now.getUTCMonth();
  if (preset === "all") return { from: "", to: "" };
  if (preset === "last")
    return {
      from: dateKey(new Date(Date.UTC(y, m - 1, 1))),
      to: dateKey(new Date(Date.UTC(y, m, 0))),
    };
  return {
    from: dateKey(new Date(Date.UTC(y, preset === "year" ? 0 : m, 1))),
    to: dateKey(now),
  };
}
const initialFilters = () => ({
  preset: "month",
  ...rangeFor("month"),
  zone: "",
  branchId: "",
});
function storedSession() {
  try {
    const s = JSON.parse(localStorage.getItem("ticketSession"));
    return s?.token && s?.user ? s : null;
  } catch {
    return null;
  }
}
function Brand() {
  return (
    <div className="brand">
      <div className="brand-icon">
        <Activity size={24} />
      </div>
      <div>
        engine<span>desk</span>
        <small>ENGINEERING OPERATIONS</small>
      </div>
    </div>
  );
}
export default function App() {
  const [session, setSession] = useState(storedSession);
  const [page, setPage] = useState(location.hash.slice(1) || "overview");
  const [filters, setFilters] = useState(initialFilters);
  const [metric, setMetric] = useState("total"),
    [category, setCategory] = useState("");
  const [data, setData] = useState(null),
    [metadata, setMetadata] = useState(null),
    [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const requestId = useRef(0);
  const headers = { Authorization: `Bearer ${session?.token}` };
  const logout = useCallback(() => {
    requestId.current++;
    localStorage.removeItem("ticketSession");
    setSession(null);
    setData(null);
    setMetadata(null);
    setSelected(null);
    setFilters(initialFilters());
    setMetric("total");
    setCategory("");
    setNotice("");
    window.location.assign("#overview");
  }, []);
  const navigate = (p) => {
    window.location.assign(`#${p}`);
    setPage(p);
    setNotice("");
  };
  useEffect(() => {
    const change = () => setPage(location.hash.slice(1) || "overview");
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  const load = useCallback(async () => {
    if (!session) return;
    const id = ++requestId.current;
    setLoading(true);
    setError("");
    setData(null);
    try {
      const params = {
        from: filters.from || undefined,
        to: filters.to || undefined,
        zone: filters.zone || undefined,
        branchId: filters.branchId || undefined,
        metric: page === "overview" ? "total" : metric,
      };
      const config = {
        headers: { Authorization: `Bearer ${session.token}` },
        params,
      };
      const [tickets, summary, meta] = await Promise.all([
        api.get("/api/tickets", config),
        api.get("/api/tickets/dashboard", config),
        api.get("/api/tickets/metadata", config),
      ]);
      if (id === requestId.current) {
        setData({ tickets: tickets.data, summary: summary.data });
        setMetadata(meta.data);
      }
    } catch (e) {
      if (id === requestId.current) {
        if (e.response?.status === 401) logout();
        else
          setError(
            e.response?.data?.message ||
              "Unable to load operations. Please retry.",
          );
      }
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [session, filters, metric, page, logout]);
  useEffect(() => {
    // Synchronise server data with the selected reporting scope.
    // eslint-disable-next-line react/set-state-in-effect
    load();
  }, [load]);
  useEffect(() => {
    if (!session) return;
    const timer = setInterval(load, 60000);
    return () => clearInterval(timer);
  }, [load, session]);
  if (!session)
    return (
      <Login
        onLogin={(s) => {
          localStorage.setItem("ticketSession", JSON.stringify(s));
          setSession(s);
        }}
      />
    );
  const hq = session.user.role === "HQ_ADMIN",
    manager = session.user.role !== "STAFF";
  const drill = (key) => {
    setMetric(key);
    setCategory("");
    navigate("services");
  };
  const title =
    {
      overview: "Operations overview",
      services: "Explore service systems",
      tickets: "Ticket register",
      new: "Raise a service ticket",
    }[page] || "Operations overview";
  return (
    <div className="shell">
      <aside className="sidebar">
        <Brand />
        <div className="workspace-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {[
            ["overview", LayoutDashboard, "Overview"],
            ["services", Layers3, "Service systems"],
            ["tickets", Ticket, "Ticket register"],
            ["new", Plus, "Raise a ticket"],
          ].map(([key, Icon, name]) => (
            <button
              key={key}
              className={page === key ? "nav-active" : ""}
              aria-current={page === key ? "page" : undefined}
              onClick={() => {
                setCategory("");
                setMetric("total");
                navigate(key);
              }}
            >
              <Icon size={18} />
              {name}
              {page === key && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <ShieldCheck size={23} />
          <b>{hq ? "HQ command centre" : "Branch workspace"}</b>
          <p>
            {hq
              ? "A connected view of every branch. Every system. Every service."
              : "One shared view for your branch’s service requests."}
          </p>
          <span>
            <i /> Role-based access
          </span>
        </div>
        <div className="profile">
          <div className="avatar">
            {session.user.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <b>{session.user.name}</b>
            <small>{hq ? "HQ administrator" : label(session.user.role)}</small>
          </div>
          <button aria-label="Sign out" onClick={logout}>
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      <main className="main">
        <div className="topbar">
          <span>
            <span className="muted">Workspace</span>
            <ChevronRight size={13} />
            {hq
              ? "National operations"
              : session.user.branch?.name || "Branch operations"}
          </span>
          <span className="secure">
            <ShieldCheck size={14} /> Secure workspace{" "}
            <span className="top-avatar">{hq ? "HQ" : "BR"}</span>
          </span>
        </div>
        <div className="content">
          <header className="page-heading">
            <div>
              <p className="eyebrow">
                <span /> ENGINEERING SERVICE INTELLIGENCE
              </p>
              <h1>
                {title}
                <span>.</span>
              </h1>
              <p className="subtitle">
                {page === "overview"
                  ? "Every system connected. Every service accounted for."
                  : page === "new"
                    ? "Tell us what needs attention. We’ll keep the resolution on track."
                    : "From the big picture to the details that matter."}
              </p>
            </div>
            {page !== "new" && (
              <button className="primary" onClick={() => navigate("new")}>
                <Plus size={17} /> New ticket
              </button>
            )}
          </header>
          {notice && (
            <div className="notice" role="status">
              <CheckCheck size={17} />
              {notice}
              <button
                aria-label="Dismiss notification"
                onClick={() => setNotice("")}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {error && (
            <div className="error" role="alert">
              {error}
              <button onClick={load}>
                Retry <RefreshCw size={14} />
              </button>
            </div>
          )}
          {page !== "new" && (
            <div className="filterbar">
              <div className="filter-title">
                <CalendarDays size={17} />
                <span>Reporting period</span>
              </div>
              <select
                aria-label="Reporting period"
                value={filters.preset}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    preset: e.target.value,
                    ...(e.target.value === "custom"
                      ? {}
                      : rangeFor(e.target.value)),
                  })
                }
              >
                <option value="month">This month</option>
                <option value="last">Last month</option>
                <option value="year">This year</option>
                <option value="all">All time</option>
                <option value="custom">Custom range</option>
              </select>
              {filters.preset === "custom" && (
                <div className="date-range">
                  <input
                    aria-label="Start date"
                    type="date"
                    value={filters.from}
                    max={filters.to || undefined}
                    onChange={(e) =>
                      setFilters({ ...filters, from: e.target.value })
                    }
                  />
                  <span>to</span>
                  <input
                    aria-label="End date"
                    type="date"
                    value={filters.to}
                    min={filters.from || undefined}
                    onChange={(e) =>
                      setFilters({ ...filters, to: e.target.value })
                    }
                  />
                </div>
              )}
              <span className="timezone">Malaysia time · UTC+8</span>
              <button
                className="icon-button"
                aria-label="Refresh dashboard"
                onClick={load}
              >
                <RefreshCw size={16} className={loading ? "spin" : ""} />
              </button>
            </div>
          )}
          {page === "new" ? (
            <TicketForm
              metadata={metadata}
              user={session.user}
              headers={headers}
              done={(m) => {
                setFilters(initialFilters());
                setMetric("total");
                setCategory("");
                navigate("tickets");
                setNotice(m);
                load();
              }}
              cancel={() => navigate("overview")}
            />
          ) : (
            <div className="dashboard-layout">
              <div className="dashboard-main">
                {loading && !data ? (
                  <div className="loading panel" role="status">
                    <Activity className="spin" /> Synchronising your workspace…
                  </div>
                ) : (
                  data && (
                    <div key={page} className="page-enter">
                      {page === "overview" ||
                      !["services", "tickets"].includes(page) ? (
                        <>
                          <Trend summary={data.summary} />
                          <div className="metric-cards">
                            {metrics.map(([key, name, Icon, tone]) => (
                              <button
                                className={`metric-card ${tone}`}
                                key={key}
                                onClick={() => drill(key)}
                              >
                                <div>
                                  <span className="metric-icon">
                                    <Icon size={18} />
                                  </span>
                                  <ArrowUpRight size={15} />
                                </div>
                                <strong>
                                  {data.summary[key].toLocaleString()}
                                </strong>
                                <span>{name}</span>
                                <small>
                                  Explore service systems{" "}
                                  <ChevronRight size={12} />
                                </small>
                              </button>
                            ))}
                          </div>
                          <div className="section-heading">
                            <div>
                              <p className="eyebrow">YOUR SERVICE ECOSYSTEM</p>
                              <h2>Six systems. One workspace.</h2>
                            </div>
                            <button
                              className="text-button"
                              onClick={() => drill("total")}
                            >
                              Explore all <ArrowUpRight size={15} />
                            </button>
                          </div>
                          <CategoryGrid
                            summary={data.summary}
                            onSelect={(name) => {
                              setMetric("total");
                              setCategory(name);
                              navigate("tickets");
                            }}
                          />
                          <div className="section-heading">
                            <h2>Latest service requests</h2>
                            <button
                              className="text-button"
                              onClick={() => {
                                setMetric("total");
                                setCategory("");
                                navigate("tickets");
                              }}
                            >
                              View register <ArrowUpRight size={15} />
                            </button>
                          </div>
                          <TicketList
                            tickets={data.tickets.slice(0, 5)}
                            open={setSelected}
                            compact
                          />
                        </>
                      ) : page === "services" ? (
                        <>
                          <div className="breadcrumb">
                            <button onClick={() => navigate("overview")}>
                              Overview
                            </button>
                            <ChevronRight size={14} />
                            {metrics.find((m) => m[0] === metric)?.[1]}
                          </div>
                          <div className="panel drill-heading">
                            <div className="metric-icon lavender">
                              <Layers3 size={24} />
                            </div>
                            <div>
                              <h2>
                                {metrics.find((m) => m[0] === metric)?.[1]}
                              </h2>
                              <p className="muted">
                                Choose a service system to view its tickets in
                                this reporting scope.
                              </p>
                            </div>
                            <strong>{data.summary[metric]}</strong>
                          </div>
                          <CategoryGrid
                            summary={data.summary}
                            onSelect={(name) => {
                              setCategory(name);
                              navigate("tickets");
                            }}
                          />
                          {data.tickets.some(
                            (t) => !categories.includes(t.category),
                          ) && (
                            <div className="notice">
                              Some historical tickets use retired categories.
                              <button
                                onClick={() => {
                                  setCategory("");
                                  navigate("tickets");
                                }}
                              >
                                View all tickets
                              </button>
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          <div className="breadcrumb">
                            <button onClick={() => navigate("overview")}>
                              Overview
                            </button>
                            <ChevronRight size={14} />
                            <button onClick={() => navigate("services")}>
                              {metrics.find((m) => m[0] === metric)?.[1]}
                            </button>
                            {category && (
                              <>
                                <ChevronRight size={14} />
                                {category}
                              </>
                            )}
                          </div>
                          <div className="category-tabs">
                            <button
                              className={!category ? "active" : ""}
                              onClick={() => setCategory("")}
                            >
                              All systems
                            </button>
                            {categories.map((c) => (
                              <button
                                key={c}
                                className={category === c ? "active" : ""}
                                onClick={() => setCategory(c)}
                              >
                                {c}
                              </button>
                            ))}
                          </div>
                          <TicketList
                            tickets={data.tickets.filter(
                              (t) => !category || t.category === category,
                            )}
                            open={setSelected}
                          />
                        </>
                      )}
                    </div>
                  )
                )}
              </div>
              <ScopePanel
                metadata={metadata}
                filters={filters}
                setFilters={setFilters}
                summary={data?.summary}
                hq={hq}
              />
            </div>
          )}
          <footer>
            <span>
              <Activity size={13} /> ENGINE DESK{" "}
              <span className="muted">/ Built for operational clarity</span>
            </span>
            <span>
              {data
                ? `Updated ${new Date(data.summary.generatedAt).toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" })}`
                : "Engineering service management"}
            </span>
          </footer>
        </div>
      </main>
      {selected && (
        <TicketModal
          ticket={selected}
          manager={manager}
          headers={headers}
          close={() => setSelected(null)}
          changed={load}
        />
      )}
    </div>
  );
}
function Login({ onLogin }) {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      onLogin((await api.post("/api/auth/login", { email, password })).data);
    } catch (e) {
      setError(
        e.response?.data?.message || "Unable to sign in. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="login">
      <div className="login-story">
        <Brand />
        <div>
          <p className="eyebrow">CONNECTED ENGINEERING OPERATIONS</p>
          <h1>
            Keep every
            <br />
            system moving<span>.</span>
          </h1>
          <p>
            One workspace for service teams.
            <br />
            Complete clarity from branch to headquarters.
          </p>
          <div className="login-orbit">
            <Activity size={70} />
            {icons.map((Icon, i) => (
              <span key={i} style={{ "--i": i }}>
                <Icon size={22} />
              </span>
            ))}
          </div>
        </div>
        <small>ENGINE DESK / SERVICE INTELLIGENCE</small>
      </div>
      <div className="login-form">
        <form onSubmit={submit}>
          <span className="login-badge">
            <ShieldCheck size={16} /> SECURE WORKSPACE
          </span>
          <h2>Welcome back.</h2>
          <p className="muted">Sign in to your operations workspace.</p>
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          <label>
            Email address
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
            />
          </label>
          <button className="primary" disabled={busy}>
            {busy ? "Signing in…" : "Enter workspace"}
            <ArrowUpRight size={18} />
          </button>
          <p className="login-help">
            Your role connects you to the right branches and services. Contact
            your administrator for access.
          </p>
        </form>
      </div>
    </div>
  );
}
function Trend({ summary }) {
  const [hover, setHover] = useState(null);
  const rows = summary.trend;
  const max = Math.max(
    3,
    Math.ceil(
      Math.max(0, ...rows.map((r) => Math.max(r.resolved, r.unresolved))) / 3,
    ) * 3,
  );
  const x = (i) => 48 + (i * 650) / Math.max(rows.length - 1, 1),
    y = (n) => 185 - (n / max) * 145;
  const path = (key) =>
    rows.map((r, i) => `${i ? "L" : "M"} ${x(i)} ${y(r[key])}`).join(" ");
  const rate = summary.total
    ? Math.round((summary.resolved / summary.total) * 100)
    : 0;
  return (
    <section className="panel trend">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">THE BIG PICTURE</p>
          <h2>Service performance</h2>
        </div>
        <span className="live-chip">
          <i /> LIVE DATA
        </span>
      </div>
      <div className="chart-intro">
        <div>
          <strong>{summary.total.toLocaleString()}</strong>
          <span>tickets in selected period</span>
        </div>
        <div className="chart-legend">
          <span>
            <i className="lavender-bg" />
            Resolved
          </span>
          <span>
            <i className="blue-bg" />
            Unresolved
          </span>
        </div>
      </div>
      <div className="chart">
        <svg
          viewBox="0 0 740 224"
          role="img"
          aria-label={`Current outcome by ticket creation date: ${summary.resolved} resolved, ${summary.unresolved} unresolved`}
        >
          <defs>
            <linearGradient id="fillLavender" x1="0" y1="0" x2="0" y2="1">
              <stop stopColor="#9a7bce" stopOpacity=".22" />
              <stop offset="1" stopColor="#9a7bce" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="fillBlue" x1="0" y1="0" x2="0" y2="1">
              <stop stopColor="#85a9e1" stopOpacity=".13" />
              <stop offset="1" stopColor="#85a9e1" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 1, 2, 3].map((i) => (
            <g key={i}>
              <line
                x1="48"
                x2="710"
                y1={40 + (i * 145) / 3}
                y2={40 + (i * 145) / 3}
                stroke="#e5e0ef"
                strokeDasharray="4 5"
              />
              <text x="27" y={44 + (i * 145) / 3} textAnchor="end">
                {Math.ceil((max * (3 - i)) / 3)}
              </text>
            </g>
          ))}
          {rows.length > 0 &&
            ["unresolved", "resolved"].map((key) => (
              <g key={key}>
                <path
                  d={`${path(key)} L ${x(rows.length - 1)} 185 L 48 185 Z`}
                  fill={
                    key === "resolved" ? "url(#fillLavender)" : "url(#fillBlue)"
                  }
                />
                <path
                  d={path(key)}
                  fill="none"
                  stroke={key === "resolved" ? "#9a7bce" : "#85a9e1"}
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                />
                {rows.map((r, i) => (
                  <circle
                    key={r.date}
                    cx={x(i)}
                    cy={y(r[key])}
                    r={rows.length === 1 ? 5 : 3}
                    fill={key === "resolved" ? "#9a7bce" : "#85a9e1"}
                  />
                ))}
              </g>
            ))}
          {rows
            .filter(
              (_, i) =>
                i % Math.max(1, Math.ceil(rows.length / 6)) === 0 ||
                i === rows.length - 1,
            )
            .map((r) => (
              <text
                key={r.date}
                x={x(rows.indexOf(r))}
                y="213"
                textAnchor="middle"
              >
                {r.date.slice(5)}
              </text>
            ))}
          {rows.map((r, i) => (
            <rect
              key={r.date}
              x={x(i) - 10}
              y="20"
              width="20"
              height="170"
              fill="transparent"
              tabIndex="0"
              aria-label={`${r.date}: ${r.resolved} resolved, ${r.unresolved} unresolved`}
              onFocus={() => setHover(r)}
              onBlur={() => setHover(null)}
              onMouseEnter={() => setHover(r)}
              onMouseLeave={() => setHover(null)}
            />
          ))}
        </svg>
        {!rows.length && (
          <div className="chart-empty">
            No tickets in this period.
            <small>Try another date range or branch.</small>
          </div>
        )}
        {hover && (
          <div className="chart-tooltip">
            {hover.date} · {hover.resolved} resolved · {hover.unresolved}{" "}
            unresolved
          </div>
        )}
      </div>
      <div className="chart-bottom">
        <span>
          <span className="lavender">{rate}%</span> resolved in this selection
        </span>
        <span>Current status by creation date</span>
      </div>
    </section>
  );
}
function ScopePanel({ metadata, filters, setFilters, summary, hq }) {
  const branches = (metadata?.branches || []).filter(
    (b) => !filters.zone || b.zone === filters.zone,
  );
  const rate = summary?.total
    ? Math.round((summary.within / summary.total) * 100)
    : 0;
  return (
    <aside className="scope">
      <section className="panel">
        <div className="panel-heading">
          <h2>Operational scope</h2>
          <ListFilter size={17} />
        </div>
        <p className="muted">Focus your view.</p>
        <label className="scope-label">
          <MapPin size={14} /> ZONES
        </label>
        <div className="zone-list">
          {["", "West MY", "East MY"].map((z) => (
            <button
              key={z}
              className={filters.zone === z ? "active" : ""}
              onClick={() => setFilters({ ...filters, zone: z, branchId: "" })}
            >
              <span className="radio" />
              {z || "All zones"}
              {filters.zone === z && <CheckCheck size={15} />}
            </button>
          ))}
        </div>
        <div className="scope-divider" />
        <label className="scope-label">
          <Building2 size={14} /> BRANCHES / STATES
        </label>
        <div className="branch-list">
          <button
            className={!filters.branchId ? "active" : ""}
            onClick={() => setFilters({ ...filters, branchId: "" })}
          >
            {hq ? "All branches" : "My branch"}
            <span>{branches.length}</span>
          </button>
          {branches.map((b) => (
            <button
              key={b.id}
              className={filters.branchId === b.id ? "active" : ""}
              onClick={() => setFilters({ ...filters, branchId: b.id })}
            >
              <span>
                <b>{b.name}</b>
                <small>{b.zone}</small>
              </span>
              <ChevronRight size={14} />
            </button>
          ))}
        </div>
        <button
          className="reset-scope"
          onClick={() => setFilters({ ...filters, zone: "", branchId: "" })}
        >
          Reset scope
        </button>
      </section>
      <section className="panel sla-panel">
        <div className="panel-heading">
          <h2>SLA health</h2>
          <ShieldCheck size={18} />
        </div>
        <div className="sla-ring" style={{ "--progress": `${rate}%` }}>
          <div>
            <strong>{summary?.total ? `${rate}%` : "—"}</strong>
            <small>WITHIN SLA</small>
          </div>
        </div>
        <p>
          {summary?.total
            ? `${summary.within} of ${summary.total} tickets on time`
            : "No tickets in this scope"}
        </p>
        <div className="sla-key">
          <span>
            <i className="lavender-bg" /> Within SLA
          </span>
          <b>{summary?.within ?? "—"}</b>
        </div>
        <div className="sla-key">
          <span>
            <i className="rose-bg" /> Missed SLA
          </span>
          <b>{summary?.missed ?? "—"}</b>
        </div>
        <small className="sla-explainer">
          Resolution SLA. Open tickets are measured against now; completed
          tickets against their resolution time.
        </small>
      </section>
      <div className="scope-foot">
        <ShieldCheck size={15} />
        {hq
          ? "Visibility across all branches"
          : "Visibility limited to your branch"}
      </div>
    </aside>
  );
}
function CategoryGrid({ summary, onSelect }) {
  return (
    <div className="category-grid">
      {categories.map((name, i) => {
        const Icon = icons[i];
        return (
          <button
            className="category-card"
            key={name}
            onClick={() => onSelect(name)}
          >
            <span className={`system-icon system-${i}`}>
              <Icon size={22} />
            </span>
            <ArrowUpRight size={15} className="category-arrow" />
            <b>{name}</b>
            <span>
              {summary.categories.find((c) => c.name === name)?.count || 0}{" "}
              tickets
              <ChevronRight size={12} />
            </span>
          </button>
        );
      })}
    </div>
  );
}
function TicketList({ tickets, open, compact }) {
  const [search, setSearch] = useState(""),
    [status, setStatus] = useState(""),
    [priority, setPriority] = useState("");
  const shown = tickets.filter(
    (t) =>
      (!status || t.status === status) &&
      (!priority || t.priority === priority) &&
      `${t.reference} ${t.title} ${t.branch?.name}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <section className="panel ticket-panel">
      {!compact && (
        <div className="register-filters">
          <div className="search-input">
            <Search size={16} />
            <input
              aria-label="Search tickets"
              placeholder="Search reference, title, branch…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            aria-label="Status filter"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All statuses</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {label(s)}
              </option>
            ))}
          </select>
          <select
            aria-label="Priority filter"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          >
            <option value="">All priorities</option>
            {priorities.map((s) => (
              <option key={s} value={s}>
                {label(s)}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Service request</th>
              <th>Branch / system</th>
              <th>Status</th>
              <th>SLA</th>
              <th>
                <span className="sr-only">Open</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((t) => (
              <tr key={t.id}>
                <td>
                  <button className="ticket-link" onClick={() => open(t)}>
                    <span>
                      <i
                        className={`priority-dot ${t.priority.toLowerCase()}`}
                      />
                      {t.reference}
                      <span className="priority-text">{label(t.priority)}</span>
                    </span>
                    <b>{t.title}</b>
                  </button>
                </td>
                <td>
                  {t.branch?.name}
                  <small>{t.category}</small>
                </td>
                <td>
                  <span className={`badge ${t.status.toLowerCase()}`}>
                    {label(t.status)}
                  </span>
                </td>
                <td>
                  <span className={t.slaMissed ? "rose" : "lavender"}>
                    {t.slaMissed
                      ? "Missed SLA"
                      : ["RESOLVED", "CLOSED"].includes(t.status)
                        ? "Met SLA"
                        : "Within SLA"}
                  </span>
                </td>
                <td>
                  <button
                    className="icon-button"
                    onClick={() => open(t)}
                    aria-label={`Open ${t.reference}`}
                  >
                    <ArrowUpRight size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!shown.length && (
        <div className="empty">
          <Ticket size={30} />
          <h3>No tickets found</h3>
          <p>Try a different period, scope or filter.</p>
        </div>
      )}
      {!compact && (
        <div className="table-footer">
          {shown.length} service requests · Showing all matching tickets
        </div>
      )}
    </section>
  );
}
function TicketForm({ metadata, user, headers, done, cancel }) {
  const own = metadata?.branches.find((b) => b.id === user.branchId);
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "HVAC",
    priority: "MEDIUM",
    zone: null,
    branchId: user.branchId || "",
  });
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const effectiveZone = form.zone ?? own?.zone ?? "";
  const field = (key) => ({
    value: form[key],
    onChange: (e) => setForm({ ...form, [key]: e.target.value }),
  });
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post(
        "/api/tickets",
        { ...form, zone: effectiveZone },
        { headers },
      );
      done(
        `${data.reference} created for ${data.branch.name}. ${data.branchId !== user.branchId && user.role !== "HQ_ADMIN" ? "The destination branch and HQ can track it; it is outside your viewing scope." : "Your service team can now track this request."}`,
      );
    } catch (e) {
      setError(e.response?.data?.message || "Unable to submit. Please retry.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="form-layout page-enter">
      <form className="panel ticket-form" onSubmit={submit}>
        <div className="panel-heading">
          <div>
            <p className="eyebrow">NEW SERVICE REQUEST</p>
            <h2>Let’s get it resolved.</h2>
          </div>
          <Ticket size={26} />
        </div>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        <label>
          Ticket title
          <input
            required
            maxLength={180}
            placeholder="e.g. Air handling unit not cooling on Level 2"
            {...field("title")}
          />
        </label>
        <div className="two">
          <label>
            Service category
            <select aria-label="Service category" {...field("category")}>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            Priority
            <select aria-label="Priority" {...field("priority")}>
              {priorities.map((p) => (
                <option key={p} value={p}>
                  {label(p)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="two">
          <label>
            Zone
            <select
              required
              aria-label="Zone"
              value={effectiveZone}
              onChange={(e) =>
                setForm({ ...form, zone: e.target.value, branchId: "" })
              }
            >
              <option value="" disabled>
                Select zone
              </option>
              {["West MY", "East MY"].map((z) => (
                <option key={z}>{z}</option>
              ))}
            </select>
          </label>
          <label>
            Branch / state
            <select aria-label="Branch / state" required {...field("branchId")}>
              <option value="" disabled>
                Select branch
              </option>
              {metadata?.submissionBranches
                .filter((b) => b.zone === effectiveZone)
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
            </select>
          </label>
        </div>
        <label>
          Issue details
          <textarea
            required
            maxLength={10000}
            placeholder="Include the exact location, what happened, operational impact and any immediate action taken."
            {...field("description")}
          />
        </label>
        <div className="form-actions">
          <button type="button" className="secondary" onClick={cancel}>
            Cancel
          </button>
          <button className="primary" disabled={busy || !metadata}>
            {busy ? "Submitting…" : "Submit service ticket"}
            <ArrowUpRight size={17} />
          </button>
        </div>
      </form>
      <section className="panel form-guide">
        <span className="metric-icon lavender">
          <Clock3 size={23} />
        </span>
        <h2>A clear path to resolution.</h2>
        <p className="muted">
          Your priority sets the response and resolution targets from the moment
          you submit.
        </p>
        {[
          ["Critical", "1 hour", "4 hours"],
          ["High", "4 hours", "12 hours"],
          ["Medium", "8 hours", "24 hours"],
          ["Low", "24 hours", "72 hours"],
        ].map(([p, a, r]) => (
          <div key={p} className="sla-guide">
            <b>{p}</b>
            <span>
              Response <strong>{a}</strong>
            </span>
            <span>
              Resolution <strong>{r}</strong>
            </span>
          </div>
        ))}
        <p className="muted">
          <ShieldCheck size={14} /> Requests are visible to the assigned branch
          and HQ.
        </p>
      </section>
    </div>
  );
}
function TicketModal({ ticket, manager, headers, close, changed }) {
  const [current, setCurrent] = useState(ticket),
    [status, setStatus] = useState(ticket.status),
    [comment, setComment] = useState(""),
    [internal, setInternal] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const dialog = useRef(null);
  useEffect(() => {
    const el = dialog.current;
    el.showModal();
    return () => el.close();
  }, []);
  const save = async (type) => {
    setBusy(true);
    setError("");
    try {
      if (type === "status")
        setCurrent(
          (
            await api.patch(
              `/api/tickets/${current.id}`,
              { status },
              { headers },
            )
          ).data,
        );
      else {
        const { data } = await api.post(
          `/api/tickets/${current.id}/comments`,
          { message: comment, internal },
          { headers },
        );
        setCurrent((t) => ({ ...t, comments: [...t.comments, data] }));
        setComment("");
      }
      changed();
    } catch (e) {
      setError(e.response?.data?.message || "Unable to save changes");
    } finally {
      setBusy(false);
    }
  };
  return (
    <dialog
      ref={dialog}
      className="ticket-dialog"
      aria-labelledby="ticket-title"
      onCancel={close}
    >
      <button
        className="dialog-close icon-button"
        aria-label="Close ticket"
        onClick={close}
      >
        <X size={22} />
      </button>
      <p className="eyebrow">
        {current.reference} / {current.category}
      </p>
      <h2 id="ticket-title">{current.title}</h2>
      <div className="tags">
        <span className={`badge ${current.status.toLowerCase()}`}>
          {label(current.status)}
        </span>
        <span className={`priority-text ${current.priority.toLowerCase()}`}>
          {label(current.priority)} priority
        </span>
      </div>
      <p className="ticket-description">{current.description}</p>
      <div className="ticket-facts">
        <div>
          Branch<b>{current.branch?.name}</b>
        </div>
        <div>
          Raised by<b>{current.requester?.name}</b>
        </div>
        <div>
          Created<b>{dateText(current.createdAt)}</b>
        </div>
        <div>
          Resolution target<b>{dateText(current.resolutionDueAt)}</b>
        </div>
      </div>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {manager && (
        <form
          className="workflow-form"
          onSubmit={(e) => {
            e.preventDefault();
            save("status");
          }}
        >
          <label>
            Update workflow
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {label(s)}
                </option>
              ))}
            </select>
          </label>
          <button
            className="primary"
            disabled={busy || status === current.status}
          >
            Save status
          </button>
        </form>
      )}
      <h3>Activity & updates</h3>
      <div className="comments">
        {current.comments.length ? (
          current.comments.map((c) => (
            <article key={c.id}>
              <div>
                <b>{c.author?.name}</b>
                <small>
                  {dateText(c.createdAt)}
                  {c.internal && " · Internal note"}
                </small>
              </div>
              <p>{c.message}</p>
            </article>
          ))
        ) : (
          <p className="muted">No updates yet. Start the conversation.</p>
        )}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save("comment");
        }}
      >
        <label>
          Add an update
          <textarea
            required
            maxLength={5000}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Share progress or add context…"
          />
        </label>
        <div className="form-actions">
          {manager && (
            <label className="checkbox">
              <input
                type="checkbox"
                checked={internal}
                onChange={(e) => setInternal(e.target.checked)}
              />
              Internal note
            </label>
          )}
          <button className="primary" disabled={busy || !comment.trim()}>
            Post update <ArrowUpRight size={15} />
          </button>
        </div>
      </form>
    </dialog>
  );
}
