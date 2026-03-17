import { useState, useEffect } from 'react';
import { getHistory, onHistoryReady, startHistoryFetch } from '../store/useBitcoinStore';

/**
 * Returns full Binance price history (2000+ days).
 * Fires immediately if cached, otherwise ~1-2s from Binance.
 */
export function usePriceData() {
  const [prices, setPrices] = useState(() => getHistory());
  const [loading, setLoading] = useState(!getHistory());

  useEffect(() => {
    startHistoryFetch(); // no-op if already started
    const unsub = onHistoryReady((data) => {
      setPrices(data);
      setLoading(false);
    });
    return unsub;
  }, []);

  return { prices, loading };
}

// Alias for Cycle Repeat (same data, needs 1458+ days)
export const useFullPriceData = usePriceData;

export function computeSMA(prices, period) {
  const result = [];
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) { result.push(null); continue; }
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += prices[j].price;
    result.push(sum / period);
  }
  return result;
}

export function logRegression(prices) {
  const n = prices.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (let i = 0; i < n; i++) {
    const x = Math.log(i + 1), y = Math.log(prices[i].price);
    sumX += x; sumY += y; sumXY += x * y; sumXX += x * x;
  }
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  let ss = 0;
  for (let i = 0; i < n; i++)
    ss += (Math.log(prices[i].price) - (slope * Math.log(i + 1) + intercept)) ** 2;
  return { slope, intercept, stdDev: Math.sqrt(ss / n) };
}
