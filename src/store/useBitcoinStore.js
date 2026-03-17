import { create } from 'zustand';
import { fetchJSON, fetchWithRetry, getCached, setCache, API, fetchFullBinanceHistory } from '../utils/api';

// =====================================================
// SHARED PRICE HISTORY — Binance (no rate limit!)
// Single fetch → 2000+ days → serves ALL components
// =====================================================
let _history = null;
let _listeners = [];
let _started = false;

export const getHistory = () => _history;

export const onHistoryReady = (fn) => {
  if (_history) { fn(_history); return () => {}; }
  _listeners.push(fn);
  return () => { _listeners = _listeners.filter(f => f !== fn); };
};

export const startHistoryFetch = () => {
  if (_started) return;
  _started = true;

  (async () => {
    // 1. Check cache first (instant)
    const cached = getCached('btc_binance_history', 30 * 60 * 1000);
    if (cached?.length > 1000) {
      _history = cached;
      _listeners.forEach(fn => fn(_history));
      _listeners = [];
      return;
    }

    // 2. Fetch from Binance (2 parallel calls, ~1-2 seconds)
    try {
      const data = await fetchFullBinanceHistory();
      if (data.length > 1000) {
        setCache('btc_binance_history', data);
        _history = data;
        _listeners.forEach(fn => fn(_history));
        _listeners = [];
        return;
      }
    } catch (e) {
      console.warn('Binance history failed:', e.message);
    }

    // 3. Stale cache fallback
    const stale = getCached('btc_binance_history', Infinity);
    if (stale?.length > 0) {
      _history = stale;
      _listeners.forEach(fn => fn(_history));
      _listeners = [];
      return;
    }

    // 4. Nothing — notify with null
    _listeners.forEach(fn => fn(null));
    _listeners = [];
  })();
};

// =====================================================
// ZUSTAND STORE
// =====================================================
const useBitcoinStore = create((set, get) => ({
  price: null, priceChange24h: null, marketCap: null, volume24h: null,
  lastPriceUpdate: null, pulseKey: 0,
  circulatingSupply: null, totalSupply: 21000000, athPrice: null, athDate: null,
  blockHeight: null, halvingProgress: null, blocksUntilHalving: null, estimatedHalvingDate: null,
  fearGreedValue: null, fearGreedLabel: null,
  priceHistory: null,   // for PriceChart (last 365 entries from Binance)
  hashrate: null, difficulty: null, difficultyChange: null,
  difficultyProgress: null, unconfirmedTx: null, mempoolSize: null,
  news: null,
  loading: { price: true, market: true, halving: true, fearGreed: true,
             priceHistory: true, network: true, news: true },
  errors: {},
  setLoading: (k, v) => set(s => ({ loading: { ...s.loading, [k]: v } })),
  setError:   (k, e) => set(s => ({ errors:  { ...s.errors,  [k]: e  } })),

  fetchPrice: async () => {
    try {
      const c = getCached('btc_price', 5 * 60 * 1000);
      if (c?.bitcoin) {
        set({ price: c.bitcoin.usd, priceChange24h: c.bitcoin.usd_24h_change,
              marketCap: c.bitcoin.usd_market_cap, volume24h: c.bitcoin.usd_24h_vol,
              lastPriceUpdate: Date.now() });
        get().setLoading('price', false); return;
      }
      const d = await fetchJSON(API.price);
      if (d?.bitcoin) {
        setCache('btc_price', d);
        set({ price: d.bitcoin.usd, priceChange24h: d.bitcoin.usd_24h_change,
              marketCap: d.bitcoin.usd_market_cap, volume24h: d.bitcoin.usd_24h_vol,
              lastPriceUpdate: Date.now(), pulseKey: get().pulseKey + 1 });
      }
    } catch {
      const fb = getCached('btc_price', Infinity);
      if (fb?.bitcoin) set({ price: fb.bitcoin.usd, priceChange24h: fb.bitcoin.usd_24h_change,
                              marketCap: fb.bitcoin.usd_market_cap, volume24h: fb.bitcoin.usd_24h_vol });
    }
    get().setLoading('price', false);
  },

  fetchMarketData: async () => {
    try {
      const c = getCached('btc_market', 10 * 60 * 1000);
      if (c) {
        set({ circulatingSupply: c.market_data?.circulating_supply,
              athPrice: c.market_data?.ath?.usd, athDate: c.market_data?.ath_date?.usd });
        get().setLoading('market', false); return;
      }
      const d = await fetchJSON(API.marketData);
      if (d?.market_data) {
        setCache('btc_market', d);
        set({ circulatingSupply: d.market_data?.circulating_supply,
              athPrice: d.market_data?.ath?.usd, athDate: d.market_data?.ath_date?.usd });
      }
    } catch (e) { console.warn('Market:', e.message); }
    get().setLoading('market', false);
  },

  fetchHalving: async () => {
    try {
      const c = getCached('btc_block', 5 * 60 * 1000);
      let bh = c;
      if (!c) {
        const d = await fetchJSON(API.mempoolBlockHeight);
        bh = typeof d === 'number' ? d : parseInt(d);
        if (!isNaN(bh)) setCache('btc_block', bh);
      }
      if (bh && !isNaN(bh)) {
        const ERA = 210000, era = Math.floor(bh / ERA), left = (era + 1) * ERA - bh;
        set({ blockHeight: bh, halvingProgress: ((bh - era * ERA) / ERA) * 100,
              blocksUntilHalving: left,
              estimatedHalvingDate: new Date(Date.now() + left * 10 * 60 * 1000) });
      }
    } catch { const fb = getCached('btc_block', Infinity); if (fb) set({ blockHeight: fb }); }
    get().setLoading('halving', false);
  },

  fetchFearGreed: async () => {
    try {
      const c = getCached('btc_fng', 15 * 60 * 1000);
      if (c) {
        set({ fearGreedValue: parseInt(c.data?.[0]?.value), fearGreedLabel: c.data?.[0]?.value_classification });
        get().setLoading('fearGreed', false); return;
      }
      const d = await fetchWithRetry(API.fearGreed);
      if (d?.data) { setCache('btc_fng', d);
        set({ fearGreedValue: parseInt(d.data[0].value), fearGreedLabel: d.data[0].value_classification }); }
    } catch (e) { console.warn('FearGreed:', e.message); }
    get().setLoading('fearGreed', false);
  },

  // Watch Binance history and set priceHistory for PriceChart
  watchPriceHistory: () =>
    onHistoryReady((h) => {
      if (!h?.length) return;
      const last366 = h.slice(-366);
      set({ priceHistory: { prices: last366.map(d => [d.ts, d.price]) } });
      get().setLoading('priceHistory', false);
    }),

  fetchNetworkStats: async () => {
    try {
      const c = getCached('btc_network', 5 * 60 * 1000);
      if (c) { set(c); get().setLoading('network', false); return; }
      const [hr, diff, mp] = await Promise.allSettled([
        fetchJSON(API.mempoolHashrate), fetchJSON(API.mempoolDifficulty), fetchJSON(API.mempoolMempool)
      ]);
      const s = {
        hashrate:           hr.status === 'fulfilled' ? hr.value?.currentHashrate : null,
        difficulty:         hr.status === 'fulfilled' ? hr.value?.currentDifficulty : null,
        difficultyChange:   diff.status === 'fulfilled' ? diff.value?.difficultyChange : null,
        difficultyProgress: diff.status === 'fulfilled' ? diff.value?.progressPercent : null,
        unconfirmedTx:      mp.status === 'fulfilled' ? mp.value?.count : null,
        mempoolSize:        mp.status === 'fulfilled' ? mp.value?.vsize : null,
      };
      setCache('btc_network', s); set(s);
    } catch (e) { console.warn('Network:', e.message); }
    get().setLoading('network', false);
  },

  fetchNews: async () => {
    try {
      const c = getCached('btc_news', 15 * 60 * 1000);
      if (c) { set({ news: c }); get().setLoading('news', false); return; }
      const res = await fetch(API.newsFeed, { signal: AbortSignal.timeout(10000) });
      const xml = new DOMParser().parseFromString(await res.text(), 'text/xml');
      const articles = Array.from(xml.querySelectorAll('item')).slice(0, 5).map(el => ({
        title: el.querySelector('title')?.textContent || '',
        link:  el.querySelector('link')?.textContent || '#',
        pubDate: el.querySelector('pubDate')?.textContent || '',
        description: (el.querySelector('description')?.textContent || '').replace(/<[^>]+>/g, '').slice(0, 150),
      }));
      setCache('btc_news', articles); set({ news: articles });
    } catch { const fb = getCached('btc_news', Infinity); if (fb) set({ news: fb }); }
    get().setLoading('news', false);
  },

  startAutoUpdate: () => {
    const s = get();

    // Binance history: starts IMMEDIATELY, 2 parallel calls, ~1-2s
    startHistoryFetch();
    const unsubH = s.watchPriceHistory();

    // All other fetches: IMMEDIATE, parallel
    s.fetchPrice();
    s.fetchHalving();
    s.fetchFearGreed();
    s.fetchNetworkStats();
    s.fetchNews();

    // CoinGecko market data: slightly delayed to avoid 429 on price
    setTimeout(() => s.fetchMarketData(), 4000);

    const intervals = [
      setInterval(s.fetchPrice,         30 * 1000),
      setInterval(s.fetchMarketData,    90 * 1000),
      setInterval(s.fetchHalving,        5 * 60 * 1000),
      setInterval(s.fetchFearGreed,     10 * 60 * 1000),
      setInterval(s.fetchNetworkStats,   2 * 60 * 1000),
      setInterval(s.fetchNews,          15 * 60 * 1000),
      // Refresh Binance history every 10 min
      setInterval(() => {
        fetchFullBinanceHistory().then(data => {
          if (data?.length > 1000) {
            setCache('btc_binance_history', data);
            _history = data;
            const last366 = data.slice(-366);
            set({ priceHistory: { prices: last366.map(d => [d.ts, d.price]) } });
          }
        }).catch(() => {});
      }, 10 * 60 * 1000),
    ];

    return () => { unsubH(); intervals.forEach(clearInterval); };
  },
}));

export default useBitcoinStore;
