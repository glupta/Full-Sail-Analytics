import React, { useState, useEffect, useMemo } from 'react';
import { TrendingUp, Filter, RefreshCw, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
// Unified data source (supports DefiLlama and GraphQL modes)
import { fetchPoolData as fetchDataFromSource } from '../lib/data-source';

// DEX Colors (Full Sail Brand)
const DEX_COLORS = {
    'Full Sail': '#7D99FD',  // Full Sail Blue
    'Cetus': '#10b981',      // Emerald
    'Bluefin': '#3b82f6',    // Blue
};

// Common token pairs to filter
const TOKEN_PAIRS = [
    { value: 'all', label: 'All Pairs' },
    { value: 'SUI/USDC', label: 'SUI/USDC' },
    { value: 'ETH/USDC', label: 'ETH/USDC' },
    { value: 'WBTC/USDC', label: 'WBTC/USDC' },
    { value: 'IKA/SUI', label: 'IKA/SUI' },
    { value: 'DEEP', label: 'DEEP Pools' },
    { value: 'SUI', label: 'All SUI Pairs' },
    { value: 'USDC', label: 'All USDC Pairs' },
];



const ITEMS_PER_PAGE = 20;

// Format helpers
const formatNumber = (num) => {
    if (!num || isNaN(num) || num === 0) return '-';
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(1)}K`;
    return `$${num.toFixed(0)}`;
};

const formatPercent = (num) => {
    if (!num || isNaN(num)) return '-';
    return `${num.toFixed(2)}%`;
};

const formatRatio = (num) => {
    if (!num || isNaN(num)) return '-';
    return num.toFixed(4);
}

// Custom tooltip for charts
const ChartTooltip = ({ active, payload, label }) => {
    if (!active || !payload) return null;
    return (
        <div className="chart-tooltip">
            <p className="tooltip-label">{label}</p>
            {payload.map((entry, idx) => (
                <p key={idx} style={{ color: entry.color }}>
                    {entry.name}: {formatNumber(entry.value)}
                </p>
            ))}
        </div>
    );
};

const PoolEfficiencyAnalysis = () => {
    const [pools, setPools] = useState([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [selectedPair, setSelectedPair] = useState('all');
    const [selectedDex, setSelectedDex] = useState('all');
    const [showDexDropdown, setShowDexDropdown] = useState(false);
    const [timeRange, setTimeRange] = useState('24h'); // 24h, 7d, 30d for Fees columns

    // Table Sort & Pagination
    const [sortConfig, setSortConfig] = useState({ key: 'fees_24h', direction: 'desc' });
    const [currentPage, setCurrentPage] = useState(1);
    const [showDropdown, setShowDropdown] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch pool data from unified data source
            const data = await fetchDataFromSource();

            // Calculate efficiency ratios for each pool
            const poolData = (data.pools || []).map(pool => {
                return {
                    ...pool,
                    // Calculate ratios from pool-level data
                    fee_tvl_ratio: pool.tvl > 0 ? (pool.fees_24h * 365) / pool.tvl : 0,
                    vol_tvl_ratio: pool.tvl > 0 ? pool.volume_24h / pool.tvl : 0,
                    fee_vol_ratio: pool.volume_24h > 0 ? pool.fees_24h / pool.volume_24h : 0,
                    apr: pool.apr || (pool.feeRate ? (pool.feeRate * 365 * 100) : 0),
                };
            });
            setPools(poolData);
        } catch (e) {
            console.error('Failed to fetch pool data:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Reset page when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [selectedPair, selectedDex, sortConfig]);

    // Filter logic - improved token matching
    const filteredPools = useMemo(() => {
        return pools.filter(pool => {
            // DEX filter
            if (selectedDex !== 'all' && pool.dex !== selectedDex) {
                return false;
            }

            // Pair filter with improved token matching
            if (selectedPair !== 'all') {
                const name = pool.name?.toUpperCase() || '';
                const filter = selectedPair.toUpperCase();

                // Helper to check if token exists as a discrete token in the pair name
                // This prevents STSUI, HASUI, SUIUSDT from matching when filtering for SUI
                const hasExactToken = (poolName, token) => {
                    // Split by common separators and check for exact match
                    const tokens = poolName.split(/[-\/\s]+/);
                    return tokens.some(t => t === token);
                };

                if (filter === 'DEEP') {
                    if (!hasExactToken(name, 'DEEP')) return false;
                } else if (filter === 'SUI' || filter === 'USDC') {
                    // For generic token filters, require exact token match
                    if (!hasExactToken(name, filter)) return false;
                } else {
                    // For specific pairs like SUI/USDC, both tokens must match exactly
                    const [token1, token2] = filter.split('/');
                    if (!(hasExactToken(name, token1) && hasExactToken(name, token2))) return false;
                }
            }

            return true;
        });
    }, [pools, selectedPair, selectedDex]);

    // Sort logic
    const sortedPools = useMemo(() => {
        return [...filteredPools].sort((a, b) => {
            const aVal = a[sortConfig.key] || 0;
            const bVal = b[sortConfig.key] || 0;
            return sortConfig.direction === 'desc' ? bVal - aVal : aVal - bVal;
        });
    }, [filteredPools, sortConfig]);

    // Pagination logic
    const totalPages = Math.ceil(sortedPools.length / ITEMS_PER_PAGE);
    const paginatedPools = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return sortedPools.slice(start, start + ITEMS_PER_PAGE);
    }, [sortedPools, currentPage]);

    const handleSort = (key) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc',
        }));
    };

    if (loading) {
        return (
            <div className="efficiency-card loading">
                <div className="loading-spinner">
                    <RefreshCw className="spin" size={24} />
                    <span>Loading dashboard data...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="pool-efficiency-section">
            {/* Main Pool Table */}
            <div className="efficiency-card">
                <div className="efficiency-header">
                    <div className="efficiency-title">
                        <TrendingUp size={20} />
                        <h3>All Pools ({filteredPools.length})</h3>
                    </div>

                    <div className="filter-controls">
                        {/* Time Range Toggle */}
                        <div className="toggle-group">
                            {['24h', '7d', '30d'].map(range => (
                                <button
                                    key={range}
                                    className={`toggle-btn ${timeRange === range ? 'active' : ''}`}
                                    onClick={() => setTimeRange(range)}
                                >
                                    {range}
                                </button>
                            ))}
                        </div>

                        {/* DEX Dropdown */}
                        <div className="dropdown-container">
                            <button
                                className="dropdown-btn"
                                onClick={() => setShowDexDropdown(!showDexDropdown)}
                            >
                                <Filter size={16} />
                                {selectedDex === 'all' ? 'All DEXs' : selectedDex}
                                <ChevronDown size={16} />
                            </button>
                            {showDexDropdown && (
                                <div className="dropdown-menu">
                                    {['all', 'Full Sail', 'Cetus', 'Bluefin'].map(dex => (
                                        <button
                                            key={dex}
                                            className={`dropdown-item ${selectedDex === dex ? 'active' : ''}`}
                                            onClick={() => {
                                                setSelectedDex(dex);
                                                setShowDexDropdown(false);
                                            }}
                                        >
                                            {dex === 'all' ? 'All DEXs' : dex}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Token Pair Dropdown */}
                        <div className="dropdown-container">
                            <button
                                className="dropdown-btn"
                                onClick={() => setShowDropdown(!showDropdown)}
                            >
                                <Filter size={16} />
                                {TOKEN_PAIRS.find(p => p.value === selectedPair)?.label}
                                <ChevronDown size={16} />
                            </button>
                            {showDropdown && (
                                <div className="dropdown-menu">
                                    {TOKEN_PAIRS.map(pair => (
                                        <button
                                            key={pair.value}
                                            className={`dropdown-item ${selectedPair === pair.value ? 'active' : ''}`}
                                            onClick={() => {
                                                setSelectedPair(pair.value);
                                                setShowDropdown(false);
                                            }}
                                        >
                                            {pair.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <button className="refresh-btn" onClick={fetchData}>
                            <RefreshCw size={16} />
                        </button>
                    </div>
                </div>

                <div className="pagination-info">
                    Page {currentPage} of {totalPages || 1}
                </div>

                <div className="efficiency-table-wrapper">
                    <table className="efficiency-table">
                        <thead>
                            <tr>
                                <th className="efficiency-th">Pool</th>
                                <th className="efficiency-th">DEX</th>
                                <th className="efficiency-th sortable" onClick={() => handleSort('tvl')}>TVL {sortConfig.key === 'tvl' && '↓'}</th>

                                {/* Fees - Dynamic based on timeRange */}
                                <th className="efficiency-th sortable" onClick={() => handleSort(`fees_${timeRange}`)}>
                                    Fees ({timeRange}) {sortConfig.key === `fees_${timeRange}` && '↓'}
                                </th>

                                {/* Efficiency Ratios */}
                                <th className="efficiency-th sortable" onClick={() => handleSort('fee_tvl_ratio')} title="Annualized Fees / TVL">Fee/TVL {sortConfig.key === 'fee_tvl_ratio' && '↓'}</th>
                                <th className="efficiency-th sortable" onClick={() => handleSort('apr')} title="LP Yield (Fees + Rewards)">LP Yield {sortConfig.key === 'apr' && '↓'}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedPools.map(pool => (
                                <tr key={pool.id}>
                                    <td className="pool-name-cell">
                                        <div className="pool-name-main">{pool.name}</div>
                                    </td>
                                    <td className="dex-name-cell">
                                        <span className="dex-indicator" style={{ backgroundColor: DEX_COLORS[pool.dex] }} />
                                        {pool.dex}
                                    </td>
                                    <td>{formatNumber(pool.tvl)}</td>

                                    {/* Fees - Dynamic based on timeRange */}
                                    <td className="font-mono">{formatNumber(pool[`fees_${timeRange}`])}</td>

                                    {/* Ratios */}
                                    <td className={pool.fee_tvl_ratio > 0.5 ? 'highlight-good' : ''}>
                                        {formatPercent(pool.fee_tvl_ratio * 100)}
                                    </td>
                                    <td className={pool.apr > 20 ? 'highlight-good' : ''}>{formatPercent(pool.apr)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <div className="pagination-controls">
                        <button
                            className="pagination-btn"
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                        >
                            <ChevronLeft size={16} /> Previous
                        </button>

                        <div className="pagination-pages">
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                let pageNum;
                                if (totalPages <= 5) pageNum = i + 1;
                                else if (currentPage <= 3) pageNum = i + 1;
                                else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                                else pageNum = currentPage - 2 + i;

                                return (
                                    <button
                                        key={pageNum}
                                        className={`pagination-page ${currentPage === pageNum ? 'active' : ''}`}
                                        onClick={() => setCurrentPage(pageNum)}
                                    >
                                        {pageNum}
                                    </button>
                                );
                            })}
                        </div>

                        <button
                            className="pagination-btn"
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                        >
                            Next <ChevronRight size={16} />
                        </button>
                    </div>
                )}
            </div>
        </div >
    );
};

export default PoolEfficiencyAnalysis;
