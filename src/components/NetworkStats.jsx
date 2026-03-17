import useBitcoinStore from '../store/useBitcoinStore';
import { formatHashrate, formatNumber } from '../utils/formatters';

export default function NetworkStats() {
  const { hashrate, difficulty, difficultyChange, difficultyProgress, unconfirmedTx, mempoolSize, loading } = useBitcoinStore();

  const formatVsize = (vsize) => {
    if (vsize == null) return '—';
    if (vsize >= 1e6) return `${(vsize / 1e6).toFixed(1)} MvB`;
    return `${(vsize / 1e3).toFixed(0)} kvB`;
  };

  const stats = [
    {
      label: 'Hashrate',
      value: hashrate != null ? formatHashrate(hashrate) : '—',
      icon: '⚡',
      sub: null,
    },
    {
      label: 'Difficulty',
      value: difficulty != null ? `${(difficulty / 1e12).toFixed(2)}T` : '—',
      icon: '🎚️',
      sub: difficultyChange != null ? `Next: ${difficultyChange >= 0 ? '+' : ''}${difficultyChange.toFixed(1)}%` : null,
      subColor: difficultyChange >= 0 ? 'text-green-400' : 'text-red-400',
    },
    {
      label: 'Diff. Progress',
      value: difficultyProgress != null ? `${difficultyProgress.toFixed(1)}%` : '—',
      icon: '📊',
      progress: difficultyProgress,
    },
    {
      label: 'Unconfirmed TX',
      value: unconfirmedTx != null ? formatNumber(unconfirmedTx) : '—',
      icon: '📨',
      sub: null,
    },
    {
      label: 'Mempool Size',
      value: formatVsize(mempoolSize),
      icon: '💾',
      sub: null,
    },
  ];

  if (loading.network && !hashrate) {
    return (
      <div className="glass p-6 mb-6 animate-fade-in">
        <div className="skeleton w-40 h-6 mb-4" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="skeleton w-full h-20" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="glass p-6 mb-6 animate-fade-in">
      <h2 className="text-lg font-semibold text-white mb-4">
        Network Statistics
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {stats.map(stat => (
          <div key={stat.label} className="text-center p-3 rounded-xl bg-white/[0.03] border border-white/5">
            <span className="text-xl mb-1 block">{stat.icon}</span>
            <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">{stat.label}</p>
            <p className="text-base font-bold text-white">{stat.value}</p>
            {stat.sub && (
              <p className={`text-[10px] mt-1 ${stat.subColor || 'text-gray-500'}`}>{stat.sub}</p>
            )}
            {stat.progress != null && (
              <div className="w-full bg-white/10 rounded-full h-1 mt-2">
                <div
                  className="bg-btc h-1 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(stat.progress, 100)}%` }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
