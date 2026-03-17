import { useEffect, useState } from 'react';
import useBitcoinStore from '../store/useBitcoinStore';
import { formatUSD, formatPercent } from '../utils/formatters';

export default function Hero() {
  const { price, priceChange24h, loading, pulseKey } = useBitcoinStore();
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (pulseKey > 0) {
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 600);
      return () => clearTimeout(t);
    }
  }, [pulseKey]);

  if (loading.price && !price) {
    return (
      <section className="text-center py-12 animate-fade-in">
        <div className="skeleton w-64 h-16 mx-auto mb-4" />
        <div className="skeleton w-40 h-8 mx-auto" />
      </section>
    );
  }

  return (
    <section className="text-center py-8 sm:py-12 animate-fade-in">
      <p className="text-gray-400 text-sm uppercase tracking-widest mb-2">Bitcoin Price</p>
      <h1
        className={`text-5xl sm:text-7xl font-black text-white mb-3 transition-all ${
          pulse ? 'pulse-update' : ''
        }`}
      >
        {formatUSD(price)}
      </h1>
      <div className="flex items-center justify-center gap-3">
        <span
          className={`text-lg font-semibold px-4 py-1.5 rounded-full ${
            priceChange24h >= 0
              ? 'bg-green-500/15 text-green-400'
              : 'bg-red-500/15 text-red-400'
          }`}
        >
          {formatPercent(priceChange24h)} (24h)
        </span>
      </div>
    </section>
  );
}
