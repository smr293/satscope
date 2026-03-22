import { useEffect } from 'react';
import useBitcoinStore from './store/useBitcoinStore';
import ErrorBoundary from './components/ErrorBoundary';
import Header from './components/Header';
import Hero from './components/Hero';
import StatsGrid from './components/StatsGrid';
import Halving from './components/Halving';
import FearGreed from './components/FearGreed';
import PriceChart from './components/PriceChart';
import CycleRepeat from './components/CycleRepeat';
import ModelCards from './components/ModelCards';
import NetworkStats from './components/NetworkStats';
import NewsFeed from './components/NewsFeed';
import MarketMetrics from './components/MarketMetrics';
import TimeMachine from './components/TimeMachine';
import DCACalculator from './components/DCACalculator';
import WhaleWatch from './components/WhaleWatch';
import CycleOracle from './components/CycleOracle';
import Footer from './components/Footer';

export default function App() {
  const startAutoUpdate = useBitcoinStore((s) => s.startAutoUpdate);

  useEffect(() => {
    const cleanup = startAutoUpdate();
    return cleanup;
  }, [startAutoUpdate]);

  return (
    <div className="min-h-screen bg-gradient-dark">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pb-8">
        <ErrorBoundary><Hero /></ErrorBoundary>
        <ErrorBoundary><StatsGrid /></ErrorBoundary>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2">
            <ErrorBoundary><Halving /></ErrorBoundary>
          </div>
          <div>
            <ErrorBoundary><FearGreed /></ErrorBoundary>
          </div>
        </div>
        <ErrorBoundary><PriceChart /></ErrorBoundary>
        <ErrorBoundary><CycleRepeat /></ErrorBoundary>
        <ErrorBoundary><ModelCards /></ErrorBoundary>
        <ErrorBoundary><MarketMetrics /></ErrorBoundary>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ErrorBoundary><NetworkStats /></ErrorBoundary>
          <ErrorBoundary><NewsFeed /></ErrorBoundary>
        </div>
        <ErrorBoundary><TimeMachine /></ErrorBoundary>
        <ErrorBoundary><DCACalculator /></ErrorBoundary>
        <ErrorBoundary><WhaleWatch /></ErrorBoundary>
        <ErrorBoundary><CycleOracle /></ErrorBoundary>
      </main>
      <Footer />
    </div>
  );
}
