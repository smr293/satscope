import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DIST = join(__dirname, 'dist');
const DATA_FILE = join(__dirname, 'analytics-data.json');
const PORT = process.env.PORT || 3000;
const ANALYTICS_KEY = process.env.ANALYTICS_KEY || 'satoshi';

// ── Analytics in-memory store ──────────────────────────────────
let analytics = { pageviews: [], visitors: new Set(), daily: {} };

function loadAnalytics() {
  try {
    if (existsSync(DATA_FILE)) {
      const raw = JSON.parse(readFileSync(DATA_FILE, 'utf-8'));
      analytics.pageviews = raw.pageviews || [];
      analytics.visitors = new Set(raw.visitors || []);
      analytics.daily = raw.daily || {};
    }
  } catch { /* start fresh */ }
}

function saveAnalytics() {
  try {
    writeFileSync(DATA_FILE, JSON.stringify({
      pageviews: analytics.pageviews.slice(-50000), // keep last 50k events
      visitors: [...analytics.visitors],
      daily: analytics.daily,
    }));
  } catch (e) { console.warn('Analytics save failed:', e.message); }
}

loadAnalytics();
// Persist every 60s
setInterval(saveAnalytics, 60000);

function hashIP(ip) {
  return createHash('sha256').update(ip + 'satoshikuza-salt').digest('hex').slice(0, 16);
}

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.headers['x-real-ip']
    || req.socket.remoteAddress
    || 'unknown';
}

function trackPageview(req, body) {
  const ip = getClientIP(req);
  const vid = hashIP(ip);
  const ua = req.headers['user-agent'] || '';
  const today = getToday();
  const now = Date.now();

  // Parse device
  const isMobile = /Mobile|Android|iPhone|iPad/i.test(ua);
  const device = isMobile ? 'mobile' : 'desktop';
  let browser = 'other';
  if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) browser = 'chrome';
  else if (/Firefox/i.test(ua)) browser = 'firefox';
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = 'safari';
  else if (/Edg/i.test(ua)) browser = 'edge';

  const event = {
    t: now,
    vid,
    path: body.path || '/',
    ref: body.ref || '',
    device,
    browser,
    lang: body.lang || '',
    screen: body.screen || '',
    country: '', // would need GeoIP service
  };

  analytics.pageviews.push(event);
  analytics.visitors.add(vid);

  // Daily aggregation
  if (!analytics.daily[today]) {
    analytics.daily[today] = { views: 0, uniques: new Set(), devices: {}, browsers: {}, refs: {}, paths: {} };
  }
  const day = analytics.daily[today];
  day.views++;
  if (day.uniques instanceof Set) {
    day.uniques.add(vid);
  } else {
    day.uniques = new Set([...(day.uniques || []), vid]);
  }
  day.devices[device] = (day.devices[device] || 0) + 1;
  day.browsers[browser] = (day.browsers[browser] || 0) + 1;
  if (event.ref) day.refs[event.ref] = (day.refs[event.ref] || 0) + 1;
  day.paths[event.path] = (day.paths[event.path] || 0) + 1;
}

function getAnalyticsData(days = 30) {
  const now = new Date();
  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const day = analytics.daily[key];
    if (day) {
      const uniqueCount = day.uniques instanceof Set ? day.uniques.size : (day.uniques?.length || 0);
      result.push({
        date: key,
        views: day.views,
        uniques: uniqueCount,
        devices: day.devices,
        browsers: day.browsers,
        refs: day.refs || {},
        paths: day.paths || {},
      });
    } else {
      result.push({ date: key, views: 0, uniques: 0, devices: {}, browsers: {}, refs: {}, paths: {} });
    }
  }

  // Recent pageviews (last 50)
  const recent = analytics.pageviews.slice(-50).reverse();

  // Live visitors (last 5 min)
  const fiveMin = Date.now() - 5 * 60 * 1000;
  const liveSet = new Set(analytics.pageviews.filter(p => p.t > fiveMin).map(p => p.vid));

  return {
    totalViews: analytics.pageviews.length,
    totalUniques: analytics.visitors.size,
    liveVisitors: liveSet.size,
    days: result,
    recent,
  };
}

// Fix daily.uniques serialization (Set → Array for JSON, Array → Set on load)
function fixDailySets() {
  for (const key of Object.keys(analytics.daily)) {
    const day = analytics.daily[key];
    if (day.uniques && !(day.uniques instanceof Set)) {
      day.uniques = new Set(day.uniques);
    }
  }
}
fixDailySets();

// Override JSON serialization for daily uniques (Set → Array)
const origSave = saveAnalytics;

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', c => { data += c; if (data.length > 10000) req.destroy(); });
    req.on('end', () => {
      try { resolve(JSON.parse(data)); } catch { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
}

// ── MIME types ─────────────────────────────────────────────────
const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
};

// ── Custom serializer for Sets in daily data ──────────────────
function serializeAnalytics() {
  const dailyCopy = {};
  for (const [key, day] of Object.entries(analytics.daily)) {
    dailyCopy[key] = {
      ...day,
      uniques: day.uniques instanceof Set ? [...day.uniques] : (day.uniques || []),
    };
  }
  return JSON.stringify({
    pageviews: analytics.pageviews.slice(-50000),
    visitors: [...analytics.visitors],
    daily: dailyCopy,
  });
}

// Override save to use custom serializer
function saveAnalyticsFixed() {
  try {
    writeFileSync(DATA_FILE, serializeAnalytics());
  } catch (e) { console.warn('Analytics save failed:', e.message); }
}

// ── HTTP Server ────────────────────────────────────────────────
const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  // CORS for API
  if (pathname.startsWith('/api/')) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  }

  // ── Track endpoint (public) ──
  if (pathname === '/api/track' && req.method === 'POST') {
    const body = await readBody(req);
    trackPageview(req, body);
    res.writeHead(204);
    return res.end();
  }

  // ── Analytics data endpoint (protected) ──
  if (pathname === '/api/analytics') {
    const key = url.searchParams.get('key');
    if (key !== ANALYTICS_KEY) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'unauthorized' }));
    }
    const days = parseInt(url.searchParams.get('days') || '30', 10);
    const data = getAnalyticsData(Math.min(days, 90));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(data));
  }

  // ── Analytics dashboard page (protected) ──
  if (pathname === '/analytics') {
    const key = url.searchParams.get('key');
    if (key !== ANALYTICS_KEY) {
      res.writeHead(401, { 'Content-Type': 'text/html' });
      return res.end('<html><body style="background:#0d0d1a;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif"><h1>401 — Access Denied</h1></body></html>');
    }
    try {
      const html = readFileSync(join(__dirname, 'analytics.html'), 'utf-8');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end(html);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Analytics page not found');
    }
  }

  // ── Static files ──
  let filePath = join(DIST, pathname === '/' ? 'index.html' : pathname);

  if (!existsSync(filePath)) {
    filePath = join(DIST, 'index.html');
  }

  try {
    const data = readFileSync(filePath);
    const ext = extname(filePath);
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000',
    });
    res.end(data);
  } catch {
    const html = readFileSync(join(DIST, 'index.html'));
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  }
});

// Save on shutdown
process.on('SIGTERM', () => { saveAnalyticsFixed(); process.exit(0); });
process.on('SIGINT', () => { saveAnalyticsFixed(); process.exit(0); });

// Periodic save
setInterval(saveAnalyticsFixed, 60000);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`SatoshiKuza running on port ${PORT}`);
});
