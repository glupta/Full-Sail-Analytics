/**
 * Full Sail Finance SDK Fetcher
 * Fetches AMM pool data using the official Full Sail SDK
 * Docs: https://www.npmjs.com/package/@fullsailfinance/sdk
 */

// Import the Full Sail SDK - initFullSailSDK returns an SDK instance
import { initFullSailSDK } from '@fullsailfinance/sdk';

// Full Sail pool IDs (from app.fullsail.finance/liquidity - extracted 2026-01-11)
const FULLSAIL_POOL_IDS = [
    { id: '0x038eca6cc3ba17b84829ea28abac7238238364e0787ad714ac35c1140561a6b9', name: 'SAIL/USDC' },
    { id: '0x7fc2f2f3807c6e19f0d418d1aaad89e6f0e866b5e4ea10b295ca0b686b6c4980', name: 'SUI/USDC' },
    { id: '0xa7aa7807a87a771206571d3dd40e53ccbc395d7024def57b49ed9200b5b7e4e5', name: 'IKA/SUI' },
    { id: '0xf4c75d0609a2a53df0c896cfee52a33e6f11d1a70ab113ad83d89b1bfdfe002d', name: 'WBTC/USDC' },
    { id: '0x90ad474a2b0e4512e953dbe9805eb233ffe5659b93b4bb71ce56bd4110b38c91', name: 'ETH/USDC' },
    { id: '0xd1fd1d6fd6bed8c901ca483e2739ff3aa2e3cb3ef67cb2a7414b147a32adbdb0', name: 'stSUI/WAL' },
    { id: '0x6659a37fcd210fab78d1efd890fd4ca790bb260136f7934193e4607d82598b4d', name: 'stSUI/DEEP' },
    { id: '0x20e2f4d32c633be7eac9cba3b2d18b8ae188c0b639f3028915afe2af7ed7c89f', name: 'WAL/SUI' },
    { id: '0xd0dd3d7ae05c22c80e1e16639fb0d4334372a8a45a8f01c85dac662cc8850b60', name: 'DEEP/SUI' },
    { id: '0xdd212407908182e6c2c908e2749b49550f853bc52306d6849059dd3f72d0a7e3', name: 'UP/SUI' },
    { id: '0x17bac48cb12d565e5f5fdf37da71705de2bf84045fac5630c6d00138387bf46a', name: 'ALKIMI/SUI' },
    { id: '0x4c46799974cde779100204a28bc131fa70c76d08c71e19eb87903ac9fedf0b00', name: 'MMT/USDC' },
];

// SDK instance (singleton)
let sdkInstance = null;

/**
 * Get or initialize the Full Sail SDK
 */
function getSDK() {
    if (!sdkInstance) {
        console.log('[Full Sail SDK] Initializing...');
        try {
            // initFullSailSDK returns the SDK instance directly (not a promise)
            sdkInstance = initFullSailSDK({ network: 'mainnet-production' });
            console.log('[Full Sail SDK] Initialized successfully');
        } catch (error) {
            console.warn('[Full Sail SDK] Initialization failed:', error.message);
            throw error;
        }
    }
    return sdkInstance;
}

/**
 * Fetch a single pool using the SDK
 * Prioritizes backend API for pre-computed CLMM TVL, falls back to chain data
 */
async function fetchPoolById(poolId, name) {
    const sdk = getSDK();

    // Try backend API first - has pre-computed CLMM TVL from tick liquidity
    try {
        const backendPool = await sdk.Pool.getById(poolId);

        if (backendPool && backendPool.dinamic_stats) {
            const stats = backendPool.dinamic_stats;
            // Fee rate is in basis points (e.g., 1622 = 0.1622%)
            const feeRate = backendPool.fee ? Number(backendPool.fee) / 1e6 : 0.003;

            return {
                id: poolId,
                name: backendPool.name || name,
                dex: 'Full Sail',
                tvl: Number(stats.tvl || 0),
                volume_24h: Number(stats.volume_usd_24h || 0),
                volume_7d: Number(stats.volume_usd_7d || 0),
                volume_30d: Number(stats.volume_usd_30d || 0),
                fees_24h: Number(stats.fees_usd_24h || 0),
                fees_7d: Number(stats.fees_usd_7d || 0),
                fees_30d: Number(stats.fees_usd_30d || 0),
                apr: Number(stats.apr || backendPool.full_apr || 0),
                apyBase: Number(stats.apr || 0),
                apyReward: 0,
                stablecoin: name.includes('USD'),
                feeRate: feeRate,
                liquidity: String(stats.active_liquidity || backendPool.liquidity || '0'),
            };
        }
    } catch (backendError) {
        console.warn(`[Full Sail SDK] Backend API failed for ${name}:`, backendError.message);
    }

    // Fallback to on-chain data (no pre-computed TVL for CLMM)
    try {
        const chainPool = await sdk.Pool.getByIdFromChain(poolId);

        if (!chainPool) {
            console.warn(`[Full Sail SDK] Pool ${name} not found on chain`);
            return null;
        }

        // For CLMM, raw liquidity doesn't equal TVL - this is an approximation
        // Real TVL requires iterating price bins, which the backend handles
        const feeRate = chainPool.feeRate ? Number(chainPool.feeRate) / 1e6 : 0.003;

        return {
            id: poolId,
            name: chainPool.name || name,
            dex: 'Full Sail',
            tvl: 0, // Cannot compute accurate CLMM TVL from chain data alone
            volume_24h: 0,
            volume_7d: 0,
            volume_30d: 0,
            fees_24h: 0,
            fees_7d: 0,
            fees_30d: 0,
            apr: 0,
            apyBase: 0,
            apyReward: chainPool.apyReward || 0,
            stablecoin: name.includes('USD'),
            feeRate: Number(feeRate),
            liquidity: chainPool.liquidity?.toString() || '0',
            sqrtPrice: chainPool.currentSqrtPrice?.toString() || '0',
        };
    } catch (chainError) {
        console.warn(`[Full Sail SDK] Chain lookup failed for ${name}:`, chainError.message);
        return null;
    }
}

/**
 * Fetch all Full Sail pools via SDK
 * @returns {Promise<Array>} Array of normalized pool objects
 */
export async function fetchFullSailPools() {
    console.log('[Full Sail SDK] Fetching pools...');

    try {
        // Initialize SDK first
        getSDK();

        // Fetch all pools in parallel
        const poolPromises = FULLSAIL_POOL_IDS.map(({ id, name }) =>
            fetchPoolById(id, name)
        );

        const pools = await Promise.all(poolPromises);
        const validPools = pools.filter(Boolean);

        console.log(`[Full Sail SDK] Fetched ${validPools.length} pools`);
        return validPools;

    } catch (error) {
        console.error('[Full Sail SDK] Fetch failed:', error.message);
        return [];
    }
}

export default { fetchFullSailPools };
