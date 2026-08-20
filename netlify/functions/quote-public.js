exports.handler = async function(event) {
  if (event.httpMethod !== "GET") return json(405, { message: "Method not allowed" });

  try {
    const token = (event.queryStringParameters || {}).token || "";
    if (!token) return json(400, { message: "Missing quote token." });

    const rows = await fetchSubmissions();
    const quote = rows
      .map((row) => {
        const data = row.data || {};
        if (formName(row) !== "saved_quote" || !data.quotePayload) return null;
        try { return JSON.parse(data.quotePayload); } catch (_) { return null; }
      })
      .filter((q) => q && q.approvalToken === token)
      .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))[0];

    if (!quote) return json(404, { message: "Quote not found." });
    const { approvalToken, ...safe } = quote;
    return json(200, { quote: safe });
  } catch (err) {
    return json(err.statusCode || 500, { message: err.message || "Quote request failed." });
  }
};

async function fetchSubmissions() {
  const token = process.env.NETLIFY_API_TOKEN || process.env.NETLIFY_AUTH_TOKEN;
  const siteId = process.env.NETLIFY_SITE_ID || process.env.SITE_ID;
  if (!token || !siteId) {
    throw Object.assign(new Error("Quote storage is not configured."), { statusCode: 500 });
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

function json(statusCode, body) {
  return { statusCode, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }, body: JSON.stringify(body) };
}
