// Private Apps Script project. Google retains the write-only reporting key.
const PROPERTY = 'properties/550152616';
const DESTINATION = 'https://tcclubworks.io/.netlify/functions/dashboard-report';

function reportingKey() {
  const properties = PropertiesService.getScriptProperties();
  let key = properties.getProperty('REPORT_KEY');
  if (!key) {
    key = Utilities.getUuid() + Utilities.getUuid();
    properties.setProperty('REPORT_KEY', key);
  }
  return key;
}

function runReport(metrics, dimensions, filter, range) {
  const request = {
    dateRanges: [range],
    metrics: metrics.map(name => ({name})),
    dimensions: dimensions.map(name => ({name})),
    currencyCode: 'USD'
  };
  if (filter) request.dimensionFilter = filter;
  return AnalyticsData.Properties.runReport(request, PROPERTY).rows || [];
}

function collectDashboardReport() {
  const day = d => Utilities.formatDate(d, 'America/Denver', 'yyyy-MM-dd');
  const end = day(new Date());
  const start = new Date(end + 'T12:00:00Z');
  start.setUTCDate(start.getUTCDate() - 29);
  const range = {startDate: day(start), endDate: end};
  const site = {andGroup: {expressions: [
    {filter: {fieldName: 'hostName', inListFilter: {values: ['tcclubworks.io','www.tcclubworks.io']}}},
    {notExpression: {filter: {fieldName: 'pagePath', stringFilter: {matchType: 'BEGINS_WITH', value: '/admin'}}}}
  ]}};
  const values = row => row.metricValues.map(m => Number(m.value));
  const total = runReport(['activeUsers','sessions'], [], site, range);
  const daily = runReport(['sessions'], ['date'], site, range);
  const contacts = ['click_to_call','click_to_text','click_to_email'];
  const filter = {andGroup: {expressions: [site, {filter: {fieldName: 'eventName', inListFilter: {values: contacts}}}]}};
  const events = runReport(['eventCount'], ['eventName'], filter, range);
  const clicks = Object.fromEntries(contacts.map(e => [e, 0]));
  events.forEach(row => { clicks[row.dimensionValues[0].value] = values(row)[0]; });
  let ads = null;
  try {
    const rows = runReport(['advertiserAdClicks','advertiserAdCost','advertiserAdImpressions'], ['sessionCampaignName'], null, range);
    if (rows.length) ads = rows.map(values).reduce((a,b) => a.map((v,i) => v+b[i]), [0,0,0]);
  } catch (error) { console.warn('Advertising report unavailable: ' + error.message); }
  return {
    property: PROPERTY, start: range.startDate, end, asOf: new Date().toISOString(),
    traffic: total.length ? values(total[0]) : [0,0], clicks, ads,
    daily: daily.map(row => [row.dimensionValues[0].value, values(row)[0]])
  };
}

function prepareDashboard() {
  const report = collectDashboardReport();
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, reportingKey());
  console.log('Reporting key fingerprint: ' + digest.map(b => (b & 255).toString(16).padStart(2,'0')).join(''));
  console.log(JSON.stringify(report));
}

function syncDashboard() {
  const response = UrlFetchApp.fetch(DESTINATION, {
    method: 'post', contentType: 'application/json', followRedirects: false,
    headers: {Authorization: 'Bearer ' + reportingKey()},
    payload: JSON.stringify(collectDashboardReport()), muteHttpExceptions: true
  });
  if (response.getResponseCode() !== 200) throw new Error('CCW report sync returned ' + response.getResponseCode());
}

function installDashboard() {
  syncDashboard();
  if (!ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'syncDashboard'))
    ScriptApp.newTrigger('syncDashboard').timeBased().everyHours(1).create();
}
