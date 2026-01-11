import React, { useState, useEffect } from 'react';
import { TrendingUp, Percent, Activity, RefreshCw } from 'lucide-react';
import { calculateEfficiencyMetrics } from '../lib/fetch-defillama';

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
    if (num < 0.01) return `${(num * 100).toFixed(4)}%`;
    return `${num.toFixed(2)}%`;
};

const formatMultiple = (num) => {
    if (!num || isNaN(num)) return '0x';
    return `${num.toFixed(2)}x`;
};

const CapitalEfficiencyTable = () => {
    const [period, setPeriod] = useState(7);
    const [metrics, setMetrics] = useState(null);
    const [loading, setLoading] = useState(true);
    const [sortConfig, setSortConfig] = useState({ key: 'annualizedFeeYield', direction: 'desc' });

    const fetchMetrics = async () => {
        setLoading(true);
        try {
            const data = await calculateEfficiencyMetrics(period);
            setMetrics(data);
            console.log('Efficiency metrics:', data);
        } catch (e) {
            console.error('Failed to fetch efficiency metrics:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMetrics();
    }, [period]);

    const sortedDexes = React.useMemo(() => {
        if (!metrics?.metrics) return [];

        const dexArray = Object.values(metrics.metrics);
        return dexArray.sort((a, b) => {
            const aVal = a[sortConfig.key] || 0;
            const bVal = b[sortConfig.key] || 0;
            return sortConfig.direction === 'desc' ? bVal - aVal : aVal - bVal;
        });
    }, [metrics, sortConfig]);

    const handleSort = (key) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc',
        }));
    };

    const SortHeader = ({ label, sortKey }) => (
        <th
            className="efficiency-th sortable"
            onClick={() => handleSort(sortKey)}
        >
            {label}
            {sortConfig.key === sortKey && (
                <span className="sort-indicator">{sortConfig.direction === 'desc' ? ' ↓' : ' ↑'}</span>
            )}
        </th>
    );

    if (loading) {
        return (
            <div className="efficiency-card loading">
                <div className="loading-spinner">
                    <RefreshCw className="spin" size={24} />
                    <span>Loading efficiency metrics...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="efficiency-card">
            <div className="efficiency-header">
                <div className="efficiency-title">
                    <TrendingUp size={20} />
                    <h3>Capital Efficiency Comparison</h3>
                </div>

                <div className="period-selector">
                    {[1, 7, 30].map(days => (
                        <button
                            key={days}
                            className={`period-btn ${period === days ? 'active' : ''}`}
                            onClick={() => setPeriod(days)}
                        >
                            {days === 1 ? '24h' : `${days}d`}
                        </button>
                    ))}
                    <button className="refresh-btn" onClick={fetchMetrics}>
                        <RefreshCw size={16} />
                    </button>
                </div>
            </div>

            <div className="efficiency-table-wrapper">
                <table className="efficiency-table">
                    <thead>
                        <tr>
                            <th className="efficiency-th">DEX</th>
                            <SortHeader label="TVL" sortKey="tvl" />
                            <SortHeader label={`Fees (${period}d)`} sortKey="fees" />
                            <SortHeader label={`Volume (${period}d)`} sortKey="volume" />
                            <SortHeader label="Fee Yield (APR)" sortKey="annualizedFeeYield" />
                            <SortHeader label="Fee Rate" sortKey="feeToVolume" />
                            <SortHeader label="Capital Turnover" sortKey="volumeToTvl" />
                        </tr>
                    </thead>
                    <tbody>
                        {sortedDexes.map(dex => (
                            <tr key={dex.name}>
                                <td className="dex-name-cell">
                                    <span
                                        className="dex-indicator"
                                        style={{ backgroundColor: DEX_COLORS[dex.name] }}
                                    />
                                    {dex.name}
                                </td>
                                <td>{formatNumber(dex.tvl)}</td>
                                <td>{formatNumber(dex.fees)}</td>
                                <td>{formatNumber(dex.volume)}</td>
                                <td className={dex.annualizedFeeYield > 20 ? 'highlight-good' : ''}>
                                    {formatPercent(dex.annualizedFeeYield)}
                                </td>
                                <td>{formatPercent(dex.feeToVolume)}</td>
                                <td>{formatMultiple(dex.volumeToTvl)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="efficiency-legend">
                <div className="legend-item">
                    <Activity size={14} />
                    <span><strong>Fee Yield (APR)</strong>: Annualized fee earnings / TVL</span>
                </div>
                <div className="legend-item">
                    <Percent size={14} />
                    <span><strong>Fee Rate</strong>: Fees / Volume (effective fee tier)</span>
                </div>
                <div className="legend-item">
                    <TrendingUp size={14} />
                    <span><strong>Capital Turnover</strong>: Volume / TVL (capital utilization)</span>
                </div>
            </div>
        </div>
    );
};

export default CapitalEfficiencyTable;
