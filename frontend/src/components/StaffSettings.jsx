import { useCallback, useEffect, useRef, useState } from "react";
import { Download, KeyRound, Plus, Search, ShieldCheck, Upload, X } from "lucide-react";

const roleName = (role) => ({ HQ_ADMIN: "HQ administrator", BRANCH_MANAGER: "Site manager", STAFF: "Technician" }[role] || role);
const blank = { name: "", email: "", password: "", role: "STAFF", site_code: "", region: "", accessEnabled: true };

function AccessDialog({ children, title, close }) {
  const ref = useRef(null);
  useEffect(() => { const dialog = ref.current; dialog.showModal(); return () => dialog.close(); }, []);
  return <dialog ref={ref} className="ticket-dialog access-dialog" aria-label={title} onCancel={(event) => { event.preventDefault(); close(); }} onClick={(event) => { if (event.target !== ref.current) return; const box = ref.current.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) close(); }}>
    <button type="button" className="dialog-close icon-button" aria-label="Close access editor" onClick={close}><X size={20}/></button>
    <p className="eyebrow">IDENTITY & ACCESS</p><h2>{title}</h2>{children}
  </dialog>;
}

export default function StaffSettings({ api, headers, user, metadata }) {
  const operator = user.role === "OPERATOR", siteManager = user.role === "BRANCH_MANAGER";
  const [staff, setStaff] = useState([]), [search, setSearch] = useState("");
  const [editor, setEditor] = useState(null), [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [error, setError] = useState(""), [modalError, setModalError] = useState(""), [notice, setNotice] = useState("");
  const [candidates, setCandidates] = useState([]), [candidate, setCandidate] = useState(""), [candidateSearch, setCandidateSearch] = useState("");
  const [csv, setCsv] = useState(""), [preview, setPreview] = useState(null), [csvErrors, setCsvErrors] = useState([]);
  const token = headers.Authorization;
  const sites = metadata?.branches || [];
  const load = useCallback(async () => {
    try { const { data } = await api.get("/api/staff", { headers: { Authorization: token } }); setStaff(data); setError(""); }
    catch (e) { setError(e.response?.data?.message || "Unable to load access list"); }
    finally { setLoading(false); }
  }, [api, token]);
  useEffect(() => { load(); }, [load]);
  const open = (account) => {
    setModalError(""); setNotice("");
    setForm(account ? { ...blank, ...account, password: "", site_code: account.branch?.code || "", region: account.zone || account.branch?.zone || "" } : blank);
    setEditor(account ? { mode: "edit", id: account.id } : { mode: "create" });
  };
  const update = (key, value) => setForm((old) => ({ ...old, [key]: value,
    ...(key === "region" ? { site_code: "" } : {}),
    ...(key === "site_code" ? { region: sites.find((site) => site.code === value)?.zone || old.region } : {}),
    ...(key === "role" && value === "HQ_ADMIN" ? { site_code: "", region: "" } : {}),
  }));
  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setModalError("");
    try {
      const payload = { ...form }; if (!payload.password) delete payload.password;
      if (editor.mode === "edit") await api.patch(`/api/staff/${editor.id}`, payload, { headers });
      else await api.post("/api/staff", payload, { headers });
      setEditor(null); setForm(blank); setNotice(editor.mode === "edit" ? "Access updated." : "New account registered."); await load();
    } catch (e) { setModalError(e.response?.data?.message || "Unable to save account access"); }
    finally { setBusy(false); }
  };
  const downloadTemplate = () => {
    const first = sites[0];
    const text = `name,email,password,role,site_code,region\r\nExample Technician,tech@example.com,ReplaceWithUniquePassword,STAFF,${first?.code || "BR1"},${first?.zone || "SOUTHERN"}\r\nHQ Lead,hq@example.com,ReplaceWithUniquePassword,HQ_ADMIN,,\r\n`;
    const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" })); const a = document.createElement("a"); a.href = url; a.download = "account-import.csv"; a.click(); URL.revokeObjectURL(url);
  };
  const importCsv = async (previewOnly) => {
    setBusy(true); setModalError(""); setCsvErrors([]);
    try {
      const { data } = await api.post("/api/staff/import", { csv, preview: previewOnly }, { headers });
      if (previewOnly) setPreview(data); else { setEditor(null); setCsv(""); setPreview(null); setNotice(data.message); await load(); }
    } catch (e) { setModalError(e.response?.data?.message || "Unable to import accounts"); setCsvErrors(e.response?.data?.errors || []); setPreview(null); }
    finally { setBusy(false); }
  };
  const openAssign = async () => {
    setEditor({ mode: "assign" }); setModalError(""); setCandidate(""); setCandidateSearch(""); setCandidates([]); setBusy(true);
    try { const { data } = await api.get("/api/staff/technicians", { headers }); setCandidates(data); }
    catch (e) { setModalError(e.response?.data?.message || "Unable to load technicians"); }
    finally { setBusy(false); }
  };
  const assign = async (event) => {
    event.preventDefault(); setBusy(true); setModalError("");
    try { await api.post("/api/staff/assign-technician", { technicianId: candidate }, { headers }); setEditor(null); setNotice("Technician added to your site. Their tickets are now visible to you."); await load(); }
    catch (e) { setModalError(e.response?.data?.message || "Unable to assign technician"); }
    finally { setBusy(false); }
  };
  const visible = staff.filter((account) => `${account.name} ${account.email} ${account.branch?.name || ""} ${roleName(account.role)}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="staff-settings page-enter">
    {error && <div className="error" role="alert">{error}<button className="secondary" onClick={load}>Retry</button></div>}
    {notice && <div className="notice" role="status">{notice}</div>}
    <section className="panel access-list-panel">
      <div className="access-list-head"><div><span className="operator-kicker"><ShieldCheck size={15}/> ACCESS CONTROL</span><h2>Account access <small>({staff.length})</small></h2><p className="muted">{siteManager ? "Manage technician access at your assigned site." : operator ? "Register accounts and manage HQ, site manager, and technician access." : "Manage technician and site manager access across all sites."}</p></div>
        {siteManager && <button className="primary" onClick={openAssign}><Plus size={16}/> Add technician to my site</button>}
        {operator && <div className="staff-actions"><button className="secondary" onClick={() => { setEditor({ mode: "bulk" }); setModalError(""); setCsvErrors([]); }}><Upload size={16}/> Bulk import</button><button className="primary" onClick={() => open(null)}><Plus size={16}/> New staff</button></div>}
      </div>
      <label className="access-search"><Search size={17}/><input aria-label="Search accounts" placeholder="Search name, email, role or site" value={search} onChange={(e) => setSearch(e.target.value)}/></label>
      <div className="staff-table-scroll"><table><thead><tr><th>Account</th><th>Access level</th><th>Region</th><th>Site</th><th>Login access</th><th>Actions</th></tr></thead><tbody>{visible.map((account) => <tr key={account.id}>
        <td><b>{account.name}</b><small>{account.email}</small></td><td>{roleName(account.role)}</td><td>{account.branch?.zone || account.zone || "All regions"}</td><td>{account.branch?.name || "All sites"}</td><td><span className={`access-state ${account.accessEnabled === false ? "disabled" : "enabled"}`}>{account.accessEnabled === false ? "Disabled" : "Enabled"}</span></td><td><button className="secondary" onClick={() => open(account)}><KeyRound size={14}/> Edit access</button></td>
      </tr>)}</tbody></table></div>
      {!visible.length && <p className="access-empty muted">{loading ? "Loading account access…" : "No accounts match this list."}</p>}
    </section>
    {editor && <AccessDialog title={editor.mode === "assign" ? "Add technician to my site" : editor.mode === "bulk" ? "Bulk account registration" : editor.mode === "edit" ? `Edit access · ${form.name}` : "Register a new account"} close={() => { if (!busy) { setEditor(null); setForm(blank); } }}>
      {modalError && <div className="error" role="alert">{modalError}</div>}
      {editor.mode === "assign" ? <form onSubmit={assign} className="access-editor">
        <p className="muted">Choose an existing technician. This moves their site assignment to {user.branch?.name || "your site"}; it does not create a new login or move historical tickets.</p>
        <label>Find a technician<input value={candidateSearch} onChange={(e) => setCandidateSearch(e.target.value)} placeholder="Search name, email or current site"/></label>
        <label>Technician<select required value={candidate} onChange={(e) => setCandidate(e.target.value)}><option value="">Choose technician</option>{candidates.filter((item) => `${item.name} ${item.email} ${item.branch?.name || ""}`.toLowerCase().includes(candidateSearch.toLowerCase())).map((item) => <option key={item.id} value={item.id}>{item.name} · {item.email} · {item.branch?.name || "Unassigned"}</option>)}</select></label>
        {!busy && !candidates.length && !modalError && <p className="muted">No other technicians are available to add.</p>}
        <button className="primary" disabled={busy || !candidate}>{busy ? "Loading…" : "Add to my site"}</button>
      </form> : editor.mode === "bulk" ? <div className="access-bulk"><p className="muted">Up to 500 accounts. Every row is checked before any account is registered.</p><button className="secondary" onClick={downloadTemplate}><Download size={16}/> Download CSV template</button><label>Account CSV<input type="file" accept=".csv,text/csv" disabled={busy} onChange={async (e) => {
        setPreview(null); setModalError(""); setCsvErrors([]); setCsv(""); const file = e.target.files[0]; if (!file) return;
        if (file.size > 512000 || !/\.csv$/i.test(file.name)) { setModalError("Choose a CSV file under 500 KB."); return; }
        try { setCsv(await file.text()); } catch { setModalError("Unable to read CSV"); }
      }}/></label><p className="muted">Roles: STAFF, BRANCH_MANAGER, HQ_ADMIN. HQ leaves site and region empty.</p>
        {csvErrors.length > 0 && <ul className="csv-errors">{csvErrors.map((e, i) => <li key={i}>Row {e.row}: {e.message}</li>)}</ul>}
        <button className="secondary" disabled={busy || !csv} onClick={() => importCsv(true)}>Validate & preview</button>
        {preview && <><div className="staff-table-scroll"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Region</th></tr></thead><tbody>{preview.staff.map((item) => <tr key={item.email}><td>{item.name}</td><td>{item.email}</td><td>{roleName(item.role)}</td><td>{item.zone || "All regions"}</td></tr>)}</tbody></table></div><button className="primary" disabled={busy} onClick={() => importCsv(false)}>Register {preview.count} accounts</button></>}
      </div> : <form onSubmit={submit} className="access-editor">
        <div className="two"><label>Full name<input required minLength={2} maxLength={120} value={form.name} onChange={(e) => update("name", e.target.value)}/></label><label>Login email<input required type="email" value={form.email} onChange={(e) => update("email", e.target.value)}/></label></div>
        {operator && <label>{editor.mode === "create" ? "Initial password" : "Reset password (optional)"}<input type="password" autoComplete="new-password" required={editor.mode === "create"} minLength={12} value={form.password} onChange={(e) => update("password", e.target.value)}/><small>12 or more characters. Leave empty to keep an existing password.</small></label>}
        <label>Access level<select disabled={siteManager} value={form.role} onChange={(e) => update("role", e.target.value)}><option value="STAFF">Technician</option>{!siteManager && <option value="BRANCH_MANAGER">Site manager</option>}{operator && <option value="HQ_ADMIN">HQ administrator</option>}</select></label>
        {form.role !== "HQ_ADMIN" && <div className="two"><label>Region<select required disabled={siteManager} value={form.region} onChange={(e) => update("region", e.target.value)}><option value="">Choose region</option>{metadata?.zones?.map((region) => <option key={region} value={region}>{region === "EC" ? "East Coast (EC)" : region}</option>)}</select></label><label>Site<select required disabled={siteManager} value={form.site_code} onChange={(e) => update("site_code", e.target.value)}><option value="">Choose site</option>{sites.filter((site) => !form.region || site.zone === form.region).map((site) => <option key={site.id} value={site.code}>{site.name}</option>)}</select></label></div>}
        {editor.mode === "edit" && <label className="access-toggle"><input type="checkbox" checked={form.accessEnabled !== false} onChange={(e) => update("accessEnabled", e.target.checked)}/><span>Give login access<small>Disabling access prevents sign-in and stops existing sessions.</small></span></label>}
        <div className="staff-actions"><button type="button" className="secondary" disabled={busy} onClick={() => { setEditor(null); setForm(blank); }}>Cancel</button><button className="primary" disabled={busy}>{busy ? "Saving…" : editor.mode === "edit" ? "Save access" : "Register account"}</button></div>
      </form>}
    </AccessDialog>}
  </div>;
}
