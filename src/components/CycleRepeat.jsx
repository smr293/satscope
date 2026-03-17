import { useMemo, useRef, useEffect, useCallback, useState } from 'react';
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

  const forecast = [];
  for (let k = 0; k <= FORECAST_DAYS; k++) {
    const histIdx = anchorIdx + k;
    if (histIdx < 0 || histIdx >= n) { forecast.push(null); continue; }
    const hp = fullHistory[histIdx].price;
    forecast.push(hp > 0 ? hp * scale : null);
  }

  const today = fullHistory[todayIdx].date;
  const forecastWithDates = forecast.map((price, k) => ({
    price,
    date: new Date(today.getTime() + k * 86400000),
  }));

  const history = fullHistory.slice(Math.max(0, n - 400)).map(d => ({ date: d.date, price: d.price }));
  const validForecast = forecastWithDates.filter(f => f.price != null);
  const projectedTop = validForecast.reduce((max, f) => f.price > max.price ? f : max, validForecast[0] || { price: 0 });

  return { history, forecast: forecastWithDates, scale, currentPrice, anchorPrice, projectedTop };
}

export default function CycleRepeat() {
  const mainCanvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const chartGeo = useRef(null); // stored geometry for mouse interaction
  const [tooltip, setTooltip] = useState(null);
  const { prices: fullHistory, loading } = useFullPriceData();

  const data = useMemo(() => {
    if (!fullHistory) return null;
    return computeCycleRepeat(fullHistory);
  }, [fullHistory]);

  // Build all chart points + geometry once
  const chartData = useMemo(() => {
    if (!data) return null;

    const allPoints = [
      ...data.history.map(h => ({ date: h.date, price: h.price, type: 'history' })),
      ...data.forecast.filter(f => f.price != null).map(f => ({ date: f.date, price: f.price, type: 'forecast' })),
    ];
    if (allPoints.length < 2) return null;

    const allPrices = allPoints.map(p => p.price);
    const minP = Math.min(...allPrices) * 0.85;
    const maxP = Math.max(...allPrices) * 1.1;
    const logMin = Math.log10(Math.max(minP, 1));
    const logMax = Math.log10(maxP);
    const minT = allPoints[0].date.getTime();
    const maxT = allPoints[allPoints.length - 1].date.getTime();

    return { allPoints, minP, maxP, logMin, logMax, minT, maxT };
  }, [data]);

  // Draw main chart
  useEffect(() => {
    if (!data || !chartData || !mainCanvasRef.current) return;
    const canvas = mainCanvasRef.current;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0) return;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    const W = rect.width, H = rect.height;

    const PAD = { top: 20, bottom: 44, left: 72, right: 24 };
    const CW = W - PAD.left - PAD.right;
    const CH = H - PAD.top - PAD.bottom;

    const { logMin, logMax, minT, maxT } = chartData;
    const dateRange = maxT - minT;

    const toX = (date) => PAD.left + ((date.getTime() - minT) / dateRange) * CW;
    const toY = (price) => PAD.top + CH - ((Math.log10(Math.max(price, 1)) - logMin) / (logMax - logMin)) * CH;

    // Store geometry for mouse interaction
    chartGeo.current = { PAD, W, H, CW, CH, toX, toY, logMin, logMax, minT, maxT, dateRange };

    // Also size the overlay canvas
    if (overlayCanvasRef.current) {
      overlayCanvasRef.current.width = rect.width * dpr;
      overlayCanvasRef.current.height = rect.height * dpr;
    }

    ctx.clearRect(0, 0, W, H);

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    const priceSteps = [10000, 20000, 30000, 50000, 75000, 100000, 150000, 200000, 300000, 500000, 1000000];
    priceSteps.forEach(p => {
      if (p < chartData.minP || p > chartData.maxP * 1.2) return;
      const y = toY(p);
      ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(W - PAD.right, y); ctx.stroke();
      ctx.fillStyle = '#666'; ctx.font = '11px Inter, sans-serif';
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      const label = p >= 1e6 ? `$${(p/1e6).toFixed(0)}M` : `$${(p/1e3).toFixed(0)}k`;
      ctx.fillText(label, PAD.left - 8, y);
    });

    // Month labels
    const startM = new Date(minT); startM.setDate(1);
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (let d = new Date(startM); d.getTime() <= maxT; d.setMonth(d.getMonth() + 2)) {
      const x = toX(d);
      if (x < PAD.left || x > W - PAD.right) continue;
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.beginPath(); ctx.moveTo(x, PAD.top); ctx.lineTo(x, H - PAD.bottom); ctx.stroke();
      ctx.fillStyle = '#666'; ctx.font = '11px Inter, sans-serif';
      ctx.fillText(d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }), x, H - PAD.bottom + 8);
    }

    // Today line
    const todayDate = data.history[data.history.length - 1].date;
    const tx = toX(todayDate);
    ctx.save(); ctx.setLineDash([4, 4]); ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(tx, PAD.top); ctx.lineTo(tx, H - PAD.bottom); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText('Today', tx, PAD.top - 2);

    // History line
    ctx.beginPath(); ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2;
    data.history.forEach((h, i) => {
      const x = toX(h.date), y = toY(h.price);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Forecast: green/red segments
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
      ctx.font = 'bold 12px Inter, sans-serif';
      const tw = ctx.measureText(lbl).width;
      const bx = Math.min(Math.max(px - tw/2 - 10, PAD.left), W - PAD.right - tw - 20);
      const by = Math.max(py - 36, PAD.top + 2);
      ctx.fillStyle = 'rgba(247,147,26,0.92)';
      ctx.beginPath(); ctx.roundRect(bx, by, tw + 20, 22, 4); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(lbl, bx + 10, by + 11);
    }

    // Current price dot
    ctx.beginPath(); ctx.arc(tx, toY(data.currentPrice), 4, 0, Math.PI * 2);
    ctx.fillStyle = '#fff'; ctx.fill();
  }, [data, chartData]);

  // Mouse interaction — draw crosshair + tooltip on overlay canvas
  const handleMouseMove = useCallback((e) => {
    if (!chartData || !chartGeo.current || !overlayCanvasRef.current || !data) return;
    const overlay = overlayCanvasRef.current;
    const dpr = window.devicePixelRatio || 1;
    const rect = overlay.getBoundingClientRect();
    const ctx = overlay.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);

    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const { PAD, W, H, CW, CH, toX, toY, logMin, logMax, minT, dateRange } = chartGeo.current;

    // Out of chart area
    if (mx < PAD.left || mx > W - PAD.right || my < PAD.top || my > H - PAD.bottom) {
      setTooltip(null);
      return;
    }

    // Find closest point by x position
    const mouseTs = minT + ((mx - PAD.left) / CW) * dateRange;

    // Search in allPoints
    let closest = null;
    let closestDist = Infinity;
    for (const pt of chartData.allPoints) {
      const dist = Math.abs(pt.date.getTime() - mouseTs);
      if (dist < closestDist) { closestDist = dist; closest = pt; }
    }
    if (!closest) return;

    const px = toX(closest.date);
    const py = toY(closest.price);

    // Vertical crosshair line
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(px, PAD.top); ctx.lineTo(px, H - PAD.bottom); ctx.stroke();

    // Horizontal crosshair line
    ctx.beginPath(); ctx.moveTo(PAD.left, py); ctx.lineTo(W - PAD.right, py); ctx.stroke();
    ctx.setLineDash([]);

    // Dot on the line
    ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI * 2);
    ctx.fillStyle = closest.type === 'history' ? '#fff' : (closest.type === 'forecast' ? '#00ffbb' : '#fff');
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1.5; ctx.stroke();

    // Price label on Y axis
    const priceLabel = `$${Math.round(closest.price).toLocaleString('en-US')}`;
    ctx.font = 'bold 11px Inter, sans-serif';
    const tw = ctx.measureText(priceLabel).width;
    ctx.fillStyle = '#F7931A';
    ctx.beginPath(); ctx.roundRect(PAD.left - tw - 16, py - 10, tw + 12, 20, 3); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillText(priceLabel, PAD.left - 8, py);

    // Date label on X axis
    const dateLabel = closest.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    ctx.font = '11px Inter, sans-serif';
    const dtw = ctx.measureText(dateLabel).width;
    const dlx = Math.max(PAD.left, Math.min(px - dtw / 2 - 6, W - PAD.right - dtw - 12));
    ctx.fillStyle = 'rgba(50,50,70,0.95)';
    ctx.beginPath(); ctx.roundRect(dlx, H - PAD.bottom + 2, dtw + 12, 20, 3); ctx.fill();
    ctx.fillStyle = '#ccc'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(dateLabel, dlx + 6, H - PAD.bottom + 12);

    // Tooltip box near cursor
    const type = closest.type === 'history' ? 'Historical' : 'Forecast';
    const tipText = `${type}: $${Math.round(closest.price).toLocaleString('en-US')}`;
    ctx.font = 'bold 12px Inter, sans-serif';
    const tipW = ctx.measureText(tipText).width;
    const tipX = Math.min(px + 14, W - PAD.right - tipW - 20);
    const tipY = Math.max(py - 30, PAD.top + 4);
    ctx.fillStyle = 'rgba(13,13,26,0.92)';
    ctx.strokeStyle = closest.type === 'history' ? 'rgba(255,255,255,0.2)' : 'rgba(0,255,187,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(tipX, tipY, tipW + 16, 24, 4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = closest.type === 'history' ? '#fff' : '#00ffbb';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(tipText, tipX + 8, tipY + 12);
  }, [chartData, data]);

  const handleMouseLeave = useCallback(() => {
    if (!overlayCanvasRef.current) return;
    const dpr = window.devicePixelRatio || 1;
    const ctx = overlayCanvasRef.current.getContext('2d');
    const rect = overlayCanvasRef.current.getBoundingClientRect();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);
    setTooltip(null);
  }, []);

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

      <div
        className="relative w-full cursor-crosshair"
        style={{ height: '360px' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <canvas ref={mainCanvasRef} className="absolute inset-0 w-full h-full" style={{ display: 'block' }} />
        <canvas ref={overlayCanvasRef} className="absolute inset-0 w-full h-full pointer-events-none" style={{ display: 'block' }} />
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
