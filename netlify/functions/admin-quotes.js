const { randomBytes } = require("crypto");
const { getStore } = require("@netlify/blobs");

exports.handler = async function(event) {
  if (!authorized(event.headers.authorization || "")) return json(401, { message: "Unauthorized" });

  try {
    if (event.httpMethod === "GET") {
      const id = (event.queryStringParameters || {}).id;
      if (id) return json(200, { quote: await getQuote(id) });
      return json(200, { quotes: await listQuotes() });
    }

    if (event.httpMethod !== "POST") return json(405, { message: "Method not allowed" });
    const body = JSON.parse(event.body || "{}");
    if (body.action !== "save") return json(400, { message: "Unknown quote action." });
    return json(200, { quote: await saveQuote(body.quote || {}) });
  } catch (err) {
    return json(err.statusCode || 500, { message: err.message || "Quote request failed." });
  }
};

function quoteStore() {
  return getStore({ name: "ccw-quotes", consistency: "strong" });
}

async function getQuote(id) {
  const store = quoteStore();
  const quote = await store.get(`quotes/${cleanId(id)}.json`, { type: "json", consistency: "strong" });
  if (!quote) throw Object.assign(new Error("Quote not found."), { statusCode: 404 });
  return quote;
}

async function listQuotes() {
  const store = quoteStore();
  const { blobs } = await store.list({ prefix: "quotes/" });
  const quotes = [];
  for (const blob of blobs) {
    const quote = await store.get(blob.key, { type: "json", consistency: "strong" });
    if (quote) {
      quotes.push({
        id: quote.id,
        quoteNumber: quote.quoteNumber,
        customerName: quote.customerName,
        customerEmail: quote.customerEmail,
        status: quote.status,
        total: quote.total,
        updatedAt: quote.updatedAt
      });
    }
  }
  return quotes.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
}

async function saveQuote(input) {
  const now = new Date().toISOString();
  const quote = {
    ...input,
    id: cleanId(input.id) || randomId("quote"),
    approvalToken: input.approvalToken || randomId("approve"),
    status: input.status || "Draft",
    createdAt: input.createdAt || now,
    updatedAt: now
  };

  const store = quoteStore();
  await store.setJSON(`quotes/${quote.id}.json`, quote);
  await store.setJSON(`tokens/${quote.approvalToken}.json`, { quoteId: quote.id });
  return quote;
}

function authorized(header) {
  const password = process.env.QUOTE_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD;
  if (!password || !header.toLowerCase().startsWith("basic ")) return false;
  const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
  const supplied = decoded.includes(":") ? decoded.split(":").slice(1).join(":") : decoded;
  return supplied === password;
}

function cleanId(id) {
  return String(id || "").replace(/[^a-zA-Z0-9_-]/g, "");
}

function randomId(prefix) {
  return `${prefix}_${Date.now()}_${randomBytes(6).toString("hex")}`;
}

function json(statusCode, body) {
  return { statusCode, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }, body: JSON.stringify(body) };
}
