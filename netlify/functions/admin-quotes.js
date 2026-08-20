exports.handler = async function(event) {
  if (!authorized(event.headers.authorization || "")) return json(401, { message: "Unauthorized" });
  if (!["GET", "DELETE"].includes(event.httpMethod)) return json(405, { message: "Method not allowed" });

  try {
    if (event.httpMethod === "DELETE") {
      const id = (event.queryStringParameters || {}).id || "";
      if (!id) return json(400, { message: "Missing quote id." });
      const result = await deleteQuote(id);
      return json(200, result);
    }

    const quotes = await loadQuotes();
    const id = (event.queryStringParameters || {}).id;
    if (id) {
      const quote = quotes.find((q) => q.id === id);
      if (!quote) return json(404, { message: "Quote not found." });
      return json(200, { quote });
    }
    return json(200, { quotes: quotes.map(summary) });
  } catch (err) {
    return json(err.statusCode || 500, { message: err.message || "Could not load saved quotes." });
  }
};

async function deleteQuote(id) {
  const rows = await fetchSubmissions();
  const toDelete = [];
  let token = "";

  rows.forEach((row) => {
    const data = row.data || {};
    if (formName(row) !== "saved_quote" || !data.quotePayload) return;
    try {
      const quote = JSON.parse(data.quotePayload);
      if (quote.id === id) {
        toDelete.push(row.id);
        token = token || quote.approvalToken || "";
      }
    } catch (_) {}
  });

  if (token) {
    rows.forEach((row) => {
      const data = row.data || {};
      if (formName(row) === "quote_approval" && data.token === token) toDelete.push(row.id);
    });
  }

  if (!toDelete.length) throw Object.assign(new Error("Quote not found."), { statusCode: 404 });
  await Promise.all([...new Set(toDelete)].map(deleteSubmission));
  return { ok: true, deleted: toDelete.length };
}

async function deleteSubmission(id) {
  const apiToken = process.env.NETLIFY_API_TOKEN || process.env.NETLIFY_AUTH_TOKEN;
  const res = await fetch(`https://api.netlify.com/api/v1/submissions/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${apiToken}` }
  });
  if (!res.ok && res.status !== 404) {
    const body = await res.text();
    throw Object.assign(new Error(`Netlify delete request failed: ${res.status} ${body.slice(0, 180)}`), { statusCode: 502 });
  }
}

async function loadQuotes() {
  const rows = await fetchSubmissions();
  const approvals = new Map();
  rows.forEach((row) => {
    const data = row.data || {};
    if (formName(row) === "quote_approval" && data.token) {
      approvals.set(data.token, {
        approvedAt: row.created_at,
        approvedBy: data.approvedBy || data.name || ""
      });
    }
  });

  const byId = new Map();
  rows.forEach((row) => {
    const data = row.data || {};
    if (formName(row) !== "saved_quote" || !data.quotePayload) return;
    try {
      const quote = JSON.parse(data.quotePayload);
      quote.savedAt = row.created_at;
      quote.updatedAt = row.created_at || quote.updatedAt;
      const approval = approvals.get(quote.approvalToken);
      if (approval) {
        quote.status = "Approved";
        quote.approvedAt = approval.approvedAt;
        quote.approvedBy = approval.approvedBy;
      }
      const existing = byId.get(quote.id);
      if (!existing || new Date(quote.updatedAt || 0) > new Date(existing.updatedAt || 0)) {
        byId.set(quote.id, quote);
      }
    } catch (_) {}
  });

  return Array.from(byId.values()).sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
}

async function fetchSubmissions() {
  const token = process.env.NETLIFY_API_TOKEN || process.env.NETLIFY_AUTH_TOKEN;
  const siteId = process.env.NETLIFY_SITE_ID || process.env.SITE_ID;
  if (!token || !siteId) {
    throw Object.assign(new Error("Set NETLIFY_API_TOKEN and NETLIFY_SITE_ID in Netlify environment variables."), { statusCode: 500 });
  }
  const res = await fetch(`https://api.netlify.com/api/v1/sites/${encodeURIComponent(siteId)}/submissions?per_page=100`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    const body = await res.text();
    throw Object.assign(new Error(`Netlify submissions request failed: ${res.status} ${body.slice(0, 180)}`), { statusCode: 502 });
  }
  return res.json();
}

function formName(row) {
  const data = row.data || {};
  return data["form-name"] || data.form_name || row.form_name || row.formName || "";
}

function summary(quote) {
  return {
    id: quote.id,
    quoteNumber: quote.quoteNumber,
    customerName: quote.customerName,
    customerEmail: quote.customerEmail,
    status: quote.status,
    total: quote.total,
    updatedAt: quote.updatedAt
  };
}

function authorized(header) {
  const password = process.env.QUOTE_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD;
  if (!password || !header.toLowerCase().startsWith("basic ")) return false;
  const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
  const supplied = decoded.includes(":") ? decoded.split(":").slice(1).join(":") : decoded;
  return supplied === password;
}

function json(statusCode, body) {
  return { statusCode, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }, body: JSON.stringify(body) };
}
