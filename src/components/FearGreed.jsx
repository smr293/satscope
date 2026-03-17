import useBitcoinStore from '../store/useBitcoinStore';

const getColor = (value) => {
  if (value <= 20) return '#ea3943';
  if (value <= 40) return '#ea8c00';
  if (value <= 60) return '#f5d100';
  if (value <= 80) return '#93c47d';
  return '#16c784';
};

export default function FearGreed() {
  const { fearGreedValue, fearGreedLabel, loading } = useBitcoinStore();

  if (loading.fearGreed && fearGreedValue == null) {
    return (
      <div className="glass p-6 mb-6 animate-fade-in">
        <div className="skeleton w-40 h-6 mb-4 mx-auto" />
        <div className="skeleton w-32 h-32 rounded-full mx-auto" />
      </div>
    );
  }

  const value = fearGreedValue || 0;
  const color = getColor(value);
  const circumference = 2 * Math.PI * 58;
  const offset = circumference - (value / 100) * circumference * 0.75;

  return (
    <div className="glass p-6 mb-6 animate-fade-in">
      <h2 className="text-lg font-semibold text-white text-center mb-4">
        Fear & Greed Index
      </h2>

      <div className="flex justify-center">
        <div className="relative w-40 h-40">
          <svg className="w-full h-full -rotate-135" viewBox="0 0 128 128">
            <circle
              cx="64" cy="64" r="58"
              fill="none"
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="8"
              strokeDasharray={`${circumference * 0.75} ${circumference * 0.25}`}
              strokeLinecap="round"
            />
            <circle
              cx="64" cy="64" r="58"
              fill="none"
              stroke={color}
              strokeWidth="8"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 1s ease, stroke 0.5s ease', filter: `drop-shadow(0 0 6px ${color})` }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-black text-white">{value}</span>
            <span className="text-xs text-gray-400 mt-1">{fearGreedLabel}</span>
          </div>
        </div>
      </div>

      <div className="flex justify-between mt-4 text-xs text-gray-500 px-4">
        <span>Extreme Fear</span>
        <span>Extreme Greed</span>
      </div>
    </div>
  );
}
