import {createHash,timingSafeEqual} from 'node:crypto';
import {validateReport} from '../lib/dashboard-data.mjs';
import {dashboardStore,json} from '../lib/dashboard-store.mjs';
import config from '../lib/report-connection.json' with {type:'json'};

export default async function ingest(req) {
  if (req.method !== 'POST') return json(405,{message:'POST required.'});
  const match = /^Bearer ([a-zA-Z0-9-]{64,100})$/.exec(req.headers.get('authorization') || '');
  const fingerprint = process.env.CCW_REPORT_KEY_SHA256 || config.fingerprint;
  if (!match || !/^[0-9a-f]{64}$/.test(fingerprint) ||
      !timingSafeEqual(createHash('sha256').update(match[1]).digest(),Buffer.from(fingerprint,'hex')))
    return json(401,{message:'Reporting credential required.'});
  if (new URL(req.url).origin !== 'https://tcclubworks.io') return json(403,{message:'Production endpoint required.'});
  try {
    const raw = await req.text();
    if (raw.length > 12000) return json(413,{message:'Payload too large.'});
    let report;
    try {report = validateReport(JSON.parse(raw));} catch {return json(400,{message:'Invalid report.'});}
    if (!report) return json(400,{message:'Invalid report.'});
    const store = dashboardStore();
    const prior = await store.getWithMetadata('report',{type:'json'});
    if (prior?.data.asOf >= report.asOf) return json(200,{ok:true});
    const write = await store.setJSON('report',report,prior ? {onlyIfMatch:prior.etag} : {onlyIfNew:true});
    return write.modified ? json(200,{ok:true}) : json(409,{message:'A newer sync is in progress.'});
  } catch {return json(503,{message:'Storage unavailable.'});}
}
