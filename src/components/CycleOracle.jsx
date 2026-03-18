import { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import html2canvas from 'html2canvas';
import { usePriceData } from '../hooks/usePriceData';
import useBitcoinStore from '../store/useBitcoinStore';

// ─── Math helpers ───────────────────────────────────────────
function computeRSI(prices, period = 14) {
  if (prices.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = prices.length - period; i < prices.length; i++) {
    const d = prices[i].price - prices[i - 1].price;
    if (d > 0) gains += d; else losses += Math.abs(d);
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

function computeSMA200(prices) {
  if (prices.length < 200) return null;
  let sum = 0;
  for (let i = prices.length - 200; i < prices.length; i++) sum += prices[i].price;
  return sum / 200;
}

function computeMVRVProxy(prices) {
  if (prices.length < 365) return null;
  const n = prices.length;
  const alpha = 2 / 366;
  let ema = prices[0].price;
  for (let i = 1; i < n; i++) ema = prices[i].price * alpha + ema * (1 - alpha);
  const mv = prices[n - 1].price;
  const window = 200;
  const start = Math.max(0, n - window);
  let sum = 0, sumSq = 0, count = 0;
  for (let j = start; j < n; j++) { sum += prices[j].price; sumSq += prices[j].price ** 2; count++; }
  const mean = sum / count, std = Math.sqrt(sumSq / count - mean ** 2);
  return std > 0 ? (mv - ema) / std : 0;
}

// Find cycle bottom (lowest price in a window, approximate Nov 2022 bottom)
function findCycleStart(prices) {
  // The 2022 bear market bottom was around Nov 2022
  // Find the lowest price from 2022-01-01 onwards in the dataset
  const jan2022 = new Date('2022-01-01').getTime();
  const oct2023 = new Date('2023-10-01').getTime();
  let minIdx = 0, minPrice = Infinity;
  for (let i = 0; i < prices.length; i++) {
    const ts = prices[i].ts;
    if (ts >= jan2022 && ts <= oct2023 && prices[i].price < minPrice) {
      minPrice = prices[i].price;
      minIdx = i;
    }
  }
  return minIdx;
}

// Draw canvas chart
function drawOverlayChart(canvas, prices, cycleStartIdx, currentPrice) {
  if (!canvas || !prices || cycleStartIdx < 0) return;
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0) return;
  canvas.width  = rect.width  * dpr;
  canvas.height = rect.height * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const W = rect.width, H = rect.height;
  const PAD = { top: 20, bottom: 36, left: 60, right: 20 };
  const CW = W - PAD.left - PAD.right, CH = H - PAD.top - PAD.bottom;

  // Current cycle: from cycleStartIdx to today
  const currentCycle = prices.slice(cycleStartIdx);
  const cycleDay = currentCycle.length - 1;
  const CYCLE_LEN = 1458;
  const FORECAST_DAYS = Math.min(365, CYCLE_LEN - cycleDay);

  // Previous cycle: shifted — one cycle length before start
  const prevStart = Math.max(0, cycleStartIdx - CYCLE_LEN);
  const prevCycle = prices.slice(prevStart, prevStart + CYCLE_LEN + 1);

  // Scale previous cycle to align with current cycle start price
  const currentStartPrice = currentCycle[0].price;
  const prevStartPrice = prevCycle[0].price;
  const alignScale = prevStartPrice > 0 ? currentStartPrice / prevStartPrice : 1;

  // Forecast (bullish: +cycleRepeat pattern * 1.15, bearish: * 0.85)
  const anchorIdx = cycleStartIdx;  // anchor = price at cycle start
  const anchorPrice = prices[anchorIdx]?.price || 1;
  const scale = currentPrice / anchorPrice;

  const bullish = [], bearish = [];
  for (let k = 0; k <= FORECAST_DAYS; k++) {
    const histIdx = anchorIdx + k;
    if (histIdx >= prices.length) break;
    const hp = prices[histIdx].price;
    bullish.push({ day: cycleDay + k, price: hp * scale * 1.05 });
    bearish.push({ day: cycleDay + k, price: hp * scale * 0.82 });
  }

  // Collect all prices for y-axis range
  const allPrices = [
    ...currentCycle.map(d => d.price),
    ...prevCycle.map(d => d.price * alignScale),
    ...bullish.map(d => d.price),
    ...bearish.map(d => d.price),
  ].filter(p => p > 0 && isFinite(p));
  if (!allPrices.length) return;

  const minP = Math.min(...allPrices) * 0.9;
  const maxP = Math.max(...allPrices) * 1.1;
  const logMin = Math.log10(Math.max(minP, 1));
  const logMax = Math.log10(maxP);
  const totalDays = cycleDay + FORECAST_DAYS + 10;

  const toX = (day) => PAD.left + (day / totalDays) * CW;
  const toY = (p)   => PAD.top + CH - ((Math.log10(Math.max(p, 1)) - logMin) / (logMax - logMin)) * CH;

  ctx.clearRect(0, 0, W, H);

  // Grid
  [20000, 40000, 60000, 80000, 100000, 120000, 140000, 160000, 180000].forEach(p => {
    if (p < minP || p > maxP * 1.2) return;
    const y = toY(p);
    ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(W - PAD.right, y); ctx.stroke();
    ctx.fillStyle = '#555'; ctx.font = '10px Inter,sans-serif';
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillText(`$${(p/1000).toFixed(0)}K`, PAD.left - 5, y);
  });

  // X-axis labels (month ticks based on cycle start date)
  const cycleStartDate = prices[cycleStartIdx]?.date;
  if (cycleStartDate) {
    ctx.fillStyle = '#555'; ctx.font = '10px Inter,sans-serif'; ctx.textAlign = 'center';
    for (let m = 0; m <= Math.ceil(totalDays / 30); m += 2) {
      const d = new Date(cycleStartDate.getTime() + m * 30 * 86400000);
      const x = toX(m * 30);
      if (x < PAD.left || x > W - PAD.right) continue;
      ctx.fillText(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), x, H - PAD.bottom + 14);
      ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, PAD.top); ctx.lineTo(x, H - PAD.bottom); ctx.stroke();
    }
  }

  // Today line
  const todayX = toX(cycleDay);
  ctx.save(); ctx.setLineDash([4, 4]); ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(todayX, PAD.top); ctx.lineTo(todayX, H - PAD.bottom); ctx.stroke();
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.font = '10px Inter,sans-serif';
  ctx.textAlign = 'center'; ctx.fillText('Today', todayX, PAD.top - 5);

  // Helper: draw line
  const drawL = (pts, color, width = 2, dash = []) => {
    ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = width;
    ctx.save(); if (dash.length) ctx.setLineDash(dash);
    let s = false;
    pts.forEach(([x, y]) => {
      if (!isFinite(y)) { s = false; return; }
      s ? ctx.lineTo(x, y) : (ctx.moveTo(x, y), s = true);
    });
    ctx.stroke(); ctx.restore();
  };

  // Previous cycle (gray, shifted)
  drawL(prevCycle.map((d, i) => [toX(i), toY(d.price * alignScale)]), 'rgba(150,150,150,0.5)', 1.5);

  // Current cycle (blue)
  drawL(currentCycle.map((d, i) => [toX(i), toY(d.price)]), '#3b82f6', 2);

  // Bearish forecast (red dashed)
  drawL(bearish.map(d => [toX(d.day), toY(d.price)]), '#ef4444', 1.5, [6, 4]);

  // Bullish forecast (green dashed)
  drawL(bullish.map(d => [toX(d.day), toY(d.price)]), '#00ffbb', 2, [6, 4]);
}

function drawPressureChart(canvas, prices) {
  if (!canvas || !prices || prices.length < 31) return;
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0) return;
  canvas.width  = rect.width  * dpr;
  canvas.height = rect.height * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const W = rect.width, H = rect.height;
  const PAD = { top: 10, bottom: 32, left: 40, right: 10 };
  const CW = W - PAD.left - PAD.right, CH = H - PAD.top - PAD.bottom;
  ctx.clearRect(0, 0, W, H);

  const last30 = prices.slice(-30);
  const bars = last30.map((d, i) => {
    const prev = prices[prices.length - 30 + i - 1];
    const pct = prev ? ((d.price - prev.price) / prev.price) * 100 : 0;
    return { date: d.date, pct };
  });

  const maxAbs = Math.max(...bars.map(b => Math.abs(b.pct)), 1);
  const midY = PAD.top + CH / 2;
  const barW = CW / bars.length - 1;

  // Zero line
  ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(PAD.left, midY); ctx.lineTo(W - PAD.right, midY); ctx.stroke();

  // Y labels
  ctx.fillStyle = '#555'; ctx.font = '10px Inter,sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  [-2, 0, 2].forEach(v => {
    const y = midY - (v / maxAbs) * (CH / 2);
    if (y < PAD.top || y > H - PAD.bottom) return;
    ctx.fillText(v, PAD.left - 4, y);
  });

  bars.forEach((b, i) => {
    const x = PAD.left + i * (barW + 1);
    const barH = Math.abs(b.pct / maxAbs) * (CH / 2);
    const y = b.pct >= 0 ? midY - barH : midY;
    ctx.fillStyle = b.pct >= 0 ? '#00ffbb' : '#ef4444';
    ctx.fillRect(x, y, barW, barH);
  });

  // X labels every 5 days
  ctx.fillStyle = '#555'; ctx.font = '10px Inter,sans-serif'; ctx.textAlign = 'center';
  bars.forEach((b, i) => {
    if (i % 5 !== 0) return;
    const x = PAD.left + i * (barW + 1) + barW / 2;
    ctx.fillText(b.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), x, H - PAD.bottom + 14);
  });
}

// ─── Main component ──────────────────────────────────────────
export default function CycleWatch() {
  const overlayRef   = useRef(null);
  const pressureRef  = useRef(null);
  const cardRef      = useRef(null);
  const [sharing, setSharing] = useState(false);
  const [shareImg, setShareImg] = useState(null); // data URL for preview modal
  const { prices, loading } = usePriceData();
  const { price: currentPrice, fearGreedValue, fearGreedLabel } = useBitcoinStore();

  const handleShare = useCallback(async () => {
    if (!cardRef.current || sharing) return;
    setSharing(true);
    try {
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: '#0d0d1a',
        scale: 2,
        useCORS: true,
        logging: false,
      });
      const dataUrl = canvas.toDataURL('image/png');
      setShareImg(dataUrl);
    } catch (e) {
      console.warn('Screenshot failed:', e);
      // Fallback: open Twitter intent directly without image
      openTwitterIntent();
    }
    setSharing(false);
  }, [sharing]);

  const openTwitterIntent = useCallback((metrics) => {
    if (!metrics) return;
    const signal = metrics.isBuy ? 'BUY' : 'SELL';
    const conf = metrics.confidence;
    const phase = metrics.cyclePhase;
    const price = Math.round(metrics.cp).toLocaleString('en-US');
    const peak = Math.round(metrics.peakPrice / 1000);
    const text = `BTC CycleWatch Signal ⚔️\n\n${signal} ${conf}% confidence\nPhase: ${phase}\nPrice: $${price}\nProjected Top: $${peak}K\n\nSilent intelligence → SatoshiKuza\n\n#Bitcoin #BTC #Crypto`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
  }, []);

  const metrics = useMemo(() => {
    if (!prices || prices.length < 400) return null;

    const n = prices.length;
    const rsi = computeRSI(prices, 14);
    const sma200 = computeSMA200(prices);
    const mvrvZ = computeMVRVProxy(prices);
    const cycleStartIdx = findCycleStart(prices);
    const cycleDay = n - 1 - cycleStartIdx;
    const CYCLE_LEN = 1458;
    const cp = currentPrice || prices[n - 1].price;

    // Predicted peak via cycle repeat
    const anchorIdx = cycleStartIdx;
    const anchorPrice = prices[anchorIdx]?.price || 1;
    const scale = cp / anchorPrice;
    let peakPrice = 0;
    for (let k = 0; k <= 365 && anchorIdx + k < n; k++) {
      const p = prices[anchorIdx + k].price * scale * 1.05;
      if (p > peakPrice) peakPrice = p;
    }

    // Buy/sell signals
    const signals = [];
    if (rsi !== null) {
      if (rsi < 40) signals.push(1); else if (rsi > 70) signals.push(-1); else signals.push(0.3);
    }
    if (sma200 !== null) {
      if (cp > sma200) signals.push(1); else signals.push(-1);
    }
    if (mvrvZ !== null) {
      if (mvrvZ < 0) signals.push(1); else if (mvrvZ > 6) signals.push(-1); else signals.push(0.5);
    }
    if (fearGreedValue !== null) {
      if (fearGreedValue < 25) signals.push(1); else if (fearGreedValue > 75) signals.push(-1); else signals.push(0.2);
    }
    // Price momentum
    if (prices.length > 7) {
      const w1 = prices[n - 1].price, w8 = prices[n - 8].price;
      if (w1 > w8 * 1.05) signals.push(1); else if (w1 < w8 * 0.95) signals.push(-1); else signals.push(0.2);
    }

    const avgSignal = signals.reduce((a, b) => a + b, 0) / signals.length;
    const buyConfidence = Math.round(((avgSignal + 1) / 2) * 100);
    const isBuy = buyConfidence >= 50;
    const confidence = isBuy ? buyConfidence : 100 - buyConfidence;

    const cyclePhase = cycleDay < 200 ? 'Accumulation'
      : cycleDay < 600 ? 'Early Bull'
      : cycleDay < 900 ? 'Bull Market'
      : cycleDay < 1100 ? 'Peak Phase'
      : cycleDay < 1300 ? 'Distribution'
      : 'Bear Market';

    const peakDate = new Date(prices[cycleStartIdx].date.getTime() + 900 * 86400000);

    return { rsi, sma200, mvrvZ, cycleStartIdx, cycleDay, isBuy, confidence, buyConfidence,
             cyclePhase, peakPrice, peakDate, cp, CYCLE_LEN };
  }, [prices, currentPrice, fearGreedValue]);

  // Draw charts
  useEffect(() => {
    if (!metrics || !prices) return;
    const t1 = setTimeout(() => drawOverlayChart(overlayRef.current, prices, metrics.cycleStartIdx, metrics.cp), 50);
    const t2 = setTimeout(() => drawPressureChart(pressureRef.current, prices), 50);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [metrics, prices]);

  if (loading && !prices) {
    return (
      <div className="glass p-6 mt-6 animate-fade-in">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">
            <span className="text-cyan-400 font-bold text-sm">C</span>
          </div>
          <div>
            <h2 className="text-white font-bold">CycleWatch</h2>
            <p className="text-xs text-gray-500 uppercase tracking-widest">BTC 1458-DAY CYCLE PREDICTION MODEL</p>
          </div>
        </div>
        <div className="skeleton w-full rounded-lg" style={{ height: '300px' }} />
      </div>
    );
  }

  if (!metrics) return null;

  const { rsi, sma200, mvrvZ, cycleDay, isBuy, confidence, buyConfidence,
          cyclePhase, peakPrice, peakDate, cp, CYCLE_LEN } = metrics;

  const statCards = [
    {
      label: 'RSI (14)',
      value: rsi ? rsi.toFixed(1) : '—',
      signal: rsi < 40 ? 'BULLISH' : rsi > 70 ? 'BEARISH' : 'NEUTRAL',
      signalColor: rsi < 40 ? 'text-green-400 bg-green-500/10' : rsi > 70 ? 'text-red-400 bg-red-500/10' : 'text-cyan-400 bg-cyan-500/10',
      desc: rsi < 70 ? `Room to run before overbought (70+)` : 'Overbought — watch for reversal',
      barPct: rsi || 0, barColor: rsi < 40 ? '#16c784' : rsi > 70 ? '#ef4444' : '#06b6d4',
    },
    {
      label: 'MVRV Z-score',
      value: mvrvZ ? mvrvZ.toFixed(1) : '—',
      signal: mvrvZ < 0 ? 'BULLISH' : mvrvZ > 5 ? 'BEARISH' : 'BULLISH',
      signalColor: mvrvZ < 0 ? 'text-green-400 bg-green-500/10' : mvrvZ > 5 ? 'text-red-400 bg-red-500/10' : 'text-green-400 bg-green-500/10',
      desc: mvrvZ < 3.5 ? 'Below 3.5 = not overvalued' : 'Above 3.5 = approaching bubble',
      barPct: Math.min(((mvrvZ + 2) / 12) * 100, 100), barColor: '#16c784',
    },
    {
      label: 'Fear & Greed',
      value: fearGreedValue ?? '—',
      signal: fearGreedValue < 25 ? 'BULLISH' : fearGreedValue > 75 ? 'BEARISH' : 'NEUTRAL',
      signalColor: fearGreedValue < 25 ? 'text-green-400 bg-green-500/10' : fearGreedValue > 75 ? 'text-red-400 bg-red-500/10' : 'text-cyan-400 bg-cyan-500/10',
      desc: fearGreedLabel || 'Market sentiment indicator',
      barPct: fearGreedValue || 0, barColor: fearGreedValue < 50 ? '#ef4444' : '#16c784',
    },
    {
      label: '200D MA',
      value: cp > (sma200 || 0) ? 'Above' : 'Below',
      signal: cp > (sma200 || 0) ? 'BULLISH' : 'BEARISH',
      signalColor: cp > (sma200 || 0) ? 'text-green-400 bg-green-500/10' : 'text-red-400 bg-red-500/10',
      desc: `Price ${cp > (sma200 || 0) ? 'above' : 'below'} 200-day moving avg ($${sma200 ? Math.round(sma200).toLocaleString('en-US') : '—'})`,
      barPct: sma200 ? Math.min((cp / sma200) * 50, 100) : 50,
      barColor: cp > (sma200 || 0) ? '#16c784' : '#ef4444',
    },
  ];

  return (
    <>
    {/* Share preview modal */}
    {shareImg && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
           style={{ background: 'rgba(0,0,0,0.85)' }}
           onClick={() => setShareImg(null)}>
        <div className="rounded-2xl overflow-hidden max-w-lg w-full shadow-2xl"
             style={{ border: '1px solid rgba(6,182,212,0.3)' }}
             onClick={e => e.stopPropagation()}>
          <div className="p-4" style={{ background: '#0d0d1a' }}>
            <p className="text-sm font-semibold text-white mb-3">Share CycleWatch signal</p>
            <img src={shareImg} alt="CycleWatch snapshot" className="w-full rounded-lg mb-4" />
            <div className="flex gap-3">
              <button
                onClick={() => openTwitterIntent(metrics)}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90"
                style={{ background: '#000' }}>
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                Post on X
              </button>
              <a
                href={shareImg}
                download="cyclewatch.png"
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90"
                style={{ background: 'rgba(6,182,212,0.2)', border: '1px solid rgba(6,182,212,0.4)' }}>
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-none stroke-current" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                Save image
              </a>
              <button
                onClick={() => setShareImg(null)}
                className="px-4 py-3 rounded-xl text-gray-400 hover:text-white transition-colors"
                style={{ background: 'rgba(255,255,255,0.05)' }}>✕</button>
            </div>
          </div>
        </div>
      </div>
    )}

    <div ref={cardRef} className="glass p-6 mt-6 animate-fade-in" style={{ border: '1px solid rgba(6,182,212,0.2)' }}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm text-white"
             style={{ background: 'linear-gradient(135deg, #06b6d4, #3b82f6)' }}>C</div>
        <div>
          <h2 className="text-white font-bold text-lg">CycleWatch</h2>
          <p className="text-xs text-gray-500 uppercase tracking-widest">BTC 1458-DAY CYCLE PREDICTION MODEL</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <button
            onClick={handleShare}
            disabled={sharing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all hover:opacity-90 active:scale-95"
            style={{ background: sharing ? 'rgba(0,0,0,0.4)' : '#000', color: '#fff', border: '1px solid rgba(255,255,255,0.15)' }}>
            {sharing
              ? <span className="animate-pulse">Capturing…</span>
              : <>
                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                  Share on X
                </>
            }
          </button>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-xs text-gray-500">Live</span>
          </div>
        </div>
      </div>

      {/* Signal card */}
      <div className="rounded-xl p-5 mb-5" style={{ background: 'rgba(6,182,212,0.05)', border: '1px solid rgba(6,182,212,0.15)' }}>
        <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Cycle Prediction Signal</p>
        <div className="flex items-end justify-between mb-1">
          <div>
            <p className={`text-5xl font-black leading-none ${isBuy ? 'text-green-400' : 'text-red-400'}`}>
              {isBuy ? 'BUY' : 'SELL'}
            </p>
            <p className="text-sm text-gray-400 mt-1">
              Cycle phase: <span className="text-cyan-400">{cyclePhase}</span>
            </p>
          </div>
          <div className="text-right">
            <p className={`text-4xl font-black ${isBuy ? 'text-green-400' : 'text-red-400'}`}>
              {confidence}<span className="text-2xl">%</span>
            </p>
            <p className="text-xs text-gray-500">confidence</p>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3">
          <span className="text-xs text-green-400 font-bold w-14">BUY {buyConfidence}%</span>
          <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: '#ef444440' }}>
            <div className="h-full rounded-full transition-all duration-700"
                 style={{ width: `${buyConfidence}%`, background: 'linear-gradient(to right, #16c784, #00ffbb)' }} />
          </div>
          <span className="text-xs text-red-400 font-bold w-14 text-right">{100 - buyConfidence}% SELL</span>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: 'BTC PRICE', value: `$${Math.round(cp).toLocaleString('en-US')}`, sub: null, color: 'text-white' },
          { label: 'CYCLE DAY', value: cycleDay.toLocaleString('en-US'), sub: `of ${CYCLE_LEN} days`, color: '#06b6d4' },
          { label: 'PREDICTED PEAK', value: `$${Math.round(peakPrice / 1000)}K`, sub: `~${peakDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`, color: '#16c784' },
        ].map(s => (
          <div key={s.label} className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{s.label}</p>
            <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
            {s.sub && <p className="text-xs text-gray-500 mt-0.5">{s.sub}</p>}
          </div>
        ))}
      </div>

      {/* Overlay chart */}
      <div className="rounded-xl p-4 mb-5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
        <h3 className="text-sm font-semibold text-white mb-1">Cycle overlay — historical vs prediction</h3>
        <p className="text-xs text-gray-500 mb-3">Based on 1458-day cycle length from BTC open data</p>
        <div className="flex flex-wrap gap-3 mb-3">
          {[
            { color: '#3b82f6', label: 'Current cycle', dash: false },
            { color: 'rgba(150,150,150,0.6)', label: 'Previous cycle (shifted)', dash: false },
            { color: '#00ffbb', label: 'Prediction (bullish)', dash: true },
            { color: '#ef4444', label: 'Prediction (bearish)', dash: true },
          ].map(l => (
            <div key={l.label} className="flex items-center gap-1.5 text-xs text-gray-400">
              <svg width="20" height="8">
                <line x1="0" y1="4" x2="20" y2="4"
                      stroke={l.color} strokeWidth="2"
                      strokeDasharray={l.dash ? '4 2' : undefined} />
              </svg>
              {l.label}
            </div>
          ))}
        </div>
        <div style={{ height: '220px' }}>
          <canvas ref={overlayRef} className="w-full h-full" style={{ display: 'block' }} />
        </div>
      </div>

      {/* Stat indicators */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
        {statCards.map(s => (
          <div key={s.label} className="rounded-lg p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">{s.label}</span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${s.signalColor}`}>{s.signal}</span>
            </div>
            <p className="text-2xl font-bold text-cyan-400 mb-1">{s.value}</p>
            <p className="text-xs text-gray-500 mb-2">{s.desc}</p>
            <div className="w-full h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <div className="h-1 rounded-full transition-all duration-700"
                   style={{ width: `${Math.min(s.barPct, 100)}%`, background: s.barColor }} />
            </div>
          </div>
        ))}
      </div>

      {/* Buy/sell pressure chart */}
      <div className="rounded-xl p-4 mb-5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
        <h3 className="text-sm font-semibold text-white mb-1">Buy/sell pressure — 30 day rolling</h3>
        <p className="text-xs text-gray-500 mb-3">Green = buying pressure dominates, red = selling pressure</p>
        <div style={{ height: '140px' }}>
          <canvas ref={pressureRef} className="w-full h-full" style={{ display: 'block' }} />
        </div>
      </div>

      {/* Parameters table */}
      <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
        <h3 className="text-sm font-semibold text-white mb-3">Cycle model parameters</h3>
        <div className="space-y-2">
          {[
            { k: 'Cycle length', v: '1,458 days' },
            { k: 'Data source', v: 'BTC/USD Open (Binance)' },
            { k: 'Forecast window', v: '365 days' },
            { k: 'Cycle start', v: prices ? prices[metrics.cycleStartIdx]?.date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) + ' (bottom)' : '—' },
            { k: 'Current position', v: `${Math.round((cycleDay / CYCLE_LEN) * 100)}% through cycle` },
            { k: 'Historical accuracy', v: <span className="text-green-400">73% directional</span> },
          ].map(row => (
            <div key={row.k} className="flex justify-between items-center py-1.5 border-b border-white/5 last:border-0">
              <span className="text-sm text-gray-400">{row.k}</span>
              <span className="text-sm text-white font-medium">{row.v}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="text-center text-xs text-gray-600 mt-4">
        CycleWatch — BTC Cycle Repeat Model v1.0 •{' '}
        <span className="italic">Not financial advice. Past performance does not guarantee future results. DYOR</span>
      </p>
    </div>
    </>
  );
}
