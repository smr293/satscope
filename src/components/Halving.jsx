import useBitcoinStore from '../store/useBitcoinStore';
import { formatNumber } from '../utils/formatters';

export default function Halving() {
  const { blockHeight, halvingProgress, blocksUntilHalving, estimatedHalvingDate, loading } = useBitcoinStore();

  if (loading.halving && !blockHeight) {
    return (
      <div className="glass p-6 mb-6 animate-fade-in">
        <div className="skeleton w-48 h-6 mb-4" />
        <div className="skeleton w-full h-4 mb-2" />
        <div className="skeleton w-64 h-10" />
      </div>
    );
  }

  const now = new Date();
  const diff = estimatedHalvingDate ? estimatedHalvingDate - now : 0;
  const days = Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
  const hours = Math.max(0, Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)));
  const minutes = Math.max(0, Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)));

  return (
    <div className="glass p-6 mb-6 glow-orange animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <span className="text-btc">⏳</span> Next Halving
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Block {formatNumber(blockHeight)} / {formatNumber(blockHeight ? Math.ceil(blockHeight / 210000) * 210000 : null)}
          </p>
        </div>
        {blocksUntilHalving != null && (
          <p className="text-sm text-gray-400 mt-2 sm:mt-0">
            {formatNumber(blocksUntilHalving)} blocks remaining
          </p>
        )}
      </div>

      <div className="w-full bg-white/10 rounded-full h-3 mb-4">
        <div
          className="bg-gradient-to-r from-btc to-btc-light h-3 rounded-full transition-all duration-1000 relative"
          style={{ width: `${halvingProgress || 0}%` }}
        >
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-btc rounded-full border-2 border-white shadow-lg" />
        </div>
      </div>

      {diff > 0 && (
        <div className="flex items-center justify-center gap-4 sm:gap-8">
          <TimeUnit value={days} label="Days" />
          <span className="text-2xl text-gray-600">:</span>
          <TimeUnit value={hours} label="Hours" />
          <span className="text-2xl text-gray-600">:</span>
          <TimeUnit value={minutes} label="Minutes" />
        </div>
      )}

      {estimatedHalvingDate && (
        <p className="text-center text-xs text-gray-500 mt-3">
          Estimated: {estimatedHalvingDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      )}
    </div>
  );
}

function TimeUnit({ value, label }) {
  return (
    <div className="text-center">
      <div className="text-3xl sm:text-4xl font-bold text-white tabular-nums">
        {String(value).padStart(2, '0')}
      </div>
      <div className="text-xs text-gray-400 uppercase tracking-wider mt-1">{label}</div>
    </div>
  );
}
