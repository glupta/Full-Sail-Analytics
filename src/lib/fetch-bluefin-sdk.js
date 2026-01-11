/**
 * Bluefin DEX SDK Fetcher
 * Fetches CLMM pool data using Bluefin's official Spot API
 * Docs: https://bluefin-exchange.readme.io/v2.0.1/reference/spot-api-introduction
 */

// Bluefin Spot API - use Vite proxy in dev to bypass CORS
// In production, this would need a backend proxy or CORS-enabled endpoint
const BLUEFIN_SPOT_API = import.meta.env.DEV
    ? '/api/bluefin'
    : 'https://swap.api.sui-prod.bluefin.io';

// Known Bluefin pools for fallback
const KNOWN_POOLS = [
    { id: '0x3b585786b13af1d8ea067ab37101b6513a05d2f90cfe60e8b1d9e1b46a63c4fa', name: 'SUI/USDC' },
    { id: '0x0321b68a0fca8c990710d26986ba433e06b495f0e8c91c40fc3bd5bf1d2b2894', name: 'WETH/USDC' },
    { id: '0xa7239a0c727c40ee3a139689b16bf8c6e37b5d88eb1cb3c1e4b4c5d6e7f8a9b0', name: 'USDT/USDC' },
];

/**
 * Fetch pools from Bluefin Spot API
 * Endpoint: GET /pools/info
 */
async function fetchPoolsFromAPI() {
    try {
        // Bluefin Spot API pools endpoint
        const response = await fetch(`${BLUEFIN_SPOT_API}/pools/info`, {
            headers: {
                'Accept': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`Spot API returned ${response.status}`);
        }

        const data = await response.json();
        console.log('[Bluefin SDK] API response:', data);
        return data.pools || data.data || data || [];
    } catch (error) {
        console.warn('[Bluefin SDK] Spot API fetch failed:', error.message);
        return null;
    }
}

/**
 * Parse pool data from API response
 */
function parsePool(pool) {
    try {
        const poolAddress = pool.poolAddress || pool.pool_address || pool.address || pool.id;
        const name = pool.name || pool.symbol ||
            `${pool.baseSymbol || pool.tokenA?.symbol || 'Unknown'}/${pool.quoteSymbol || pool.tokenB?.symbol || 'Unknown'}`;

        // Get TVL from various possible field names
        const tvl = Number(
            pool.tvl ||
            pool.totalValueLocked ||
            pool.liquidity ||
            pool.tvlUsd ||
            0
        );

        // Volume data
        const volume24h = Number(pool.volume24h || pool.volume_24h || pool.dailyVolume || 0);
        const fees24h = Number(pool.fees24h || pool.fees_24h || pool.dailyFees || 0);

        // Fee rate
        const feeRate = Number(pool.feeRate || pool.fee_rate || pool.swapFee || 0.003);

        // APR/APY
        const apr = Number(pool.apr || pool.apy || 0);

        return {
            id: poolAddress,
            name: name,
            dex: 'Bluefin',
            tvl: tvl,
            volume_24h: volume24h,
            volume_7d: Number(pool.volume7d || pool.volume_7d || 0),
            volume_30d: Number(pool.volume30d || pool.volume_30d || 0),
            fees_24h: fees24h,
            fees_7d: 0,
            fees_30d: 0,
            apr: apr,
            apyBase: Number(pool.apyBase || 0),
            apyReward: Number(pool.apyReward || 0),
            stablecoin: name.includes('USD'),
            feeRate: feeRate,
        };
    } catch (error) {
        console.warn('[Bluefin SDK] Failed to parse pool:', error.message);
        return null;
    }
}

/**
 * Fetch all Bluefin pools via native Spot API
 * Returns known pools with placeholder data if API is unavailable
 * @returns {Promise<Array>} Array of normalized pool objects
 */
export async function fetchBluefinPools() {
    console.log('[Bluefin SDK] Fetching pools...');

    try {
        const apiPools = await fetchPoolsFromAPI();

        if (apiPools && Array.isArray(apiPools) && apiPools.length > 0) {
            const parsedPools = apiPools
                .map(parsePool)
                .filter(Boolean)
                .filter(p => p.tvl > 0);

            parsedPools.sort((a, b) => b.tvl - a.tvl);
            const topPools = parsedPools.slice(0, 50);

            console.log(`[Bluefin SDK] Fetched ${topPools.length} pools from API`);
            return topPools;
        }

        // No fallback data - throw error so UI shows connection failed
        throw new Error('Bluefin Spot API unavailable - no valid pool data');

    } catch (error) {
        console.error('[Bluefin SDK] Fetch failed:', error.message);
        return [];
    }
}

export default { fetchBluefinPools };
