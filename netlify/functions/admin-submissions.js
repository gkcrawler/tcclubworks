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

  const url = `https://api.netlify.com/api/v1/sites/${encodeURIComponent(siteId)}/submissions?per_page=100`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) {
    const body = await res.text();
    return json(res.status, {
      message: `Netlify submissions request failed: ${res.status} ${body.slice(0, 180)}`
    });
  }

  const rows = await res.json();
  const submissions = rows
    .filter((row) => (row.data || {})["form-name"] === "quote" || row.name === "quote")
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
