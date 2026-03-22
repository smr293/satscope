import { useState, useCallback, useRef } from 'react';
import { useFullPriceData } from '../hooks/usePriceData';
import useBitcoinStore from '../store/useBitcoinStore';

// Monthly BTC closing prices (USD) — public historical data
const HISTORY = {
  '2010-07': 0.08, '2010-08': 0.07, '2010-09': 0.06, '2010-10': 0.10, '2010-11': 0.22, '2010-12': 0.30,
  '2011-01': 0.84, '2011-02': 1.00, '2011-03': 0.81, '2011-04': 1.10, '2011-05': 8.50, '2011-06': 15.40,
  '2011-07': 13.10, '2011-08': 8.90, '2011-09': 4.85, '2011-10': 3.20, '2011-11': 2.80, '2011-12': 4.70,
  '2012-01': 6.30, '2012-02': 4.90, '2012-03': 5.00, '2012-04': 5.10, '2012-05': 5.30, '2012-06': 6.70,
  '2012-07': 8.40, '2012-08': 10.20, '2012-09': 12.30, '2012-10': 11.00, '2012-11': 12.60, '2012-12': 13.50,
  '2013-01': 14.00, '2013-02': 27.80, '2013-03': 93.00, '2013-04': 135.00, '2013-05': 120.00, '2013-06': 97.00,
  '2013-07': 100.00, '2013-08': 120.00, '2013-09': 140.00, '2013-10': 198.00, '2013-11': 1075.00, '2013-12': 757.00,
  '2014-01': 828.00, '2014-02': 558.00, '2014-03': 475.00, '2014-04': 450.00, '2014-05': 625.00, '2014-06': 640.00,
  '2014-07': 585.00, '2014-08': 480.00, '2014-09': 380.00, '2014-10': 338.00, '2014-11': 378.00, '2014-12': 310.00,
  '2015-01': 215.00, '2015-02': 255.00, '2015-03': 244.00, '2015-04': 236.00, '2015-05': 240.00, '2015-06': 263.00,
  '2015-07': 285.00, '2015-08': 230.00, '2015-09': 237.00, '2015-10': 330.00, '2015-11': 378.00, '2015-12': 430.00,
  '2016-01': 378.00, '2016-02': 437.00, '2016-03': 416.00, '2016-04': 454.00, '2016-05': 536.00, '2016-06': 672.00,
  '2016-07': 624.00, '2016-08': 575.00, '2016-09': 609.00, '2016-10': 697.00, '2016-11': 740.00, '2016-12': 963.00,
  '2017-01': 965.00, '2017-02': 1190.00, '2017-03': 1071.00, '2017-04': 1348.00, '2017-05': 2300.00, '2017-06': 2500.00,
  '2017-07': 2875.00, '2017-08': 4710.00, '2017-09': 4340.00, '2017-10': 6468.00, '2017-11': 10975.00, '2017-12': 13850.00,
  '2018-01': 10166.00, '2018-02': 10685.00, '2018-03': 6926.00, '2018-04': 9240.00, '2018-05': 7495.00, '2018-06': 6394.00,
  '2018-07': 7736.00, '2018-08': 7012.00, '2018-09': 6602.00, '2018-10': 6317.00, '2018-11': 3956.00, '2018-12': 3693.00,
  '2019-01': 3457.00, '2019-02': 3784.00, '2019-03': 4105.00, '2019-04': 5350.00, '2019-05': 8574.00, '2019-06': 10817.00,
  '2019-07': 9590.00, '2019-08': 9600.00, '2019-09': 8293.00, '2019-10': 9199.00, '2019-11': 7569.00, '2019-12': 7194.00,
  '2020-01': 9350.00, '2020-02': 8778.00, '2020-03': 6424.00, '2020-04': 8624.00, '2020-05': 9455.00, '2020-06': 9137.00,
  '2020-07': 11351.00, '2020-08': 11655.00, '2020-09': 10779.00, '2020-10': 13805.00, '2020-11': 19698.00, '2020-12': 29001.00,
  '2021-01': 33108.00, '2021-02': 45240.00, '2021-03': 58918.00, '2021-04': 57750.00, '2021-05': 37332.00, '2021-06': 35040.00,
  '2021-07': 41461.00, '2021-08': 47166.00, '2021-09': 43790.00, '2021-10': 61350.00, '2021-11': 57005.00, '2021-12': 46306.00,
  '2022-01': 38484.00, '2022-02': 43180.00, '2022-03': 45528.00, '2022-04': 37644.00, '2022-05': 31793.00, '2022-06': 19785.00,
  '2022-07': 23307.00, '2022-08': 20050.00, '2022-09': 19423.00, '2022-10': 20496.00, '2022-11': 17167.00, '2022-12': 16547.00,
  '2023-01': 23139.00, '2023-02': 23147.00, '2023-03': 28478.00, '2023-04': 29252.00, '2023-05': 27220.00, '2023-06': 30477.00,
  '2023-07': 29230.00, '2023-08': 26044.00, '2023-09': 27000.00, '2023-10': 34500.00, '2023-11': 37700.00, '2023-12': 42258.00,
  '2024-01': 42580.00, '2024-02': 51800.00, '2024-03': 71290.00, '2024-04': 60670.00, '2024-05': 67520.00, '2024-06': 62730.00,
  '2024-07': 65450.00, '2024-08': 59110.00, '2024-09': 63400.00, '2024-10': 72390.00, '2024-11': 96400.00, '2024-12': 93429.00,
  '2025-01': 102400.00, '2025-02': 96000.00, '2025-03': 84000.00,
};

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const YEARS = [];
for (let y = 2010; y <= 2025; y++) YEARS.push(y);

const FUN_ITEMS = [
  { name: 'Lamborghinis', icon: '🏎️', price: 350000 },
  { name: 'Houses (avg US)', icon: '🏠', price: 420000 },
  { name: 'Tesla Model S', icon: '⚡', price: 90000 },
  { name: 'Rolex Daytona', icon: '⌚', price: 45000 },
  { name: 'First Class Flights (NYC→Tokyo)', icon: '✈️', price: 25000 },
  { name: 'Years of Rent (NYC avg)', icon: '🏢', price: 36000 },
  { name: 'Pizzas (10,000 BTC moment)', icon: '🍕', price: 20 },
  { name: 'iPhones', icon: '📱', price: 1200 },
];

export default function TimeMachine() {
  const [year, setYear] = useState(2015);
  const [month, setMonth] = useState(1);
  const [amount, setAmount] = useState(1000);
  const [result, setResult] = useState(null);
  const [sharing, setSharing] = useState(false);
  const cardRef = useRef(null);
  const currentPrice = useBitcoinStore(s => s.price);

  const calculate = useCallback(() => {
    const key = `${year}-${String(month).padStart(2, '0')}`;
    const buyPrice = HISTORY[key];
    if (!buyPrice || !currentPrice) return;

    const btcBought = amount / buyPrice;
    const currentValue = btcBought * currentPrice;
    const roi = ((currentValue - amount) / amount) * 100;
    const profit = currentValue - amount;

    // Compare vs S&P 500 (~10.5% annual avg) and Gold (~7.5% annual avg)
    const yearsHeld = (Date.now() - new Date(year, month - 1, 1).getTime()) / (365.25 * 24 * 3600000);
    const sp500Value = amount * Math.pow(1.105, yearsHeld);
    const goldValue = amount * Math.pow(1.075, yearsHeld);
    const cashValue = amount * Math.pow(1.03, yearsHeld); // 3% inflation erodes cash

    // Fun purchases
    const funBuys = FUN_ITEMS.map(item => ({
      ...item,
      count: Math.floor(currentValue / item.price),
    })).filter(i => i.count > 0).slice(0, 4);

    setResult({
      buyPrice, btcBought, currentValue, roi, profit, yearsHeld,
      sp500Value, goldValue, cashValue, funBuys,
      dateStr: `${MONTHS[month - 1]} ${year}`,
    });
  }, [year, month, amount, currentPrice]);

  const shareOnX = useCallback(async () => {
    if (!result) return;
    setSharing(true);

    const roiStr = result.roi > 1000
      ? `+${(result.roi / 1000).toFixed(0)}K%`
      : `+${result.roi.toFixed(0)}%`;
    const valStr = result.currentValue >= 1e6
      ? `$${(result.currentValue / 1e6).toFixed(2)}M`
      : `$${Math.round(result.currentValue).toLocaleString()}`;

    const text = `🕰️ Bitcoin Time Machine\n\nIf I invested $${amount.toLocaleString()} in ${result.dateStr}...\n\n💰 Worth today: ${valStr}\n📈 ROI: ${roiStr}\n₿ ${result.btcBought.toFixed(4)} BTC\n\nCheck yours → satoshikuza.com\n\n#Bitcoin #BTC #TimeMachine`;
    const url = 'https://satoshikuza.com';
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
    setSharing(false);
  }, [result, amount]);

  const roiColor = result && result.roi > 0 ? '#16c784' : '#ef4444';

  return (
    <div className="glass p-6 mt-6 animate-fade-in" style={{ border: '1px solid rgba(6,182,212,0.2)' }}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
             style={{ background: 'linear-gradient(135deg, #f97316, #ef4444)' }}>🕰️</div>
        <div>
          <h2 className="text-white font-bold text-lg">Bitcoin Time Machine</h2>
          <p className="text-xs text-gray-500 uppercase tracking-widest">What if you had bought earlier?</p>
        </div>
      </div>
      <p className="text-sm text-gray-400 mb-6">See what your investment would be worth today. Go back in time and discover your missed fortune.</p>

      {/* Input Row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-6">
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wider mb-1 block">Amount ($)</label>
          <input
            type="number"
            value={amount}
            onChange={e => setAmount(Math.max(1, Number(e.target.value)))}
            className="w-full rounded-xl px-4 py-3 text-white font-bold text-lg outline-none transition-all focus:ring-2 focus:ring-cyan-500/40"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
            min="1"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wider mb-1 block">Year</label>
          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            className="w-full rounded-xl px-4 py-3 text-white font-bold outline-none appearance-none cursor-pointer"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
            {YEARS.map(y => <option key={y} value={y} style={{ background: '#0d0d1a' }}>{y}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wider mb-1 block">Month</label>
          <select
            value={month}
            onChange={e => setMonth(Number(e.target.value))}
            className="w-full rounded-xl px-4 py-3 text-white font-bold outline-none appearance-none cursor-pointer"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
            {MONTHS.map((m, i) => <option key={i} value={i + 1} style={{ background: '#0d0d1a' }}>{m}</option>)}
          </select>
        </div>
        <div className="flex items-end">
          <button
            onClick={calculate}
            className="w-full py-3 rounded-xl font-bold text-white transition-all hover:scale-[1.02] active:scale-95"
            style={{ background: 'linear-gradient(135deg, #f97316, #ef4444)' }}>
            Travel Back ⚡
          </button>
        </div>
      </div>

      {/* Results */}
      {result && (
        <div ref={cardRef} className="animate-fade-in">
          {/* Main result */}
          <div className="rounded-2xl p-6 mb-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="text-center mb-6">
              <p className="text-sm text-gray-400 mb-1">
                ${amount.toLocaleString()} invested in <span className="text-white font-semibold">{result.dateStr}</span> when BTC was <span className="text-orange-400">${result.buyPrice.toLocaleString()}</span>
              </p>
              <p className="text-4xl sm:text-5xl font-black text-white mt-3">
                {result.currentValue >= 1e6
                  ? `$${(result.currentValue / 1e6).toFixed(2)}M`
                  : `$${Math.round(result.currentValue).toLocaleString()}`}
              </p>
              <p className="text-lg font-bold mt-1" style={{ color: roiColor }}>
                {result.roi > 0 ? '+' : ''}{result.roi >= 10000 ? `${(result.roi / 1000).toFixed(1)}K` : result.roi.toFixed(1)}% ROI
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {result.btcBought.toFixed(6)} BTC • {result.yearsHeld.toFixed(1)} years
              </p>
            </div>

            {/* Comparison bars */}
            <div className="space-y-3">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Same ${amount.toLocaleString()} in...</p>
              {[
                { label: 'Bitcoin', value: result.currentValue, color: '#f97316' },
                { label: 'S&P 500', value: result.sp500Value, color: '#3b82f6' },
                { label: 'Gold', value: result.goldValue, color: '#eab308' },
                { label: 'Cash (mattress)', value: result.cashValue, color: '#666' },
              ].map(item => {
                const maxVal = result.currentValue;
                const pct = Math.min((item.value / maxVal) * 100, 100);
                return (
                  <div key={item.label} className="flex items-center gap-3">
                    <span className="text-xs text-gray-400 w-24 shrink-0">{item.label}</span>
                    <div className="flex-1 h-6 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <div className="h-full rounded-full transition-all duration-1000 flex items-center px-2"
                           style={{ width: `${Math.max(pct, 2)}%`, background: item.color }}>
                        <span className="text-[10px] font-bold text-white whitespace-nowrap">
                          ${item.value >= 1e6 ? `${(item.value / 1e6).toFixed(1)}M` : Math.round(item.value).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Fun purchases */}
          {result.funBuys.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              {result.funBuys.map(item => (
                <div key={item.name} className="rounded-xl p-4 text-center"
                     style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="text-2xl mb-1">{item.icon}</div>
                  <div className="text-xl font-black text-white">{item.count.toLocaleString()}</div>
                  <div className="text-[10px] text-gray-500">{item.name}</div>
                </div>
              ))}
            </div>
          )}

          {/* Share */}
          <div className="flex justify-center">
            <button
              onClick={shareOnX}
              disabled={sharing}
              className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm text-white transition-all hover:scale-[1.02] active:scale-95"
              style={{ background: '#000', border: '1px solid rgba(255,255,255,0.15)' }}>
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              Share Your Time Travel on X
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
