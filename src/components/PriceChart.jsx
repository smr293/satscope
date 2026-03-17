import { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import useBitcoinStore from '../store/useBitcoinStore';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

export default function PriceChart() {
  const { priceHistory, loading } = useBitcoinStore();

  const chartData = useMemo(() => {
    if (!priceHistory?.prices) return null;

    const prices = priceHistory.prices;
    const labels = prices.map(([ts]) =>
      new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    );
    const data = prices.map(([, p]) => p);

    return {
      labels,
      datasets: [
        {
          label: 'BTC/USD',
          data,
          borderColor: '#F7931A',
          backgroundColor: (ctx) => {
            const gradient = ctx.chart.ctx.createLinearGradient(0, 0, 0, ctx.chart.height);
            gradient.addColorStop(0, 'rgba(247, 147, 26, 0.3)');
            gradient.addColorStop(1, 'rgba(247, 147, 26, 0)');
            return gradient;
          },
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          pointHitRadius: 10,
          borderWidth: 2,
        },
      ],
    };
  }, [priceHistory]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(15, 15, 26, 0.9)',
        borderColor: 'rgba(247, 147, 26, 0.3)',
        borderWidth: 1,
        titleColor: '#999',
        bodyColor: '#fff',
        bodyFont: { weight: 'bold', size: 14 },
        padding: 12,
        displayColors: false,
        callbacks: {
          label: (ctx) => `$${ctx.parsed.y.toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
        },
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(255,255,255,0.05)' },
        ticks: { color: '#666', maxTicksLimit: 8, font: { size: 11 } },
        border: { display: false },
      },
      y: {
        grid: { color: 'rgba(255,255,255,0.05)' },
        ticks: {
          color: '#666',
          font: { size: 11 },
          callback: (v) => `$${(v / 1000).toFixed(0)}k`,
        },
        border: { display: false },
      },
    },
  };

  if (loading.priceHistory && !priceHistory) {
    return (
      <div className="glass p-6 mb-6 animate-fade-in">
        <div className="skeleton w-48 h-6 mb-4" />
        <div className="skeleton w-full h-64" />
      </div>
    );
  }

  return (
    <div className="glass p-6 mb-6 animate-fade-in">
      <h2 className="text-lg font-semibold text-white mb-4">
        Price History (1 Year)
      </h2>
      <div className="h-64 sm:h-80">
        {chartData && <Line data={chartData} options={options} />}
      </div>
    </div>
  );
}
