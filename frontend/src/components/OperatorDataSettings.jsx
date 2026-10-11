import { useEffect, useRef, useState } from "react";

export default function OperatorDataSettings({ api, headers, changed }) {
  const [action, setAction] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [userId, setUserId] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const dialog = useRef(null);
  const phrase = action === "tickets" ? "DELETE ALL TICKETS" : "DELETE USER";
  useEffect(() => {
    if (!action) return;
    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, [action]);
  const open = async (nextAction) => {
    setError(""); setNotice(""); setConfirmation(""); setUserId(""); setAccounts([]); setAction(nextAction);
    if (nextAction === "user") {
      setBusy(true);
      try { const { data } = await api.get("/api/staff", { headers }); setAccounts(data); }
      catch (e) { setError(e.response?.data?.message || "Unable to load users"); }
      finally { setBusy(false); }
    }
  };
  const remove = async (event) => {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const { data } = await api.delete(action === "tickets" ? "/api/tickets" : `/api/staff/${userId}`, { headers, data: { confirmation } });
      setAction(null); setNotice(data.message); changed();
    } catch (e) { setError(e.response?.data?.message || "Deletion failed. Please retry."); }
    finally { setBusy(false); }
  };
  return <section className="panel operator-data-settings" aria-label="Operator data settings">
    <h2>Operator data settings</h2>
    <p className="muted">Only operators can permanently delete ticket data or user accounts.</p>
    {notice && <p className="notice" role="status">{notice}</p>}
    <div className="staff-actions"><button className="danger-button" onClick={() => open("tickets")}>Delete all ticket data</button><button className="danger-button" onClick={() => open("user")}>Delete user</button></div>
    {action && <dialog ref={dialog} className="ticket-dialog deletion-dialog" aria-labelledby="delete-title" onCancel={(event) => { event.preventDefault(); if (!busy) setAction(null); }}>
      <form onSubmit={remove}>
        <h2 id="delete-title">{action === "tickets" ? "Delete all ticket data?" : "Delete a user?"}</h2>
        <p>{action === "tickets" ? "Permanently delete every ticket and all ticket comments across every site, including data outside your current filters. Accounts and sites will remain. This cannot be undone." : "Permanently remove this login and end its access. Tickets and comments remain, showing Deleted user for the removed author. Assigned tickets become unassigned. Operator accounts cannot be deleted here."}</p>
        {action === "user" && <label>User to delete<select required value={userId} disabled={busy} onChange={(event) => { setUserId(event.target.value); setConfirmation(""); }}><option value="">Choose a user</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {account.email}</option>)}</select></label>}
        <label>Type {phrase} to confirm<input autoComplete="off" value={confirmation} disabled={busy} onChange={(event) => setConfirmation(event.target.value)} /></label>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="staff-actions"><button type="button" className="secondary" disabled={busy} onClick={() => setAction(null)}>Cancel</button><button className="danger-button" disabled={busy || confirmation !== phrase || (action === "user" && !userId)}>{busy ? "Please wait…" : "Permanently delete"}</button></div>
      </form>
    </dialog>}
  </section>;
}
