/**
 * Unified Data Source
 * Fetches pool data from configured source (DefiLlama or local JSON)
 */

import { DATA_SOURCE_CONFIG, DATA_SOURCE_MODES } from './config.js';
import { fetchSuiPools } from './fetch-defillama.js';

// Cache for fetched data
const cache = {
    data: null,
    timestamp: 0,
};

const CACHE_TTL_MS = DATA_SOURCE_CONFIG.cacheTTLMinutes * 60 * 1000;

/**
 * Check if cached data is still valid
 */
function isCacheValid() {
    return DATA_SOURCE_CONFIG.cacheEnabled &&
        cache.timestamp > 0 &&
        (Date.now() - cache.timestamp) < CACHE_TTL_MS;
}

/**
 * Normalize DefiLlama pool data to match our standard schema
 */
function normalizeDefiLlamaPool(pool) {
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
        source: 'defillama',
    };
}

/**
 * Normalize GraphQL/local JSON pool data to standard schema
 */
function normalizeGraphQLPool(pool) {
    return {
        id: pool.id,
        name: pool.name || 'Unknown',
        dex: pool.dex,
        tvl: pool.tvl || 0,
        volume_24h: pool.volume_24h || 0,
        volume_7d: pool.volume_7d || 0,
        volume_30d: pool.volume_30d || 0,
        fees_24h: pool.fees_24h || 0,
        fees_7d: pool.fees_7d || 0,
        fees_30d: pool.fees_30d || 0,
        feeRate: pool.feeRate || 0,
        apr: pool.apr || (pool.feeRate ? pool.feeRate * 365 * 100 : 0),
        isPaused: pool.isPaused || false,
        swaps_24h: pool.swaps_24h || 0,
        source: 'graphql',
    };
}

/**
 * Fetch data from DefiLlama yields API
 */
async function fetchDefiLlamaData() {
    console.log('[DataSource] Fetching from DefiLlama...');
    const pools = await fetchSuiPools();
    const normalized = pools.map(normalizeDefiLlamaPool);
    console.log(`[DataSource] DefiLlama returned ${normalized.length} pools`);
    return {
        pools: normalized,
        dexStats: calculateDexStats(normalized),
        summary: {},
        lastUpdated: new Date().toISOString(),
    };
}

/**
 * Fetch data from local JSON (pre-processed Sui GraphQL data)
 */
async function fetchGraphQLData() {
    console.log('[DataSource] Fetching from local JSON...');
    const response = await fetch('/dex-data.json');
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const pools = (data.pools || []).map(normalizeGraphQLPool);

    console.log(`[DataSource] GraphQL returned ${pools.length} pools`);
    return {
        pools,
        summary: data.summary || {},
        dexStats: data.dexStats || calculateDexStats(pools),
        lastUpdated: data.lastUpdated || new Date().toISOString(),
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
                volume7d: 0,
                volume30d: 0,
                fees24h: 0,
                fees7d: 0,
                fees30d: 0,
            };
        }

        const s = stats[pool.dex];
        s.poolCount++;
        s.totalTVL += pool.tvl || 0;
        s.volume24h += pool.volume_24h || 0;
        s.volume7d += pool.volume_7d || 0;
        s.volume30d += pool.volume_30d || 0;
        s.fees24h += pool.fees_24h || 0;
        s.fees7d += pool.fees_7d || 0;
        s.fees30d += pool.fees_30d || 0;
    }

    return stats;
}

/**
 * Main entry point - fetch pool data from configured source
 * @param {Object} options - Fetch options
 * @param {boolean} options.forceRefresh - Bypass cache
 * @returns {Promise<Object>} Pool data with summary and stats
 */
export async function fetchPoolData(options = {}) {
    const { forceRefresh = false } = options;
    const mode = DATA_SOURCE_CONFIG.mode;

    // Check cache
    if (!forceRefresh && isCacheValid()) {
        console.log('[DataSource] Using cached data');
        return { ...cache.data, mode };
    }

    console.log(`[DataSource] Mode: ${mode}`);

    // Fetch based on mode
    const data = mode === DATA_SOURCE_MODES.DEFILLAMA
        ? await fetchDefiLlamaData()
        : await fetchGraphQLData();

    // Calculate summary
    const totalTVL = data.pools.reduce((sum, p) => sum + (p.tvl || 0), 0);
    const totalVolume24h = data.pools.reduce((sum, p) => sum + (p.volume_24h || 0), 0);

    const result = {
        ...data,
        summary: {
            totalTVL,
            totalVolume24h,
            totalPools: data.pools.length,
            ...data.summary,
        },
        mode,
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
    return DATA_SOURCE_CONFIG.mode;
}

/**
 * Clear cached data
 */
export function clearCache() {
    cache.data = null;
    cache.timestamp = 0;
    console.log('[DataSource] Cache cleared');
}

export default { fetchPoolData, getDataSourceMode, clearCache };
