import React, { useState, useEffect, useMemo } from 'react';
import { Activity, RefreshCw } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { fetchSuiFees, fetchSuiHistoricalVolume } from '../lib/fetch-defillama';

// DEX Colors (Full Sail Brand)
const DEX_COLORS = {
    'Full Sail': '#7D99FD',
    'Cetus': '#10b981',
    'Bluefin': '#3b82f6',
};

// Protocol slugs for TVL historical data
const PROTOCOL_SLUGS = {
    'Full Sail': 'full-sail',
    'Cetus': 'cetus-amm',
    'Bluefin': 'bluefin-spot'
};

// Available metrics from DefiLlama
const METRICS = [
    { key: 'fees', label: 'Fees', description: 'Protocol fee revenue per day' },
    { key: 'volume', label: 'Volume', description: 'Trading volume per day' },
    { key: 'tvl', label: 'TVL', description: 'Total value locked' },
    { key: 'feeTvl', label: 'Fee/TVL', description: 'Fee efficiency (annualized)' },
];

// Period options
const PERIODS = [
    { days: 7, label: '7d' },
    { days: 14, label: '14d' },
    { days: 30, label: '30d' },
    { days: 90, label: '3m' },
];

// Format helpers
const formatNumber = (num) => {
    if (!num || isNaN(num)) return '$0';
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(1)}K`;
    return `$${num.toFixed(0)}`;
};

const formatPercent = (num) => {
    if (!num || isNaN(num)) return '0%';
    return `${(num * 100).toFixed(2)}%`;
};

// Custom tooltip
const ChartTooltip = ({ active, payload, label, metric }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="chart-tooltip">
            <p className="tooltip-label">{label}</p>
            {payload.map((entry, idx) => (
                <p key={idx} style={{ color: entry.color }}>
                    {entry.name}: {metric === 'feeTvl' ? formatPercent(entry.value) : formatNumber(entry.value)}
                </p>
            ))}
        </div>
    );
};

// Fetch historical TVL for all DEXs
async function fetchHistoricalTVL(days = 30) {
    const dexNames = Object.keys(PROTOCOL_SLUGS);
    const results = {};

    try {
        // Fetch TVL for each DEX in parallel
        const promises = dexNames.map(async (dex) => {
            const slug = PROTOCOL_SLUGS[dex];
            try {
                const res = await fetch(`https://api.llama.fi/protocol/${slug}`);
                if (!res.ok) return { dex, data: [] };
                const data = await res.json();
                return { dex, data: data.tvl || [] };
            } catch {
                return { dex, data: [] };
            }
        });

        const allData = await Promise.all(promises);

        // Find common date range (last N days)
        const now = Date.now();
        const cutoff = now - (days * 24 * 60 * 60 * 1000);

        // Build daily data map
        const dailyMap = {};

        allData.forEach(({ dex, data }) => {
            data.forEach(({ date, totalLiquidityUSD }) => {
                const timestamp = date * 1000;
                if (timestamp < cutoff) return;

                const dateStr = new Date(timestamp).toISOString().split('T')[0];
                if (!dailyMap[dateStr]) {
                    dailyMap[dateStr] = { date: dateStr };
                }
                dailyMap[dateStr][dex] = totalLiquidityUSD || 0;
            });
        });

        // Convert to array and sort by date
        const daily = Object.values(dailyMap)
            .sort((a, b) => a.date.localeCompare(b.date))
            .slice(-days);

        return { daily, totals: {} };
    } catch (e) {
        console.error('TVL fetch failed:', e);
        return { daily: [], totals: {} };
    }
}

const DexHistoricalChart = () => {
    const [metric, setMetric] = useState('fees');
    const [period, setPeriod] = useState(30);
    const [rawData, setRawData] = useState({ fees: [], volume: [], tvl: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            // Fetch all metrics in parallel
            const [feesData, volumeData, tvlData] = await Promise.all([
                fetchSuiFees(period),
                fetchSuiHistoricalVolume(period),
                fetchHistoricalTVL(period),
            ]);

            setRawData({
                fees: feesData?.daily || [],
                volume: volumeData?.daily || [],
                tvl: tvlData?.daily || [],
            });

            if (!feesData?.daily?.length && !volumeData?.daily?.length && !tvlData?.daily?.length) {
                setError('No historical data available');
            }
        } catch (e) {
            console.error('Failed to fetch historical data:', e);
            setError('Failed to load historical data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [period]);

    // Get chart data based on selected metric
    const chartData = useMemo(() => {
        let data = [];

        if (metric === 'fees') {
            data = rawData.fees;
        } else if (metric === 'volume') {
            data = rawData.volume;
        } else if (metric === 'tvl') {
            data = rawData.tvl;
        } else if (metric === 'feeTvl') {
            // Calculate Fee/TVL ratio by merging fees and tvl data
            const feesMap = {};
            rawData.fees.forEach(d => {
                feesMap[d.date] = d;
            });

            data = rawData.tvl.map(tvlDay => {
                const feeDay = feesMap[tvlDay.date] || {};
                const result = { date: tvlDay.date };

                Object.keys(DEX_COLORS).forEach(dex => {
                    const fees = feeDay[dex] || 0;
                    const tvl = tvlDay[dex] || 0;
                    // Annualized fee/tvl ratio
                    result[dex] = tvl > 0 ? (fees * 365) / tvl : 0;
                });

                return result;
            });
        }

        // Format dates for display (MM/DD)
        return data.map(d => ({
            ...d,
            dateDisplay: d.date ? d.date.slice(5) : '',
        }));
    }, [rawData, metric]);

    const dexNames = Object.keys(DEX_COLORS);

    // Calculate tick count for even spacing
    const tickCount = Math.min(chartData.length, 7);

    return (
        <div className="chart-container">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <div className="flex items-center gap-2">
                    <Activity size={20} className="text-[#7D99FD]" />
                    <h3 className="font-semibold text-lg">DEX Comparison Over Time</h3>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                    {/* Metric Selector */}
                    <div className="flex gap-1 bg-slate-800/50 rounded-lg p-1">
                        {METRICS.map(m => (
                            <button
                                key={m.key}
                                onClick={() => setMetric(m.key)}
                                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${metric === m.key
                                    ? 'bg-[#7D99FD]/20 text-[#7D99FD]'
                                    : 'text-slate-400 hover:text-white'
                                    }`}
                                title={m.description}
                            >
                                {m.label}
                            </button>
                        ))}
                    </div>

                    {/* Period Selector */}
                    <div className="flex gap-1 bg-slate-800/50 rounded-lg p-1">
                        {PERIODS.map(p => (
                            <button
                                key={p.days}
                                onClick={() => setPeriod(p.days)}
                                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${period === p.days
                                    ? 'bg-blue-500/20 text-blue-400'
                                    : 'text-slate-400 hover:text-white'
                                    }`}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={fetchData}
                        className="p-2 rounded-lg bg-slate-800/50 text-slate-400 hover:text-white transition-colors"
                        disabled={loading}
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            <div className="h-72">
                {loading ? (
                    <div className="h-full flex items-center justify-center text-slate-400">
                        <RefreshCw className="animate-spin mr-2" size={20} />
                        Loading historical data...
                    </div>
                ) : error ? (
                    <div className="h-full flex items-center justify-center text-slate-500">
                        {error}
                    </div>
                ) : chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                            <XAxis
                                dataKey="dateDisplay"
                                stroke="#64748b"
                                fontSize={11}
                                tickLine={false}
                                interval={Math.max(0, Math.floor(chartData.length / tickCount) - 1)}
                            />
                            <YAxis
                                stroke="#64748b"
                                fontSize={11}
                                tickLine={false}
                                tickFormatter={(v) => {
                                    if (metric === 'feeTvl') {
                                        return `${(v * 100).toFixed(0)}%`;
                                    }
                                    if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
                                    if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
                                    return `$${v}`;
                                }}
                            />
                            <Tooltip content={<ChartTooltip metric={metric} />} />
                            <Legend />
                            {dexNames.map(dex => (
                                <Line
                                    key={dex}
                                    type="monotone"
                                    dataKey={dex}
                                    stroke={DEX_COLORS[dex]}
                                    strokeWidth={2}
                                    dot={false}
                                    name={dex}
                                />
                            ))}
                        </LineChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="h-full flex items-center justify-center text-slate-500">
                        No data available for this period
                    </div>
                )}
            </div>
        </div>
    );
};

export default DexHistoricalChart;
