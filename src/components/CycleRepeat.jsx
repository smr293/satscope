import { useMemo, useRef, useEffect, useState } from 'react';
import { useFullPriceData } from '../hooks/usePriceData';

const CYCLE_LENGTH = 1458;
const FORECAST_DAYS = 365;

function computeCycleRepeat(fullHistory) {
  if (!fullHistory || fullHistory.length < CYCLE_LENGTH + 10) return null;

  const n = fullHistory.length;
  const todayIdx = n - 1;
  const currentPrice = fullHistory[todayIdx].price;

  const anchorIdx = todayIdx - CYCLE_LENGTH;
  if (anchorIdx < 0) return null;

  const anchorPrice = fullHistory[anchorIdx].price;
  if (!anchorPrice || anchorPrice <= 0) return null;

  const scale = currentPrice / anchorPrice;

  // Forecast: for k=0..365, forecastPrice[k] = fullHistory[anchorIdx + k] * scale
  // (Pine: src[cycleLength - k] relative to current bar = fullHistory[todayIdx - (cycleLength - k)])
  const forecast = [];
  for (let k = 0; k <= FORECAST_DAYS; k++) {
    const histIdx = anchorIdx + k;  // = todayIdx - cycleLength + k
    if (histIdx < 0 || histIdx >= n) { forecast.push(null); continue; }
    const hp = fullHistory[histIdx].price;
    forecast.push(hp > 0 ? hp * scale : null);
  }

  const today = fullHistory[todayIdx].date;
  const forecastWithDates = forecast.map((price, k) => ({
    price,
    date: new Date(today.getTime() + k * 86400000),
  }));

  // Last 400 days of history for context
  const history = fullHistory.slice(Math.max(0, n - 400)).map(d => ({ date: d.date, price: d.price }));

  const validForecast = forecastWithDates.filter(f => f.price != null);
  const projectedTop = validForecast.reduce((max, f) => f.price > max.price ? f : max, validForecast[0] || { price: 0 });

  return { history, forecast: forecastWithDates, scale, currentPrice, anchorPrice, projectedTop };
}

export default function CycleRepeat() {
  const canvasRef = useRef(null);
  const { prices: fullHistory, loading } = useFullPriceData();

  const data = useMemo(() => {
    if (!fullHistory) return null;
    return computeCycleRepeat(fullHistory);
  }, [fullHistory]);

  // Draw chart
  useEffect(() => {
    if (!data || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0) return;

    canvas.width  = rect.width  * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    const W = rect.width, H = rect.height;

    const PAD = { top: 20, bottom: 44, left: 72, right: 24 };
    const CW = W - PAD.left - PAD.right;
    const CH = H - PAD.top - PAD.bottom;

    const all = [
      ...data.history.map(h => h.price),
      ...data.forecast.filter(f => f.price).map(f => f.price),
    ].filter(Boolean);

    const minP = Math.min(...all) * 0.85;
    const maxP = Math.max(...all) * 1.1;
    const logMin = Math.log10(Math.max(minP, 1));
    const logMax = Math.log10(maxP);

    const allDates = [
      ...data.history.map(h => h.date.getTime()),
      ...data.forecast.map(f => f.date.getTime()),
    ];
    const minT = Math.min(...allDates);
    const maxT = Math.max(...allDates);

    const toX = (d) => PAD.left + ((d.getTime() - minT) / (maxT - minT)) * CW;
    const toY = (p) => PAD.top + CH - ((Math.log10(Math.max(p, 1)) - logMin) / (logMax - logMin)) * CH;

    ctx.clearRect(0, 0, W, H);

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    [10000, 20000, 30000, 50000, 75000, 100000, 150000, 200000, 300000, 500000].forEach(p => {
      if (p < minP || p > maxP * 1.2) return;
      const y = toY(p);
      ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(W - PAD.right, y); ctx.stroke();
      ctx.fillStyle = '#555'; ctx.font = '11px Inter,sans-serif';
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.fillText(p >= 1e6 ? `$${p/1e6}M` : `$${(p/1e3).toFixed(0)}k`, PAD.left - 6, y);
    });

    // Month labels
    const startM = new Date(minT); startM.setDate(1);
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (let d = new Date(startM); d.getTime() <= maxT; d.setMonth(d.getMonth() + 2)) {
      const x = toX(d);
      if (x < PAD.left || x > W - PAD.right) continue;
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.beginPath(); ctx.moveTo(x, PAD.top); ctx.lineTo(x, H - PAD.bottom); ctx.stroke();
      ctx.fillStyle = '#555'; ctx.font = '11px Inter,sans-serif';
      ctx.fillText(d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }), x, H - PAD.bottom + 6);
    }

    // Today line
    const todayDate = data.history[data.history.length - 1].date;
    const tx = toX(todayDate);
    ctx.save(); ctx.setLineDash([4,4]); ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(tx, PAD.top); ctx.lineTo(tx, H - PAD.bottom); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = '10px Inter,sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText('Today', tx, PAD.top - 2);

    // History line (white)
    ctx.beginPath(); ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2;
    data.history.forEach((h, i) => {
      const x = toX(h.date), y = toY(h.price);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Forecast: green/red segments (Pine Script logic)
    const vf = data.forecast.filter(f => f.price != null);
    for (let i = 0; i < vf.length - 1; i++) {
      const p1 = vf[i], p2 = vf[i + 1];
      ctx.beginPath();
      ctx.moveTo(toX(p1.date), toY(p1.price));
      ctx.lineTo(toX(p2.date), toY(p2.price));
      ctx.strokeStyle = p2.price >= p1.price ? '#00ffbb' : '#ff0000';
      ctx.lineWidth = 3; ctx.stroke();
    }

    // Projected top marker
    if (data.projectedTop?.price > 0) {
      const px = toX(data.projectedTop.date), py = toY(data.projectedTop.price);
      ctx.beginPath(); ctx.arc(px, py, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#F7931A'; ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();

      const lbl = `Top  $${Math.round(data.projectedTop.price).toLocaleString('en-US')}`;
      ctx.font = 'bold 12px Inter,sans-serif';
      const tw = ctx.measureText(lbl).width;
      const bx = Math.min(Math.max(px - tw/2 - 10, PAD.left), W - PAD.right - tw - 20);
      const by = Math.max(py - 36, PAD.top + 2);
      ctx.fillStyle = 'rgba(247,147,26,0.92)';
      ctx.beginPath(); ctx.roundRect(bx, by, tw + 20, 22, 4); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(lbl, bx + 10, by + 11);
    }

    // Current price dot
    const cp = data.currentPrice;
    ctx.beginPath(); ctx.arc(tx, toY(cp), 4, 0, Math.PI * 2);
    ctx.fillStyle = '#fff'; ctx.fill();

  }, [data]);

  // ── Render ──

  if (loading && !data) {
    return (
      <div className="glass p-6 mb-6 glow-orange-strong animate-fade-in">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-xl">🔬</span>
          <h2 className="text-lg font-semibold text-white">BTC Cycle Repeat</h2>
          <div className="w-2 h-2 rounded-full bg-btc animate-pulse" />
        </div>
        <p className="text-sm text-gray-400 mb-4">
          Fetching extended price history ({CYCLE_LENGTH} days required)…
        </p>
        <div className="skeleton w-full rounded-lg" style={{ height: '360px' }} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="glass p-6 mb-6 glow-orange-strong animate-fade-in">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-2">
          <span>🔬</span> BTC Cycle Repeat
        </h2>
        <p className="text-sm text-yellow-400">
          Not enough history yet ({fullHistory?.length ?? 0} / {CYCLE_LENGTH + 10} days needed).
          Loading extended data…
        </p>
      </div>
    );
  }

  return (
    <div className="glass p-6 mb-6 glow-orange-strong animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <span>🔬</span> BTC Cycle Repeat
          </h2>
          <p className="text-sm text-gray-400 mt-0.5">
            Projects future price by repeating the pattern from {CYCLE_LENGTH} days ago, scaled to current level
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-2 h-2 rounded-full bg-btc animate-pulse" />
          <span className="text-xs text-gray-500">Auto-updates every 60min</span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {[
          { label: 'Current Price', value: `$${Math.round(data.currentPrice).toLocaleString('en-US')}`, color: 'text-white' },
          { label: `Anchor (${CYCLE_LENGTH}d ago)`, value: `$${Math.round(data.anchorPrice).toLocaleString('en-US')}`, color: 'text-gray-300' },
          { label: 'Scale Factor', value: `${data.scale.toFixed(2)}×`, color: 'text-btc' },
          { label: 'Projected Top', value: `$${Math.round(data.projectedTop?.price || 0).toLocaleString('en-US')}`, color: 'text-green-400' },
        ].map(s => (
          <div key={s.label} className="bg-white/[0.03] rounded-lg p-3 border border-white/5">
            <p className="text-xs text-gray-500 mb-1">{s.label}</p>
            <p className={`text-sm font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="w-full" style={{ height: '360px' }}>
        <canvas ref={canvasRef} className="w-full h-full" style={{ display: 'block' }} />
      </div>

      <div className="flex flex-wrap gap-4 mt-4 pt-3 border-t border-white/5">
        {[
          { color: 'rgba(255,255,255,0.55)', label: 'Historical Price', line: true },
          { color: '#00ffbb', label: 'Forecast Up', line: true },
          { color: '#ff0000', label: 'Forecast Down', line: true },
          { color: '#F7931A', label: 'Projected Top', dot: true },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-2 text-xs text-gray-400">
            {l.line
              ? <div className="w-5 h-0.5 rounded" style={{ backgroundColor: l.color }} />
              : <div className="w-3 h-3 rounded-full" style={{ backgroundColor: l.color }} />}
            {l.label}
          </div>
        ))}
      </div>
    </div>
  );
}
