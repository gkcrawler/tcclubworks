import shopData from './shop-data.cjs';

const dayFormatter = new Intl.DateTimeFormat('en-CA', {timeZone:'America/Denver',year:'numeric',month:'2-digit',day:'2-digit'});
export function dateWindow(now = new Date()) {
  const end = dayFormatter.format(now);
  const first = new Date(end + 'T12:00:00Z');
  first.setUTCDate(first.getUTCDate() - 29);
  return {start:first.toISOString().slice(0,10), end};
}

// Verified production checks explicitly labeled as tests in the CCW shop board.
const testIds = new Set(['6b03503599cea071273d216f','6ae0ea72058a96d27dbbc7cc']);
export function websiteLeads(sources, state, now = new Date()) {
  const {start, end} = dateWindow(now);
  const jobs = shopData.derive(sources, state);
  const bySource = new Map();
  for (const job of jobs) {
    bySource.set(job.id, job);
    for (const id of job.linkedSources) bySource.set(id, job);
  }
  const inquiries = [];
  for (const item of sources.inquiries) {
    if (testIds.has(item.id) || !Number.isFinite(Date.parse(item.createdAt))) continue;
    const day = dayFormatter.format(new Date(item.createdAt));
    if (day < start || day > end || Date.parse(item.createdAt) > now.getTime()) continue;
    const job = bySource.get('inquiry:' + item.id);
    if (!job) continue;
    inquiries.push({day, received:item.createdAt, id:job.id, name:item.customer || 'Website inquiry',
      service:item.type || 'General inquiry', stage:job.stage, open:!job.archived && job.stage !== 'complete'});
  }
  return {total:inquiries.length, open:inquiries.filter(i=>i.open).sort((a,b)=>b.received.localeCompare(a.received))};
}

export function validateReport(value, now = new Date()) {
  const count = n => Number.isSafeInteger(n) && n >= 0;
  const window = dateWindow(new Date(value?.asOf || 0));
  const asOf = Date.parse(value?.asOf);
  const dateCode = s => s.replaceAll('-','');
  if (value?.property !== 'properties/550152616' || !Number.isFinite(asOf) ||
      asOf < now.getTime()-86400000 || asOf > now.getTime()+300000 ||
      value.start !== window.start || value.end !== window.end ||
      !Array.isArray(value.traffic) || value.traffic.length !== 2 || !value.traffic.every(count)) return null;
  const contact = {};
  for (const name of ['click_to_call','click_to_text','click_to_email']) {
    if (!count(value.clicks?.[name])) return null;
    contact[name] = value.clicks[name];
  }
  const ads = value.ads;
  if (ads !== null && (!Array.isArray(ads) || ads.length !== 3 || !count(ads[0]) ||
      !Number.isFinite(ads[1]) || ads[1] < 0 || !count(ads[2]))) return null;
  if (!Array.isArray(value.daily) || value.daily.length > 30) return null;
  const dates = new Set();
  for (const pair of value.daily) {
    if (!Array.isArray(pair) || pair.length !== 2) return null;
    const [date, sessions] = pair;
    if (typeof date !== 'string' || !/^\d{8}$/.test(date) || dates.has(date) ||
        date < dateCode(window.start) || date > dateCode(window.end) || !count(sessions)) return null;
    dates.add(date);
  }
  return {...window, asOf:value.asOf, traffic:value.traffic, clicks:contact, ads, daily:value.daily};
}
