/**
 * Cetus DEX SDK Fetcher
 * Fetches CLMM pool data using the official Cetus SDK v2
 * Docs: https://cetus-1.gitbook.io/cetus-developer-docs/developer/via-sdk-v2
 */

// Note: The new SDK v2 uses @cetusprotocol/sui-clmm-sdk
// Fallback to the installed @cetusprotocol/cetus-sui-clmm-sdk
import { initCetusSDK } from '@cetusprotocol/cetus-sui-clmm-sdk';

// SDK instance (lazy initialization)
let sdkInstance = null;

/**
 * Get or initialize the Cetus SDK
 * Uses the v2 API pattern: CetusClmmSDK.createSDK({ env: 'mainnet' })
 */
async function getSDK() {
    if (!sdkInstance) {
        console.log('[Cetus SDK] Initializing with mainnet config...');
        // Using the installed package's initialization method
        sdkInstance = initCetusSDK({ network: 'mainnet' });
    }
    return sdkInstance;
}

/**
 * Parse pool data from SDK response
 */
function parsePool(pool) {
    try {
        const poolAddress = pool.poolAddress || pool.pool_address || pool.address;
        const coinTypeA = pool.coinTypeA || pool.coin_type_a || '';
        const coinTypeB = pool.coinTypeB || pool.coin_type_b || '';

        // Extract token symbols from coin types
        const symbolA = coinTypeA.split('::').pop() || 'Unknown';
        const symbolB = coinTypeB.split('::').pop() || 'Unknown';
        const name = `${symbolA}/${symbolB}`;

        // Get liquidity and calculate TVL
        const liquidity = BigInt(pool.liquidity || pool.current_liquidity || '0');
        const sqrtPrice = BigInt(pool.current_sqrt_price || pool.sqrtPrice || '0');

        // Fee rate (usually in basis points or parts per million)
        const feeRate = Number(pool.fee_rate || pool.feeRate || 0) / 1000000;

        // Estimate TVL from liquidity (rough approximation)
        // Real TVL would require fetching token prices
        const tvl = Number(liquidity) / 1e9 * 2;

        return {
            id: poolAddress,
            name: name,
            dex: 'Cetus',
            tvl: tvl,
            volume_24h: 0, // SDK doesn't provide this directly
            volume_7d: 0,
            volume_30d: 0,
            fees_24h: 0,
            fees_7d: 0,
            fees_30d: 0,
            apr: 0,
            apyBase: 0,
            apyReward: 0,
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
 * Fetch all Cetus pools via SDK
 * @returns {Promise<Array>} Array of normalized pool objects
 */
export async function fetchCetusPools() {
    console.log('[Cetus SDK] Fetching pools...');

    try {
        const sdk = await getSDK();

        // Fetch pool list from SDK
        const pools = await sdk.Pool.getPools();

        console.log(`[Cetus SDK] Raw pools fetched: ${pools?.length || 0}`);

        if (!pools || !Array.isArray(pools)) {
            console.warn('[Cetus SDK] No pools returned');
            return [];
        }

        // Parse and filter valid pools
        const parsedPools = pools
            .map(parsePool)
            .filter(Boolean)
            .filter(p => p.tvl > 0); // Only include pools with liquidity

        // Sort by TVL descending and take top 50
        parsedPools.sort((a, b) => b.tvl - a.tvl);
        const topPools = parsedPools.slice(0, 50);

        console.log(`[Cetus SDK] Parsed ${topPools.length} pools`);
        return topPools;

    } catch (error) {
        console.error('[Cetus SDK] Fetch failed:', error.message);
        return [];
    }
}

export default { fetchCetusPools };
