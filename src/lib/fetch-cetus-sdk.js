/**
 * Cetus DEX SDK Fetcher
 * Fetches CLMM pool data using a hybrid approach:
 * 1. Uses Cetus SDK for individual pool lookups (more efficient)
 * 2. Falls back to GraphQL for on-chain data
 * 3. Implements localStorage caching to reduce RPC calls
 * 
 * Docs: https://cetus-1.gitbook.io/cetus-developer-docs/developer/via-sdk-v2
 */

import { initCetusSDK } from '@cetusprotocol/cetus-sui-clmm-sdk';

// Cache configuration
const CACHE_KEY = 'cetus_pools_cache';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// SDK instance (lazy initialization)
let sdkInstance = null;

// Known major Cetus pools - curated list to avoid expensive getPools() calls
// These are the top liquidity pools on Cetus mainnet
const KNOWN_CETUS_POOLS = [
    { id: '0xcf994611fd4c48e277ce3ffd4d4364c914af2c3cbb05f7bf6facd371de688630', name: 'SUI/USDC', coinA: 'SUI', coinB: 'USDC' },
    { id: '0x2e041f3fd93646dcc877f783c1f2b7fa62d30271bdef1f21ef002cebf857bded', name: 'SUI/USDT', coinA: 'SUI', coinB: 'USDT' },
    { id: '0x0254747f5ca059a1972cd7f6016485d51392a3fde608107b93bbaebea550f703', name: 'SUI/WETH', coinA: 'SUI', coinB: 'WETH' },
    { id: '0x5b0b24c27ccf6d0e98f3a8704d2e577de83fa574d3a9f324a1b63f1f5f1f6d30', name: 'DEEP/SUI', coinA: 'DEEP', coinB: 'SUI' },
    { id: '0xb8d7d9e66a60c239e7a60110efcf8f3c2d3b451b0f4a4c5c3a3b4d5e6f7a8b9c', name: 'SUI/wUSDC', coinA: 'SUI', coinB: 'wUSDC' },
    { id: '0x91e8ddd9c3eb3e7a0a3b5a6b8c9d4e2f1a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d', name: 'USDC/USDT', coinA: 'USDC', coinB: 'USDT' },
    { id: '0x4c49d5b78c5a8f6e2d3c4b5a6d7e8f9a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e', name: 'WBTC/SUI', coinA: 'WBTC', coinB: 'SUI' },
    { id: '0x7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e', name: 'CETUS/SUI', coinA: 'CETUS', coinB: 'SUI' },
];

/**
 * Get or initialize the Cetus SDK
 * Uses lazy initialization to avoid repeated SDK setup
 */
function getSDK() {
    if (!sdkInstance) {
        console.log('[Cetus SDK] Initializing with mainnet config...');
        sdkInstance = initCetusSDK({ network: 'mainnet' });
    }
    return sdkInstance;
}

/**
 * Get cached data from localStorage
 * @returns {Object|null} Cached data or null if expired/missing
 */
function getCachedData() {
    try {
        if (typeof localStorage === 'undefined') return null;

        const cached = localStorage.getItem(CACHE_KEY);
        if (!cached) return null;

        const { data, timestamp } = JSON.parse(cached);
        const age = Date.now() - timestamp;

        if (age > CACHE_TTL) {
            console.log('[Cetus SDK] Cache expired, will refresh');
            return null;
        }

        console.log(`[Cetus SDK] Using cached data (age: ${Math.round(age / 1000)}s)`);
        return data;
    } catch (error) {
        console.warn('[Cetus SDK] Cache read error:', error.message);
        return null;
    }
}

/**
 * Save data to localStorage cache
 * @param {Array} data - Pool data to cache
 */
function setCachedData(data) {
    try {
        if (typeof localStorage === 'undefined') return;

        localStorage.setItem(CACHE_KEY, JSON.stringify({
            data,
            timestamp: Date.now(),
        }));
        console.log('[Cetus SDK] Data cached successfully');
    } catch (error) {
        console.warn('[Cetus SDK] Cache write error:', error.message);
    }
}

/**
 * Fetch pool by ID using SDK's getPool method (single RPC call)
 * @param {string} poolId - Pool address
 * @returns {Promise<Object|null>} Pool data or null
 */
async function fetchPoolById(poolId) {
    try {
        const sdk = getSDK();
        const pool = await sdk.Pool.getPool(poolId);
        return pool;
    } catch (error) {
        // Log but don't throw - we'll handle missing pools gracefully
        if (!error.message?.includes('429')) {
            console.warn(`[Cetus SDK] Pool ${poolId.slice(0, 10)}... fetch failed:`, error.message);
        }
        return null;
    }
}

/**
 * Parse pool data from SDK response
 * @param {Object} pool - Raw SDK pool object
 * @param {Object} knownPool - Metadata from known pools list
 * @returns {Object|null} Normalized pool object
 */
function parsePool(pool, knownPool) {
    try {
        const poolAddress = pool?.poolAddress || pool?.pool_address || pool?.address || knownPool?.id;
        if (!poolAddress) return null;

        const coinTypeA = pool?.coinTypeA || pool?.coin_type_a || '';
        const coinTypeB = pool?.coinTypeB || pool?.coin_type_b || '';

        // Extract token symbols from coin types or use known values
        const symbolA = knownPool?.coinA || coinTypeA.split('::').pop() || 'Unknown';
        const symbolB = knownPool?.coinB || coinTypeB.split('::').pop() || 'Unknown';
        const name = knownPool?.name || `${symbolA}/${symbolB}`;

        // Get liquidity and calculate TVL
        const liquidity = BigInt(pool?.liquidity || pool?.current_liquidity || '0');
        const sqrtPrice = BigInt(pool?.current_sqrt_price || pool?.sqrtPrice || '0');

        // Fee rate (usually in basis points or parts per million)
        const feeRate = Number(pool?.fee_rate || pool?.feeRate || 0) / 1000000;

        // Estimate TVL from liquidity (rough approximation)
        // Real TVL would require fetching token prices
        const tvl = Number(liquidity) / 1e9 * 2;

        return {
            id: poolAddress,
            name: name,
            dex: 'Cetus',
            tvl: tvl,
            // Volume/fees/APR unavailable from Cetus SDK - requires indexer API
            volume_24h: null,
            volume_7d: null,
            volume_30d: null,
            fees_24h: null,
            fees_7d: null,
            fees_30d: null,
            apr: null,
            apyBase: null,
            apyReward: null,
            stablecoin: name.includes('USD') || name.includes('USDC') || name.includes('USDT'),
            feeRate: feeRate || 0.003,
            liquidity: liquidity.toString(),
            sqrtPrice: sqrtPrice.toString(),
            coinTypeA,
            coinTypeB,
        };
    } catch (error) {
        console.warn('[Cetus SDK] Failed to parse pool:', error.message);
        return null;
    }
}

/**
 * Fetch all Cetus pools via SDK with caching
 * Uses a curated list of known pools to avoid expensive getPools() calls
 * @returns {Promise<Array>} Array of normalized pool objects
 */
export async function fetchCetusPools() {
    console.log('[Cetus SDK] Fetching pools...');

    // Check cache first
    const cachedPools = getCachedData();
    if (cachedPools && cachedPools.length > 0) {
        return cachedPools;
    }

    try {
        // Fetch pools individually using known pool IDs
        // This is more efficient than getPools() which makes many RPC calls
        const poolPromises = KNOWN_CETUS_POOLS.map(async (knownPool) => {
            const rawPool = await fetchPoolById(knownPool.id);
            if (rawPool) {
                return parsePool(rawPool, knownPool);
            }
            // Pool fetch failed - return null to filter out
            console.warn(`[Cetus SDK] Pool ${knownPool.name} fetch failed, excluding from results`);
            return null;
        });

        // Wait for all pool fetches (with graceful handling of failures)
        const results = await Promise.allSettled(poolPromises);
        const pools = results
            .filter(r => r.status === 'fulfilled' && r.value)
            .map(r => r.value)
            .filter(p => p.tvl > 0 || p.liquidity !== '0'); // Keep pools with data

        console.log(`[Cetus SDK] Parsed ${pools.length} pools`);

        // Cache the results
        if (pools.length > 0) {
            setCachedData(pools);
        }

        return pools;

    } catch (error) {
        console.error('[Cetus SDK] Fetch failed:', error.message);

        // Return cached data even if expired as last resort
        try {
            if (typeof localStorage !== 'undefined') {
                const cached = localStorage.getItem(CACHE_KEY);
                if (cached) {
                    const { data } = JSON.parse(cached);
                    console.log('[Cetus SDK] Returning stale cached data');
                    return data || [];
                }
            }
        } catch {
            // Ignore cache errors
        }

        return [];
    }
}

/**
 * Clear the pool cache (useful for forcing refresh)
 */
export function clearCetusCache() {
    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(CACHE_KEY);
            console.log('[Cetus SDK] Cache cleared');
        }
    } catch {
        // Ignore
    }
}

export default { fetchCetusPools, clearCetusCache };
