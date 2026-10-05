import { useCallback, useEffect, useState } from "react";
import { Building2, Download, Upload, Users } from "lucide-react";
const blank = {
  name: "",
  email: "",
  password: "",
  role: "STAFF",
  branch_code: "",
  zone: "",
  operatorId: "",
};
export default function StaffSettings({ api, headers, user, metadata }) {
  const [staff, setStaff] = useState([]),
    [operators, setOperators] = useState([]);
  const [form, setForm] = useState(blank),
    [editing, setEditing] = useState(null);
  const [operator, setOperator] = useState({
    operatorName: "",
    name: "",
    email: "",
    password: "",
  });
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
      const results = await Promise.all([
        api.get("/api/staff", config),
        ...(user.role === "HQ_ADMIN"
          ? [api.get("/api/staff/operators", config)]
          : []),
      ]);
      setStaff(results[0].data);
      if (results[1]) setOperators(results[1].data);
    } catch (e) {
      setError(e.response?.data?.message || "Unable to load staff");
    }
  }, [api, token, user.role]);
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
      setNotice(editing ? "Staff access updated." : "Staff account created.");
      setForm(blank);
      setEditing(null);
      await load();
    });
  };
  const downloadTemplate = () => {
    const branch = branches[0];
    const content = `name,email,password,role,branch_code,zone\r\nExample Staff,staff@example.com,ReplaceWithUniquePassword,STAFF,${branch?.code || "BR1"},${branch?.zone || "West MY"}\r\n`;
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
        { csv, preview: previewOnly, operatorId: form.operatorId || undefined },
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
  return (
    <div className="staff-settings page-enter">
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
      {user.role === "HQ_ADMIN" && (
        <section className="panel operator-panel">
          <div className="panel-heading">
            <h2>
              <Building2 size={20} /> Operator credentials
            </h2>
          </div>
          <p className="muted">
            Create an operator login to manage its staff accounts and bulk
            imports.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                await api.post("/api/staff/operators", operator, { headers });
                setOperator({
                  operatorName: "",
                  name: "",
                  email: "",
                  password: "",
                });
                setNotice("Operator login created.");
                await load();
              });
            }}
          >
            <div className="two">
              <label>
                Operator / company name
                <input
                  required
                  maxLength={120}
                  value={operator.operatorName}
                  onChange={(e) =>
                    setOperator({ ...operator, operatorName: e.target.value })
                  }
                />
              </label>
              <label>
                Account holder name
                <input
                  required
                  minLength={2}
                  maxLength={120}
                  value={operator.name}
                  onChange={(e) =>
                    setOperator({ ...operator, name: e.target.value })
                  }
                />
              </label>
              <label>
                Login email
                <input
                  type="email"
                  required
                  autoComplete="off"
                  value={operator.email}
                  onChange={(e) =>
                    setOperator({ ...operator, email: e.target.value })
                  }
                />
              </label>
              <label>
                Initial password
                <input
                  type="password"
                  required
                  minLength={12}
                  autoComplete="new-password"
                  value={operator.password}
                  onChange={(e) =>
                    setOperator({ ...operator, password: e.target.value })
                  }
                />
              </label>
            </div>
            <button className="primary" disabled={busy}>
              Create operator
            </button>
          </form>
          <div className="operator-list">
            {operators.map((o) => (
              <article key={o.id}>
                <b>{o.name}</b>
                <span>{o.user.email}</span>
                <small>{o._count.staff} staff</small>
              </article>
            ))}
          </div>
        </section>
      )}
      <div className="staff-management-grid">
        <section className="panel">
          <h2>
            <Users size={20} /> {editing ? "Edit staff access" : "Add staff"}
          </h2>
          <p className="muted">Role, zone and branch determine staff access.</p>
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
                  <option value="STAFF">SU — Technician</option>
                  <option value="BRANCH_MANAGER">SM — Zone manager</option>
                </select>
              </label>
              <label>
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
              </label>
            </div>
            <label>
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
            </label>
            {user.role === "HQ_ADMIN" && !editing && (
              <label>
                Operator ownership
                <select
                  value={form.operatorId}
                  onChange={(e) => {
                    update("operatorId", e.target.value);
                    setPreview(null);
                  }}
                >
                  <option value="">Company staff</option>
                  {operators.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
                <small>Also applies to the CSV import.</small>
              </label>
            )}
            <div className="staff-actions">
              <button className="primary" disabled={busy}>
                {editing ? "Save access" : "Add staff"}
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
            <Upload size={20} /> Bulk add staff
          </h2>
          <p className="muted">
            Upload up to 500 staff. Every row is checked before any accounts are
            created.
          </p>
          <button className="secondary" onClick={downloadTemplate}>
            <Download size={16} /> Download CSV template
          </button>
          <label>
            Staff CSV
            <input
              type="file"
              accept=".csv,text/csv"
              disabled={busy}
              onChange={selectCsv}
            />
          </label>
          <p className="muted">
            Columns: name, email, password, role, branch_code, zone. Roles:
            STAFF / SU or BRANCH_MANAGER / SM. Zone must match the branch.
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
                        <td>{s.zone}</td>
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
                {busy ? "Adding staff…" : `Add ${preview.count} staff`}
              </button>
            </div>
          )}
        </section>
      </div>
      <section className="panel">
        <h2>
          Staff directory <small>({staff.length})</small>
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
                .filter((s) => ["STAFF", "BRANCH_MANAGER"].includes(s.role))
                .map((s) => (
                  <tr key={s.id}>
                    <td>
                      <b>{s.name}</b>
                      <small>{s.email}</small>
                    </td>
                    <td>
                      {s.role === "STAFF" ? "SU — Technician" : "SM — Manager"}
                    </td>
                    <td>{s.zone || s.branch?.zone || "—"}</td>
                    <td>{s.branch?.name || "—"}</td>
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
        {!staff.length && <p className="muted">No staff in your scope yet.</p>}
      </section>
    </div>
  );
}
