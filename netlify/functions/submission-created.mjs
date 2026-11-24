import { getStore } from '@netlify/blobs';
import { acknowledge } from '../lib/lead-reply.mjs';

// Netlify verifies the event signature before invoking this reserved function name.
export default async function submissionCreated(request, context) {
  if (request.method !== 'POST' || context.deploy?.context !== 'production') return new Response(null, { status: 204 });
  const { payload } = await request.json();
  await acknowledge(payload, {
    env: process.env,
    getLedger: () => getStore({ name: 'ccw-lead-replies', consistency: 'strong' }),
    getBoard: () => getStore({ name: process.env.SHOP_STORE_NAME || 'ccw-shop-v1', consistency: 'strong' }).get('board', { type: 'json' }),
  });
  return new Response(null, { status: 204 });
}
