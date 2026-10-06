import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import {
  Activity,
  ArrowLeft,
  ArrowUpRight,
  BellRing,
  Building2,
  BarChart3,
  CheckCheck,
  ChevronRight,
  CircleCheck,
  Clock3,
  Fan,
  Flame,
  Gauge,
  LayoutDashboard,
  Layers3,
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
  Menu,
  PanelLeftClose,
  Settings,
  UserCircle,
} from "lucide-react";
import "./App.css";
import StaffSettings from "./components/StaffSettings";

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
const statuses = ["IN_PROGRESS", "WAITING", "RESOLVED", "CLOSED"];
const metrics = [
  ["total", "Total Tickets", Ticket, "blue"],
  ["unresolved", "Total Unresolved Tickets", Clock3, "amber"],
  ["resolved", "Total Resolved Tickets", CircleCheck, "lavender"],
  ["missed", "Total Missed SLA", BellRing, "rose"],
  ["within", "Total Within SLA", ShieldCheck, "violet"],
];
const label = (value) => value.replaceAll("_", " ").toLowerCase();
const initials = (name = "") =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "ED";
const dateText = (value) =>
  new Date(value).toLocaleString("en-MY", {
    timeZone: "Asia/Kuala_Lumpur",
    dateStyle: "medium",
    timeStyle: "short",
  });
const dateKey = (d) => d.toISOString().slice(0, 10);
function rangeFor(preset) {
  // Work with calendar dates in Malaysia (UTC+8), matching the API boundaries.
  const now = new Date(Date.now() + 8 * 3600000);
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const d = now.getUTCDate();
  const day = new Date(Date.UTC(y, m, d));
  if (preset === "all") return { from: "", to: "" };
  if (preset === "today") {
    const today = dateKey(day);
    return { from: today, to: today };
  }
  if (preset === "yesterday") {
    const yesterday = dateKey(new Date(day.getTime() - 86400000));
    return { from: yesterday, to: yesterday };
  }
  if (preset === "week") {
    const mondayOffset = (day.getUTCDay() + 6) % 7;
    const thisMonday = new Date(day.getTime() - mondayOffset * 86400000);
    const lastMonday = new Date(thisMonday.getTime() - 7 * 86400000);
    const lastSunday = new Date(thisMonday.getTime() - 86400000);
    return { from: dateKey(lastMonday), to: dateKey(lastSunday) };
  }
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
  preset: "today",
  ...rangeFor("today"),
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
  useEffect(() => {
    document.documentElement.dataset.theme = "light";
    try {
      localStorage.setItem("engineDeskTheme", "light");
    } catch {
      /* Light mode remains active without browser storage. */
    }
  }, []);
  const [session, setSession] = useState(storedSession);
  const [page, setPage] = useState(location.hash.slice(1) || "overview");
  const [filters, setFilters] = useState(initialFilters);
  const [metric, setMetric] = useState("total"),
    [category, setCategory] = useState(null);
  const [data, setData] = useState(null),
    [metadata, setMetadata] = useState(null),
    [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false),
    [profileOpen, setProfileOpen] = useState(false),
    [periodOpen, setPeriodOpen] = useState(false);
  const profileMenu = useRef(null);
  const periodMenu = useRef(null);
  const requestId = useRef(0);
  const loadedScope = useRef("");
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
    setCategory(null);
    setNotice("");
    window.location.assign("#overview");
  }, []);
  const navigate = (p) => {
    window.location.assign(`#${p}`);
    setPage(p);
    setNotice("");
    setPeriodOpen(false);
  };
  useEffect(() => {
    const change = () => setPage(location.hash.slice(1) || "overview");
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  useEffect(() => {
    const close = (event) => {
      if (profileMenu.current?.contains(event.target)) return;
      setProfileOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  useEffect(() => {
    const close = (event) => {
      if (!periodMenu.current?.contains(event.target)) setPeriodOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  const load = useCallback(async () => {
    if (!session) return;
    const id = ++requestId.current;
    setLoading(true);
    setError("");
    const scopeKey = JSON.stringify([
      session.token,
      filters,
      page === "overview" ? "total" : metric,
    ]);
    if (loadedScope.current !== scopeKey) setData(null);
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
        loadedScope.current = scopeKey;
        setData({ tickets: tickets.data, summary: summary.data });
        setSelected((previous) =>
          previous
            ? tickets.data.find((t) => t.id === previous.id) || previous
            : null,
        );
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
    const timer = setInterval(
      load,
      session.user.role === "STAFF" ? 15000 : 60000,
    );
    return () => clearInterval(timer);
  }, [load, session]);
  if (!session)
    return (
      <Login
        onLogin={(s) => {
          localStorage.setItem("ticketSession", JSON.stringify(s));
          setFilters(initialFilters());
          setSession(s);
        }}
      />
    );
  const hq = session.user.role === "HQ_ADMIN",
    manager = session.user.role !== "STAFF";
  const drill = (key) => {
    setMetric(key);
    setCategory(null);
    navigate("tickets");
  };
  const title =
    {
      overview: manager ? "Operations overview" : "My service desk",
      tickets: manager ? "Ticket register" : "My ticket",
      new: "Raise a service ticket",
      profile: "Profile details",
      reporting: "Reporting",
      users: "Settings · Users",
    }[page] || "Operations overview";
  return (
    <div className={`shell ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <aside className="sidebar">
        <div className="sidebar-head">
          <Brand />
          <button
            className="sidebar-toggle"
            aria-label={
              sidebarCollapsed ? "Open navigation" : "Close navigation"
            }
            aria-pressed={sidebarCollapsed}
            onClick={() => setSidebarCollapsed((value) => !value)}
          >
            {sidebarCollapsed ? (
              <Menu size={18} />
            ) : (
              <PanelLeftClose size={18} />
            )}
          </button>
        </div>
        <div className="workspace-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {[
            [
              "overview",
              LayoutDashboard,
              manager ? "Overview" : "My dashboard",
            ],
            ["tickets", Ticket, manager ? "Ticket register" : "My ticket"],
            ["new", Plus, "Raise a ticket"],
            ["reporting", BarChart3, "Reporting"],
            ["users", Settings, "Settings · Users"],
          ]
            .filter(([key]) => manager || !["reporting", "users"].includes(key))
            .map(([key, Icon, name]) => (
              <button
                key={key}
                className={page === key ? "nav-active" : ""}
                aria-current={page === key ? "page" : undefined}
                onClick={() => {
                  setCategory(null);
                  setMetric("total");
                  navigate(key);
                }}
                title={name}
              >
                <Icon size={18} />
                <span>{name}</span>
                {page === key && <span className="nav-dot" />}
              </button>
            ))}
        </nav>
        <div className="sidebar-profile profile-menu" ref={profileMenu}>
          <button
            className="profile-trigger"
            aria-label="Open profile menu"
            aria-expanded={profileOpen}
            onClick={() => setProfileOpen((value) => !value)}
          >
            <span className="top-avatar">{initials(session.user.name)}</span>
            <span>
              <b>{session.user.name}</b>
              <small>
                {hq
                  ? "HQ"
                  : session.user.role === "OPERATOR"
                    ? "Operator"
                    : manager
                      ? "Manager"
                      : "Staff"}
              </small>
            </span>
            <ChevronRight size={14} />
          </button>
          {profileOpen && (
            <div className="profile-dropdown" role="menu">
              <div className="profile-card">
                <div className="avatar">{initials(session.user.name)}</div>
                <div>
                  <b>{session.user.name}</b>
                  <small>
                    {hq
                      ? "HQ administrator"
                      : session.user.role === "OPERATOR"
                        ? "Operator"
                        : manager
                          ? `${session.user.zone || session.user.branch?.zone || "Zone"} manager`
                          : "Staff requester"}
                  </small>
                </div>
              </div>
              <button
                role="menuitem"
                onClick={() => {
                  navigate("profile");
                  setProfileOpen(false);
                }}
              >
                <UserCircle size={17} /> Profile details
              </button>
              <button role="menuitem" className="logout-menu" onClick={logout}>
                <LogOut size={17} /> Log out
              </button>
            </div>
          )}
        </div>
      </aside>
      <main className="main">
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
                  ? manager
                    ? "Every system connected. Every service accounted for."
                    : "Follow your active service requests and their latest updates."
                  : page === "new"
                    ? "Tell us what needs attention. We’ll keep the resolution on track."
                    : "From the big picture to the details that matter."}
              </p>
            </div>
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
          {!["new", "profile", "users"].includes(page) &&
            (manager || page !== "overview") && (
              <div className="period-toolbar">
                <div className="period-filter" ref={periodMenu}>
                  <button
                    className="period-filter-button"
                    aria-label="Filter reporting period"
                    aria-haspopup="true"
                    aria-expanded={periodOpen}
                    title="Reporting period"
                    onClick={() => setPeriodOpen((open) => !open)}
                  >
                    <ListFilter size={20} />
                  </button>
                  {periodOpen && (
                    <div className="period-menu">
                      <strong>Reporting period</strong>
                      {[
                        ["today", "Today"],
                        ["yesterday", "Yesterday"],
                        ["week", "Last week"],
                        ["month", "This month"],
                        ["last", "Last month"],
                        ["year", "This year"],
                        ["all", "All time"],
                        ["custom", "Custom range"],
                      ].map(([value, name]) => (
                        <button
                          key={value}
                          className={filters.preset === value ? "active" : ""}
                          onClick={() => {
                            setFilters({
                              ...filters,
                              preset: value,
                              ...(value === "custom" ? {} : rangeFor(value)),
                            });
                            if (value !== "custom") setPeriodOpen(false);
                          }}
                        >
                          {name}
                          {filters.preset === value && <CheckCheck size={15} />}
                        </button>
                      ))}
                      {filters.preset === "custom" && (
                        <div className="period-dates">
                          <label>
                            From
                            <input
                              aria-label="Start date"
                              type="date"
                              value={filters.from}
                              max={filters.to || undefined}
                              onChange={(e) =>
                                setFilters({ ...filters, from: e.target.value })
                              }
                            />
                          </label>
                          <label>
                            To
                            <input
                              aria-label="End date"
                              type="date"
                              value={filters.to}
                              min={filters.from || undefined}
                              onChange={(e) =>
                                setFilters({ ...filters, to: e.target.value })
                              }
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <button className="primary" onClick={() => navigate("new")}>
                  <Plus size={17} /> New ticket
                </button>
              </div>
            )}
          {page === "users" && manager ? (
            <StaffSettings
              api={api}
              headers={headers}
              user={session.user}
              metadata={metadata}
            />
          ) : page === "new" ? (
            <TicketForm
              metadata={metadata}
              user={session.user}
              headers={headers}
              done={(m) => {
                setFilters(initialFilters());
                setMetric("total");
                setCategory(null);
                navigate("tickets");
                setNotice(m);
                load();
              }}
              cancel={() => navigate("overview")}
            />
          ) : page === "profile" ? (
            <ProfileSettings
              session={session}
              headers={headers}
              back={() => navigate(manager ? "overview" : "tickets")}
              done={(nextSession) => {
                localStorage.setItem(
                  "ticketSession",
                  JSON.stringify(nextSession),
                );
                setSession(nextSession);
                setNotice("Profile details updated.");
              }}
            />
          ) : page === "reporting" && manager ? (
            <ReportingPanel />
          ) : (
            <div
              className={`dashboard-layout ${manager && page === "overview" ? "manager-overview-layout" : "full-dashboard-layout"}`}
            >
              {manager && page === "overview" && (
                <aside className="dashboard-scope-sidebar">
                  <ScopePanel
                    metadata={metadata}
                    filters={filters}
                    setFilters={setFilters}
                    hq={hq}
                  />
                </aside>
              )}
              <div className="dashboard-main">
                {loading && !data ? (
                  <div className="loading panel" role="status">
                    <Activity className="spin" /> Synchronising your workspace…
                  </div>
                ) : (
                  data && (
                    <div key={page} className="page-enter">
                      {!manager && page === "overview" ? (
                        <>
                          <div className="dashboard-health-panel" aria-label="Ticket health">
                            <SlaHealth summary={data.summary} />
                            <SlaHealth summary={data.summary} resolution />
                          </div>
                          <MyDashboard
                            tickets={data.tickets}
                            summary={data.summary}
                            open={setSelected}
                            onFilter={(key) => {
                              setMetric(key);
                              setCategory(null);
                              navigate("tickets");
                            }}
                          />
                        </>
                      ) : manager && page === "overview" ? (
                        <>
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
                                  View tickets <ChevronRight size={12} />
                                </small>
                              </button>
                            ))}
                          </div>
                          <div className="dashboard-health-panel" aria-label="Ticket health">
                            <SlaHealth summary={data.summary} />
                            <SlaHealth summary={data.summary} resolution />
                          </div>
                        </>
                      ) : manager && page === "tickets" ? (
                        category === null ? (
                          <section className="system-selection">
                            <div className="breadcrumb">
                              <button onClick={() => navigate("overview")}>
                                Overview
                              </button>
                              <ChevronRight size={14} />
                              {metrics.find((m) => m[0] === metric)?.[1]}
                            </div>
                            <div className="section-heading">
                              <div>
                                <p className="eyebrow">TICKET REGISTER</p>
                                <h2>Choose a system</h2>
                              </div>
                            </div>
                            <div className="system-grid">
                              {["", ...categories].map((system, index) => {
                                const Icon =
                                  index === 0 ? Layers3 : icons[index - 1];
                                const count = system
                                  ? data.tickets.filter(
                                      (ticket) => ticket.category === system,
                                    ).length
                                  : data.tickets.length;
                                return (
                                  <button
                                    key={system || "all"}
                                    className="system-choice panel"
                                    onClick={() => setCategory(system)}
                                  >
                                    <span className="system-icon">
                                      <Icon size={24} />
                                    </span>
                                    <ArrowUpRight
                                      className="system-choice-arrow"
                                      size={18}
                                    />
                                    <strong>{system || "All systems"}</strong>
                                    <small>
                                      {count}{" "}
                                      {count === 1 ? "ticket" : "tickets"}
                                    </small>
                                  </button>
                                );
                              })}
                            </div>
                          </section>
                        ) : (
                          <section className="system-results">
                            <button
                              className="back-to-systems"
                              onClick={() => setCategory(null)}
                            >
                              <ArrowLeft size={18} /> Back to systems
                            </button>
                            <div className="section-heading">
                              <div>
                                <p className="eyebrow">
                                  {metrics.find((m) => m[0] === metric)?.[1]}
                                </p>
                                <h2>{category || "All systems"}</h2>
                              </div>
                            </div>
                            <TicketList
                              tickets={data.tickets.filter(
                                (ticket) =>
                                  !category || ticket.category === category,
                              )}
                              open={setSelected}
                              compact
                            />
                          </section>
                        )
                      ) : page === "tickets" ? (
                        <TicketList tickets={data.tickets} open={setSelected} />
                      ) : null}
                    </div>
                  )
                )}
              </div>
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
          metadata={metadata}
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
function ProfileSettings({ session, headers, back, done }) {
  const [form, setForm] = useState({
    name: session.user.name || "",
    email: session.user.email || "",
    currentPassword: "",
    newPassword: "",
  });
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const update = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const payload = {
        name: form.name,
        email: form.email,
        currentPassword: form.currentPassword || undefined,
        newPassword: form.newPassword || undefined,
      };
      const { data } = await api.put("/api/auth/profile", payload, {
        headers,
      });
      done(data);
      setForm({
        name: data.user.name || "",
        email: data.user.email || "",
        currentPassword: "",
        newPassword: "",
      });
      setMessage("Your profile and credentials are updated.");
    } catch (e) {
      setError(
        e.response?.data?.message ||
          "Unable to update profile. Please check the details.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="profile-page">
      <button className="secondary profile-back" onClick={back}>
        <ChevronRight size={17} />
        Back
      </button>
      <form className="panel profile-editor" onSubmit={submit}>
        <div className="panel-heading">
          <div>
            <p className="eyebrow">ACCOUNT SETTINGS</p>
            <h2>Profile details</h2>
          </div>
          <Settings size={19} />
        </div>
        <div className="profile-summary">
          <div className="avatar">{initials(session.user.name)}</div>
          <div>
            <b>{session.user.name}</b>
            <span>{session.user.email}</span>
          </div>
          <dl>
            <div>
              <dt>Role</dt>
              <dd>{label(session.user.role)}</dd>
            </div>
            <div>
              <dt>Branch</dt>
              <dd>{session.user.branch?.name || "All branches"}</dd>
            </div>
          </dl>
        </div>
        {message && (
          <div className="notice" role="status">
            <CheckCheck size={17} />
            {message}
          </div>
        )}
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        <div className="two">
          <label>
            Display name
            <input
              required
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              autoComplete="name"
            />
          </label>
          <label>
            Login email
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              autoComplete="username"
            />
          </label>
        </div>
        <div className="credential-grid">
          <label>
            Current password
            <input
              type="password"
              value={form.currentPassword}
              onChange={(e) => update("currentPassword", e.target.value)}
              autoComplete="current-password"
              placeholder="Required to change password"
            />
          </label>
          <label>
            New password
            <input
              type="password"
              value={form.newPassword}
              onChange={(e) => update("newPassword", e.target.value)}
              autoComplete="new-password"
              minLength={6}
              placeholder="At least 6 characters"
            />
          </label>
        </div>
        <div className="form-actions">
          <button type="button" className="secondary" onClick={back}>
            Back
          </button>
          <button className="primary" disabled={busy}>
            {busy ? "Saving…" : "Save profile"}
            <ArrowUpRight size={17} />
          </button>
        </div>
      </form>
    </div>
  );
}
function MyDashboard({ tickets, summary, open, onFilter }) {
  const active = tickets.filter(
    (t) => !["RESOLVED", "CLOSED"].includes(t.status),
  );
  const stages = ["In progress", "Resolved", "Closed"];
  const stageFor = (status) =>
    ({
      IN_PROGRESS: 0,
      WAITING: 0,
      RESOLVED: 1,
      CLOSED: 2,
    })[status] ?? 0;
  return (
    <>
      <div className="personal-metrics">
        {[
          ["total", "My tickets", Ticket],
          ["unresolved", "In progress", Clock3],
          ["resolved", "Resolved", CircleCheck],
        ].map(([key, title, Icon]) => (
          <button
            className="metric-card"
            key={key}
            onClick={() => onFilter(key)}
          >
            <div>
              <span className="metric-icon">
                <Icon size={20} />
              </span>
              <ArrowUpRight size={16} />
            </div>
            <strong>{summary[key]}</strong>
            <span>{title}</span>
            <small>
              View your requests <ChevronRight size={12} />
            </small>
          </button>
        ))}
      </div>
      {active.length > 0 && (
        <>
          <div className="section-heading">
            <div>
              <p className="eyebrow">WHAT’S HAPPENING NOW</p>
              <button
                className="section-title-button"
                onClick={() => onFilter("unresolved")}
              >
                <h2>Track your active requests</h2>
                <ArrowUpRight size={15} />
              </button>
            </div>
            <button
              className="text-button"
              onClick={() => onFilter("unresolved")}
            >
              View all <ArrowUpRight size={15} />
            </button>
          </div>
          <div className="personal-progress">
            {active.slice(0, 3).map((t) => (
              <button
                key={t.id}
                className="progress-card panel"
                onClick={() => open(t)}
              >
                <div className="progress-heading">
                  <span>
                    {t.reference} · {t.category}
                  </span>
                  <span className={`badge ${t.status.toLowerCase()}`}>
                    {label(t.status)}
                  </span>
                </div>
                <h3>{t.title}</h3>
                <p>
                  <MapPin size={12} />
                  {t.branch?.name}
                </p>
                <ol className="ticket-steps" aria-label="Resolution progress">
                  {stages.map((stage, index) => (
                    <li
                      key={stage}
                      className={index <= stageFor(t.status) ? "step-done" : ""}
                    >
                      <span>
                        {index < stageFor(t.status) ? (
                          <CheckCheck size={12} />
                        ) : (
                          index + 1
                        )}
                      </span>
                      <small>{stage}</small>
                    </li>
                  ))}
                </ol>
                <div className="progress-foot">
                  <span>
                    {t.status === "WAITING"
                      ? "Request on hold · open for details"
                      : `Resolution target: ${dateText(t.resolutionDueAt)}`}
                  </span>
                  <ArrowUpRight size={16} />
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}
function ReportingPanel() {
  return (
    <section className="panel reporting-placeholder">
      <BarChart3 size={32} />
      <p className="eyebrow">AI-ASSISTED REPORTING</p>
      <h2>Generated operational reports are coming soon.</h2>
      <p className="muted">
        This area is reserved for role-aware summaries, trends, and downloadable
        reports generated from the selected reporting period.
      </p>
      <span className="live-chip">
        <i /> PLANNED
      </span>
    </section>
  );
}
function ScopePanel({ metadata, filters, setFilters, hq }) {
  const branches = (metadata?.branches || []).filter(
    (branch) => !filters.zone || branch.zone === filters.zone,
  );
  return (
    <section className="panel dashboard-scope" aria-label="Operational scope">
      <div className="dashboard-scope-head">
        <div>
          <h2>Operational scope</h2>
          <p className="muted">
            Choose the zones and branches shown in the dashboard.
          </p>
        </div>
        <button
          className="reset-scope"
          onClick={() => setFilters({ ...filters, zone: "", branchId: "" })}
        >
          Reset scope
        </button>
      </div>
      <div className="dashboard-scope-grid">
        <div className="dashboard-scope-column">
          <div className="scope-label">
            <MapPin size={15} /> ZONES
          </div>
          <div className="zone-list">
            {["", ...(metadata?.zones || [])].map((zone) => (
              <button
                key={zone}
                className={filters.zone === zone ? "active" : ""}
                aria-pressed={filters.zone === zone}
                onClick={() => setFilters({ ...filters, zone, branchId: "" })}
              >
                <span className="radio" />
                {zone || "All zones"}
                {filters.zone === zone && <CheckCheck size={15} />}
              </button>
            ))}
          </div>
        </div>
        <div className="dashboard-scope-column">
          <div className="scope-label">
            <Building2 size={15} /> BRANCHES / STATES
          </div>
          <div className="branch-list">
            <button
              className={!filters.branchId ? "active" : ""}
              aria-pressed={!filters.branchId}
              onClick={() => setFilters({ ...filters, branchId: "" })}
            >
              {hq ? "All branches" : "Accessible branches"}
              <span>{branches.length}</span>
            </button>
            {branches.map((branch) => (
              <button
                key={branch.id}
                className={filters.branchId === branch.id ? "active" : ""}
                aria-pressed={filters.branchId === branch.id}
                onClick={() => setFilters({ ...filters, branchId: branch.id })}
              >
                <span>
                  <b>{branch.name}</b>
                  <small>{branch.zone}</small>
                </span>
                <ChevronRight size={14} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
function SlaHealth({ summary, resolution = false }) {
  const good = resolution ? summary?.resolved : summary?.within;
  const bad = resolution ? summary?.unresolved : summary?.missed;
  const rate = summary?.total ? Math.round((good / summary.total) * 100) : 0;
  return (
    <section className="panel sla-panel">
      <div className="panel-heading">
        <h2>{resolution ? "Resolution health" : "SLA health"}</h2>
        <ShieldCheck size={18} />
      </div>
      <div className="sla-ring" style={{ "--progress": `${rate}%` }}>
        <div>
          <strong>{summary?.total ? `${rate}%` : "—"}</strong>
          <small>{resolution ? "RESOLVED" : "WITHIN SLA"}</small>
        </div>
      </div>
      <p>
        {summary?.total
          ? `${good} of ${summary.total} tickets ${resolution ? "resolved" : "within SLA"}`
          : "No tickets in this scope"}
      </p>
      <div className="sla-key">
        <span>
          <i className="lavender-bg" /> {resolution ? "Resolved" : "Within SLA"}
        </span>
        <b>{good ?? "—"}</b>
      </div>
      <div className="sla-key">
        <span>
          <i className="rose-bg" /> {resolution ? "Unresolved" : "Missed SLA"}
        </span>
        <b>{bad ?? "—"}</b>
      </div>
      <small className="sla-explainer">
        {resolution
          ? "Resolved and closed tickets ÷ total tickets in the selected period and scope."
          : "Resolution SLA. Waiting pauses the timer; completed tickets use their resolution time."}
      </small>
    </section>
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
                <td data-label="Branch / system">
                  {t.branch?.name}
                  <small>{t.category}</small>
                </td>
                <td data-label="Status">
                  <span className={`badge ${t.status.toLowerCase()}`}>
                    {label(t.status)}
                  </span>
                </td>
                <td data-label="SLA">
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
  const locked = user.role === "STAFF";
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
        `${data.reference} created for ${data.branch.name}. You can track this request in your ticket register.`,
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
        {locked && !own && (
          <div className="error">
            Your account needs an assigned branch. Contact your manager.
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
              disabled={locked}
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
            <select
              aria-label="Branch / state"
              disabled={locked}
              required
              {...field("branchId")}
            >
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
          <button
            className="primary"
            disabled={busy || !metadata || (locked && !own)}
          >
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
          <ShieldCheck size={14} /> Requests are visible to you, the destination
          branch’s managers and HQ.
        </p>
      </section>
    </div>
  );
}
function TicketModal({ ticket, manager, metadata, headers, close, changed }) {
  const [current, setCurrent] = useState(ticket),
    [status, setStatus] = useState(ticket.status),
    [assignment, setAssignment] = useState(ticket.assigneeId || ""),
    [branch, setBranch] = useState(ticket.branchId),
    [priority, setPriority] = useState(ticket.priority),
    [comment, setComment] = useState(""),
    [internal, setInternal] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const dialog = useRef(null);
  useEffect(() => {
    // Synchronise the open detail view with freshly polled server data.
    // eslint-disable-next-line react/set-state-in-effect
    setCurrent(ticket);
  }, [ticket]);
  useEffect(() => {
    const el = dialog.current;
    el.showModal();
    return () => el.close();
  }, []);
  const save = async (type) => {
    setBusy(true);
    setError("");
    try {
      if (["status", "assignment", "escalate"].includes(type))
        setCurrent(
          (
            await api.patch(
              `/api/tickets/${current.id}`,
              type === "status"
                ? { status }
                : type === "escalate"
                  ? { escalateToHq: true }
                  : { assigneeId: assignment, priority, branchId: branch },
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
      {(manager || !["RESOLVED", "CLOSED"].includes(current.status)) && (
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
              {statuses
                .filter((s) => manager || s !== "CLOSED")
                .map((s) => (
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
      {current.waitingSince && (
        <p className="notice">
          SLA paused since {dateText(current.waitingSince)}.
        </p>
      )}
      {current.escalatedAt && (
        <p className="notice">
          Assigned to HQ · {dateText(current.escalatedAt)}
        </p>
      )}
      {manager && (
        <form
          className="assignment-form"
          onSubmit={(e) => {
            e.preventDefault();
            save("assignment");
          }}
        >
          <div className="two">
            <label>
              Zone / branch
              <select
                value={branch}
                onChange={(e) => {
                  setBranch(e.target.value);
                  setAssignment("");
                }}
              >
                {metadata?.branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.zone} · {b.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Criticality
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              >
                {priorities.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Assign technician
            <select
              value={assignment}
              onChange={(e) => setAssignment(e.target.value)}
            >
              <option value="">Unassigned</option>
              {metadata?.assignees
                ?.filter((u) => u.role === "HQ_ADMIN" || u.branchId === branch)
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                    {u.role === "HQ_ADMIN" ? " (HQ)" : ""}
                  </option>
                ))}
            </select>
          </label>
          <div className="staff-actions">
            <button className="primary" disabled={busy}>
              Save assignment
            </button>
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => save("escalate")}
            >
              Assign to HQ
            </button>
          </div>
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
