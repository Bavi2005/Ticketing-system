import { useEffect, useRef, useState } from "react";

export default function OperatorDataSettings({ api, headers, changed }) {
  const [action, setAction] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [selected, setSelected] = useState([]);
  const [search, setSearch] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const dialog = useRef(null);
  const phrase = action === "tickets" ? "DELETE ALL TICKETS" : "DELETE USERS";
  useEffect(() => {
    if (!action) return;
    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, [action]);
  const open = async (nextAction) => {
    setError(""); setNotice(""); setConfirmation(""); setSelected([]); setSearch(""); setAccounts([]); setAction(nextAction);
    if (nextAction === "user") {
      setBusy(true);
      try { const { data } = await api.get("/api/staff", { headers }); setAccounts(data.filter((account) => account.role !== "OPERATOR")); }
      catch (e) { setError(e.response?.data?.message || "Unable to load users"); }
      finally { setBusy(false); }
    }
  };
  const remove = async (event) => {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const { data } = await api.delete(action === "tickets" ? "/api/tickets" : "/api/staff", { headers, data: { confirmation, ...(action === "user" ? { userIds: selected } : {}) } });
      setAction(null); setNotice(data.message); changed();
    } catch (e) { setError(e.response?.data?.message || "Deletion failed. Please retry."); }
    finally { setBusy(false); }
  };
  const visible = accounts.filter((account) => `${account.name} ${account.email} ${account.branch?.name || ""}`.toLowerCase().includes(search.toLowerCase()));
  const changeSelection = (next) => { setSelected(next); setConfirmation(""); };
  const toggle = (id) => changeSelection(selected.includes(id) ? selected.filter((value) => value !== id) : [...selected, id]);
  return <section className="panel operator-data-settings" aria-label="Operator data settings">
    <h2>Operator data settings</h2>
    <p className="muted">Only operators can permanently delete ticket data or user accounts.</p>
    {notice && <p className="notice" role="status">{notice}</p>}
    <div className="staff-actions"><button className="danger-button" onClick={() => open("tickets")}>Delete all ticket data</button><button className="danger-button" onClick={() => open("user")}>Delete users</button></div>
    {action && <dialog ref={dialog} className="ticket-dialog deletion-dialog" aria-labelledby="delete-title" onCancel={(event) => { event.preventDefault(); if (!busy) setAction(null); }}>
      <form onSubmit={remove}>
        <h2 id="delete-title">{action === "tickets" ? "Delete all ticket data?" : `Delete selected users (${selected.length})?`}</h2>
        <p>{action === "tickets" ? "Permanently delete every ticket and all ticket comments across every site, including data outside your current filters. Accounts and sites will remain. This cannot be undone." : "Permanently remove the selected logins and end their access. Tickets and comments remain, showing Deleted user for the removed author. Assigned tickets become unassigned. Operator accounts cannot be deleted here."}</p>
        {action === "user" && <div className="bulk-user-picker">
          <label>Search users<input type="search" value={search} disabled={busy} placeholder="Name, email or site" onChange={(event) => setSearch(event.target.value)} /></label>
          <div className="staff-actions">
            <button type="button" className="secondary" disabled={busy || !visible.length} onClick={() => changeSelection([...new Set([...selected, ...visible.map((account) => account.id)])])}>Select all {search ? "matching" : "users"} ({visible.length})</button>
            <button type="button" className="secondary" disabled={busy || !selected.length} onClick={() => changeSelection([])}>Clear selection</button>
          </div>
          <p role="status">{selected.length} selected of {accounts.length} users{search ? "; search does not clear previous selections" : ""}.</p>
          <div className="bulk-user-list" role="group" aria-label="Users to delete">
            {visible.map((account) => <label className="bulk-user-option" key={account.id}>
              <input type="checkbox" checked={selected.includes(account.id)} disabled={busy} onChange={() => toggle(account.id)} />
              <span><b>{account.name}</b><small>{account.email} · {account.branch?.name || "All sites"}</small></span>
            </label>)}
            {!visible.length && <p className="muted">{busy ? "Loading users…" : "No users found."}</p>}
          </div>
        </div>}

        <label>Type {phrase} to confirm<input autoComplete="off" value={confirmation} disabled={busy} onChange={(event) => setConfirmation(event.target.value)} /></label>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="staff-actions"><button type="button" className="secondary" disabled={busy} onClick={() => setAction(null)}>Cancel</button><button className="danger-button" disabled={busy || confirmation !== phrase || (action === "user" && !selected.length)}>{busy ? "Please wait…" : action === "user" ? `Permanently delete ${selected.length} user${selected.length === 1 ? "" : "s"}` : "Permanently delete"}</button></div>
      </form>
    </dialog>}
  </section>;
}
