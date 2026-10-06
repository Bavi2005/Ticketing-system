const { fail } = require("./ticketing");
// RFC-style quoted cells, escaped quotes, CRLF, UTF-8 BOM and embedded newlines.
function parseStaffCsv(input) {
  if (typeof input !== "string" || Buffer.byteLength(input, "utf8") > 512000)
    fail("CSV must be UTF-8 text under 500 KB");
  const rows = [];
  let row = [],
    cell = "",
    quoted = false,
    closed = false;
  const csv = input.replace(/^\uFEFF/, "");
  for (let i = 0; i < csv.length; i++) {
    const c = csv[i];
    if (quoted) {
      if (c === '"') {
        if (csv[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else cell += c;
    } else if (c === '"') {
      if (cell || closed) fail("Unexpected quote in CSV");
      quoted = true;
    } else if (c === "," || c === "\n" || c === "\r") {
      row.push(cell);
      cell = "";
      closed = false;
      if (c !== ",") {
        if (row.some((v) => v.trim())) rows.push(row);
        row = [];
        if (c === "\r" && csv[i + 1] === "\n") i++;
      }
    } else {
      if (closed) fail("Unexpected text after CSV quote");
      cell += c;
    }
    if (rows.length > 501) fail("Import at most 500 staff at a time");
  }
  if (quoted) fail("Unclosed CSV quote");
  row.push(cell);
  if (row.some((v) => v.trim())) rows.push(row);
  if (rows.length < 2 || rows.length > 501)
    fail("CSV must contain a header and 1–500 staff rows");
  const header = rows.shift().map((v) => ({ site_code: "branch_code", region: "zone" }[v.trim().toLowerCase()] || v.trim().toLowerCase()));
  const required = ["name", "email", "password", "role", "branch_code"];
  const allowed = [...required, "zone"];
  if (
    new Set(header).size !== header.length ||
    required.some((k) => !header.includes(k)) ||
    header.some((k) => !allowed.includes(k))
  )
    fail(
      "CSV headers: name,email,password,role,site_code,region (region is optional)",
    );
  return rows.map((values, index) => {
    if (values.length !== header.length)
      fail(`Row ${index + 2}: column count does not match header`);
    return Object.fromEntries(header.map((k, i) => [k, values[i]]));
  });
}
module.exports = { parseStaffCsv };
