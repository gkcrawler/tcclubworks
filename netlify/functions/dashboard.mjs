import {getStore} from '@netlify/blobs';
import auth from '../lib/shop-auth.cjs';
import data from '../lib/shop-data.cjs';
import {readSources} from './shop.mjs';
import {dateWindow,websiteLeads} from '../lib/dashboard-data.mjs';
import {dashboardStore,json,retailState,changeRetail,startBuild} from '../lib/dashboard-store.mjs';

export default async function dashboard(req) {
  if (!auth.validSession(req.headers.get('Cookie') || '')) return json(401,{message:'Sign in to your dashboard.'});
  const url = new URL(req.url);
  const production = url.origin === 'https://tcclubworks.io';
  try {
    if (req.method === 'POST') {
      if (!production || req.headers.get('origin') !== url.origin) return json(403,{message:'Use the dashboard on tcclubworks.io to publish.'});
      if (!req.headers.get('content-type')?.startsWith('application/json')) return json(415,{message:'JSON required.'});
      const raw = await req.text();
      if (raw.length > 1000) return json(413,{message:'Request too large.'});
      let input;
      try { input = JSON.parse(raw); } catch { return json(400,{message:'Invalid request.'}); }
      if (!input || input.action !== 'retail') return json(400,{message:'Unknown action.'});
      return await changeRetail(dashboardStore(),input,startBuild);
    }
    if (req.method !== 'GET') return json(405,{message:'Method unavailable.'});
    const section = url.searchParams.get('section');
    if (section === 'session') return json(200,{production,range:dateWindow()});
    const store = dashboardStore();
    if (section === 'retail') return json(200,await retailState(store));
    if (section === 'report') return json(200,{report:await store.get('report',{type:'json'})});
    if (section === 'leads') {
      const board = getStore({name:process.env.SHOP_STORE_NAME || 'ccw-shop-v1',consistency:'strong'});
      const [sources,state] = await Promise.all([readSources(),board.get('board',{type:'json'})]);
      return json(200,websiteLeads(sources,state || data.emptyState()));
    }
    return json(400,{message:'Choose a dashboard section.'});
  } catch { return json(503,{message:'This connection is unavailable. Refresh to try again.'}); }
}
