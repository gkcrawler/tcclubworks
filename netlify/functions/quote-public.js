const { getStore } = require("@netlify/blobs");

exports.handler = async function(event) {
  try {
    if (event.httpMethod === "GET") {
      const token = (event.queryStringParameters || {}).token || "";
      return json(200, { quote: publicQuote(await quoteByToken(token)) });
    }

    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body || "{}");
      const quote = await quoteByToken(body.token || "");
      quote.status = "Approved";
      quote.approvedAt = new Date().toISOString();
      quote.approvedBy = body.name || quote.customerName || "";
      quote.updatedAt = quote.approvedAt;
      const store = quoteStore();
      await store.setJSON(`quotes/${quote.id}.json`, quote);
      return json(200, { quote: publicQuote(quote) });
    }

    return json(405, { message: "Method not allowed" });
  } catch (err) {
    return json(err.statusCode || 500, { message: err.message || "Quote request failed." });
  }
};

async function quoteByToken(token) {
  if (!token) throw Object.assign(new Error("Missing quote token."), { statusCode: 400 });
  const store = quoteStore();
  const pointer = await store.get(`tokens/${token}.json`, { type: "json", consistency: "strong" });
  if (!pointer) throw Object.assign(new Error("Quote not found."), { statusCode: 404 });
  const quote = await store.get(`quotes/${pointer.quoteId}.json`, { type: "json", consistency: "strong" });
  if (!quote) throw Object.assign(new Error("Quote not found."), { statusCode: 404 });
  return quote;
}

function quoteStore() {
  const siteID = process.env.NETLIFY_SITE_ID || process.env.SITE_ID;
  const token = process.env.NETLIFY_BLOBS_TOKEN || process.env.NETLIFY_AUTH_TOKEN || process.env.NETLIFY_API_TOKEN;
  const options = { name: "ccw-quotes", consistency: "strong" };
  if (siteID && token) {
    options.siteID = siteID;
    options.token = token;
  }
  return getStore(options);
}

function publicQuote(quote) {
  const { approvalToken, ...safe } = quote;
  return safe;
}

function json(statusCode, body) {
  return { statusCode, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }, body: JSON.stringify(body) };
}
