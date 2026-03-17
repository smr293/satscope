import useBitcoinStore from '../store/useBitcoinStore';
import { formatUSD, formatBTC } from '../utils/formatters';

function StatCard({ label, value, icon, loading }) {
  if (loading) {
    return (
      <div className="glass p-5">
        <div className="skeleton w-20 h-4 mb-3" />
        <div className="skeleton w-32 h-7" />
      </div>
    );
  }

  return (
    <div className="glass p-5 group">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{icon}</span>
        <p className="text-xs text-gray-400 uppercase tracking-wider">{label}</p>
      </div>
      <p className="text-xl sm:text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

export default function StatsGrid() {
  const { marketCap, volume24h, circulatingSupply, totalSupply, loading } = useBitcoinStore();
  const supplyPercent = circulatingSupply ? ((circulatingSupply / totalSupply) * 100).toFixed(1) : null;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6 animate-fade-in">
      <StatCard
        label="Market Cap"
        value={formatUSD(marketCap)}
        icon="💎"
        loading={loading.price && !marketCap}
      />
      <StatCard
        label="Volume 24h"
        value={formatUSD(volume24h)}
        icon="📊"
        loading={loading.price && !volume24h}
      />
      <StatCard
        label="Circulating"
        value={circulatingSupply ? `${formatBTC(circulatingSupply)} BTC` : '—'}
        icon="🪙"
        loading={loading.market && !circulatingSupply}
      />
      <div className="glass p-5">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">⛏️</span>
          <p className="text-xs text-gray-400 uppercase tracking-wider">Mined</p>
        </div>
        <p className="text-xl sm:text-2xl font-bold text-white mb-2">{supplyPercent ? `${supplyPercent}%` : '—'}</p>
        <div className="w-full bg-white/10 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-btc to-btc-light h-2 rounded-full transition-all duration-1000"
            style={{ width: `${supplyPercent || 0}%` }}
          />
        </div>
      </div>
    </div>
  );
}
