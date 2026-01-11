/**
 * Full Sail Finance GraphQL Fetcher
 * Fetches AMM pool data from Sui blockchain via GraphQL
 */

import { executeQuery } from './graphql-client.js';

// Full Sail pool addresses from official docs
const FULLSAIL_POOLS = [
    { id: '0xa7aa7807a87a771206571d3dd40e53ccbc395d7024def57b49ed9200b5b7e4e5', name: 'IKA/SUI' },
    { id: '0x7fc2f2f3807c6e19f0d418d1aaad89e6f0e866b5e4ea10b295ca0b686b6c4980', name: 'SUI/USDC' },
    { id: '0xb41cf6d7b9dfdf21279571a1128292b56b70ad5e0106243db102a8e4aea842c7', name: 'USDT/USDC' },
    { id: '0x195fa451874754e5f14f88040756d4897a5fe4b872dffc4e451d80376fa7c858', name: 'WBTC/USDC' },
    { id: '0x90ad474a2b0e4512e953dbe9805eb233ffe5659b93b4bb71ce56bd4110b38c91', name: 'ETH/USDC' },
    { id: '0x20e2f4d32c633be7eac9cba3b2d18b8ae188c0b639f3028915afe2af7ed7c89f', name: 'WAL/SUI' },
    { id: '0xd0dd3d7ae05c22c80e1e16639fb0d4334372a8a45a8f01c85dac662cc8850b60', name: 'DEEP/SUI' },
    { id: '0x17bac48cb12d565e5f5fdf37da71705de2bf84045fac5630c6d00138387bf46a', name: 'ALKIMI/SUI' },
    { id: '0x038eca6cc3ba17b84829ea28abac7238238364e0787ad714ac35c1140561a6b9', name: 'SAIL/USDC' },
    { id: '0xe676d09899c8a4f4ecd3e4b9adac181f3f2e1e439db19454cacce1b4ea5b40f4', name: 'USDZ/USDC' },
];

/**
 * Query pool objects from Sui GraphQL using correct schema
 */
async function queryPools() {
    const poolIds = FULLSAIL_POOLS.map(p => p.id);

    // Build query for multiple objects using correct Sui GraphQL schema
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

    const query = `query GetFullSailPools { ${objectQueries} }`;

    try {
        const data = await executeQuery(query);
        return poolIds.map((_, i) => data[`pool${i}`]).filter(Boolean);
    } catch (error) {
        console.error('[Full Sail] Pool query failed:', error.message);
        return [];
    }
}

/**
 * Parse Full Sail pool data from GraphQL response
 */
function parsePoolData(node, knownPool) {
    try {
        const json = node?.asMoveObject?.contents?.json;
        const poolId = node.address;
        const name = knownPool?.name || 'Unknown';

        // Debug: log the actual field names we receive
        if (json) {
            console.log(`[Full Sail] Pool ${name} fields:`, Object.keys(json));
            console.log(`[Full Sail] Pool ${name} data:`, JSON.stringify(json).slice(0, 500));
        }

        // Extract reserves and calculate TVL
        let tvl = 0;
        let reserveA = 0;
        let reserveB = 0;

        if (json) {
            // Full Sail AMM uses coin_x_reserve and coin_y_reserve based on typical Move AMM patterns
            reserveA = BigInt(json.coin_x_reserve || json.x_reserve || json.reserve_x || json.coin_x || json.balance_x || '0');
            reserveB = BigInt(json.coin_y_reserve || json.y_reserve || json.reserve_y || json.coin_y || json.balance_y || '0');

            // Rough TVL estimate 
            const isStablePair = name.includes('USD');
            if (isStablePair) {
                tvl = (Number(reserveA) + Number(reserveB)) / 1e6;
            } else {
                tvl = (Number(reserveA) / 1e9 + Number(reserveB) / 1e9) * 1.5;
            }
        }

        const feeRate = json?.fee_rate ? Number(json.fee_rate) / 10000 : 0.003;

        return {
            id: poolId,
            name: name,
            dex: 'Full Sail',
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
            feeRate: feeRate,
            reserveA: reserveA.toString(),
            reserveB: reserveB.toString(),
        };
    } catch (error) {
        console.warn('[Full Sail] Failed to parse pool:', error.message);

        return {
            id: node?.address || knownPool?.id || 'unknown',
            name: knownPool?.name || 'Unknown',
            dex: 'Full Sail',
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
            stablecoin: false,
            feeRate: 0.003,
        };
    }
}

/**
 * Fetch all Full Sail pools
 * @returns {Promise<Array>} Array of normalized pool objects
 */
export async function fetchFullSailPools() {
    console.log('[Full Sail] Fetching pools via GraphQL...');

    const nodes = await queryPools();

    // Map nodes to known pool info
    const pools = nodes.map((node, i) => {
        const knownPool = FULLSAIL_POOLS.find(p => p.id === node?.address) || FULLSAIL_POOLS[i];
        return parsePoolData(node, knownPool);
    }).filter(Boolean);

    console.log(`[Full Sail] Fetched ${pools.length} pools`);
    return pools;
}

export default { fetchFullSailPools };
