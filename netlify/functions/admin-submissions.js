exports.handler = async function(event) {
  if (event.httpMethod !== "GET") {
    return json(405, { message: "Method not allowed" });
  }

  const password = process.env.QUOTE_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD;
  if (!password) {
    return json(500, {
      setupRequired: true,
      message: "Set QUOTE_ADMIN_PASSWORD in Netlify environment variables before using the quote admin."
    });
  }

  if (!authorized(event.headers.authorization || "", password)) {
    return json(401, { message: "Unauthorized" });
  }

  const token = process.env.NETLIFY_API_TOKEN || process.env.NETLIFY_AUTH_TOKEN;
  const siteId = process.env.NETLIFY_SITE_ID || process.env.SITE_ID;
  if (!token || !siteId) {
    return json(500, {
      setupRequired: true,
      message: "Set NETLIFY_API_TOKEN and NETLIFY_SITE_ID in Netlify environment variables so submissions can be loaded."
    });
  }

  let rows;
  try {
    rows = await fetchSubmissions(siteId, token);
  } catch (err) {
    return json(err.statusCode || 502, { message: err.message || "Could not load Netlify submissions." });
  }
  const seen = new Set();
  const submissions = rows
    .filter((row) => {
      if (!row || !row.id || seen.has(row.id)) return false;
      seen.add(row.id);
      const data = row.data || {};
      const formName = data["form-name"] || data.form_name || row.form_name || row.formName || "";
      const looksLikeQuote =
        formName === "quote" ||
        data.service ||
        data.message ||
        (data.name && data.email);
      return Boolean(looksLikeQuote);
    })
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    .map((row) => {
      const data = row.data || {};
      return {
        id: row.id,
        number: row.number,
        createdAt: row.created_at,
        name: data.name || row.name || "",
        email: data.email || row.email || "",
        phone: data.phone || "",
        service: data.service || "",
        message: data.message || row.body || ""
      };
    });

  return json(200, { submissions });
};

async function fetchSubmissions(siteId, token) {
  const base = `https://api.netlify.com/api/v1/sites/${encodeURIComponent(siteId)}/submissions?per_page=100`;
  const headers = { Authorization: `Bearer ${token}` };
  const requests = [base, `${base}&state=spam`].map(async (url) => {
    const res = await fetch(url, { headers });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Netlify submissions request failed: ${res.status} ${body.slice(0, 180)}`);
    }
    return res.json();
  });

  const groups = await Promise.allSettled(requests);
  if (groups[0].status === "rejected") {
    throw Object.assign(groups[0].reason, { statusCode: 502 });
  }
  const verified = groups[0].value;
  const spam = groups[1].status === "fulfilled" ? groups[1].value : [];
  return verified.concat(spam);
}

function authorized(header, password) {
  if (!header || !header.toLowerCase().startsWith("basic ")) return false;
  const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
  const supplied = decoded.includes(":") ? decoded.split(":").slice(1).join(":") : decoded;
  return supplied === password;
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify(body)
  };
}
