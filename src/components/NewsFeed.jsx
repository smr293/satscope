import useBitcoinStore from '../store/useBitcoinStore';

export default function NewsFeed() {
  const { news, loading } = useBitcoinStore();

  if (loading.news && !news) {
    return (
      <div className="glass p-6 mb-6 animate-fade-in">
        <div className="skeleton w-48 h-6 mb-4" />
        {[1, 2, 3].map(i => (
          <div key={i} className="skeleton w-full h-16 mb-3" />
        ))}
      </div>
    );
  }

  if (!news || news.length === 0) return null;

  return (
    <div className="glass p-6 mb-6 animate-fade-in">
      <h2 className="text-lg font-semibold text-white mb-4">
        Latest News
      </h2>
      <div className="space-y-3">
        {news.slice(0, 3).map((article, i) => (
          <a
            key={i}
            href={article.link}
            target="_blank"
            rel="noopener noreferrer"
            className="block p-4 rounded-xl bg-white/[0.03] border border-white/5 hover:border-btc/30 hover:bg-white/[0.06] transition-all group"
          >
            <h3 className="text-sm font-medium text-white group-hover:text-btc transition-colors line-clamp-2">
              {article.title}
            </h3>
            {article.description && (
              <p className="text-xs text-gray-500 mt-1 line-clamp-2">{article.description}</p>
            )}
            {article.pubDate && (
              <p className="text-xs text-gray-600 mt-2">
                {new Date(article.pubDate).toLocaleDateString('en-US', {
                  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                })}
              </p>
            )}
          </a>
        ))}
      </div>
    </div>
  );
}
