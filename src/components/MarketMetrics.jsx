import { useState, useEffect, useCallback, useRef } from 'react';
import { getCached, setCache } from '../utils/api';

export default function MarketMetrics() {
  const [dominance, setDominance] = useState(null);
  const [funding, setFunding] = useState(null);
  const [loading, setLoading] = useState(true);
  const canvasRef = useRef(null);

  const fetchData = useCallback(async () => {
    try {
      // BTC Dominance from CoinGecko global
      const cached = getCached('market_metrics');
      if (cached) {
        setDominance(cached.dominance);
        setFunding(cached.funding);
        setLoading(false);
      }

      // Fetch in parallel
      const [globalRes, fundingRes] = await Promise.allSettled([
        fetch('https://api.coingecko.com/api/v3/global').then(r => r.ok ? r.json() : null),
        fetch('https://fapi.binance.com/fapi/v1/fundingRate?symbol=BTCUSDT&limit=30').then(r => r.ok ? r.json() : null),
      ]);

      const globalData = globalRes.status === 'fulfilled' ? globalRes.value : null;
      const fundingData = fundingRes.status === 'fulfilled' ? fundingRes.value : null;

      if (globalData?.data) {
        const dom = {
          btc: globalData.data.market_cap_percentage?.btc?.toFixed(1) || '0',
          eth: globalData.data.market_cap_percentage?.eth?.toFixed(1) || '0',
          totalMarketCap: globalData.data.total_market_cap?.usd || 0,
          totalVolume: globalData.data.total_volume?.usd || 0,
          activeCryptos: globalData.data.active_cryptocurrencies || 0,
          marketCapChange: globalData.data.market_cap_change_percentage_24h_usd?.toFixed(2) || '0',
        };
        setDominance(dom);
      }

      if (fundingData && fundingData.length > 0) {
        const latest = fundingData[fundingData.length - 1];
        const rate = parseFloat(latest.fundingRate) * 100;
        const history = fundingData.map(f => parseFloat(f.fundingRate) * 100);
        const avgRate = history.reduce((a, b) => a + b, 0) / history.length;
        setFunding({ rate, history, avgRate, time: latest.fundingTime });
      }

      // Cache
      setCache('market_metrics', {
        dominance: dominance, funding: funding,
      }, 120000);

    } catch (e) {
      console.warn('Market metrics fetch failed:', e);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 120000); // 2 min
    return () => clearInterval(interval);
  }, [fetchData]);

  // Draw funding rate mini chart
  useEffect(() => {
    if (!funding?.history || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = 200 * dpr;
    canvas.height = 60 * dpr;
    canvas.style.width = '200px';
    canvas.style.height = '60px';
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, 200, 60);

    const data = funding.history;
    const max = Math.max(...data.map(Math.abs), 0.02);
    const mid = 30;
    const barW = Math.max(2, (200 / data.length) - 1);

    // Zero line
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.beginPath(); ctx.moveTo(0, mid); ctx.lineTo(200, mid); ctx.stroke();

    data.forEach((val, i) => {
      const x = (i / data.length) * 200;
      const h = (Math.abs(val) / max) * 25;
      const y = val >= 0 ? mid - h : mid;
      ctx.fillStyle = val >= 0 ? 'rgba(22,199,132,0.6)' : 'rgba(239,68,68,0.6)';
      ctx.fillRect(x, y, barW, h);
    });
  }, [funding]);

  if (loading && !dominance) {
    return (
      <div className="glass p-6 mt-6 animate-fade-in">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-xl">📡</div>
          <h2 className="text-white font-bold text-lg">Market Intelligence</h2>
        </div>
        <div className="skeleton w-full rounded-lg" style={{ height: '200px' }} />
      </div>
    );
  }

  return (
    <div className="glass p-6 mt-6 animate-fade-in" style={{ border: '1px solid rgba(6,182,212,0.2)' }}>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
             style={{ background: 'linear-gradient(135deg, #8b5cf6, #ec4899)' }}>📡</div>
        <div>
          <h2 className="text-white font-bold text-lg">Market Intelligence</h2>
          <p className="text-xs text-gray-500 uppercase tracking-widest">Dominance, Funding & Global Metrics</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* BTC Dominance */}
        <div>
          <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <span className="w-1 h-3 rounded bg-orange-500 inline-block" />
            BTC Dominance
          </h3>

          {dominance && (
            <div className="space-y-4">
              {/* Dominance bar */}
              <div>
                <div className="flex justify-between items-baseline mb-2">
                  <span className="text-3xl font-black text-orange-400">{dominance.btc}%</span>
                  <span className="text-xs text-gray-500">ETH: {dominance.eth}%</span>
                </div>
                <div className="h-4 rounded-full overflow-hidden flex" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <div className="h-full rounded-l-full transition-all duration-1000"
                       style={{ width: `${dominance.btc}%`, background: 'linear-gradient(90deg, #f97316, #f59e0b)' }} />
                  <div className="h-full transition-all duration-1000"
                       style={{ width: `${dominance.eth}%`, background: 'linear-gradient(90deg, #627eea, #8b5cf6)' }} />
                  <div className="h-full flex-1 rounded-r-full" style={{ background: 'rgba(255,255,255,0.06)' }} />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] text-orange-400">Bitcoin</span>
                  <span className="text-[10px] text-purple-400">Ethereum</span>
                  <span className="text-[10px] text-gray-600">Others</span>
                </div>
              </div>

              {/* Global stats */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <div className="text-[10px] text-gray-500 uppercase">Total Market Cap</div>
                  <div className="text-sm font-bold text-white">
                    ${dominance.totalMarketCap >= 1e12 ? `${(dominance.totalMarketCap / 1e12).toFixed(2)}T` : `${(dominance.totalMarketCap / 1e9).toFixed(0)}B`}
                  </div>
                  <div className={`text-[10px] ${parseFloat(dominance.marketCapChange) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {parseFloat(dominance.marketCapChange) >= 0 ? '+' : ''}{dominance.marketCapChange}% 24h
                  </div>
                </div>
                <div className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <div className="text-[10px] text-gray-500 uppercase">24h Volume</div>
                  <div className="text-sm font-bold text-white">
                    ${dominance.totalVolume >= 1e12 ? `${(dominance.totalVolume / 1e12).toFixed(2)}T` : `${(dominance.totalVolume / 1e9).toFixed(0)}B`}
                  </div>
                  <div className="text-[10px] text-gray-500">{dominance.activeCryptos?.toLocaleString()} coins</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Funding Rate */}
        <div>
          <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <span className="w-1 h-3 rounded bg-cyan-500 inline-block" />
            BTC Perpetual Funding Rate
          </h3>

          {funding && (
            <div className="space-y-4">
              <div className="flex items-baseline gap-3">
                <span className={`text-3xl font-black ${funding.rate >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {funding.rate >= 0 ? '+' : ''}{funding.rate.toFixed(4)}%
                </span>
                <span className="text-xs text-gray-500">
                  Avg: {funding.avgRate >= 0 ? '+' : ''}{funding.avgRate.toFixed(4)}%
                </span>
              </div>

              <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <canvas ref={canvasRef} />
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] text-gray-600">30 periods ago</span>
                  <span className="text-[10px] text-gray-600">Now</span>
                </div>
              </div>

              <div className="rounded-xl p-3" style={{ background: funding.rate > 0.03 ? 'rgba(239,68,68,0.1)' : funding.rate < -0.01 ? 'rgba(22,199,132,0.1)' : 'rgba(255,255,255,0.02)', border: `1px solid ${funding.rate > 0.03 ? 'rgba(239,68,68,0.2)' : funding.rate < -0.01 ? 'rgba(22,199,132,0.2)' : 'rgba(255,255,255,0.06)'}` }}>
                <div className="flex items-center gap-2">
                  <span className="text-sm">
                    {funding.rate > 0.05 ? '🔴' : funding.rate > 0.01 ? '🟡' : funding.rate < -0.01 ? '🟢' : '⚪'}
                  </span>
                  <span className="text-xs text-gray-300">
                    {funding.rate > 0.05 ? 'Extremely bullish sentiment — longs are crowded. Correction risk.'
                      : funding.rate > 0.01 ? 'Positive funding — more longs than shorts. Mildly bullish.'
                      : funding.rate < -0.01 ? 'Negative funding — shorts paying longs. Potential squeeze incoming.'
                      : 'Neutral funding — balanced market positioning.'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {!funding && !loading && (
            <p className="text-gray-500 text-sm">Funding rate data unavailable</p>
          )}
        </div>
      </div>

      <p className="text-[10px] text-gray-600 mt-4 text-center">Dominance: CoinGecko • Funding: Binance Futures • Updates every 2 min</p>
    </div>
  );
}
