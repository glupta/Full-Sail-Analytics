/**
 * Data Source - DefiLlama Integration
 * Fetches pool data from DefiLlama yields API
 */

import { fetchSuiPools } from './fetch-defillama.js';

// Cache configuration
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const cache = { data: null, timestamp: 0 };

/**
 * Normalize pool data to standard schema
 */
function normalizePool(pool) {
    return {
        id: pool.id || pool.pool,
        name: pool.name || pool.symbol || 'Unknown',
        dex: pool.dex,
        tvl: pool.tvl || 0,
        volume_24h: pool.volume_24h || 0,
        volume_7d: pool.volume_7d || 0,
        volume_30d: pool.volume_30d || 0,
        fees_24h: pool.fees_24h || 0,
        fees_7d: pool.fees_7d || 0,
        fees_30d: pool.fees_30d || 0,
        feeRate: pool.fee_vol_ratio || 0.003,
        apr: pool.apr || pool.apy || 0,
        apyBase: pool.apyBase || 0,
        apyReward: pool.apyReward || 0,
        stablecoin: pool.stablecoin || false,
    };
}

/**
 * Calculate DEX-level statistics from pool data
 */
function calculateDexStats(pools) {
    const stats = {};

    for (const pool of pools) {
        if (!stats[pool.dex]) {
            stats[pool.dex] = {
                poolCount: 0,
                totalTVL: 0,
                volume24h: 0,
                fees24h: 0,
            };
        }

        const s = stats[pool.dex];
        s.poolCount++;
        s.totalTVL += pool.tvl || 0;
        s.volume24h += pool.volume_24h || 0;
        s.fees24h += pool.fees_24h || 0;
    }

    return stats;
}

/**
 * Fetch pool data from DefiLlama
 * @param {Object} options - Fetch options
 * @param {boolean} options.forceRefresh - Bypass cache
 */
export async function fetchPoolData(options = {}) {
    const { forceRefresh = false } = options;

    // Check cache
    if (!forceRefresh && cache.data && (Date.now() - cache.timestamp) < CACHE_TTL_MS) {
        console.log('[DataSource] Using cached data');
        return { ...cache.data, mode: 'DefiLlama' };
    }

    console.log('[DataSource] Fetching from DefiLlama...');
    const rawPools = await fetchSuiPools();
    const pools = rawPools.map(normalizePool);

    console.log(`[DataSource] Loaded ${pools.length} pools`);

    const totalTVL = pools.reduce((sum, p) => sum + (p.tvl || 0), 0);
    const totalVolume24h = pools.reduce((sum, p) => sum + (p.volume_24h || 0), 0);

    const result = {
        pools,
        dexStats: calculateDexStats(pools),
        summary: { totalTVL, totalVolume24h, totalPools: pools.length },
        lastUpdated: new Date().toISOString(),
        mode: 'DefiLlama',
    };

    // Cache result
    cache.data = result;
    cache.timestamp = Date.now();

    return result;
}

/**
 * Get current data source mode
 */
export function getDataSourceMode() {
    return 'DefiLlama';
}

/**
 * Clear cached data
 */
export function clearCache() {
    cache.data = null;
    cache.timestamp = 0;
}

export default { fetchPoolData, getDataSourceMode, clearCache };
