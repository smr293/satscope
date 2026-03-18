export default function Footer() {
  return (
    <footer className="text-center py-8 text-xs text-gray-600 border-t border-white/5">
      <p className="font-bold text-gray-500 flex items-center justify-center gap-2">
        <span style={{ color: '#F7931A' }}>忍</span>
        Satoshi<span className="text-gradient-orange">Kuza</span>
        <span className="text-gray-600">— Shadow of the Chain</span>
      </p>
      <p className="mt-1">Data updates automatically &bull; Sources: Binance, CoinGecko, alternative.me, mempool.space</p>
      <p className="mt-1 italic">Not financial advice. The blade cuts both ways. DYOR.</p>
    </footer>
  );
}
