/**
 * Cetus Protocol GraphQL Fetcher
 * Fetches CLMM pool data from Sui blockchain via GraphQL
 */

import { executeQuery } from './graphql-client.js';

// Known major Cetus pools (SUI pairs) - popular pools on mainnet
const KNOWN_CETUS_POOLS = [
    { id: '0xcf994611fd4c48e277ce3ffd4d4364c914af2c3cbb05f7bf6facd371de688630', name: 'SUI/USDC' },
    { id: '0x2e041f3fd93646dcc877f783c1f2b7fa62d30271bdef1f21ef002cebf857bded', name: 'SUI/USDT' },
    { id: '0x0254747f5ca059a1972cd7f6016485d51392a3fde608107b93bbaebea550f703', name: 'SUI/WETH' },
    { id: '0x5b0b24c27ccf6d0e98f3a8704d2e577de83fa574d3a9f324a1b63f1f5f1f6d30', name: 'DEEP/SUI' },
];

/**
 * Query pool objects from Sui GraphQL
 */
async function queryPools() {
    const poolIds = KNOWN_CETUS_POOLS.map(p => p.id);

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

    const query = `query GetCetusPools { ${objectQueries} }`;

    try {
        const data = await executeQuery(query);
        return poolIds.map((_, i) => data[`pool${i}`]).filter(Boolean);
    } catch (error) {
        console.error('[Cetus] Pool query failed:', error.message);
        return [];
    }
}

/**
 * Parse Cetus CLMM pool data
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
                dex: 'Cetus',
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

        // Extract liquidity and other metrics from CLMM pool
        const liquidity = BigInt(json.liquidity || '0');
        const feeRate = Number(json.fee_rate || 0) / 1000000;

        // Estimate TVL from liquidity (simplified)
        const tvl = Number(liquidity) / 1e9 * 2;

        return {
            id: poolId,
            name: name,
            dex: 'Cetus',
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
            liquidity: liquidity.toString(),
        };
    } catch (error) {
        console.warn('[Cetus] Failed to parse pool:', error.message);
        return null;
    }
}

/**
 * Fetch all Cetus pools
 * @returns {Promise<Array>} Array of normalized pool objects
 */
export async function fetchCetusPools() {
    console.log('[Cetus] Fetching pools via GraphQL...');

    const nodes = await queryPools();
    const pools = nodes.map((node, i) => {
        const knownPool = KNOWN_CETUS_POOLS.find(p => p.id === node?.address) || KNOWN_CETUS_POOLS[i];
        return parsePoolData(node, knownPool);
    }).filter(Boolean);

    console.log(`[Cetus] Fetched ${pools.length} pools`);
    return pools;
}

export default { fetchCetusPools };
