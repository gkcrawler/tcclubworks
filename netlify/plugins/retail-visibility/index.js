module.exports.onPreBuild = async ({netlifyConfig}) => {
  if (process.env.CONTEXT !== 'production') return;
  const {getStore} = await import('@netlify/blobs');
  const store = getStore({name: 'ccw-dashboard', consistency: 'strong'});
  const desired = await store.get('retail', {type: 'json'});
  if (desired === null) return; // First deploy uses the existing shop.toml pause.
  if (typeof desired.visible !== 'boolean') throw new Error('Invalid CCW retail visibility setting.');
  netlifyConfig.build.environment.CCW_RETAIL_VISIBILITY = desired.visible ? 'public' : 'private';
};
