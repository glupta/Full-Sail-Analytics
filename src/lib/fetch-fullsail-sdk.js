/**
 * Full Sail Finance SDK Fetcher
 * Fetches AMM pool data using the official Full Sail SDK
 * Docs: https://www.npmjs.com/package/@fullsailfinance/sdk
 */

// Import the Full Sail SDK - using default export
import FullSailSDK from '@fullsailfinance/sdk';

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

// SDK instance
let sdkInitialized = false;

/**
 * Initialize the Full Sail SDK
 */
async function initSDK() {
    if (!sdkInitialized) {
        console.log('[Full Sail SDK] Initializing...');
        try {
            // Initialize SDK for mainnet using the correct function
            await FullSailSDK.initFullSailSDK({ network: 'mainnet-production' });
            sdkInitialized = true;
            console.log('[Full Sail SDK] Initialized successfully');
        } catch (error) {
            console.warn('[Full Sail SDK] Initialization failed:', error.message);
            throw error;
        }
    }
}

/**
 * Fetch a single pool using the SDK
 */
async function fetchPoolById(poolId, name) {
    try {
        // Use Pool.getByIdFromChain for real-time blockchain data
        const chainPool = await FullSailSDK.Pool.getByIdFromChain(poolId);

        if (!chainPool) {
            console.warn(`[Full Sail SDK] Pool ${name} not found`);
            return null;
        }

        // Extract data from chain pool
        const tvl = chainPool.tvl || chainPool.totalValueLocked || 0;
        const volume24h = chainPool.volume24h || chainPool.dailyVolume || 0;
        const fees24h = chainPool.fees24h || chainPool.dailyFees || 0;
        const feeRate = chainPool.feeRate || chainPool.fee || 0.003;
        const apr = chainPool.apr || chainPool.apy || 0;

        return {
            id: poolId,
            name: name,
            dex: 'Full Sail',
            tvl: Number(tvl),
            volume_24h: Number(volume24h),
            volume_7d: chainPool.volume7d || 0,
            volume_30d: chainPool.volume30d || 0,
            fees_24h: Number(fees24h),
            fees_7d: 0,
            fees_30d: 0,
            apr: Number(apr),
            apyBase: chainPool.apyBase || 0,
            apyReward: chainPool.apyReward || 0,
            stablecoin: name.includes('USD'),
            feeRate: Number(feeRate),
            liquidity: chainPool.liquidity?.toString() || '0',
            sqrtPrice: chainPool.currentSqrtPrice?.toString() || '0',
        };
    } catch (error) {
        console.warn(`[Full Sail SDK] Failed to fetch pool ${name}:`, error.message);

        // Try backend API as fallback
        try {
            const backendPool = await FullSailSDK.Pool.getById(poolId);
            if (backendPool) {
                return {
                    id: poolId,
                    name: name,
                    dex: 'Full Sail',
                    tvl: Number(backendPool.tvl || 0),
                    volume_24h: Number(backendPool.volume24h || 0),
                    volume_7d: 0,
                    volume_30d: 0,
                    fees_24h: Number(backendPool.fees24h || 0),
                    fees_7d: 0,
                    fees_30d: 0,
                    apr: Number(backendPool.apr || 0),
                    apyBase: 0,
                    apyReward: 0,
                    stablecoin: name.includes('USD'),
                    feeRate: 0.003,
                };
            }
        } catch (backendError) {
            console.warn(`[Full Sail SDK] Backend fallback failed for ${name}:`, backendError.message);
        }

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
        await initSDK();

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
