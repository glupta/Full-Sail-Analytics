/**
 * Direct DEX API integration for Sui DEX data
 * Uses Cetus SDK for programmatic pool data access
 * Falls back to DefiLlama for historical and yield data
 */

import { initCetusSDK, d } from '@cetusprotocol/cetus-sui-clmm-sdk';

// SDK initialization (cached)
let cetusSDK = null;

/**
 * Initialize Cetus SDK for mainnet
 */
async function getCetusSDK() {
    if (!cetusSDK) {
        cetusSDK = initCetusSDK({ network: 'mainnet' });
    }
    return cetusSDK;
}

/**
 * Fetch all Cetus pools with TVL and stats
 * @returns {Promise<Array>} Array of pool objects
 */
export async function fetchCetusPools() {
    try {
        const sdk = await getCetusSDK();

        // Get all pools from the SDK
        const pools = await sdk.Pool.getPools([]);

        if (!pools || pools.length === 0) {
            console.warn('Cetus SDK returned no pools');
            return [];
        }

        // Map pool data to our standard format
        return pools.map(pool => {
            const coinTypeA = pool.coinTypeA;
            const coinTypeB = pool.coinTypeB;

            // Extract token symbols from coin types
            const symbolA = extractSymbol(coinTypeA);
            const symbolB = extractSymbol(coinTypeB);

            // Calculate TVL from pool liquidity (requires price data overlay)
            const liquidity = pool.liquidity ? d(pool.liquidity).toNumber() : 0;

            // Fee rate from pool config
            const feeRate = pool.fee_rate ? pool.fee_rate / 1000000 : 0.003; // Default 0.3%

            return {
                id: pool.poolAddress,
                name: `${symbolA}-${symbolB}`,
                dex: 'Cetus',
                coinTypeA,
                coinTypeB,
                liquidity,
                feeRate,
                tickSpacing: pool.tickSpacing || 0,
                currentSqrtPrice: pool.current_sqrt_price || 0,
                // These need to be populated from historical data or calculated
                tvl: 0, // Will overlay from price data
                volume_24h: 0,
                volume_7d: 0,
                volume_30d: 0,
                fees_24h: 0,
                fees_7d: 0,
                fees_30d: 0,
                apr: 0,
            };
        });
    } catch (error) {
        console.error('Cetus SDK pool fetch failed:', error);
        return [];
    }
}

/**
 * Extract token symbol from Sui coin type
 * @param {string} coinType - Full coin type path
 * @returns {string} Token symbol
 */
function extractSymbol(coinType) {
    if (!coinType) return 'UNKNOWN';

    // Common coin type mappings
    const knownCoins = {
        '0x2::sui::SUI': 'SUI',
        '0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN': 'USDC',
        '0xc060006111016b8a020ad5b33834984a437aaa7d3c74c18e09a95d48aceab08c::coin::COIN': 'USDT',
        '0xaf8cd5edc19c4512f4259f0bee101a40d41ebed738ade5874359610ef8eeced5::coin::COIN': 'WETH',
        '0x027792d9fed7f9844eb4839566001bb6f6cb4804f66aa2da6fe1ee242d896881::coin::COIN': 'WBTC',
    };

    if (knownCoins[coinType]) {
        return knownCoins[coinType];
    }

    // Try to extract from module path (last part often contains symbol)
    const parts = coinType.split('::');
    if (parts.length >= 2) {
        // Often the second-to-last part is the module name which hints at the symbol
        const moduleName = parts[parts.length - 2];
        if (moduleName.length <= 10) {
            return moduleName.toUpperCase();
        }
    }

    return 'TOKEN';
}

/**
 * Fetch pool statistics from Cetus API
 * This endpoint provides volume and TVL data
 */
export async function fetchCetusPoolStats() {
    try {
        // Try the Cetus aggregator stats endpoint
        const response = await fetch('/api/cetus/v2/sui/stat');
        if (!response.ok) {
            throw new Error(`Stats fetch failed: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.warn('Cetus stats fetch failed:', error.message);
        return null;
    }
}

/**
 * Merge on-chain pool data with stats/price data
 */
export async function fetchCetusPoolsWithStats() {
    const [pools, stats] = await Promise.all([
        fetchCetusPools(),
        fetchCetusPoolStats(),
    ]);

    // If we have stats, overlay them onto pool data
    if (stats && stats.data) {
        const statsMap = new Map();
        for (const item of stats.data) {
            statsMap.set(item.pool_address, item);
        }

        return pools.map(pool => {
            const poolStats = statsMap.get(pool.id);
            if (poolStats) {
                return {
                    ...pool,
                    tvl: poolStats.tvl_in_usd || 0,
                    volume_24h: poolStats.vol_in_usd_24h || 0,
                    volume_7d: (poolStats.vol_in_usd_24h || 0) * 7, // Estimate
                    fees_24h: (poolStats.vol_in_usd_24h || 0) * pool.feeRate,
                };
            }
            return pool;
        });
    }

    return pools;
}

/**
 * Combined fetch for all DEXs
 * Uses Cetus SDK + falls back to DefiLlama for other DEXs
 */
export async function fetchAllDexPools() {
    const results = {
        Cetus: [],
        Bluefin: [],
        Momentum: [],
        'Full Sail': [],
    };

    try {
        // Fetch Cetus pools via SDK
        const cetusPools = await fetchCetusPoolsWithStats();
        results.Cetus = cetusPools;
    } catch (error) {
        console.error('Failed to fetch Cetus pools:', error);
    }

    // For other DEXs, we can add similar integrations or fall back to DefiLlama
    // TODO: Add Bluefin SDK integration
    // TODO: Add Momentum integration

    return results;
}

export { getCetusSDK };
