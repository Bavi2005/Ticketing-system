const { randomUUID } = require("crypto");

// Immutable snapshots are kept outside live ticket/user foreign keys so they
// survive cascading ticket comment deletion and account removal.
function auditEntry(actor, action, subjectType, subjectId, subjectLabel, details) {
  return {
    id: randomUUID(),
    action,
    actorId: actor.id,
    actorName: actor.name || "Unknown account",
    actorRole: actor.role,
    subjectType,
    subjectId,
    subjectLabel,
    details,
  };
}

function ticketSnapshot(ticket) {
  const { branch, requester, assignee, comments = [], ...fields } = ticket;
  return {
    ticket: fields,
    branch: branch ? { id: branch.id, code: branch.code, name: branch.name, zone: branch.zone } : null,
    requester: requester ? { id: requester.id, name: requester.name } : null,
    assignee: assignee ? { id: assignee.id, name: assignee.name, role: assignee.role } : null,
    comments: comments.map(({ id, ticketId, authorId, message, internal, createdAt, author }) => ({
      id, ticketId, authorId, message, internal, createdAt,
      author: author ? { name: author.name, role: author.role } : null,
    })),
  };
}

function userSnapshot(user) {
  // Never store password hashes or session credentials in deletion history.
  const { passwordHash, ...safe } = user;
  return safe;
}

module.exports = { auditEntry, ticketSnapshot, userSnapshot };
