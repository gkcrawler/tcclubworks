import {getStore} from '@netlify/blobs';
import built from './retail-build.json' with {type:'json'};

export const dashboardStore = () => getStore({name:'ccw-dashboard',consistency:'strong'});
export const json = (status, body) => Response.json(body, {status, headers:{
  'Cache-Control':'private, no-store', 'Netlify-CDN-Cache-Control':'no-store',
  'Vary':'Cookie', 'X-Content-Type-Options':'nosniff', 'X-Robots-Tag':'noindex, nofollow'
}});

export async function retailState(store) {
  const entry = await store.getWithMetadata('retail', {type:'json'});
  return {active:built.visible, desired:entry?.data.visible ?? built.visible, revision:entry?.etag || 'new',
    requested:entry?.data.at || null, failed:entry?.data.failed === true};
}

export async function changeRetail(store, input, startBuild, now = new Date()) {
  const current = await retailState(store);
  if (typeof input.visible !== 'boolean') return json(400,{message:'Choose public or private.'});
  if (input.revision !== current.revision) return json(409,{message:'Visibility changed in another window. Refresh to see it.'});
  const retry = input.visible === current.desired && current.desired !== current.active;
  if (retry && !current.failed && now - Date.parse(current.requested) < 120000)
    return json(409,{message:'The site is publishing this change.'});
  if (!retry && input.visible === current.active && input.visible === current.desired) return json(200,current);
  const next = {visible:input.visible, at:now.toISOString(), failed:false};
  const write = await store.setJSON('retail',next,current.revision === 'new' ? {onlyIfNew:true} : {onlyIfMatch:current.revision});
  if (!write.modified) return json(409,{message:'Another window changed visibility. Refresh to see it.'});
  try {
    await startBuild();
  } catch {
    await store.setJSON('retail',{...next,failed:true},{onlyIfMatch:write.etag});
    return json(502,{message:'The publish request could not be confirmed. Refresh to check the live state and retry.'});
  }
  return json(202,await retailState(store));
}

export async function startBuild() {
  const site = process.env.NETLIFY_SITE_ID || process.env.SITE_ID;
  const token = process.env.NETLIFY_API_TOKEN || process.env.NETLIFY_AUTH_TOKEN;
  if (!site || !token) throw new Error('Missing Netlify build connection');
  const response = await fetch('https://api.netlify.com/api/v1/sites/'+encodeURIComponent(site)+'/builds',
    {method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
      body:'{}',signal:AbortSignal.timeout(12000)});
  if (!response.ok) throw new Error('Netlify build failed');
}
