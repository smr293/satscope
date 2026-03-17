const PROXY_URL = 'https://api.allorigins.win/raw?url=';

const fetchWithTimeout = async (url, timeout = 8000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res;
  } catch (e) {
    clearTimeout(id);
    throw e;
  }
};

export const fetchJSON = async (url, { useProxy = false, timeout = 8000 } = {}) => {
  const target = useProxy ? `${PROXY_URL}${encodeURIComponent(url)}` : url;
  try {
    const res = await fetchWithTimeout(target, timeout);
    const text = await res.text();
    try { return JSON.parse(text); } catch {
      const num = Number(text.trim());
      if (!isNaN(num)) return num;
      throw new Error('Invalid response');
    }
  } catch (e) {
    if (!useProxy) {
      try {
        const proxyRes = await fetchWithTimeout(`${PROXY_URL}${encodeURIComponent(url)}`, timeout);
        const text = await proxyRes.text();
        try { return JSON.parse(text); } catch {
          const num = Number(text.trim());
          if (!isNaN(num)) return num;
          throw new Error('Invalid response');
        }
      } catch { /* fall through */ }
    }
    throw e;
  }
};

export const fetchWithRetry = async (url, options = {}, retries = 2, delay = 3000) => {
  for (let i = 0; i <= retries; i++) {
    try { return await fetchJSON(url, options); }
    catch (e) { if (i === retries) throw e; await new Promise(r => setTimeout(r, delay)); }
  }
};

export const getCached = (key, ttl) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.ts > ttl) return null;
    return parsed.data;
  } catch { return null; }
};

export const setCache = (key, data) => {
  try { localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() })); }
  catch { /* full */ }
};

// ── Binance klines helper ──
// Returns array of { ts, date, price (close) } sorted chronologically
export const fetchBinanceHistory = async (startMs, limit = 1000) => {
  const url = `https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=${limit}` +
    (startMs ? `&startTime=${startMs}` : '');
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Binance HTTP ${res.status}`);
  const klines = await res.json();
  return klines.map(k => ({
    ts: k[0],
    date: new Date(k[0]),
    price: parseFloat(k[4]), // close price
  }));
};

// Fetch full BTC history from Binance (2 calls covers 2000+ days)
export const fetchFullBinanceHistory = async () => {
  const JAN_2020 = 1577836800000; // 2020-01-01 in ms

  // Two parallel fetches: 2020-01-01 → 2022-09-26, then latest 1000 days
  const [older, newer] = await Promise.all([
    fetchBinanceHistory(JAN_2020, 1000),
    fetchBinanceHistory(null, 1000),
  ]);

  // Merge and deduplicate by timestamp
  const map = new Map();
  older.forEach(d => map.set(d.ts, d));
  newer.forEach(d => map.set(d.ts, d));

  const merged = Array.from(map.values()).sort((a, b) => a.ts - b.ts);
  return merged;
};

// API endpoints
export const API = {
  price: 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true',
  marketData: 'https://api.coingecko.com/api/v3/coins/bitcoin?localization=false&tickers=false&community_data=false&developer_data=false',
  fearGreed: 'https://api.alternative.me/fng/?limit=1',
  mempoolHashrate: 'https://mempool.space/api/v1/mining/hashrate/3d',
  mempoolDifficulty: 'https://mempool.space/api/v1/difficulty-adjustment',
  mempoolMempool: 'https://mempool.space/api/mempool',
  mempoolBlockHeight: 'https://mempool.space/api/blocks/tip/height',
  newsFeed: 'https://api.allorigins.win/raw?url=' + encodeURIComponent('https://news.bitcoin.com/feed/'),
};
