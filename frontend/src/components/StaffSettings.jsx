import { useCallback, useEffect, useState } from "react";
import { ShieldCheck, Download, Upload, Users } from "lucide-react";
const blank = {
  name: "",
  email: "",
  password: "",
  role: "STAFF",
  branch_code: "",
  zone: "",
};
export default function StaffSettings({ api, headers, user, metadata }) {
  const [staff, setStaff] = useState([]);
  const [form, setForm] = useState(blank),
    [editing, setEditing] = useState(null);
  const [csv, setCsv] = useState(""),
    [filename, setFilename] = useState(""),
    [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [errors, setErrors] = useState([]),
    [notice, setNotice] = useState("");
  const token = headers.Authorization;
  const load = useCallback(async () => {
    const config = { headers: { Authorization: token } };
    try {
      const { data } = await api.get("/api/staff", config);
      setStaff(data);
    } catch (e) {
      setError(e.response?.data?.message || "Unable to load staff");
    }
  }, [api, token]);
  // Fetch staff when the authenticated account changes.
  useEffect(() => {
    // eslint-disable-next-line react/set-state-in-effect
    load();
  }, [load]);
  const run = async (fn) => {
    setBusy(true);
    setError("");
    setErrors([]);
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError(e.response?.data?.message || e.message || "Unable to save");
      setErrors(e.response?.data?.errors || []);
    } finally {
      setBusy(false);
    }
  };
  const branches = metadata?.branches || [];
  const update = (key, value) => {
    const branch =
      key === "branch_code" ? branches.find((b) => b.code === value) : null;
    setForm((f) => ({
      ...f,
      [key]: value,
      ...(branch ? { zone: branch.zone } : {}),
      ...(key === "role" && value === "HQ_ADMIN" ? { zone: "", branch_code: "" } : {}),
    }));
  };
  const submitStaff = (e) => {
    e.preventDefault();
    run(async () => {
      const payload = editing
        ? {
            name: form.name,
            email: form.email,
            role: form.role,
            branch_code: form.branch_code,
            zone: form.zone,
          }
        : form;
      await (editing
        ? api.patch(`/api/staff/${editing}`, payload, { headers })
        : api.post("/api/staff", payload, { headers }));
      setNotice(editing ? "Credential access updated." : "Credential created.");
      setForm(blank);
      setEditing(null);
      await load();
    });
  };
  const downloadTemplate = () => {
    const branch = branches[0];
    const content = `name,email,password,role,branch_code,zone\r\nHQ Lead,hq@example.com,ReplaceWithUniquePassword,HQ_ADMIN,,\r\nExample Staff,staff@example.com,ReplaceWithUniquePassword,STAFF,${branch?.code || "BR1"},${branch?.zone || "West MY"}\r\n`;
    const url = URL.createObjectURL(
      new Blob([content], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "staff-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };
  const selectCsv = async (e) => {
    setPreview(null);
    setCsv("");
    setError("");
    setErrors([]);
    setFilename("");
    const file = e.target.files[0];
    if (!file) return;
    if (!/\.csv$/i.test(file.name) || file.size > 512000) {
      setError("Choose a UTF-8 .csv file under 500 KB.");
      e.target.value = "";
      return;
    }
    try {
      setCsv(await file.text());
      setFilename(file.name);
    } catch {
      setError("Unable to read CSV");
    }
  };
  const importCsv = (previewOnly) =>
    run(async () => {
      const { data } = await api.post(
        "/api/staff/import",
        { csv, preview: previewOnly },
        { headers },
      );
      if (previewOnly) setPreview(data);
      else {
        setPreview(null);
        setCsv("");
        setFilename("");
        setNotice(data.message);
        await load();
      }
    });
  if (user.role !== "OPERATOR") return null;
  return (
    <div className="staff-settings page-enter">
      <section className="credential-hero panel">
        <span className="operator-kicker"><ShieldCheck size={15}/> OPERATOR ACCESS CONTROL</span>
        <h2>Identity & access command centre</h2>
        <p>Create and manage every HQ, branch manager, and technician login.</p>
        <div className="credential-summary">
          <span><strong>{staff.length}</strong>Managed accounts</span>
          {[["HQ_ADMIN", "HQ admins"], ["BRANCH_MANAGER", "Managers"], ["STAFF", "Technicians"]].map(([role, name]) => <span key={role}><strong>{staff.filter((item) => item.role === role).length}</strong>{name}</span>)}
        </div>
      </section>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {errors.length > 0 && (
        <ul className="csv-errors">
          {errors.map((e, i) => (
            <li key={i}>
              Row {e.row}: {e.message}
            </li>
          ))}
        </ul>
      )}
      {notice && (
        <div className="notice" role="status">
          {notice}
        </div>
      )}
      <div className="staff-management-grid">
        <section className="panel">
          <h2>
            <Users size={20} /> {editing ? "Edit credential access" : "Create credentials"}
          </h2>
          <p className="muted">Only the operator can issue and change account access.</p>
          <form onSubmit={submitStaff}>
            <label>
              Name
              <input
                required
                minLength={2}
                maxLength={120}
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
              />
            </label>
            <label>
              Email
              <input
                required
                type="email"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
              />
            </label>
            {!editing && (
              <label>
                Initial password
                <input
                  required
                  type="password"
                  minLength={12}
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(e) => update("password", e.target.value)}
                />
                <small>
                  At least 12 characters; share with the staff member securely.
                </small>
              </label>
            )}
            <div className="two">
              <label>
                Role
                <select
                  value={form.role}
                  onChange={(e) => update("role", e.target.value)}
                >
                  <option value="HQ_ADMIN">HQ — Administrator</option>
                  <option value="STAFF">SU — Technician</option>
                  <option value="BRANCH_MANAGER">SM — Zone manager</option>
                </select>
              </label>
              {form.role !== "HQ_ADMIN" && <label>
                Zone
                <select
                  value={form.zone}
                  required
                  onChange={(e) =>
                    setForm({ ...form, zone: e.target.value, branch_code: "" })
                  }
                >
                  <option value="">Select zone</option>
                  {metadata?.zones?.map((z) => (
                    <option key={z}>{z}</option>
                  ))}
                </select>
              </label>}
            </div>
            {form.role !== "HQ_ADMIN" && <label>
              Branch
              <select
                required
                value={form.branch_code}
                onChange={(e) => update("branch_code", e.target.value)}
              >
                <option value="">Select branch</option>
                {branches
                  .filter((b) => !form.zone || b.zone === form.zone)
                  .map((b) => (
                    <option key={b.id} value={b.code}>
                      {b.name} ({b.code})
                    </option>
                  ))}
              </select>
            </label>}
            <div className="staff-actions">
              <button className="primary" disabled={busy}>
                {editing ? "Save access" : "Create credential"}
              </button>
              {editing && (
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    setEditing(null);
                    setForm(blank);
                  }}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </section>
        <section className="panel csv-panel">
          <h2>
            <Upload size={20} /> Bulk credential creation
          </h2>
          <p className="muted">
            Upload up to 500 HQ, manager, and technician accounts. Every row is checked before any accounts are
            created.
          </p>
          <button className="secondary" onClick={downloadTemplate}>
            <Download size={16} /> Download CSV template
          </button>
          <label>
            Credential CSV
            <input
              type="file"
              accept=".csv,text/csv"
              disabled={busy}
              onChange={selectCsv}
            />
          </label>
          <p className="muted">
            Columns: name, email, password, role, branch_code, zone. Roles:
            HQ_ADMIN / HQ, STAFF / SU or BRANCH_MANAGER / SM. HQ rows leave branch and zone empty; other zones must match the branch.
          </p>
          {filename && <p>{filename}</p>}
          <button
            className="secondary"
            disabled={busy || !csv}
            onClick={() => importCsv(true)}
          >
            Validate & preview
          </button>
          {preview && (
            <div className="csv-preview">
              <p className="notice">
                {preview.count} valid accounts ready to add.
              </p>
              <div className="staff-table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Zone</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.staff.map((s) => (
                      <tr key={s.email}>
                        <td>{s.name}</td>
                        <td>{s.email}</td>
                        <td>{s.role}</td>
                        <td>{s.zone || "All zones"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                className="primary"
                disabled={busy}
                onClick={() => importCsv(false)}
              >
                {busy ? "Creating credentials…" : `Create ${preview.count} credentials`}
              </button>
            </div>
          )}
        </section>
      </div>
      <section className="panel">
        <h2>
          Managed credentials <small>({staff.length})</small>
        </h2>
        <div className="staff-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Staff</th>
                <th>Role</th>
                <th>Zone</th>
                <th>Branch</th>
                <th>Access</th>
              </tr>
            </thead>
            <tbody>
              {staff
                .filter((s) => ["STAFF", "BRANCH_MANAGER", "HQ_ADMIN"].includes(s.role))
                .map((s) => (
                  <tr key={s.id}>
                    <td>
                      <b>{s.name}</b>
                      <small>{s.email}</small>
                    </td>
                    <td>
                      {s.role === "HQ_ADMIN" ? "HQ — Administrator" : s.role === "STAFF" ? "SU — Technician" : "SM — Manager"}
                    </td>
                    <td>{s.zone || s.branch?.zone || "—"}</td>
                    <td>{s.branch?.name || "HQ / global"}</td>
                    <td>
                      <button
                        className="secondary"
                        disabled={busy || s.id === user.id}
                        onClick={() => {
                          setEditing(s.id);
                          setForm({
                            ...blank,
                            ...s,
                            branch_code: s.branch?.code || "",
                            zone: s.zone || s.branch?.zone || "",
                          });
                        }}
                      >
                        Edit access
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {!staff.length && <p className="muted">No managed credentials yet.</p>}
      </section>
    </div>
  );
}
