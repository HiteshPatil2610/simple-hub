import React, { useState } from 'react';
import {
  TrendingUp,
  MousePointerClick,
  Users,
  Download,
  RefreshCw,
  ArrowUpRight,
  Smartphone,
  Laptop,
  Tablet,
  ExternalLink,
  Search,
  Flame,
  Calendar,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { AnalyticsSummary, Product } from '../types';

interface AnalyticsDashboardProps {
  analytics: AnalyticsSummary | null;
  products: Product[];
  isLoading: boolean;
  onRefresh: () => void;
  onSelectProduct: (product: Product) => void;
}

const DEVICE_ICONS: Record<string, React.ReactNode> = {
  Mobile: <Smartphone className="w-3.5 h-3.5" />,
  Desktop: <Laptop className="w-3.5 h-3.5" />,
  Tablet: <Tablet className="w-3.5 h-3.5" />,
};

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  analytics,
  products,
  isLoading,
  onRefresh,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'products' | 'clicks'>('overview');
  const [logFilter, setLogFilter] = useState('');


  if (isLoading || !analytics) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <div className="inline-flex items-center justify-center p-4 bg-[#FFE600] border-2 border-[#111111] rounded-2xl mb-4 shadow-[3px_3px_0px_0px_#111111]">
          <RefreshCw className="w-6 h-6 text-[#111111] animate-spin" />
        </div>
        <h2 className="text-xl font-display font-extrabold text-[var(--foreground)]">Loading tracking analytics...</h2>
        <p className="text-sm font-bold text-[var(--muted-text)] mt-1">Gathering outbound click telemetry</p>
      </div>
    );
  }

  // Export clicks as CSV
  const handleExportCSV = () => {
    if (!analytics.recentClicks.length) return;
    const headers = ['Click ID', 'Product', 'Category', 'Timestamp', 'Device', 'Referrer', 'UTM Source', 'Destination URL'];
    const rows = analytics.recentClicks.map(c => [
      c.id,
      `"${c.productTitle.replace(/"/g, '""')}"`,
      c.category,
      c.timestamp,
      c.device,
      c.referrer,
      c.utmSource || '',
      `"${c.destinationUrl.replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `raccoonhub_clicks_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredClicks = analytics.recentClicks.filter(c => {
    const query = logFilter.toLowerCase();
    return (
      c.productTitle.toLowerCase().includes(query) ||
      c.referrer.toLowerCase().includes(query) ||
      c.category.toLowerCase().includes(query)
    );
  });

  return (
    <div data-testid="analytics-dashboard" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-6 animate-in fade-in duration-300 text-[var(--foreground)]">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b-2 border-[var(--border)]/20 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="px-2.5 py-0.5 rounded-md bg-[#FF5722] text-white border-2 border-[#111111] text-[10px] font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_#111111]">
              Affiliate Tracking Engine
            </span>
            <span className="text-xs text-[var(--muted-text)] font-mono font-bold">
              Live telemetry
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-[var(--foreground)] mt-2">
            Click Stream & Telemetry
          </h1>
          <p className="text-sm text-[var(--muted-text)] font-bold mt-1">
            Real-time outbound click tracking and visitor engagement across all curated Amazon affiliate links.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            id="analytics-refresh-btn"
            data-testid="refresh-analytics-button"
            onClick={onRefresh}
            className="flex items-center gap-1.5 px-4 py-2 bg-[var(--card)] hover:bg-[var(--muted)] text-[var(--foreground)] rounded-xl text-xs font-black uppercase border-2 border-[var(--border)] shadow-[3px_3px_0px_0px_var(--border)] active:translate-y-0.5 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>

          <button
            id="analytics-export-btn"
            data-testid="export-csv-button"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#4ECDC4] hover:bg-[#3dbdb5] text-[#111111] rounded-xl text-xs font-black uppercase border-2 border-[#111111] shadow-[3px_3px_0px_0px_#111111] active:translate-y-0.5 transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* KPI Cards (metric-card-0 through metric-card-3 with distinct top accent borders: cyan, coral, yellow, mint) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Metric 0: Total Clicks */}
        <div data-testid="metric-card-0" className="bg-[var(--card)] p-4 sm:p-5 rounded-2xl border-2 border-[var(--border)] border-t-6 border-t-[#00E5FF] shadow-[4px_4px_0px_0px_var(--border)]">
          <div className="flex items-center justify-between text-[var(--foreground)] mb-1.5">
            <span className="text-[11px] font-black uppercase">Total Clicks</span>
            <MousePointerClick className="w-4 h-4 text-[#00E5FF]" />
          </div>
          <div className="text-2xl sm:text-3xl font-display font-extrabold text-[var(--foreground)]">
            {analytics.totalClicks.toLocaleString()}
          </div>
          <div className="text-[10px] text-[var(--muted-text)] font-bold mt-1">
            Lifetime outbound clicks
          </div>
        </div>

        {/* Metric 1: Unique Visitors */}
        <div data-testid="metric-card-1" className="bg-[var(--card)] p-4 sm:p-5 rounded-2xl border-2 border-[var(--border)] border-t-6 border-t-[#FF6B6B] shadow-[4px_4px_0px_0px_var(--border)]">
          <div className="flex items-center justify-between text-[var(--foreground)] mb-1.5">
            <span className="text-[11px] font-black uppercase">Unique Clickers</span>
            <Users className="w-4 h-4 text-[#FF6B6B]" />
          </div>
          <div className="text-2xl sm:text-3xl font-display font-extrabold text-[var(--foreground)]">
            {analytics.uniqueVisitors.toLocaleString()}
          </div>
          <div className="text-[10px] text-[var(--muted-text)] font-bold mt-1">
            Anonymous visitor hashes
          </div>
        </div>

        {/* Metric 2: Clicks Today */}
        <div data-testid="metric-card-2" className="bg-[var(--card)] p-4 sm:p-5 rounded-2xl border-2 border-[var(--border)] border-t-6 border-t-[#FFE600] shadow-[4px_4px_0px_0px_var(--border)]">
          <div className="flex items-center justify-between text-[var(--foreground)] mb-1.5">
            <span className="text-[11px] font-black uppercase">Clicks Today</span>
            <Flame className="w-4 h-4 text-[#FFE600]" />
          </div>
          <div className="text-2xl sm:text-3xl font-display font-extrabold text-[var(--foreground)]">
            {analytics.clicksToday.toLocaleString()}
          </div>
          <div className="text-[10px] text-[var(--muted-text)] font-bold mt-1">
            Recorded past 24 hrs
          </div>
        </div>

        {/* Metric 3: Active Products */}
        <div data-testid="metric-card-3" className="bg-[var(--card)] p-4 sm:p-5 rounded-2xl border-2 border-[var(--border)] border-t-6 border-t-[#4ECDC4] shadow-[4px_4px_0px_0px_var(--border)]">
          <div className="flex items-center justify-between text-[var(--foreground)] mb-1.5">
            <span className="text-[11px] font-black uppercase">Tracked Products</span>
            <Calendar className="w-4 h-4 text-[#4ECDC4]" />
          </div>
          <div className="text-2xl sm:text-3xl font-display font-extrabold text-[var(--foreground)]">
            {products.length}
          </div>
          <div className="text-[10px] text-[var(--muted-text)] font-bold mt-1">
            Active Amazon items
          </div>
        </div>
      </div>


      {/* Navigation Sub-Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b-3 border-[var(--border)]/30 pb-3">
        <button
          id="tab-overview"
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl border-2 border-[var(--border)] transition ${
            activeTab === 'overview'
              ? 'bg-[#FF6B6B] text-white shadow-[3px_3px_0px_0px_var(--border)]'
              : 'bg-[var(--card)] text-[var(--foreground)] hover:bg-[#FFE600] hover:text-[#111111] shadow-[2px_2px_0px_0px_var(--border)]'
          }`}
        >
          Visual Trends & Performance
        </button>
        <button
          id="tab-products"
          onClick={() => setActiveTab('products')}
          className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl border-2 border-[var(--border)] transition ${
            activeTab === 'products'
              ? 'bg-[#FF6B6B] text-white shadow-[3px_3px_0px_0px_var(--border)]'
              : 'bg-[var(--card)] text-[var(--foreground)] hover:bg-[#FFE600] hover:text-[#111111] shadow-[2px_2px_0px_0px_var(--border)]'
          }`}
        >
          Product Breakdown ({analytics.topProducts.length})
        </button>
        <button
          id="tab-clicks"
          onClick={() => setActiveTab('clicks')}
          className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl border-2 border-[var(--border)] transition ${
            activeTab === 'clicks'
              ? 'bg-[#FF6B6B] text-white shadow-[3px_3px_0px_0px_var(--border)]'
              : 'bg-[var(--card)] text-[var(--foreground)] hover:bg-[#FFE600] hover:text-[#111111] shadow-[2px_2px_0px_0px_var(--border)]'
          }`}
        >
          Live Click Log ({analytics.recentClicks.length})
        </button>
      </div>

      {/* TAB 1: OVERVIEW & CHARTS */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Main Traffic Trend Chart: Outbound Clicks (Last 14 Days) */}
          <div className="bg-[var(--card)] p-5 sm:p-6 rounded-[2rem] border-3 border-[var(--border)] shadow-[6px_6px_0px_0px_var(--border)]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-2">
              <div>
                <h3 className="font-black text-[var(--foreground)] text-base sm:text-lg">
                  Outbound Clicks (Last 14 Days)
                </h3>
                <p className="text-xs text-[var(--muted-text)] font-bold mt-0.5">
                  Daily distribution of visitors clicking through your Amazon affiliate links.
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs font-black">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-[#FF6B6B] border border-[var(--border)]"></span>
                  <span className="text-[var(--foreground)]">Clicks</span>
                </div>
              </div>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analytics.clicksByDay} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="clicksGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#FF6B6B" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#FF6B6B" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.2} />
                  <XAxis dataKey="date" tickLine={false} axisLine={{ stroke: 'var(--border)' }} tick={{ fontSize: 11, fill: 'var(--foreground)', fontWeight: 'bold' }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'var(--foreground)', fontWeight: 'bold' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--card)',
                      color: 'var(--foreground)',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      border: '2px solid var(--border)',
                    }}
                  />
                  <Area type="monotone" dataKey="clicks" stroke="#FF6B6B" strokeWidth={3} fillOpacity={1} fill="url(#clicksGrad)" name="Clicks" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Secondary Charts: Top Categories & Device/Referrer Mix */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Category Performance */}
            <div className="bg-[var(--card)] p-5 rounded-[2rem] border-3 border-[var(--border)] shadow-[6px_6px_0px_0px_var(--border)] flex flex-col justify-between">
              <div>
                <h4 className="font-black text-[var(--foreground)] text-sm uppercase mb-1">
                  Top Categories
                </h4>
                <p className="text-xs text-[var(--muted-text)] font-bold mb-4">
                  Highest engagement Amazon niches
                </p>
                <div className="space-y-3">
                  {analytics.categoryBreakdown.map(c => (
                    <div key={c.category} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-black">
                        <span className="text-[var(--foreground)] truncate max-w-[180px]">{c.category}</span>
                        <span className="text-[var(--muted-text)]">{c.clicks} clicks ({c.percentage}%)</span>
                      </div>
                      <div className="w-full h-3 rounded-full bg-[var(--muted)] border-2 border-[var(--border)] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#FF6B6B] transition-all duration-500"
                          style={{ width: `${c.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="pt-4 mt-4 border-t-2 border-[var(--border)]/20 text-[11px] text-[var(--muted-text)] font-bold">
                Tech gadgets and desk novelties drive the highest outbound engagement.
              </div>
            </div>

            {/* Device & Traffic Sources */}
            <div className="bg-[var(--card)] p-5 rounded-[2rem] border-3 border-[var(--border)] shadow-[6px_6px_0px_0px_var(--border)] flex flex-col justify-between">
              <div>
                <h4 className="font-black text-[var(--foreground)] text-sm uppercase mb-1">
                  Device & Referrer Mix
                </h4>
                <p className="text-xs text-[var(--muted-text)] font-bold mb-4">
                  Where traffic originates before redirecting to Amazon
                </p>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {analytics.deviceBreakdown.map(d => (
                    <div key={d.device} className="p-2.5 rounded-xl bg-[var(--muted)] border-2 border-[var(--border)] text-center shadow-[2px_2px_0px_0px_var(--border)]">
                      <div className="flex justify-center text-[var(--foreground)] mb-1">
                        {DEVICE_ICONS[d.device] || <Smartphone className="w-3.5 h-3.5" />}
                      </div>
                      <div className="text-xs font-black text-[var(--foreground)]">{d.percentage}%</div>
                      <div className="text-[10px] text-[var(--muted-text)] font-bold">{d.device}</div>
                    </div>
                  ))}
                </div>

                <div className="text-xs text-[var(--foreground)] space-y-2">
                  {(() => {
                    const total = analytics.recentClicks.length;
                    if (total === 0) {
                      return (
                        <div className="text-[var(--muted-text)] font-bold text-center py-2">No click data yet.</div>
                      );
                    }
                    const directCount = analytics.recentClicks.filter(
                      c => c.referrer === 'direct' || c.referrer === ''
                    ).length;
                    const socialCount = analytics.recentClicks.filter(
                      c => /instagram|tiktok|facebook|twitter|x\.com|pinterest|snapchat/i.test(c.referrer)
                    ).length;
                    const searchCount = total - directCount - socialCount;
                    const pct = (n: number) => Math.round((n / total) * 100);
                    return (
                      <>
                        <div className="flex justify-between font-bold">
                          <span>Direct / Browser Link</span>
                          <span className="font-black text-[#FF6B6B]">{pct(directCount)}%</span>
                        </div>
                        <div className="flex justify-between font-bold">
                          <span>Social Media &amp; Mobile Apps</span>
                          <span className="font-black text-[#4ECDC4]">{pct(socialCount)}%</span>
                        </div>
                        <div className="flex justify-between font-bold">
                          <span>Search &amp; Referral</span>
                          <span className="font-black text-[#FFE600]">{pct(searchCount)}%</span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
              <div className="pt-4 mt-4 border-t-2 border-[var(--border)]/20 text-[11px] text-[var(--muted-text)] font-bold">
                Optimized direct Amazon redirect routes through active affiliate tags.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PRODUCTS BREAKDOWN */}
      {activeTab === 'products' && (
        <div className="bg-[var(--card)] rounded-[2rem] border-3 border-[var(--border)] overflow-hidden shadow-[6px_6px_0px_0px_var(--border)]">
          <div className="p-5 sm:p-6 border-b-2 border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[var(--muted)]">
            <div>
              <h3 className="font-black text-[var(--foreground)] text-base sm:text-lg">
                Product Performance Leaderboard
              </h3>
              <p className="text-xs text-[var(--muted-text)] font-bold">
                Ranked by outbound click volume to Amazon
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--muted)] text-[var(--foreground)] uppercase tracking-wider font-black border-b-2 border-[var(--border)]">
                <tr>
                  <th className="py-3.5 px-4">Product</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4 text-right">Total Clicks</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-[var(--border)]/20">
                {analytics.topProducts.map((p, idx) => {
                  const productCategory =
                    products.find(prod => prod.id === p.productId)?.category || 'Amazon Find';

                  return (
                    <tr key={p.productId} className="hover:bg-[var(--muted)]/50 transition">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-bold text-[var(--muted-text)] text-xs w-4">#{idx + 1}</span>
                          <img
                            src={p.imageUrl}
                            alt={p.productTitle}
                            referrerPolicy="no-referrer"
                            className="w-11 h-11 rounded-xl object-cover bg-[#FFE600]/30 border-2 border-[var(--border)] shrink-0 shadow-[1px_1px_0px_0px_var(--border)]"
                            onError={e => {
                              (e.target as HTMLImageElement).src =
                                'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=800&auto=format&fit=crop&q=80';
                            }}
                          />
                          <div>
                            <div className="font-black text-[var(--foreground)] line-clamp-1 max-w-xs sm:max-w-md">
                              {p.productTitle}
                            </div>
                            <div className="text-[11px] text-[var(--muted-text)] font-mono font-bold">ID: {p.productId}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase border-2 border-[#111111] bg-[#FFE600] text-[#111111] shadow-[1px_1px_0px_0px_var(--border)]">
                          {productCategory}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <span className="font-black text-[#FF6B6B] text-base">{p.clicks}</span>
                        <span className="text-[11px] font-bold text-[var(--muted-text)] ml-1">clicks</span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <a
                          href={`/api/redirect/${p.productId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-black text-xs text-[#111111] bg-[#FFE600] hover:bg-[#e6d000] border-2 border-[#111111] px-3 py-1.5 rounded-xl shadow-[2px_2px_0px_0px_var(--border)] active:translate-y-0.5 transition"
                          title="Test outbound Amazon affiliate link"
                        >
                          <span>Test Link</span>
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: LIVE CLICK STREAM LOG */}
      {activeTab === 'clicks' && (
        <div className="bg-[var(--card)] rounded-[2rem] border-3 border-[var(--border)] overflow-hidden shadow-[6px_6px_0px_0px_var(--border)]">
          <div className="p-5 sm:p-6 border-b-2 border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[var(--muted)]">
            <div>
              <h3 className="font-black text-[var(--foreground)] text-base sm:text-lg">
                Real-Time Outbound Click Stream
              </h3>
              <p className="text-xs text-[var(--muted-text)] font-bold">
                Granular click events captured whenever a visitor clicks to view on Amazon.
              </p>
            </div>

            {/* Search filter */}
            <div className="flex items-center gap-2">
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-[var(--muted-text)] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={logFilter}
                  onChange={e => setLogFilter(e.target.value)}
                  placeholder="Search by product, referrer..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-[var(--card)] border-2 border-[var(--border)] rounded-xl text-[var(--foreground)] font-bold shadow-[2px_2px_0px_0px_var(--border)] focus:outline-none min-h-[38px]"
                />
                {logFilter && (
                  <button
                    onClick={() => setLogFilter('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-black text-[#FF6B6B] hover:underline"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--muted)] text-[var(--foreground)] uppercase tracking-wider font-black border-b-2 border-[var(--border)]">
                <tr>
                  <th className="py-3.5 px-4">Time</th>
                  <th className="py-3.5 px-4">Product</th>
                  <th className="py-3.5 px-4">Device</th>
                  <th className="py-3.5 px-4">Referrer</th>
                  <th className="py-3.5 px-4">Tracking Destination</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-[var(--border)]/20 font-mono">
                {filteredClicks.map(click => {
                  const date = new Date(click.timestamp);
                  const timeFormatted = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                  const dateFormatted = date.toLocaleDateString([], { month: 'short', day: 'numeric' });

                  return (
                    <tr key={click.id} className="hover:bg-[var(--muted)]/50 transition">
                      <td className="py-3.5 px-4 text-[var(--muted-text)] font-bold whitespace-nowrap">
                        <div>{timeFormatted}</div>
                        <div className="text-[10px] opacity-75">{dateFormatted}</div>
                      </td>
                      <td className="py-3.5 px-4 font-sans font-black text-[var(--foreground)] max-w-xs truncate">
                        {click.productTitle}
                      </td>
                      <td className="py-3.5 px-4 font-sans text-[var(--foreground)] font-bold">
                        <div className="inline-flex items-center gap-1.5 bg-[var(--card)] border border-[var(--border)] px-2 py-0.5 rounded-lg shadow-[1px_1px_0px_0px_var(--border)]">
                          {DEVICE_ICONS[click.device] || <Smartphone className="w-3.5 h-3.5" />}
                          <span>{click.device}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-[var(--foreground)] font-semibold">
                        {click.referrer}
                      </td>
                      <td className="py-3.5 px-4 max-w-xs truncate text-[11px] text-[#FF5722] dark:text-[#00E5FF] hover:underline font-bold">
                        <a href={click.destinationUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1">
                          <span className="truncate">{click.destinationUrl}</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      </td>
                    </tr>
                  );
                })}
                {filteredClicks.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-[var(--muted-text)] font-sans font-bold">
                      No click events matching your filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
