import React, { useState, useEffect, useMemo } from 'react';
import { RefreshCw, TrendingUp, Droplets, Activity, ChevronUp, ChevronDown, Search, Database, Wifi, WifiOff, Settings, Check, X } from 'lucide-react';
import { fetchGraphQLPoolData, clearGraphQLCache } from '../lib/graphql-data-source';
import { fetchPoolData as fetchDefiLlamaData } from '../lib/data-source';

// DEX Colors (Full Sail Brand)
const DEX_COLORS = {
    'Full Sail': '#7D99FD',
    'Cetus': '#10b981',
    'Bluefin': '#3b82f6',
};

// Available columns configuration
const COLUMN_CONFIG = [
    { key: 'name', label: 'Pool', required: true, group: 'basic' },
    { key: 'dex', label: 'DEX', required: true, group: 'basic' },
    { key: 'tvl', label: 'TVL', group: 'liquidity', format: 'currency' },
    { key: 'activeLiquidity', label: 'Active Liq.', group: 'liquidity', format: 'currency', tooltip: 'Liquidity within current tick range' },
    { key: 'liq10', label: 'Liq ±10%', group: 'liquidity', format: 'currency', tooltip: 'Liquidity within ±10% of current price' },
    { key: 'liq20', label: 'Liq ±20%', group: 'liquidity', format: 'currency', tooltip: 'Liquidity within ±20% of current price' },
    { key: 'volume_24h', label: '24h Vol', group: 'volume', format: 'currency' },
    { key: 'volume_7d', label: '7d Vol', group: 'volume', format: 'currency' },
    { key: 'fees_24h', label: '24h Fees', group: 'fees', format: 'currency' },
    { key: 'feeRate', label: 'Fee Rate', group: 'fees', format: 'percent' },
    { key: 'feePerActiveLiq', label: 'Fee/Active Liq', group: 'efficiency', format: 'percent', tooltip: 'Annualized fee yield on active liquidity' },
    { key: 'apr', label: 'APR', group: 'rewards', format: 'percent' },
    { key: 'apyBase', label: 'Base APY', group: 'rewards', format: 'percent', tooltip: 'APY from trading fees' },
    { key: 'apyReward', label: 'Reward APY', group: 'rewards', format: 'percent', tooltip: 'APY from token incentives' },
    { key: 'emissions', label: 'Emissions', group: 'rewards', format: 'currency', tooltip: 'Daily token emissions value' },
    { key: 'mystenIncentives', label: 'Mysten Incentives', group: 'rewards', format: 'currency', tooltip: 'Sui Foundation incentives' },
    { key: 'turnover', label: 'Turnover', group: 'efficiency', format: 'ratio', tooltip: 'Volume/TVL ratio' },
    { key: 'defiLlamaTvl', label: 'DefiLlama TVL', group: 'validation', format: 'currency', tooltip: 'Cross-check with DefiLlama' },
    { key: 'tvlDiff', label: 'TVL Δ', group: 'validation', format: 'percentDiff', tooltip: 'Difference from DefiLlama TVL' },
];

const COLUMN_GROUPS = {
    basic: 'Basic',
    liquidity: 'Liquidity',
    volume: 'Volume',
    fees: 'Fees',
    efficiency: 'Efficiency',
    rewards: 'Rewards',
    validation: 'Validation',
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

const formatRatio = (num) => {
    if (!num || isNaN(num)) return '0x';
    return `${num.toFixed(2)}x`;
};

const formatPercentDiff = (num) => {
    if (!num || isNaN(num)) return '-';
    const sign = num >= 0 ? '+' : '';
    return `${sign}${num.toFixed(1)}%`;
};

const formatValue = (value, format) => {
    switch (format) {
        case 'currency': return formatNumber(value);
        case 'percent': return formatPercent(value);
        case 'ratio': return formatRatio(value);
        case 'percentDiff': return formatPercentDiff(value);
        default: return value;
    }
};

// Skeleton Component
const Skeleton = ({ className }) => (
    <div className={`animate-pulse bg-slate-700/50 rounded ${className}`}></div>
);

// Status Badge Component
const StatusBadge = ({ status }) => {
    const isOnline = status === 'success';
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${isOnline ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
            {isOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
            {isOnline ? 'Connected' : 'Offline'}
        </span>
    );
};

// Stat Card Component
const StatCard = ({ icon: Icon, label, value, loading, variant = 'cyan' }) => {
    const colors = {
        cyan: 'from-cyan-500/20 to-blue-500/20 border-cyan-500/30',
        emerald: 'from-emerald-500/20 to-green-500/20 border-emerald-500/30',
        purple: 'from-purple-500/20 to-pink-500/20 border-purple-500/30',
    };

    return (
        <div className={`glass-card bg-gradient-to-br ${colors[variant]} border rounded-xl p-4`}>
            <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
                <Icon size={16} />
                <span>{label}</span>
            </div>
            {loading ? (
                <Skeleton className="h-8 w-24" />
            ) : (
                <div className="text-2xl font-bold text-white">{value}</div>
            )}
        </div>
    );
};

// Column Selector Dropdown
const ColumnSelector = ({ columns, visibleColumns, setVisibleColumns }) => {
    const [isOpen, setIsOpen] = useState(false);

    const toggleColumn = (key) => {
        const col = columns.find(c => c.key === key);
        if (col?.required) return;

        setVisibleColumns(prev =>
            prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
        );
    };

    const columnsByGroup = columns.reduce((acc, col) => {
        const group = col.group || 'other';
        if (!acc[group]) acc[group] = [];
        acc[group].push(col);
        return acc;
    }, {});

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
            >
                <Settings size={16} />
                Columns
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                    <div className="absolute right-0 mt-2 w-72 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 p-3 max-h-96 overflow-y-auto">
                        {Object.entries(COLUMN_GROUPS).map(([groupKey, groupLabel]) => (
                            columnsByGroup[groupKey] && (
                                <div key={groupKey} className="mb-3">
                                    <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
                                        {groupLabel}
                                    </div>
                                    <div className="space-y-1">
                                        {columnsByGroup[groupKey].map(col => (
                                            <label
                                                key={col.key}
                                                className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-slate-700/50 ${col.required ? 'opacity-50 cursor-not-allowed' : ''}`}
                                            >
                                                <div className={`w-4 h-4 rounded border flex items-center justify-center ${visibleColumns.includes(col.key)
                                                    ? 'bg-[#7D99FD] border-[#7D99FD]'
                                                    : 'border-slate-600'
                                                    }`}>
                                                    {visibleColumns.includes(col.key) && <Check size={12} className="text-white" />}
                                                </div>
                                                <span className="text-sm text-white">{col.label}</span>
                                                {col.tooltip && (
                                                    <span className="text-xs text-slate-500 ml-auto">{col.tooltip.slice(0, 20)}...</span>
                                                )}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

const GraphQLDashboard = ({ embedded = false, renderHeaderControls }) => {
    const [dataSource, setDataSource] = useState('graphql'); // 'graphql' or 'defillama'
    const [pools, setPools] = useState([]);
    const [defiLlamaPools, setDefiLlamaPools] = useState([]);
    const [dexStats, setDexStats] = useState({});
    const [summary, setSummary] = useState({ totalTVL: 0, totalVolume24h: 0, totalPools: 0 });
    const [fetchStatus, setFetchStatus] = useState({});
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'tvl', direction: 'desc' });
    const [activeDexes, setActiveDexes] = useState(['Full Sail', 'Cetus', 'Bluefin']);
    const [visibleColumns, setVisibleColumns] = useState(['name', 'dex', 'tvl', 'volume_24h', 'apr', 'defiLlamaTvl', 'tvlDiff']);

    const fetchAllData = async (forceRefresh = false) => {
        setLoading(true);
        try {
            // Fetch both sources in parallel for cross-checking
            const [graphqlData, defiLlamaData] = await Promise.all([
                fetchGraphQLPoolData({ forceRefresh }),
                fetchDefiLlamaData({ forceRefresh }),
            ]);

            // Store DefiLlama pools for cross-reference
            setDefiLlamaPools(defiLlamaData.pools || []);

            // Use selected data source for display
            if (dataSource === 'graphql') {
                setPools(graphqlData.pools);
                setDexStats(graphqlData.dexStats);
                setSummary(graphqlData.summary);
                setFetchStatus(graphqlData.fetchStatus || {});
            } else {
                setPools(defiLlamaData.pools);
                setDexStats(defiLlamaData.dexStats);
                setSummary(defiLlamaData.summary);
                setFetchStatus({ 'Full Sail': 'success', 'Cetus': 'success', 'Bluefin': 'success' });
            }

            setLastUpdated(new Date());
        } catch (error) {
            console.error('Fetch error:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAllData();
        const interval = setInterval(() => fetchAllData(), 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, [dataSource]);

    // Enrich pools with derived metrics and DefiLlama cross-check
    const enrichedPools = useMemo(() => {
        return pools.map(pool => {
            // Find matching DefiLlama pool
            const dlPool = defiLlamaPools.find(p =>
                p.name === pool.name && p.dex === pool.dex
            );

            const tvl = pool.tvl || 0;
            const activeLiquidity = pool.activeLiquidity || tvl * 0.8; // Estimate 80% active
            const volume24h = pool.volume_24h || 0;
            const fees24h = pool.fees_24h || (volume24h * (pool.feeRate || 0.003));

            return {
                ...pool,
                activeLiquidity,
                liq10: activeLiquidity * 0.6, // Estimate
                liq20: activeLiquidity * 0.85, // Estimate
                feePerActiveLiq: activeLiquidity > 0 ? (fees24h * 365 / activeLiquidity) * 100 : 0,
                turnover: tvl > 0 ? volume24h / tvl : 0,
                emissions: pool.emissions || 0,
                mystenIncentives: pool.mystenIncentives || 0,
                defiLlamaTvl: dlPool?.tvl || 0,
                tvlDiff: dlPool?.tvl ? ((tvl - dlPool.tvl) / dlPool.tvl) * 100 : null,
            };
        });
    }, [pools, defiLlamaPools]);

    // Filter and sort pools
    const displayPools = useMemo(() => {
        let result = [...enrichedPools];

        // Filter by active DEXes
        result = result.filter(p => activeDexes.includes(p.dex));

        // Filter by search
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            result = result.filter(p =>
                p.name?.toLowerCase().includes(q) ||
                p.dex?.toLowerCase().includes(q)
            );
        }

        // Sort
        result.sort((a, b) => {
            const aVal = a[sortConfig.key] || 0;
            const bVal = b[sortConfig.key] || 0;
            return sortConfig.direction === 'desc' ? bVal - aVal : aVal - bVal;
        });

        return result.slice(0, 50);
    }, [enrichedPools, activeDexes, searchQuery, sortConfig]);

    const handleSort = (key) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
        }));
    };

    const toggleDex = (dex) => {
        setActiveDexes(prev =>
            prev.includes(dex) ? prev.filter(d => d !== dex) : [...prev, dex]
        );
    };

    const SortIcon = ({ columnKey }) => {
        if (sortConfig.key !== columnKey) return null;
        return sortConfig.direction === 'desc' ? <ChevronDown size={14} /> : <ChevronUp size={14} />;
    };

    const visibleColumnConfigs = COLUMN_CONFIG.filter(c => visibleColumns.includes(c.key));

    // Wrapper for embedded vs standalone mode
    const Wrapper = embedded ? React.Fragment : ({ children }) => (
        <div className="min-h-screen animated-bg text-white p-4 md:p-6">{children}</div>
    );

    return (
        <Wrapper>
            <div className={embedded ? "space-y-6" : "max-w-7xl mx-auto space-y-6"}>
                {/* Header - only show when not embedded */}
                {!embedded && (
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <div className="flex items-center gap-3">
                                <Database className="text-[#7D99FD]" size={28} />
                                <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-[#7D99FD] to-cyan-400 bg-clip-text text-transparent">
                                    DEX Analytics Dashboard
                                </h1>
                            </div>
                            <p className="text-slate-400 mt-1">
                                {dataSource === 'graphql' ? 'Real-time on-chain data via Sui GraphQL RPC' : 'Aggregated data via DefiLlama API'}
                            </p>
                        </div>

                        {/* Controls Row */}
                        <div className="flex items-center gap-3 flex-wrap">
                            {lastUpdated && (
                                <span className="text-xs text-slate-500">
                                    Updated {lastUpdated.toLocaleTimeString()}
                                </span>
                            )}

                            {/* Data Source Toggle */}
                            <div className="flex bg-slate-800/50 border border-slate-700 rounded-lg p-1">
                                <button
                                    onClick={() => setDataSource('graphql')}
                                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${dataSource === 'graphql'
                                        ? 'bg-[#7D99FD] text-white'
                                        : 'text-slate-400 hover:text-white'
                                        }`}
                                >
                                    GraphQL
                                </button>
                                <button
                                    onClick={() => setDataSource('defillama')}
                                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${dataSource === 'defillama'
                                        ? 'bg-[#7D99FD] text-white'
                                        : 'text-slate-400 hover:text-white'
                                        }`}
                                >
                                    DefiLlama
                                </button>
                            </div>

                            {/* Column Selector */}
                            <ColumnSelector
                                columns={COLUMN_CONFIG}
                                visibleColumns={visibleColumns}
                                setVisibleColumns={setVisibleColumns}
                            />

                            {/* Refresh Button */}
                            <button
                                onClick={() => fetchAllData(true)}
                                className="btn-primary flex items-center gap-2 px-4 py-2 rounded-lg"
                                disabled={loading}
                                aria-label="Refresh data"
                            >
                                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                                Refresh
                            </button>
                        </div>
                    </div>
                )}



                {/* Connection Status (only for GraphQL) */}
                {dataSource === 'graphql' && (
                    <div className="glass-card rounded-xl p-4">
                        <h3 className="text-sm font-medium text-slate-400 mb-3">GraphQL Connection Status</h3>
                        <div className="flex flex-wrap gap-4">
                            {Object.entries(DEX_COLORS).map(([dex, color]) => (
                                <div key={dex} className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }}></div>
                                    <span className="text-sm text-white">{dex}</span>
                                    <StatusBadge status={fetchStatus[dex]} />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <StatCard
                        icon={Droplets}
                        label={`Total TVL (${dataSource === 'graphql' ? 'GraphQL' : 'DefiLlama'})`}
                        value={formatNumber(summary.totalTVL)}
                        loading={loading}
                        variant="cyan"
                    />
                    <StatCard
                        icon={Activity}
                        label="Total Pools"
                        value={summary.totalPools.toString()}
                        loading={loading}
                        variant="emerald"
                    />
                    <StatCard
                        icon={TrendingUp}
                        label="24h Volume"
                        value={formatNumber(summary.totalVolume24h)}
                        loading={loading}
                        variant="purple"
                    />
                </div>

                {/* DEX Filter */}
                <div className="flex flex-wrap gap-2">
                    {Object.entries(DEX_COLORS).map(([dex, color]) => (
                        <button
                            key={dex}
                            onClick={() => toggleDex(dex)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeDexes.includes(dex)
                                ? 'text-white'
                                : 'bg-slate-800/50 text-slate-500'
                                }`}
                            style={activeDexes.includes(dex) ? { backgroundColor: `${color}30`, borderColor: color, border: '1px solid' } : {}}
                        >
                            {dex}
                        </button>
                    ))}
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search pools..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-[#7D99FD]"
                    />
                </div>

                {/* Pool Table Header with Column Selector */}
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-semibold text-white">Pool Analytics</h3>
                    <ColumnSelector
                        columns={COLUMN_CONFIG}
                        visibleColumns={visibleColumns}
                        setVisibleColumns={setVisibleColumns}
                    />
                </div>

                {/* Pool Table */}
                <div className="glass-card rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-slate-700/50">
                                    {visibleColumnConfigs.map(col => (
                                        <th
                                            key={col.key}
                                            className={`p-4 text-slate-400 font-medium cursor-pointer hover:text-white ${col.key === 'name' || col.key === 'dex' ? 'text-left' : 'text-right'
                                                }`}
                                            onClick={() => handleSort(col.key)}
                                            title={col.tooltip}
                                        >
                                            <div className={`flex items-center gap-1 ${col.key === 'name' || col.key === 'dex' ? '' : 'justify-end'
                                                }`}>
                                                {col.label} <SortIcon columnKey={col.key} />
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    Array(5).fill(0).map((_, i) => (
                                        <tr key={i} className="border-b border-slate-700/30">
                                            {visibleColumnConfigs.map(col => (
                                                <td key={col.key} className="p-4">
                                                    <Skeleton className="h-5 w-20" />
                                                </td>
                                            ))}
                                        </tr>
                                    ))
                                ) : displayPools.length === 0 ? (
                                    <tr>
                                        <td colSpan={visibleColumnConfigs.length} className="p-8 text-center text-slate-500">
                                            No pools found
                                        </td>
                                    </tr>
                                ) : (
                                    displayPools.map((pool) => (
                                        <tr key={pool.id} className="border-b border-slate-700/30 hover:bg-slate-800/30">
                                            {visibleColumnConfigs.map(col => {
                                                if (col.key === 'name') {
                                                    return (
                                                        <td key={col.key} className="p-4">
                                                            <span className="font-medium text-white">{pool.name}</span>
                                                        </td>
                                                    );
                                                }
                                                if (col.key === 'dex') {
                                                    return (
                                                        <td key={col.key} className="p-4">
                                                            <span
                                                                className="px-2 py-1 rounded text-xs font-medium"
                                                                style={{
                                                                    backgroundColor: `${DEX_COLORS[pool.dex]}20`,
                                                                    color: DEX_COLORS[pool.dex]
                                                                }}
                                                            >
                                                                {pool.dex}
                                                            </span>
                                                        </td>
                                                    );
                                                }

                                                const value = pool[col.key];
                                                const formatted = formatValue(value, col.format);
                                                const colorClass = col.key === 'tvlDiff'
                                                    ? (value > 0 ? 'text-red-400' : value < 0 ? 'text-green-400' : 'text-slate-400')
                                                    : col.format === 'percent' ? 'text-emerald-400' : 'text-white';

                                                return (
                                                    <td key={col.key} className={`p-4 text-right ${colorClass}`}>
                                                        {formatted}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Data source note */}
                <div className="text-center text-xs text-slate-500">
                    {dataSource === 'graphql'
                        ? 'Data fetched directly from Sui GraphQL RPC • Pool contracts queried on-chain'
                        : 'Data aggregated from DefiLlama API'
                    }
                </div>
            </div >
        </Wrapper >
    );
};

export default GraphQLDashboard;
