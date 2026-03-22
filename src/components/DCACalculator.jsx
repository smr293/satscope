import { useState, useCallback, useRef, useEffect } from 'react';
import useBitcoinStore from '../store/useBitcoinStore';

// Monthly BTC prices (same dataset)
const PRICES = {
  '2015-01': 215, '2015-02': 255, '2015-03': 244, '2015-04': 236, '2015-05': 240, '2015-06': 263,
  '2015-07': 285, '2015-08': 230, '2015-09': 237, '2015-10': 330, '2015-11': 378, '2015-12': 430,
  '2016-01': 378, '2016-02': 437, '2016-03': 416, '2016-04': 454, '2016-05': 536, '2016-06': 672,
  '2016-07': 624, '2016-08': 575, '2016-09': 609, '2016-10': 697, '2016-11': 740, '2016-12': 963,
  '2017-01': 965, '2017-02': 1190, '2017-03': 1071, '2017-04': 1348, '2017-05': 2300, '2017-06': 2500,
  '2017-07': 2875, '2017-08': 4710, '2017-09': 4340, '2017-10': 6468, '2017-11': 10975, '2017-12': 13850,
  '2018-01': 10166, '2018-02': 10685, '2018-03': 6926, '2018-04': 9240, '2018-05': 7495, '2018-06': 6394,
  '2018-07': 7736, '2018-08': 7012, '2018-09': 6602, '2018-10': 6317, '2018-11': 3956, '2018-12': 3693,
  '2019-01': 3457, '2019-02': 3784, '2019-03': 4105, '2019-04': 5350, '2019-05': 8574, '2019-06': 10817,
  '2019-07': 9590, '2019-08': 9600, '2019-09': 8293, '2019-10': 9199, '2019-11': 7569, '2019-12': 7194,
  '2020-01': 9350, '2020-02': 8778, '2020-03': 6424, '2020-04': 8624, '2020-05': 9455, '2020-06': 9137,
  '2020-07': 11351, '2020-08': 11655, '2020-09': 10779, '2020-10': 13805, '2020-11': 19698, '2020-12': 29001,
  '2021-01': 33108, '2021-02': 45240, '2021-03': 58918, '2021-04': 57750, '2021-05': 37332, '2021-06': 35040,
  '2021-07': 41461, '2021-08': 47166, '2021-09': 43790, '2021-10': 61350, '2021-11': 57005, '2021-12': 46306,
  '2022-01': 38484, '2022-02': 43180, '2022-03': 45528, '2022-04': 37644, '2022-05': 31793, '2022-06': 19785,
  '2022-07': 23307, '2022-08': 20050, '2022-09': 19423, '2022-10': 20496, '2022-11': 17167, '2022-12': 16547,
  '2023-01': 23139, '2023-02': 23147, '2023-03': 28478, '2023-04': 29252, '2023-05': 27220, '2023-06': 30477,
  '2023-07': 29230, '2023-08': 26044, '2023-09': 27000, '2023-10': 34500, '2023-11': 37700, '2023-12': 42258,
  '2024-01': 42580, '2024-02': 51800, '2024-03': 71290, '2024-04': 60670, '2024-05': 67520, '2024-06': 62730,
  '2024-07': 65450, '2024-08': 59110, '2024-09': 63400, '2024-10': 72390, '2024-11': 96400, '2024-12': 93429,
  '2025-01': 102400, '2025-02': 96000, '2025-03': 84000,
};

const PRESETS = [
  { label: '$50/mo since 2020', amount: 50, startYear: 2020, startMonth: 1 },
  { label: '$100/mo since 2021', amount: 100, startYear: 2021, startMonth: 1 },
  { label: '$200/mo since 2022', amount: 200, startYear: 2022, startMonth: 1 },
  { label: '$500/mo since 2017', amount: 500, startYear: 2017, startMonth: 1 },
];

export default function DCACalculator() {
  const [amount, setAmount] = useState(100);
  const [startYear, setStartYear] = useState(2020);
  const [startMonth, setStartMonth] = useState(1);
  const [result, setResult] = useState(null);
  const canvasRef = useRef(null);
  const currentPrice = useBitcoinStore(s => s.price);

  const calculate = useCallback(() => {
    if (!currentPrice) return;
    const data = [];
    let totalInvested = 0;
    let totalBTC = 0;

    const keys = Object.keys(PRICES).sort();
    const startKey = `${startYear}-${String(startMonth).padStart(2, '0')}`;

    for (const key of keys) {
      if (key < startKey) continue;
      const price = PRICES[key];
      totalInvested += amount;
      totalBTC += amount / price;
      const value = totalBTC * currentPrice;
      data.push({ date: key, invested: totalInvested, value, btc: totalBTC, price });
    }

    if (data.length === 0) return;

    const last = data[data.length - 1];
    const roi = ((last.value - last.invested) / last.invested) * 100;

    setResult({
      data,
      totalInvested: last.invested,
      currentValue: last.value,
      totalBTC: last.btc,
      roi,
      months: data.length,
      avgCost: last.invested / last.btc,
    });
  }, [amount, startYear, startMonth, currentPrice]);

  // Draw chart
  useEffect(() => {
    if (!result || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = 200 * dpr;
    canvas.style.height = '200px';
    ctx.scale(dpr, dpr);
    const W = rect.width, H = 200;
    ctx.clearRect(0, 0, W, H);

    const pad = { top: 16, right: 16, bottom: 30, left: 60 };
    const cW = W - pad.left - pad.right;
    const cH = H - pad.top - pad.bottom;
    const { data } = result;
    const maxV = Math.max(...data.map(d => d.value));

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    for (let i = 0; i <= 3; i++) {
      const y = pad.top + (cH / 3) * i;
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y); ctx.stroke();
      ctx.fillStyle = '#444'; ctx.font = '10px monospace'; ctx.textAlign = 'right';
      const val = maxV - (maxV / 3) * i;
      ctx.fillText(`$${val >= 1000 ? `${(val / 1000).toFixed(0)}K` : Math.round(val)}`, pad.left - 6, y + 4);
    }

    // Invested area (gray)
    ctx.beginPath();
    data.forEach((d, i) => {
      const x = pad.left + (i / (data.length - 1)) * cW;
      const y = pad.top + cH - (d.invested / maxV) * cH;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.lineTo(pad.left + cW, pad.top + cH);
    ctx.lineTo(pad.left, pad.top + cH);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    data.forEach((d, i) => {
      const x = pad.left + (i / (data.length - 1)) * cW;
      const y = pad.top + cH - (d.invested / maxV) * cH;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Value area (green)
    ctx.beginPath();
    data.forEach((d, i) => {
      const x = pad.left + (i / (data.length - 1)) * cW;
      const y = pad.top + cH - (d.value / maxV) * cH;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.lineTo(pad.left + cW, pad.top + cH);
    ctx.lineTo(pad.left, pad.top + cH);
    ctx.closePath();
    ctx.fillStyle = 'rgba(22,199,132,0.1)';
    ctx.fill();
    ctx.strokeStyle = '#16c784';
    ctx.lineWidth = 2;
    ctx.beginPath();
    data.forEach((d, i) => {
      const x = pad.left + (i / (data.length - 1)) * cW;
      const y = pad.top + cH - (d.value / maxV) * cH;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    // X labels
    ctx.fillStyle = '#444'; ctx.font = '10px monospace'; ctx.textAlign = 'center';
    const step = Math.max(1, Math.floor(data.length / 6));
    data.forEach((d, i) => {
      if (i % step === 0) {
        const x = pad.left + (i / (data.length - 1)) * cW;
        ctx.fillText(d.date.slice(2), x, H - 6);
      }
    });

    // Legend
    ctx.fillStyle = '#16c784'; ctx.fillRect(pad.left, 4, 10, 10);
    ctx.fillStyle = '#888'; ctx.font = '10px monospace'; ctx.textAlign = 'left';
    ctx.fillText('Portfolio Value', pad.left + 14, 13);
    ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(pad.left + 120, 4, 10, 10);
    ctx.fillStyle = '#888';
    ctx.fillText('Total Invested', pad.left + 134, 13);
  }, [result]);

  const shareOnX = useCallback(() => {
    if (!result) return;
    const valStr = result.currentValue >= 1e6
      ? `$${(result.currentValue / 1e6).toFixed(2)}M`
      : `$${Math.round(result.currentValue).toLocaleString()}`;
    const text = `📊 Bitcoin DCA Strategy\n\n$${amount}/month for ${result.months} months\n\n💵 Invested: $${result.totalInvested.toLocaleString()}\n💰 Worth: ${valStr}\n📈 ROI: ${result.roi > 0 ? '+' : ''}${result.roi.toFixed(0)}%\n₿ ${result.totalBTC.toFixed(4)} BTC\n\nCalculate yours → satoshikuza.com\n\n#Bitcoin #DCA #BTC`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent('https://satoshikuza.com')}`, '_blank');
  }, [result, amount]);

  return (
    <div className="glass p-6 mt-6 animate-fade-in" style={{ border: '1px solid rgba(6,182,212,0.2)' }}>
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
             style={{ background: 'linear-gradient(135deg, #16c784, #06b6d4)' }}>📊</div>
        <div>
          <h2 className="text-white font-bold text-lg">DCA Calculator</h2>
          <p className="text-xs text-gray-500 uppercase tracking-widest">Dollar-Cost Averaging Simulator</p>
        </div>
      </div>
      <p className="text-sm text-gray-400 mb-4">What if you stacked sats every month? See how a simple DCA strategy would have performed.</p>

      {/* Presets */}
      <div className="flex flex-wrap gap-2 mb-4">
        {PRESETS.map((p, i) => (
          <button key={i}
            onClick={() => { setAmount(p.amount); setStartYear(p.startYear); setStartMonth(p.startMonth); }}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-300 transition-all hover:text-white"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
            {p.label}
          </button>
        ))}
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-6">
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wider mb-1 block">$/month</label>
          <input type="number" value={amount} onChange={e => setAmount(Math.max(1, Number(e.target.value)))}
            className="w-full rounded-xl px-4 py-3 text-white font-bold text-lg outline-none focus:ring-2 focus:ring-cyan-500/40"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }} min="1" />
        </div>
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wider mb-1 block">Start Year</label>
          <select value={startYear} onChange={e => setStartYear(Number(e.target.value))}
            className="w-full rounded-xl px-4 py-3 text-white font-bold outline-none appearance-none cursor-pointer"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
            {Array.from({ length: 11 }, (_, i) => 2015 + i).map(y =>
              <option key={y} value={y} style={{ background: '#0d0d1a' }}>{y}</option>
            )}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wider mb-1 block">Month</label>
          <select value={startMonth} onChange={e => setStartMonth(Number(e.target.value))}
            className="w-full rounded-xl px-4 py-3 text-white font-bold outline-none appearance-none cursor-pointer"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
            {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m, i) =>
              <option key={i} value={i + 1} style={{ background: '#0d0d1a' }}>{m}</option>
            )}
          </select>
        </div>
        <div className="flex items-end">
          <button onClick={calculate}
            className="w-full py-3 rounded-xl font-bold text-white transition-all hover:scale-[1.02] active:scale-95"
            style={{ background: 'linear-gradient(135deg, #16c784, #06b6d4)' }}>
            Calculate ⚡
          </button>
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="animate-fade-in">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {[
              { label: 'Total Invested', value: `$${result.totalInvested.toLocaleString()}`, color: '#888' },
              { label: 'Current Value', value: result.currentValue >= 1e6 ? `$${(result.currentValue / 1e6).toFixed(2)}M` : `$${Math.round(result.currentValue).toLocaleString()}`, color: '#16c784' },
              { label: 'ROI', value: `${result.roi > 0 ? '+' : ''}${result.roi.toFixed(1)}%`, color: result.roi > 0 ? '#16c784' : '#ef4444' },
              { label: 'BTC Stacked', value: `₿ ${result.totalBTC.toFixed(4)}`, color: '#f97316' },
            ].map(s => (
              <div key={s.label} className="rounded-xl p-4 text-center"
                   style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{s.label}</div>
                <div className="text-lg font-black" style={{ color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          <div className="rounded-xl p-4 mb-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <canvas ref={canvasRef} />
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">Avg cost basis: <span className="text-white font-semibold">${Math.round(result.avgCost).toLocaleString()}</span> per BTC</p>
            <button onClick={shareOnX}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white transition-all hover:scale-[1.02] active:scale-95"
              style={{ background: '#000', border: '1px solid rgba(255,255,255,0.15)' }}>
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              Share DCA Results on X
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
