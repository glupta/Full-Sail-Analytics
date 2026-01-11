/**
 * Bluefin DEX GraphQL Fetcher
 * Fetches CLMM pool data from Sui blockchain via GraphQL
 */

import { executeQuery } from './graphql-client.js';

// Known Bluefin CLMM pools on Sui mainnet
const BLUEFIN_POOLS = [
    { id: '0x3b585786b13af1d8ea067ab37101b6513a05d2f90cfe60e8b1d9e1b46a63c4fa', name: 'SUI/USDC' },
    // More pools can be discovered from suiscan or polymedia
];

/**
 * Query pool objects from Sui GraphQL
 */
async function queryPoolsGraphQL() {
    const poolIds = BLUEFIN_POOLS.map(p => p.id);

    if (!poolIds.length) return [];

    const objectQueries = poolIds.map((id, i) => `
        pool${i}: object(address: "${id}") {
            address
            version
            asMoveObject {
                contents {
                    type { repr }
                    json
                }
            }
        }
    `).join('\n');

    const query = `query GetBluefinPools { ${objectQueries} }`;

    try {
        const data = await executeQuery(query);
        return poolIds.map((_, i) => data[`pool${i}`]).filter(Boolean);
    } catch (error) {
        console.error('[Bluefin] GraphQL query failed:', error.message);
        return [];
    }
}

/**
 * Parse Bluefin CLMM pool data from GraphQL response
 */
function parsePoolData(node, knownPool) {
    try {
        const json = node?.asMoveObject?.contents?.json;
        const poolId = node.address;
        const name = knownPool?.name || 'Unknown';

        if (!json) {
            return {
                id: poolId,
                name: name,
                dex: 'Bluefin',
                tvl: 0,
                volume_24h: 0,
                volume_7d: 0,
                volume_30d: 0,
                fees_24h: 0,
                fees_7d: 0,
                fees_30d: 0,
                apr: 0,
                apyBase: 0,
                apyReward: 0,
                stablecoin: name.includes('USD'),
                feeRate: 0.003,
            };
        }

        // Extract CLMM-specific fields
        const liquidity = BigInt(json.liquidity || json.current_liquidity || '0');
        const sqrtPrice = BigInt(json.current_sqrt_price || json.sqrt_price || '0');
        const feeRate = Number(json.fee_rate || json.swap_fee_rate || 0) / 1000000;

        // Estimate TVL from liquidity
        const tvl = Number(liquidity) / 1e9 * 2;

        return {
            id: poolId,
            name: name,
            dex: 'Bluefin',
            tvl: tvl,
            volume_24h: 0,
            volume_7d: 0,
            volume_30d: 0,
            fees_24h: 0,
            fees_7d: 0,
            fees_30d: 0,
            apr: 0,
            apyBase: 0,
            apyReward: 0,
            stablecoin: name.includes('USD'),
            feeRate: feeRate || 0.003,
            liquidity: liquidity.toString(),
            sqrtPrice: sqrtPrice.toString(),
        };
    } catch (error) {
        console.warn('[Bluefin] Failed to parse pool:', error.message);
        return null;
    }
}

/**
 * Fetch all Bluefin pools via GraphQL
 * @returns {Promise<Array>} Array of normalized pool objects
 */
export async function fetchBluefinPools() {
    console.log('[Bluefin] Fetching pools via GraphQL...');

    const nodes = await queryPoolsGraphQL();

    const pools = nodes.map((node, i) => {
        const knownPool = BLUEFIN_POOLS.find(p => p.id === node?.address) || BLUEFIN_POOLS[i];
        return parsePoolData(node, knownPool);
    }).filter(Boolean);

    console.log(`[Bluefin] Fetched ${pools.length} pools`);
    return pools;
}

export default { fetchBluefinPools };
