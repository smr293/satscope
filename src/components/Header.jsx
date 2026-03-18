import useBitcoinStore from '../store/useBitcoinStore';
import { formatUSD, timeAgo } from '../utils/formatters';

export default function Header() {
  const { price, priceChange24h, lastPriceUpdate, loading } = useBitcoinStore();

  return (
    <header className="sticky top-0 z-50 glass-static px-4 sm:px-6 py-3 mb-6">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Ninja star logo */}
          <div className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-white text-base relative"
               style={{ background: 'linear-gradient(135deg, #F7931A, #ff4500)' }}>
            <span style={{ filter: 'drop-shadow(0 0 4px rgba(247,147,26,0.6))' }}>忍</span>
          </div>
          <div className="hidden sm:block">
            <span className="text-lg font-black text-white tracking-tight">
              Satoshi<span className="text-gradient-orange">Kuza</span>
            </span>
            <p className="text-[9px] text-gray-500 uppercase tracking-[0.25em] -mt-0.5">Shadow of the Chain</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {loading.price ? (
            <div className="skeleton w-32 h-8" />
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-white">{formatUSD(price)}</span>
              {priceChange24h != null && (
                <span className={`text-sm font-medium px-2 py-0.5 rounded-full ${
                  priceChange24h >= 0
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-red-500/20 text-red-400'
                }`}>
                  {priceChange24h >= 0 ? '+' : ''}{priceChange24h?.toFixed(2)}%
                </span>
              )}
            </div>
          )}

          <div className="text-xs text-gray-500 hidden sm:block">
            Updated: {timeAgo(lastPriceUpdate)}
          </div>

          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" title="Live" />
        </div>
      </div>
    </header>
  );
}
