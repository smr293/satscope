import { useState, useEffect, useCallback } from 'react';
import useBitcoinStore from '../store/useBitcoinStore';

const WHALE_THRESHOLDS = [
  { min: 500, label: 'Mega Whale', icon: '🐋', color: '#ef4444' },
  { min: 100, label: 'Whale', icon: '🐳', color: '#f97316' },
  { min: 50, label: 'Big Fish', icon: '🦈', color: '#eab308' },
  { min: 10, label: 'Dolphin', icon: '🐬', color: '#06b6d4' },
  { min: 1, label: 'Fish', icon: '🐟', color: '#666' },
];

function classifyTx(btcAmount) {
  for (const t of WHALE_THRESHOLDS) {
    if (btcAmount >= t.min) return t;
  }
  return WHALE_THRESHOLDS[WHALE_THRESHOLDS.length - 1];
}

function timeAgo(timestamp) {
  const diff = Date.now() / 1000 - timestamp;
  if (diff < 60) return `${Math.round(diff)}s ago`;
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  return `${Math.round(diff / 86400)}d ago`;
}

export default function WhaleWatch() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState(10);
  const currentPrice = useBitcoinStore(s => s.price);

  const fetchWhales = useCallback(async () => {
    try {
      const price = currentPrice || 84000;

      // Get the 3 most recent blocks
      const blocksRes = await fetch('https://mempool.space/api/v1/blocks');
      if (!blocksRes.ok) throw new Error('blocks fetch failed');
      const blocks = await blocksRes.json();
      const recentBlocks = blocks.slice(0, 3);

      const allTxs = [];

      // Fetch transactions from each block (first page = 25 txs per block)
      const fetches = recentBlocks.map(async (block) => {
        try {
          const res = await fetch(`https://mempool.space/api/block/${block.id}/txs/0`);
          if (!res.ok) return [];
          const txs = await res.json();
          return txs.map(tx => {
            // Sum all outputs to get total value moved
            const totalSats = (tx.vout || []).reduce((sum, out) => sum + (out.value || 0), 0);
            const btc = totalSats / 1e8;
            return {
              txid: tx.txid,
              btc,
              usd: btc * price,
              time: block.timestamp,
              blockHeight: block.height,
            };
          });
        } catch {
          return [];
        }
      });

      const results = await Promise.all(fetches);
      results.forEach(txs => allTxs.push(...txs));

      // Also try to get mempool (unconfirmed) large txs
      try {
        const mempoolRes = await fetch('https://mempool.space/api/mempool/recent');
        if (mempoolRes.ok) {
          const mempoolTxs = await mempoolRes.json();
          mempoolTxs.forEach(tx => {
            const btc = (tx.value || 0) / 1e8;
            if (btc >= 1) {
              allTxs.push({
                txid: tx.txid,
                btc,
                usd: btc * price,
                time: Date.now() / 1000,
                blockHeight: null, // unconfirmed
              });
            }
          });
        }
      } catch { /* ok */ }

      // Sort by BTC amount, filter >= 1 BTC, take top 50
      const sorted = allTxs
        .filter(tx => tx.btc >= 1 && tx.txid)
        .sort((a, b) => b.btc - a.btc)
        .slice(0, 50)
        .map(tx => ({ ...tx, classification: classifyTx(tx.btc) }));

      setTransactions(sorted);
    } catch (e) {
      console.warn('Whale fetch failed:', e);
    }
    setLoading(false);
  }, [currentPrice]);

  useEffect(() => {
    fetchWhales();
    const interval = setInterval(fetchWhales, 60000); // refresh every 60s
    return () => clearInterval(interval);
  }, [fetchWhales]);

  const filtered = transactions.filter(tx => tx.btc >= filter);

  const totalBTC = filtered.reduce((s, tx) => s + tx.btc, 0);
  const totalUSD = filtered.reduce((s, tx) => s + tx.usd, 0);

  return (
    <div className="glass p-6 mt-6 animate-fade-in" style={{ border: '1px solid rgba(6,182,212,0.2)' }}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
             style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>🐋</div>
        <div className="flex-1">
          <h2 className="text-white font-bold text-lg">Whale Watch</h2>
          <p className="text-xs text-gray-500 uppercase tracking-widest">Large BTC Transactions</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs text-gray-500">Live</span>
        </div>
      </div>
      <p className="text-sm text-gray-400 mb-4">Tracking big BTC movements from recent blocks. When whales move, pay attention.</p>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="text-[10px] text-gray-500 uppercase">Whale Txs</div>
          <div className="text-lg font-black text-white">{filtered.length}</div>
        </div>
        <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="text-[10px] text-gray-500 uppercase">Total BTC</div>
          <div className="text-lg font-black text-orange-400">₿ {totalBTC >= 1000 ? `${(totalBTC / 1000).toFixed(1)}K` : totalBTC.toFixed(1)}</div>
        </div>
        <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="text-[10px] text-gray-500 uppercase">Total USD</div>
          <div className="text-lg font-black text-cyan-400">
            {totalUSD >= 1e9 ? `$${(totalUSD / 1e9).toFixed(1)}B` : totalUSD >= 1e6 ? `$${(totalUSD / 1e6).toFixed(1)}M` : `$${Math.round(totalUSD).toLocaleString()}`}
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {[
          { label: 'All (>1 BTC)', value: 1 },
          { label: '>10 BTC', value: 10 },
          { label: '>50 BTC', value: 50 },
          { label: '>100 BTC', value: 100 },
          { label: '>500 BTC', value: 500 },
        ].map(f => (
          <button key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filter === f.value ? 'text-white' : 'text-gray-400 hover:text-white'}`}
            style={{
              background: filter === f.value ? 'rgba(6,182,212,0.2)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${filter === f.value ? 'rgba(6,182,212,0.4)' : 'rgba(255,255,255,0.06)'}`,
            }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Transaction list */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#333 transparent' }}>
        {loading ? (
          <div className="text-center py-8">
            <div className="text-2xl mb-2 animate-pulse">🐋</div>
            <p className="text-gray-500 text-sm">Scanning the ocean...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 text-sm">No whale transactions found with current filter</p>
          </div>
        ) : (
          filtered.map((tx, i) => (
            <div key={tx.txid || i}
              className="flex items-center gap-3 rounded-xl p-3 transition-all hover:bg-white/[0.03]"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
              <div className="text-xl w-8 text-center">{tx.classification.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                        style={{ background: `${tx.classification.color}20`, color: tx.classification.color }}>
                    {tx.classification.label}
                  </span>
                  <span className="text-[10px] text-gray-600">
                    {tx.blockHeight ? `Block #${tx.blockHeight.toLocaleString()}` : 'Unconfirmed'}
                  </span>
                  <span className="text-[10px] text-gray-600">{timeAgo(tx.time)}</span>
                </div>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-white font-bold">₿ {tx.btc >= 100 ? tx.btc.toFixed(1) : tx.btc.toFixed(3)}</span>
                  <span className="text-gray-500 text-xs">
                    (${tx.usd >= 1e6 ? `${(tx.usd / 1e6).toFixed(2)}M` : Math.round(tx.usd).toLocaleString()})
                  </span>
                </div>
              </div>
              <a href={`https://mempool.space/tx/${tx.txid}`}
                 target="_blank" rel="noopener noreferrer"
                 className="text-xs text-gray-600 hover:text-cyan-400 transition-colors shrink-0"
                 title="View on mempool.space">
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-none stroke-current" strokeWidth="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" />
                </svg>
              </a>
            </div>
          ))
        )}
      </div>

      <p className="text-[10px] text-gray-600 mt-3 text-center">Data from mempool.space • Recent blocks + mempool • Refreshes every 60s</p>
    </div>
  );
}
