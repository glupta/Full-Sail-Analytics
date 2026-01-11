import React, { useState, useEffect, useMemo } from 'react';
import { RefreshCw, TrendingUp, Droplets, ChevronUp, ChevronDown } from 'lucide-react';
// Unified data source (supports DefiLlama, GraphQL, and hybrid modes)
import { fetchPoolData as fetchDataFromSource, getDataSourceMode } from '../lib/data-source';
import PoolEfficiencyAnalysis from './PoolEfficiencyAnalysis';
import DexHistoricalChart from './DexHistoricalChart';
import GraphQLDashboard from './GraphQLDashboard';

// DEX Colors (Full Sail Brand)
const DEX_COLORS = {
  'Full Sail': '#7D99FD',  // Full Sail Blue
  'Cetus': '#10b981',      // Emerald
  'Bluefin': '#3b82f6',    // Blue
};

// Format helpers
const formatNumber = (num) => {
  if (!num || isNaN(num)) return '$0';
  if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `$${(num / 1e3).toFixed(1)}K`;
  return `$${num.toFixed(0)}`;
};

const formatPercent = (num) => {
  if (!num || isNaN(num)) return '0%';
  return `${num.toFixed(2)}%`;
};


// Skeleton Component
const Skeleton = ({ className }) => (
  <div className={`skeleton ${className}`}></div>
);

// Custom Tooltip for Charts
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass-card rounded-lg p-3 text-sm">
        <p className="font-semibold text-white mb-1">{label}</p>
        {payload.map((entry, idx) => (
          <p key={idx} style={{ color: entry.color }}>
            {entry.name}: {formatNumber(entry.value)}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// Stat Card Component
const StatCard = ({ icon: Icon, label, value, loading, variant = 'cyan' }) => (
  <div className={`glass-card glass-card-hover rounded-xl p-5 relative overflow-hidden`}>
    <div className={`absolute inset-0 opacity-10 bg-gradient-to-br ${variant === 'cyan' ? 'from-cyan-500 to-cyan-600' :
      variant === 'blue' ? 'from-blue-500 to-blue-600' :
        'from-purple-500 to-purple-600'
      }`} />
    <div className="relative">
      <div className="flex items-center gap-2 text-slate-400 mb-2">
        <Icon size={18} className={
          variant === 'cyan' ? 'text-cyan-400' :
            variant === 'blue' ? 'text-blue-400' :
              'text-purple-400'
        } />
        <span className="text-sm font-medium">{label}</span>
      </div>
      {loading ? (
        <Skeleton className="h-8 w-32" />
      ) : (
        <div className="text-3xl font-bold text-white animate-count">{value}</div>
      )}
    </div>
  </div>
);

export default function SuiDexDashboard() {
  const [viewMode, setViewMode] = useState('defillama'); // 'defillama' or 'graphql'
  const [pools, setPools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDexes, setSelectedDexes] = useState(['Full Sail', 'Cetus', 'Bluefin']);
  const [sortConfig, setSortConfig] = useState({ key: 'tvl', direction: 'desc' });
  const [searchTerm, setSearchTerm] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  // Summary data for charts (from unified data source)
  const [graphqlSummary, setGraphqlSummary] = useState(null);
  const [dataSourceMode, setDataSourceMode] = useState('loading');

  const fetchPoolData = async (forceRefresh = false) => {
    setLoading(true);
    setError(null);

    try {
      // Fetch from unified data source (DefiLlama, GraphQL, or hybrid)
      console.log('Fetching from unified data source...');

      const data = await fetchDataFromSource({ forceRefresh });
      console.log(`Loaded ${data.pools.length} pools via ${data.mode} mode`);

      // Update data source mode for footer display
      setDataSourceMode(data.mode);

      setGraphqlSummary({
        totalTVL: data.summary?.totalTVL || 0,
        totalVolume: data.summary?.totalVolume24h || 0,
        dexData: Object.fromEntries(
          Object.entries(data.dexStats || {}).map(([dex, stats]) => [
            dex, {
              tvl: stats.totalTVL,
              volume_24h: stats.volume24h,
              volume_7d: stats.volume7d,
              volume_30d: stats.volume30d,
              fees_24h: stats.fees24h,
              fees_7d: stats.fees7d,
              fees_30d: stats.fees30d,
            }
          ])
        ),
      });

      setPools(data.pools);
      setLastUpdated(data.lastUpdated ? new Date(data.lastUpdated) : new Date());
    } catch (e) {
      console.error('Error loading DEX data:', e);
      setError('Failed to fetch data. Check console for details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPoolData();
  }, []);

  // Filter and sort pools
  const filteredPools = useMemo(() => {
    let result = pools.filter(p =>
      selectedDexes.includes(p.dex) &&
      (searchTerm === '' || p.name?.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    result.sort((a, b) => {
      const aVal = a[sortConfig.key] || 0;
      const bVal = b[sortConfig.key] || 0;
      return sortConfig.direction === 'desc' ? bVal - aVal : aVal - bVal;
    });

    return result;
  }, [pools, selectedDexes, searchTerm, sortConfig]);

  // Calculate stats per DEX
  const dexStats = useMemo(() => {
    const stats = {};
    Object.keys(DEX_COLORS).forEach(dex => {
      const dexPools = pools.filter(p => p.dex === dex);
      stats[dex] = {
        poolCount: dexPools.length,
        totalTVL: dexPools.reduce((sum, p) => sum + (p.tvl || 0), 0),
        totalVolume: dexPools.reduce((sum, p) => sum + (p.volume_24h || 0), 0),
        totalFees: dexPools.reduce((sum, p) => sum + (p.fees_24h || 0), 0),
        avgAPR: dexPools.length > 0
          ? dexPools.reduce((sum, p) => sum + (p.apr || 0), 0) / dexPools.length
          : 0,
      };
    });
    return stats;
  }, [pools]);

  // Use GraphQL data for totals
  const totalStats = useMemo(() => ({
    tvl: graphqlSummary?.totalTVL || Object.values(dexStats).reduce((sum, s) => sum + s.totalTVL, 0),
    volume: graphqlSummary?.totalVolume || Object.values(dexStats).reduce((sum, s) => sum + s.totalVolume, 0),
    pools: Object.values(dexStats).reduce((sum, s) => sum + s.poolCount, 0),
  }), [dexStats, graphqlSummary]);

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc',
    }));
  };

  const toggleDex = (dex) => {
    setSelectedDexes(prev =>
      prev.includes(dex)
        ? prev.filter(d => d !== dex)
        : [...prev, dex]
    );
  };

  const SortIcon = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) return null;
    return sortConfig.direction === 'desc' ? <ChevronDown size={14} /> : <ChevronUp size={14} />;
  };

  // If GraphQL mode, render the GraphQL dashboard (placed after all hooks)
  if (viewMode === 'graphql') {
    return (
      <div className="min-h-screen animated-bg text-white p-6 lg:p-8">
        {/* Header with toggle - matches DefiLlama layout */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-[#7D99FD] via-blue-400 to-purple-400 bg-clip-text text-transparent glow-text">
              Sui DEX Capital Efficiency
            </h1>
            <p className="text-slate-400 mt-2">
              Compare LP yields and capital efficiency across Sui DEXs
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Data Source Toggle */}
            <div className="flex bg-slate-800/50 border border-slate-700 rounded-lg p-1">
              <button
                onClick={() => setViewMode('defillama')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'defillama'
                  ? 'bg-[#7D99FD] text-white'
                  : 'text-slate-400 hover:text-white'
                  }`}
              >
                DefiLlama
              </button>
              <button
                onClick={() => setViewMode('graphql')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'graphql'
                  ? 'bg-[#7D99FD] text-white'
                  : 'text-slate-400 hover:text-white'
                  }`}
              >
                GraphQL
              </button>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#7D99FD] to-blue-600 hover:from-[#9DB5FF] hover:to-blue-500 rounded-xl font-medium transition-all duration-300 shadow-lg shadow-[#7D99FD]/20 hover:shadow-[#7D99FD]/40"
            >
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>
        </div>
        {/* Render GraphQL Dashboard content */}
        <GraphQLDashboard embedded={true} />
      </div>
    );
  }

  return (
    <div className="min-h-screen animated-bg text-white p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-[#7D99FD] via-blue-400 to-purple-400 bg-clip-text text-transparent glow-text">
            Sui DEX Capital Efficiency
          </h1>
          <p className="text-slate-400 mt-2">
            Compare LP yields and capital efficiency across Sui DEXs
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Data Source Toggle */}
          <div className="flex bg-slate-800/50 border border-slate-700 rounded-lg p-1">
            <button
              onClick={() => setViewMode('defillama')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'defillama'
                ? 'bg-[#7D99FD] text-white'
                : 'text-slate-400 hover:text-white'
                }`}
            >
              DefiLlama
            </button>
            <button
              onClick={() => setViewMode('graphql')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'graphql'
                ? 'bg-[#7D99FD] text-white'
                : 'text-slate-400 hover:text-white'
                }`}
            >
              GraphQL
            </button>
          </div>
          {lastUpdated && (
            <span className="text-slate-500 text-sm">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={() => fetchPoolData(true)}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#7D99FD] to-blue-600 hover:from-[#9DB5FF] hover:to-blue-500 rounded-xl font-medium transition-all duration-300 shadow-lg shadow-[#7D99FD]/20 hover:shadow-[#7D99FD]/40 disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Total Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <StatCard icon={Droplets} label="Total TVL" value={formatNumber(totalStats.tvl)} loading={loading} variant="cyan" />
        <StatCard icon={TrendingUp} label="Total Pools" value={totalStats.pools.toString()} loading={loading} variant="purple" />
      </div>

      {/* Historical DEX Comparison Chart */}
      <div className="mb-8">
        <DexHistoricalChart />
      </div>

      {/* DEX Filter Pills */}
      <div className="flex flex-wrap gap-2 mb-6">
        {Object.keys(DEX_COLORS).map(dex => (
          <button
            key={dex}
            onClick={() => toggleDex(dex)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${selectedDexes.includes(dex)
              ? 'text-white shadow-lg'
              : 'text-slate-400 bg-slate-800/50'
              }`}
            style={{
              backgroundColor: selectedDexes.includes(dex)
                ? DEX_COLORS[dex]
                : undefined,
              boxShadow: selectedDexes.includes(dex)
                ? `0 4px 15px -3px ${DEX_COLORS[dex]}66`
                : undefined,
            }}
          >
            {dex}
            {dexStats[dex] && (
              <span className="ml-2 opacity-75">
                ({dexStats[dex].poolCount})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* DEX Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {selectedDexes.map(dex => (
          <div
            key={dex}
            className="glass-card glass-card-hover rounded-xl p-4 border-l-4"
            style={{ borderLeftColor: DEX_COLORS[dex] }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="font-semibold" style={{ color: DEX_COLORS[dex] }}>{dex}</span>
              <span className="text-slate-500 text-sm">{dexStats[dex]?.poolCount || 0} pools</span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">TVL</span>
                <span className="font-mono">{formatNumber(dexStats[dex]?.totalTVL)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">24h Vol</span>
                <span className="font-mono">{formatNumber(dexStats[dex]?.totalVolume)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Avg APR</span>
                <span className="text-green-400 font-mono">{formatPercent(dexStats[dex]?.avgAPR)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      {/* Pool-Level Efficiency Analysis - Single consolidated table per spec */}
      <PoolEfficiencyAnalysis />

      {/* Footer */}
      <div className="mt-8 text-center text-slate-500 text-sm">
        Powered by <span className="text-[#7D99FD] font-medium">Full Sail</span> • Data via DefiLlama
      </div>
    </div>
  );
}
