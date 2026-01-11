import React, { useState, useEffect } from 'react';
import { fetchPoolData as fetchDataFromSource } from '../lib/data-source';
import { DEX_LIST } from '../utils/constants';

// Child components
import DexOverview from './DexOverview';
import DexHistoricalChart from './DexHistoricalChart';
import PoolEfficiencyAnalysis from './PoolEfficiencyAnalysis';

/**
 * DefiLlamaDashboard - DefiLlama data view
 * 
 * Displays:
 * - DexOverview (stat cards + DEX filter pills + DEX stats cards)
 * - DexHistoricalChart (historical TVL/Volume/Fees)
 * - PoolEfficiencyAnalysis (pool-level data table)
 */
export default function DefiLlamaDashboard() {
    const [pools, setPools] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedDexes, setSelectedDexes] = useState(DEX_LIST);

    // Fetch pool data
    const fetchPoolData = async (forceRefresh = false) => {
        setLoading(true);
        setError(null);

        try {
            const data = await fetchDataFromSource({ forceRefresh });
            console.log(`DefiLlamaDashboard: Loaded ${data.pools.length} pools`);
            setPools(data.pools);
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

    // Toggle DEX selection
    const toggleDex = (dex) => {
        setSelectedDexes(prev =>
            prev.includes(dex)
                ? prev.filter(d => d !== dex)
                : [...prev, dex]
        );
    };

    return (
        <>
            {/* Error display */}
            {error && (
                <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400">
                    {error}
                </div>
            )}

            {/* DEX Overview (stat cards + filter pills + DEX cards) */}
            <DexOverview
                pools={pools}
                loading={loading}
                selectedDexes={selectedDexes}
                onToggleDex={toggleDex}
            />

            {/* Historical Chart */}
            <div className="mb-8">
                <DexHistoricalChart />
            </div>

            {/* Pool Efficiency Analysis */}
            <PoolEfficiencyAnalysis />
        </>
    );
}
