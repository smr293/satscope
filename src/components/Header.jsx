import useBitcoinStore from '../store/useBitcoinStore';
import { formatUSD, timeAgo } from '../utils/formatters';

export default function Header() {
  const { price, priceChange24h, lastPriceUpdate, loading } = useBitcoinStore();

  return (
    <header className="sticky top-0 z-50 glass-static px-4 sm:px-6 py-3 mb-6">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-sm"
               style={{ background: 'linear-gradient(135deg, #F7931A, #ff6b00)' }}>
            S
          </div>
          <span className="text-lg font-bold text-white hidden sm:block tracking-tight">
            Chain<span style={{ color: '#F7931A' }}>Bo</span>
          </span>
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
