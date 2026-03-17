export const formatUSD = (num) => {
  if (num == null) return '—';
  if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
  if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(num);
};

export const formatBTC = (num) => {
  if (num == null) return '—';
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
  return new Intl.NumberFormat('en-US').format(Math.round(num));
};

export const formatPercent = (num) => {
  if (num == null) return '—';
  const sign = num >= 0 ? '+' : '';
  return `${sign}${num.toFixed(2)}%`;
};

export const formatHashrate = (hashrate) => {
  if (hashrate == null) return '—';
  if (hashrate >= 1e18) return `${(hashrate / 1e18).toFixed(2)} EH/s`;
  if (hashrate >= 1e15) return `${(hashrate / 1e15).toFixed(2)} PH/s`;
  if (hashrate >= 1e12) return `${(hashrate / 1e12).toFixed(2)} TH/s`;
  return `${hashrate} H/s`;
};

export const formatNumber = (num) => {
  if (num == null) return '—';
  return new Intl.NumberFormat('en-US').format(num);
};

export const timeAgo = (timestamp) => {
  if (!timestamp) return 'never';
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
};
