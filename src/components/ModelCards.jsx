import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { usePriceData, computeSMA, logRegression } from '../hooks/usePriceData';
import useBitcoinStore from '../store/useBitcoinStore';

// =========================================================
// MINI CANVAS CHART — shared by all models
// =========================================================
function MiniChart({ drawFn, height = 200 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !drawFn) return;
    const canvas = canvasRef.current;

    const render = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0) { requestAnimationFrame(render); return; }
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, rect.width, rect.height);
      drawFn(ctx, rect.width, rect.height);
    };

    // Small delay so layout has settled after accordion opens
    const t = setTimeout(render, 50);
    return () => clearTimeout(t);
  }, [drawFn]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full"
      style={{ height: `${height}px`, display: 'block' }}
    />
  );
}

// =========================================================
// HELPER: draw line on chart
// =========================================================
function drawLine(ctx, points, color, lineWidth = 1.5) {
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  let started = false;
  points.forEach(([x, y]) => {
    if (y == null || isNaN(y)) { started = false; return; }
    if (!started) { ctx.moveTo(x, y); started = true; }
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

function drawGrid(ctx, W, H, pad, yMin, yMax, isLog = false) {
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + ((H - pad.top - pad.bottom) * i) / 4;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(W - pad.right, y);
    ctx.stroke();
  }
}

// =========================================================
// 1. RAINBOW CHART
// =========================================================
function useRainbowChart(prices) {
  return useMemo(() => {
    if (!prices || prices.length < 100) return null;

    const { slope, intercept, stdDev } = logRegression(prices);
    const n = prices.length;
    const currentPrice = prices[n - 1].price;

    // Rainbow bands (from bottom to top)
    const BANDS = [
      { name: 'Fire Sale', color: '#3861FB', offset: -2.5 },
      { name: 'Buy', color: '#3CB371', offset: -1.5 },
      { name: 'Accumulate', color: '#90EE90', offset: -0.5 },
      { name: 'Still Cheap', color: '#FFFF00', offset: 0 },
      { name: 'Hold', color: '#FFD700', offset: 0.5 },
      { name: 'Is This a Bubble?', color: '#FFA500', offset: 1.0 },
      { name: 'FOMO', color: '#FF6347', offset: 1.5 },
      { name: 'Sell', color: '#FF4500', offset: 2.0 },
      { name: 'Maximum Bubble', color: '#FF0000', offset: 2.5 },
    ];

    // Find current band
    const x = Math.log(n);
    const logPredicted = slope * x + intercept;
    const logActual = Math.log(currentPrice);
    const zScore = (logActual - logPredicted) / stdDev;

    let currentBand = 'Hold';
    for (const band of BANDS) {
      if (zScore <= band.offset + 0.5) {
        currentBand = band.name;
        break;
      }
    }
    if (zScore > 2.5) currentBand = 'Maximum Bubble';

    // Build chart data (last 800 days)
    const startIdx = Math.max(0, n - 800);
    const chartPrices = prices.slice(startIdx);

    const drawFn = (ctx, W, H) => {
      const pad = { top: 10, bottom: 10, left: 5, right: 5 };
      const chartW = W - pad.left - pad.right;
      const chartH = H - pad.top - pad.bottom;

      // Get price range for log scale
      let minP = Infinity, maxP = 0;
      for (const p of chartPrices) {
        minP = Math.min(minP, p.price);
        maxP = Math.max(maxP, p.price);
      }
      // Extend range for bands
      const logFitMax = slope * Math.log(n) + intercept + 2.5 * stdDev;
      const logFitMin = slope * Math.log(startIdx + 1) + intercept - 2.5 * stdDev;
      maxP = Math.max(maxP, Math.exp(logFitMax) * 1.1);
      minP = Math.min(minP, Math.exp(logFitMin) * 0.9);

      const logMin = Math.log(Math.max(minP, 1));
      const logMax = Math.log(maxP);

      const toX = (i) => pad.left + (i / (chartPrices.length - 1)) * chartW;
      const toY = (price) => {
        const logP = Math.log(Math.max(price, 1));
        return pad.top + chartH - ((logP - logMin) / (logMax - logMin)) * chartH;
      };

      // Draw rainbow bands
      for (let b = 0; b < BANDS.length - 1; b++) {
        const band = BANDS[b];
        const nextBand = BANDS[b + 1];
        ctx.fillStyle = band.color + '25'; // semi-transparent

        ctx.beginPath();
        for (let i = 0; i < chartPrices.length; i++) {
          const dayIdx = startIdx + i + 1;
          const lx = Math.log(dayIdx);
          const lower = Math.exp(slope * lx + intercept + band.offset * stdDev);
          const x = toX(i);
          const y = toY(lower);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        for (let i = chartPrices.length - 1; i >= 0; i--) {
          const dayIdx = startIdx + i + 1;
          const lx = Math.log(dayIdx);
          const upper = Math.exp(slope * lx + intercept + nextBand.offset * stdDev);
          ctx.lineTo(toX(i), toY(upper));
        }
        ctx.closePath();
        ctx.fill();
      }

      // Draw price line
      const pricePoints = chartPrices.map((p, i) => [toX(i), toY(p.price)]);
      drawLine(ctx, pricePoints, '#fff', 1.5);
    };

    return { currentBand, zScore, drawFn, BANDS };
  }, [prices]);
}

// =========================================================
// 2. STOCK-TO-FLOW
// =========================================================
function useStockToFlow(prices) {
  return useMemo(() => {
    if (!prices || prices.length < 365) return null;

    const n = prices.length;
    const currentPrice = prices[n - 1].price;

    // BTC supply schedule
    const HALVINGS = [
      { block: 0, date: new Date('2009-01-03'), reward: 50 },
      { block: 210000, date: new Date('2012-11-28'), reward: 25 },
      { block: 420000, date: new Date('2016-07-09'), reward: 12.5 },
      { block: 630000, date: new Date('2020-05-11'), reward: 6.25 },
      { block: 840000, date: new Date('2024-04-20'), reward: 3.125 },
    ];

    const getRewardAtDate = (date) => {
      for (let i = HALVINGS.length - 1; i >= 0; i--) {
        if (date >= HALVINGS[i].date) return HALVINGS[i].reward;
      }
      return 50;
    };

    const getSupplyAtDate = (date) => {
      let supply = 0;
      for (let i = 0; i < HALVINGS.length; i++) {
        const start = HALVINGS[i].date;
        const end = i + 1 < HALVINGS.length ? HALVINGS[i + 1].date : date;
        if (date < start) break;
        const effectiveEnd = date < end ? date : end;
        const daysBetween = (effectiveEnd - start) / 86400000;
        const blocksPerDay = 144;
        supply += daysBetween * blocksPerDay * HALVINGS[i].reward;
      }
      return supply;
    };

    // Compute S2F for last 365 days
    const startIdx = Math.max(0, n - 500);
    const chartData = [];

    for (let i = startIdx; i < n; i++) {
      const d = prices[i].date;
      const reward = getRewardAtDate(d);
      const annualFlow = reward * 144 * 365;
      const stock = getSupplyAtDate(d);
      const sf = annualFlow > 0 ? stock / annualFlow : 0;
      // S2F model price: e^(3.21 * ln(SF) + 14.6) — simplified PlanB model
      const modelPrice = sf > 0 ? Math.exp(3.21 * Math.log(sf) + 14.6) : 0;
      chartData.push({
        date: d,
        price: prices[i].price,
        modelPrice,
        sf,
      });
    }

    const current = chartData[chartData.length - 1];
    const ratio = current.modelPrice > 0 ? currentPrice / current.modelPrice : 0;
    let status;
    if (ratio < 0.5) status = 'Very undervalued';
    else if (ratio < 0.8) status = 'Below model price';
    else if (ratio < 1.2) status = 'At model price';
    else if (ratio < 2) status = 'Above model price';
    else status = 'Very overvalued';

    const drawFn = (ctx, W, H) => {
      const pad = { top: 10, bottom: 10, left: 5, right: 5 };
      const chartW = W - pad.left - pad.right;
      const chartH = H - pad.top - pad.bottom;

      let minP = Infinity, maxP = 0;
      for (const d of chartData) {
        minP = Math.min(minP, d.price, d.modelPrice || Infinity);
        maxP = Math.max(maxP, d.price, d.modelPrice || 0);
      }
      const logMin = Math.log(Math.max(minP * 0.8, 1));
      const logMax = Math.log(maxP * 1.2);

      const toX = (i) => pad.left + (i / (chartData.length - 1)) * chartW;
      const toY = (price) => pad.top + chartH - ((Math.log(Math.max(price, 1)) - logMin) / (logMax - logMin)) * chartH;

      drawGrid(ctx, W, H, pad);

      // Model line
      const modelPoints = chartData.map((d, i) => [toX(i), d.modelPrice > 0 ? toY(d.modelPrice) : null]);
      drawLine(ctx, modelPoints, '#F7931A', 2);

      // Price line
      const pricePoints = chartData.map((d, i) => [toX(i), toY(d.price)]);
      drawLine(ctx, pricePoints, '#fff', 1.5);
    };

    return { status, ratio, currentSF: current.sf, modelPrice: current.modelPrice, drawFn };
  }, [prices]);
}

// =========================================================
// 3. MVRV Z-SCORE (approximated)
// =========================================================
function useMVRV(prices) {
  return useMemo(() => {
    if (!prices || prices.length < 200) return null;

    const n = prices.length;
    // Approximate "realized value" as a heavily smoothed price (like a cost-basis average)
    // True MVRV needs UTXO data, this is a reasonable proxy using 200d EMA
    const alpha = 2 / (365 + 1);
    let ema = prices[0].price;
    const emaValues = [ema];
    for (let i = 1; i < n; i++) {
      ema = prices[i].price * alpha + ema * (1 - alpha);
      emaValues.push(ema);
    }

    // Z-Score = (MarketValue - RealizedValue) / StdDev(MarketValue)
    // We use: (price - 365EMA) / rolling_std
    const startIdx = Math.max(0, n - 500);
    const chartData = [];

    for (let i = startIdx; i < n; i++) {
      const mv = prices[i].price;
      const rv = emaValues[i];

      // Compute rolling std of price (200 periods)
      const window = 200;
      const start = Math.max(0, i - window);
      let sum = 0, sumSq = 0, count = 0;
      for (let j = start; j <= i; j++) {
        sum += prices[j].price;
        sumSq += prices[j].price ** 2;
        count++;
      }
      const mean = sum / count;
      const std = Math.sqrt(sumSq / count - mean ** 2);

      const zScore = std > 0 ? (mv - rv) / std : 0;
      chartData.push({ date: prices[i].date, price: mv, zScore });
    }

    const current = chartData[chartData.length - 1];
    let status, statusColor;
    if (current.zScore < -0.5) { status = 'Undervalued'; statusColor = 'text-green-400 bg-green-500/15'; }
    else if (current.zScore < 2) { status = 'Neutral'; statusColor = 'text-blue-400 bg-blue-500/15'; }
    else if (current.zScore < 5) { status = 'Heating up'; statusColor = 'text-yellow-400 bg-yellow-500/15'; }
    else if (current.zScore < 8) { status = 'Overheated'; statusColor = 'text-orange-400 bg-orange-500/15'; }
    else { status = 'Extreme (sell zone)'; statusColor = 'text-red-400 bg-red-500/15'; }

    const drawFn = (ctx, W, H) => {
      const pad = { top: 10, bottom: 10, left: 5, right: 5 };
      const chartW = W - pad.left - pad.right;
      const chartH = H - pad.top - pad.bottom;

      let minZ = Infinity, maxZ = -Infinity;
      for (const d of chartData) {
        minZ = Math.min(minZ, d.zScore);
        maxZ = Math.max(maxZ, d.zScore);
      }
      const range = maxZ - minZ || 1;

      const toX = (i) => pad.left + (i / (chartData.length - 1)) * chartW;
      const toY = (z) => pad.top + chartH - ((z - minZ) / range) * chartH;

      drawGrid(ctx, W, H, pad);

      // Danger zone (z > 7)
      if (maxZ > 7) {
        const y7 = toY(7);
        ctx.fillStyle = 'rgba(255, 0, 0, 0.08)';
        ctx.fillRect(pad.left, pad.top, chartW, y7 - pad.top);
      }

      // Green zone (z < 0)
      const y0 = toY(0);
      ctx.fillStyle = 'rgba(0, 255, 100, 0.06)';
      ctx.fillRect(pad.left, y0, chartW, H - pad.bottom - y0);

      // Zero line
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(pad.left, y0);
      ctx.lineTo(W - pad.right, y0);
      ctx.stroke();
      ctx.setLineDash([]);

      // Z-score line with color segments
      for (let i = 0; i < chartData.length - 1; i++) {
        const z1 = chartData[i].zScore;
        const z2 = chartData[i + 1].zScore;
        const x1 = toX(i), y1 = toY(z1);
        const x2 = toX(i + 1), y2 = toY(z2);
        const avg = (z1 + z2) / 2;

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        if (avg < 0) ctx.strokeStyle = '#16c784';
        else if (avg < 3) ctx.strokeStyle = '#f5d100';
        else if (avg < 7) ctx.strokeStyle = '#F7931A';
        else ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    };

    return { status, statusColor, zScore: current.zScore, drawFn };
  }, [prices]);
}

// =========================================================
// 4. PUELL MULTIPLE
// =========================================================
function usePuellMultiple(prices) {
  return useMemo(() => {
    if (!prices || prices.length < 200) return null;

    const n = prices.length;

    const HALVINGS = [
      { date: new Date('2009-01-03'), reward: 50 },
      { date: new Date('2012-11-28'), reward: 25 },
      { date: new Date('2016-07-09'), reward: 12.5 },
      { date: new Date('2020-05-11'), reward: 6.25 },
      { date: new Date('2024-04-20'), reward: 3.125 },
    ];

    const getReward = (date) => {
      for (let i = HALVINGS.length - 1; i >= 0; i--) {
        if (date >= HALVINGS[i].date) return HALVINGS[i].reward;
      }
      return 50;
    };

    // Daily issuance value = blocks_per_day * reward * price
    const dailyValues = prices.map(p => {
      const reward = getReward(p.date);
      return 144 * reward * p.price;
    });

    // Compute Puell = daily_value / 365d_MA(daily_value)
    const maWindow = Math.min(365, Math.floor(n / 2));
    const startIdx = Math.max(maWindow, n - 500);
    const chartData = [];

    for (let i = startIdx; i < n; i++) {
      let sum = 0;
      const window = Math.min(365, i);
      for (let j = i - window + 1; j <= i; j++) sum += dailyValues[j];
      const avg365 = sum / window;
      const puell = avg365 > 0 ? dailyValues[i] / avg365 : 0;
      chartData.push({ date: prices[i].date, puell, price: prices[i].price });
    }

    const current = chartData[chartData.length - 1];
    let status, statusColor;
    if (current.puell < 0.5) { status = 'Green zone (buy)'; statusColor = 'text-green-400 bg-green-500/15'; }
    else if (current.puell < 1.2) { status = 'Neutral'; statusColor = 'text-blue-400 bg-blue-500/15'; }
    else if (current.puell < 4) { status = 'Elevated'; statusColor = 'text-yellow-400 bg-yellow-500/15'; }
    else { status = 'Red zone (sell)'; statusColor = 'text-red-400 bg-red-500/15'; }

    const drawFn = (ctx, W, H) => {
      const pad = { top: 10, bottom: 10, left: 5, right: 5 };
      const chartW = W - pad.left - pad.right;
      const chartH = H - pad.top - pad.bottom;

      let maxP = 0;
      for (const d of chartData) maxP = Math.max(maxP, d.puell);
      maxP = Math.min(maxP, 10); // cap for display
      const minP = 0;

      const toX = (i) => pad.left + (i / (chartData.length - 1)) * chartW;
      const toY = (v) => pad.top + chartH - ((Math.min(v, maxP) - minP) / (maxP - minP)) * chartH;

      drawGrid(ctx, W, H, pad);

      // Green zone below 0.5
      const y05 = toY(0.5);
      ctx.fillStyle = 'rgba(0, 255, 100, 0.06)';
      ctx.fillRect(pad.left, y05, chartW, H - pad.bottom - y05);

      // Red zone above 4
      if (maxP > 4) {
        const y4 = toY(4);
        ctx.fillStyle = 'rgba(255, 0, 0, 0.06)';
        ctx.fillRect(pad.left, pad.top, chartW, y4 - pad.top);
      }

      // Puell line
      for (let i = 0; i < chartData.length - 1; i++) {
        const p1 = chartData[i].puell;
        const p2 = chartData[i + 1].puell;
        ctx.beginPath();
        ctx.moveTo(toX(i), toY(p1));
        ctx.lineTo(toX(i + 1), toY(p2));
        if ((p1 + p2) / 2 < 0.5) ctx.strokeStyle = '#16c784';
        else if ((p1 + p2) / 2 < 4) ctx.strokeStyle = '#F7931A';
        else ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // 1.0 reference line
      const y1 = toY(1);
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(pad.left, y1);
      ctx.lineTo(W - pad.right, y1);
      ctx.stroke();
      ctx.setLineDash([]);
    };

    return { status, statusColor, puell: current.puell, drawFn };
  }, [prices]);
}

// =========================================================
// 5. PI CYCLE TOP
// =========================================================
function usePiCycleTop(prices) {
  return useMemo(() => {
    if (!prices || prices.length < 200) return null;

    const n = prices.length;
    const sma111 = computeSMA(prices, 111);
    const sma350 = computeSMA(prices, 350);
    // Pi Cycle: when 111d MA crosses above 350d MA * 2 → cycle top signal
    const sma350x2 = sma350.map(v => v != null ? v * 2 : null);

    const startIdx = Math.max(350, n - 500);
    const chartData = [];
    let signal = false;
    let crossDay = null;

    for (let i = startIdx; i < n; i++) {
      const ma111 = sma111[i];
      const ma350x = sma350x2[i];
      chartData.push({
        date: prices[i].date,
        price: prices[i].price,
        ma111,
        ma350x2: ma350x,
      });

      // Check for crossover in last 30 days
      if (i >= n - 30 && ma111 != null && ma350x != null && sma111[i-1] != null && sma350x2[i-1] != null) {
        if (sma111[i-1] < sma350x2[i-1] && ma111 >= ma350x) {
          signal = true;
          crossDay = prices[i].date;
        }
      }
    }

    // Check proximity: how close is 111MA to 350MAx2?
    const last = chartData[chartData.length - 1];
    const proximity = last.ma111 && last.ma350x2
      ? ((last.ma111 - last.ma350x2) / last.ma350x2 * 100)
      : null;

    let status, statusColor;
    if (signal) { status = 'TOP SIGNAL!'; statusColor = 'text-red-400 bg-red-500/15'; }
    else if (proximity != null && proximity > -5) { status = 'Approaching signal'; statusColor = 'text-yellow-400 bg-yellow-500/15'; }
    else { status = 'No signal'; statusColor = 'text-gray-400 bg-gray-500/15'; }

    const drawFn = (ctx, W, H) => {
      const pad = { top: 10, bottom: 10, left: 5, right: 5 };
      const chartW = W - pad.left - pad.right;
      const chartH = H - pad.top - pad.bottom;

      let minP = Infinity, maxP = 0;
      for (const d of chartData) {
        minP = Math.min(minP, d.price);
        maxP = Math.max(maxP, d.price);
        if (d.ma111) { minP = Math.min(minP, d.ma111); maxP = Math.max(maxP, d.ma111); }
        if (d.ma350x2) { minP = Math.min(minP, d.ma350x2); maxP = Math.max(maxP, d.ma350x2); }
      }
      const logMin = Math.log(Math.max(minP * 0.9, 1));
      const logMax = Math.log(maxP * 1.1);

      const toX = (i) => pad.left + (i / (chartData.length - 1)) * chartW;
      const toY = (p) => pad.top + chartH - ((Math.log(Math.max(p, 1)) - logMin) / (logMax - logMin)) * chartH;

      drawGrid(ctx, W, H, pad);

      // Price
      const pricePoints = chartData.map((d, i) => [toX(i), toY(d.price)]);
      drawLine(ctx, pricePoints, 'rgba(255,255,255,0.4)', 1);

      // 111 MA (green)
      const ma111Points = chartData.map((d, i) => [toX(i), d.ma111 ? toY(d.ma111) : null]);
      drawLine(ctx, ma111Points, '#16c784', 2);

      // 350 MA x2 (orange)
      const ma350Points = chartData.map((d, i) => [toX(i), d.ma350x2 ? toY(d.ma350x2) : null]);
      drawLine(ctx, ma350Points, '#F7931A', 2);
    };

    return { status, statusColor, signal, proximity, crossDay, drawFn, ma111: last.ma111, ma350x2: last.ma350x2 };
  }, [prices]);
}

// =========================================================
// MAIN COMPONENT
// =========================================================
export default function ModelCards() {
  const [expanded, setExpanded] = useState(null);
  const { prices, loading: pricesLoading } = usePriceData();
  const { price: currentPrice } = useBitcoinStore();

  const rainbow = useRainbowChart(prices);
  const s2f = useStockToFlow(prices);
  const mvrv = useMVRV(prices);
  const puell = usePuellMultiple(prices);
  const piCycle = usePiCycleTop(prices);

  const models = useMemo(() => [
    {
      name: 'Rainbow Chart',
      icon: '🌈',
      status: rainbow?.currentBand || 'Loading...',
      statusColor: rainbow?.currentBand?.includes('Bubble') ? 'text-red-400 bg-red-500/15'
        : rainbow?.currentBand?.includes('Sell') ? 'text-orange-400 bg-orange-500/15'
        : rainbow?.currentBand?.includes('FOMO') ? 'text-orange-400 bg-orange-500/15'
        : rainbow?.currentBand?.includes('Hold') ? 'text-yellow-400 bg-yellow-500/15'
        : rainbow?.currentBand?.includes('Buy') || rainbow?.currentBand?.includes('Accumulate') || rainbow?.currentBand?.includes('Cheap') ? 'text-green-400 bg-green-500/15'
        : rainbow?.currentBand?.includes('Fire') ? 'text-blue-400 bg-blue-500/15'
        : 'text-gray-400 bg-gray-500/15',
      description: 'Logarithmic regression with color-coded standard deviation bands. Shows where current price sits in the long-term growth channel.',
      drawFn: rainbow?.drawFn,
      details: rainbow ? [
        { label: 'Current Band', value: rainbow.currentBand },
        { label: 'Z-Score', value: rainbow.zScore.toFixed(2) },
      ] : null,
    },
    {
      name: 'Stock-to-Flow (S2F)',
      icon: '📈',
      status: s2f?.status || 'Loading...',
      statusColor: s2f?.status?.includes('undervalued') ? 'text-green-400 bg-green-500/15'
        : s2f?.status?.includes('Below') ? 'text-yellow-400 bg-yellow-500/15'
        : s2f?.status?.includes('At') ? 'text-blue-400 bg-blue-500/15'
        : s2f?.status?.includes('Above') ? 'text-orange-400 bg-orange-500/15'
        : s2f?.status?.includes('overvalued') ? 'text-red-400 bg-red-500/15'
        : 'text-gray-400 bg-gray-500/15',
      description: 'Values BTC based on scarcity. The ratio of existing stock to annual production flow determines a model price. White = actual price, orange = model.',
      drawFn: s2f?.drawFn,
      details: s2f ? [
        { label: 'S2F Ratio', value: s2f.currentSF.toFixed(1) },
        { label: 'Model Price', value: `$${Math.round(s2f.modelPrice).toLocaleString()}` },
        { label: 'Price/Model', value: `${s2f.ratio.toFixed(2)}x` },
      ] : null,
    },
    {
      name: 'MVRV Z-Score',
      icon: '📐',
      status: mvrv?.status || 'Loading...',
      statusColor: mvrv?.statusColor || 'text-gray-400 bg-gray-500/15',
      description: 'Market Value vs Realized Value. Green = undervalued, yellow = fair, orange = heating up, red = overheated. Historical tops occur at Z > 7.',
      drawFn: mvrv?.drawFn,
      details: mvrv ? [
        { label: 'Z-Score', value: mvrv.zScore.toFixed(2) },
      ] : null,
    },
    {
      name: 'Puell Multiple',
      icon: '💰',
      status: puell?.status || 'Loading...',
      statusColor: puell?.statusColor || 'text-gray-400 bg-gray-500/15',
      description: 'Ratio of daily mining revenue to its 365-day average. Green zone (< 0.5) = buy, red zone (> 4) = sell. The 1.0 line = average.',
      drawFn: puell?.drawFn,
      details: puell ? [
        { label: 'Puell Multiple', value: puell.puell.toFixed(2) },
      ] : null,
    },
    {
      name: 'Pi Cycle Top',
      icon: '🎯',
      status: piCycle?.status || 'Loading...',
      statusColor: piCycle?.statusColor || 'text-gray-400 bg-gray-500/15',
      description: 'When the 111-day MA (green) crosses above the 350-day MA × 2 (orange), it historically signals within 3 days of a cycle top.',
      drawFn: piCycle?.drawFn,
      details: piCycle ? [
        { label: '111d MA', value: piCycle.ma111 ? `$${Math.round(piCycle.ma111).toLocaleString()}` : '—' },
        { label: '350d MA × 2', value: piCycle.ma350x2 ? `$${Math.round(piCycle.ma350x2).toLocaleString()}` : '—' },
        { label: 'Distance', value: piCycle.proximity != null ? `${piCycle.proximity.toFixed(1)}%` : '—' },
      ] : null,
    },
  ], [rainbow, s2f, mvrv, puell, piCycle]);

  const toggle = useCallback((i) => {
    setExpanded(prev => prev === i ? null : i);
  }, []);

  return (
    <div className="mb-6 animate-fade-in">
      <h2 className="text-lg font-semibold text-white mb-4">
        Models & Indicators
      </h2>
      {pricesLoading && !prices && (
        <p className="text-xs text-gray-500 mb-3">Loading price history for model calculations...</p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {models.map((model, i) => (
          <div
            key={model.name}
            className={`glass p-5 cursor-pointer transition-all ${expanded === i ? 'sm:col-span-2 lg:col-span-3' : ''}`}
            onClick={() => toggle(i)}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">{model.icon}</span>
                <h3 className="text-sm font-semibold text-white">{model.name}</h3>
              </div>
              <svg
                className={`w-4 h-4 text-gray-500 transition-transform ${expanded === i ? 'rotate-180' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            <span className={`text-xs font-medium px-2 py-1 rounded-full ${model.statusColor}`}>
              {model.status}
            </span>

            {expanded === i && (
              <div className="mt-4 animate-fade-in">
                <p className="text-sm text-gray-400 mb-4">{model.description}</p>

                {/* Stats */}
                {model.details && (
                  <div className="flex flex-wrap gap-3 mb-4">
                    {model.details.map(d => (
                      <div key={d.label} className="bg-white/[0.03] rounded-lg px-3 py-2 border border-white/5">
                        <p className="text-[10px] text-gray-500 uppercase">{d.label}</p>
                        <p className="text-sm font-bold text-white">{d.value}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Chart */}
                {model.drawFn ? (
                  <div className="bg-white/[0.02] rounded-lg p-2 border border-white/5">
                    <MiniChart drawFn={model.drawFn} height={220} />
                  </div>
                ) : (
                  <div className="skeleton w-full h-48 rounded-lg" />
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
