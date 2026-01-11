import React, { useMemo } from 'react';
import { Droplets, TrendingUp } from 'lucide-react';
import { formatNumber, formatPercent } from '../utils/format';
import { DEX_COLORS } from '../utils/constants';
import { StatCard } from '../utils/components';

/**
 * DexOverview - Displays aggregate stats and per-DEX summary cards
 * 
 * Props:
 * - pools: Array of pool objects
 * - loading: Boolean loading state
 * - selectedDexes: Array of selected DEX names
 * - onToggleDex: Function to toggle DEX selection
 */
export default function DexOverview({ pools = [], loading, selectedDexes, onToggleDex }) {
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

    // Calculate total stats
    const totalStats = useMemo(() => ({
        tvl: Object.values(dexStats).reduce((sum, s) => sum + s.totalTVL, 0),
        volume: Object.values(dexStats).reduce((sum, s) => sum + s.totalVolume, 0),
        pools: Object.values(dexStats).reduce((sum, s) => sum + s.poolCount, 0),
    }), [dexStats]);

    return (
        <>
            {/* Total Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                <StatCard
                    icon={Droplets}
                    label="Total TVL"
                    value={formatNumber(totalStats.tvl)}
                    loading={loading}
                    variant="cyan"
                />
                <StatCard
                    icon={TrendingUp}
                    label="Total Pools"
                    value={totalStats.pools.toString()}
                    loading={loading}
                    variant="purple"
                />
            </div>

            {/* DEX Filter Pills */}
            <div className="flex flex-wrap gap-2 mb-6">
                {Object.keys(DEX_COLORS).map(dex => (
                    <button
                        key={dex}
                        onClick={() => onToggleDex(dex)}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${selectedDexes.includes(dex)
                                ? 'text-white shadow-lg'
                                : 'text-slate-400 bg-slate-800/50'
                            }`}
                        style={{
                            backgroundColor: selectedDexes.includes(dex) ? DEX_COLORS[dex] : undefined,
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
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
        </>
    );
}
