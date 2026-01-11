/**
 * SDK Data Source
 * Fetches pool data directly from each DEX's SDK/API
 * Aggregates data from Cetus, Bluefin, and Full Sail
 */

import { fetchCetusPools } from './fetch-cetus-sdk.js';
import { fetchBluefinPools } from './fetch-bluefin-sdk.js';

// Dynamic import for Full Sail SDK to avoid Vite bundling issues
// The @fullsailfinance/sdk package has misconfigured exports for browser environments
async function fetchFullSailPools() {
    try {
        const module = await import('./fetch-fullsail-sdk.js');
        return module.fetchFullSailPools();
    } catch (error) {
        console.warn('[SDK DataSource] Full Sail SDK unavailable:', error.message);
        return [];
    }
}

// Cache configuration
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const cache = { data: null, timestamp: 0 };

/**
 * Normalize pool data to standard schema
 * Preserves null values to distinguish unavailable data from actual zeros
 */
function normalizePool(pool) {
    // Helper: preserve null values, default undefined to 0
    const toNumber = (val, defaultVal = 0) => val === null ? null : (val ?? defaultVal);

    return {
        id: pool.id || pool.pool,
        name: pool.name || pool.symbol || 'Unknown',
        dex: pool.dex,
        tvl: toNumber(pool.tvl),
        volume_24h: toNumber(pool.volume_24h),
        volume_7d: toNumber(pool.volume_7d),
        volume_30d: toNumber(pool.volume_30d),
        fees_24h: toNumber(pool.fees_24h),
        fees_7d: toNumber(pool.fees_7d),
        fees_30d: toNumber(pool.fees_30d),
        feeRate: toNumber(pool.feeRate, 0.003),
        apr: pool.apr === null ? null : (pool.apr || pool.apy || 0),
        apyBase: toNumber(pool.apyBase),
        apyReward: toNumber(pool.apyReward),
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
 * Fetch pool data from all DEXes via native SDKs
 * @param {Object} options - Fetch options
 * @param {boolean} options.forceRefresh - Bypass cache
 */
export async function fetchSDKPoolData(options = {}) {
    const { forceRefresh = false } = options;

    // Check cache
    if (!forceRefresh && cache.data && (Date.now() - cache.timestamp) < CACHE_TTL_MS) {
        console.log('[SDK DataSource] Using cached data');
        return { ...cache.data, mode: 'SDK' };
    }

    console.log('[SDK DataSource] Fetching from DEX SDKs...');

    // Fetch from all DEXes in parallel with graceful failure
    const results = await Promise.allSettled([
        fetchCetusPools(),
        fetchBluefinPools(),
        fetchFullSailPools(),
    ]);

    // Collect pools from successful fetches
    const allPools = [];
    const fetchStatus = { Cetus: 'failed', Bluefin: 'failed', 'Full Sail': 'failed' };
    const dexNames = ['Cetus', 'Bluefin', 'Full Sail'];

    results.forEach((result, index) => {
        const dexName = dexNames[index];
        if (result.status === 'fulfilled' && result.value.length > 0) {
            allPools.push(...result.value);
            fetchStatus[dexName] = 'success';
            console.log(`[SDK DataSource] ${dexName}: ${result.value.length} pools`);
        } else {
            const error = result.reason || 'No data';
            console.warn(`[SDK DataSource] ${dexName}: ${error}`);
        }
    });

    // Normalize all pools
    const pools = allPools.map(normalizePool);
    console.log(`[SDK DataSource] Total: ${pools.length} pools`);

    const totalTVL = pools.reduce((sum, p) => sum + (p.tvl || 0), 0);
    const totalVolume24h = pools.reduce((sum, p) => sum + (p.volume_24h || 0), 0);

    const result = {
        pools,
        dexStats: calculateDexStats(pools),
        summary: { totalTVL, totalVolume24h, totalPools: pools.length },
        lastUpdated: new Date().toISOString(),
        mode: 'SDK',
        fetchStatus,
    };

    // Cache result
    cache.data = result;
    cache.timestamp = Date.now();

    return result;
}

/**
 * Clear cached data
 */
export function clearSDKCache() {
    cache.data = null;
    cache.timestamp = 0;
}

export default { fetchSDKPoolData, clearSDKCache };
