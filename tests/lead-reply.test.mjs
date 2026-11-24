import assert from 'node:assert/strict';
import test from 'node:test';
import { acknowledge, alreadyHandled } from '../netlify/lib/lead-reply.mjs';
import submissionCreated from '../netlify/functions/submission-created.mjs';

const instant = Date.parse('2026-06-10T12:00:00Z');
const inquiry = { id: 'form-1', form_name: 'quote', created_at: new Date(instant).toISOString(), data: { name: 'José Example', email: 'lead@example.com', message: 'private form contents' } };
function setup() {
  const records = new Map();
  const sent = [];
  const ledger = {
    async get(key) { return records.get(key) || null; },
    async setJSON(key, value, options) {
      if (options?.onlyIfNew && records.has(key)) return { modified: false };
      records.set(key, value);
      return { modified: true };
    },
  };
  return { records, sent, env: { CCW_LEAD_REPLY_LIVE_FROM: inquiry.created_at, CCW_RESEND_API_KEY: 'test-placeholder' },
    now: () => instant, getBoard: async () => null, getLedger: () => ledger,
    send: async (message, key) => { sent.push({ message, key }); return 'mail-1'; } };
}

test('uses the submitted address, customer first name, approved copy, CCs and inline signature', async () => {
  const deps = setup();
  assert.equal(await acknowledge(inquiry, deps), 'sent');
  const { message, key } = deps.sent[0];
  assert.equal(key, 'ccw-lead/form-1');
  assert.deepEqual(message.to, ['lead@example.com']);
  assert.deepEqual(message.cc, ['info@tcclubworks.io', 'brian@tcclubworks.io']);
  assert.equal(message.from, 'Paul Cohn <paul@tcclubworks.io>');
  assert.equal(message.reply_to, 'paul@tcclubworks.io');
  assert.equal(message.subject, 'Thanks for reaching out to Chronic Clubworks');
  assert.ok(message.text.startsWith('Hi José,\n\nThanks for reaching out to Chronic Clubworks. We’ve received your request and are reviewing the details. I’ll follow up with you about next steps. If you have photos or anything else you’d like me to see, just reply to this email or shoot me a text.'));
  assert.ok(!JSON.stringify(message).includes('private form contents'));
  assert.match(message.html, /href="https:\/\/tcclubworks\.io"><img src="cid:ccw-logo"/);
  assert.ok(message.html.includes('Owner | Master Clubmaker'));
  assert.ok(message.html.includes('tel:+17208544132'));
  assert.ok(message.attachments[0].content.startsWith('iVBOR'));
  assert.equal(message.attachments[0].content_id, 'ccw-logo');
  assert.equal(await acknowledge(inquiry, deps), 'already sent');
  assert.equal(deps.sent.length, 1);
});

test('test mode only accepts new submissions from its configured test address', async () => {
  const d = setup();
  delete d.env.CCW_LEAD_REPLY_LIVE_FROM;
  assert.equal(await acknowledge(inquiry, d), 'off');
  d.env.CCW_LEAD_TEST_TO = 'another@example.com';
  assert.equal(await acknowledge(inquiry, d), 'off');
  d.env.CCW_LEAD_TEST_TO = 'LEAD@example.com';
  assert.equal(await acknowledge({ ...inquiry, created_at: '2020-01-01T00:00:00Z' }, d), 'off');
  assert.equal(await acknowledge(inquiry, d), 'sent');
});

test('skips past submissions, non-lead forms, invalid recipients and handled inquiries', async () => {
  const d = setup();
  assert.equal(await acknowledge({ ...inquiry, created_at: '2020-01-01T00:00:00Z' }, d), 'before activation');
  assert.equal(await acknowledge({ ...inquiry, form_name: 'saved_quote', data: { ...inquiry.data, 'form-name': 'quote' } }, d), 'ignored');
  for (const email of ['a@example.com,b@example.com', 'a@example.com\r\nCc:b@example.com', 'Name <a@example.com>', '']) {
    assert.equal(await acknowledge({ ...inquiry, data: { email } }, d), 'invalid email');
  }
  for (const attrs of [{ archived: true }, { stage: 'quoted' }, { checks: [true] }]) {
    assert.ok(alreadyHandled({ jobs: { 'inquiry:form-1': attrs } }, inquiry.id));
  }
  d.getBoard = async () => ({ links: { 'inquiry:form-1': 'quote:abc' } });
  assert.equal(await acknowledge(inquiry, d), 'already handled');
  assert.equal(d.sent.length, 0);
});

test('uses the same provider key for overlapping events and ambiguous failures', async () => {
  const d = setup(), keys = new Set();
  d.send = async (_message, key) => { keys.add(key); return 'provider-id'; };
  await Promise.all([acknowledge(inquiry, d), acknowledge(inquiry, d)]);
  assert.deepEqual([...keys], ['ccw-lead/form-1']);
  d.records.clear();
  d.send = async () => { throw new Error('network interruption'); };
  await assert.rejects(acknowledge(inquiry, d), /network interruption/);
  assert.equal(d.records.get(inquiry.id).firstAttempt, instant);
  d.now = () => instant + 25 * 60 * 60 * 1000;
  await assert.rejects(acknowledge(inquiry, d), /needs review/);
});

test('ignores previews and safely handles an unusable first name', async () => {
  const req = new Request('https://example.com/', { method: 'POST', body: 'not a payload' });
  assert.equal((await submissionCreated(req, { deploy: { context: 'deploy-preview' } })).status, 204);
  const d = setup();
  await acknowledge({ ...inquiry, data: { ...inquiry.data, name: '<script>' } }, d);
  assert.ok(d.sent[0].message.html.startsWith('<p>Hi there,</p>'));
});
