/**
 * Sui GraphQL data fetching for DEX analytics
 * Uses Sui's native GraphQL RPC to query on-chain DEX data
 * Replaces DefiLlama as the sole data source
 */

// Sui GraphQL endpoint (official beta)
const SUI_GRAPHQL_URL = 'https://graphql.mainnet.sui.io/graphql';

// Cache configuration - persist data to reduce RPC load
const CACHE_KEY = 'sui_dex_graphql_cache';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get cached data if fresh
 */
function getCachedData(key) {
  try {
    const cached = localStorage.getItem(`${CACHE_KEY}_${key}`);
    if (!cached) return null;

    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp < CACHE_TTL_MS) {
      console.log(`Using cached ${key} data`);
      return data;
    }
  } catch (e) {
    console.warn('Cache read error:', e);
  }
  return null;
}

/**
 * Store data in cache
 */
function setCachedData(key, data) {
  try {
    localStorage.setItem(`${CACHE_KEY}_${key}`, JSON.stringify({
      data,
      timestamp: Date.now(),
    }));
  } catch (e) {
    console.warn('Cache write error:', e);
  }
}

// DEX pool type strings for Sui mainnet
const DEX_POOL_TYPES = {
  Cetus: '0x1eabed72c53feb3805120a081dc15963c204dc8d091542592abaf7a35689b2fb::pool::Pool',
  // Add other DEXs as their pool types are confirmed
};

// DEX swap event types
const DEX_SWAP_EVENTS = {
  Cetus: '0x1eabed72c53feb3805120a081dc15963c204dc8d091542592abaf7a35689b2fb::pool::SwapEvent',
};

// Common token mappings for symbol extraction
const KNOWN_TOKENS = {
  '0x2::sui::SUI': { symbol: 'SUI', decimals: 9 },
  '0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN': { symbol: 'USDC', decimals: 6 },
  '0xc060006111016b8a020ad5b33834984a437aaa7d3c74c18e09a95d48aceab08c::coin::COIN': { symbol: 'USDT', decimals: 6 },
  '0xaf8cd5edc19c4512f4259f0bee101a40d41ebed738ade5874359610ef8eeced5::coin::COIN': { symbol: 'WETH', decimals: 8 },
};

/**
 * Execute a GraphQL query against Sui mainnet
 */
async function executeGraphQL(query, variables = {}) {
  const response = await fetch(SUI_GRAPHQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`GraphQL request failed: ${response.status}`);
  }

  const result = await response.json();
  if (result.errors) {
    console.error('GraphQL errors:', result.errors);
    throw new Error(`GraphQL error: ${result.errors[0]?.message}`);
  }

  return result.data;
}

/**
 * Fetch pool objects for a specific DEX
 */
export async function fetchPoolObjects(poolType, limit = 50) {
  // Use regex filter for pool type (handles type parameters)
  const query = `
    query GetPools($poolType: String!, $first: Int!) {
      objects(
        filter: { type: $poolType }
        first: $first
      ) {
        nodes {
          address
          asMoveObject {
            contents { json }
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  `;

  try {
    const data = await executeGraphQL(query, { poolType, first: limit });
    return data?.objects?.nodes || [];
  } catch (error) {
    console.error('Failed to fetch pool objects:', error);
    return [];
  }
}

/**
 * Fetch recent swap events
 */
export async function fetchSwapEvents(eventType, limit = 50) {
  const query = `
    query GetSwapEvents($eventType: String!, $first: Int!) {
      events(
        filter: { type: $eventType }
        first: $first
      ) {
        nodes {
          timestamp
          sequenceNumber
          contents { json }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  `;

  try {
    const data = await executeGraphQL(query, { eventType, first: limit });
    return data?.events?.nodes || [];
  } catch (error) {
    console.error('Failed to fetch swap events:', error);
    return [];
  }
}

/**
 * Extract token symbol from coin type
 */
function extractSymbol(coinType) {
  if (!coinType) return 'UNKNOWN';
  if (KNOWN_TOKENS[coinType]) return KNOWN_TOKENS[coinType].symbol;

  // Try to extract from module path
  const parts = coinType.split('::');
  if (parts.length >= 2) {
    const moduleName = parts[parts.length - 2];
    if (moduleName.length <= 8) return moduleName.toUpperCase();
  }
  return 'TOKEN';
}

/**
 * Parse Cetus pool data into standard format
 */
function parseCetusPool(node) {
  const poolData = node.asMoveObject?.contents?.json;
  if (!poolData) return null;

  const feeRate = parseInt(poolData.fee_rate || 0) / 1000000; // Convert to decimal
  const coinA = BigInt(poolData.coin_a || 0);
  const coinB = BigInt(poolData.coin_b || 0);
  const liquidity = BigInt(poolData.liquidity || 0);

  // Estimate TVL from coin balances (simplified - would need price oracle for accuracy)
  // For now, use liquidity as a proxy metric
  const liquidityNum = Number(liquidity);

  return {
    id: node.address,
    name: `Pool ${node.address.slice(0, 8)}...`,
    dex: 'Cetus',
    tvl: liquidityNum > 0 ? liquidityNum / 1e18 : 0, // Rough estimate
    coinA: Number(coinA),
    coinB: Number(coinB),
    feeRate: feeRate,
    tickSpacing: poolData.tick_spacing || 0,
    isPaused: poolData.is_pause || false,
    // These will be populated from swap events
    volume_24h: 0,
    volume_7d: 0,
    volume_30d: 0,
    fees_24h: 0,
    fees_7d: 0,
    fees_30d: 0,
    apr: 0,
  };
}

/**
 * Calculate volume and fees from swap events over time periods
 */
function calculateVolumeAndFees(events) {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  let volume24h = 0, volume7d = 0, volume30d = 0;
  let fees24h = 0, fees7d = 0, fees30d = 0;

  for (const event of events) {
    try {
      const eventData = event.contents?.json;
      if (!eventData) continue;

      const timestamp = new Date(event.timestamp).getTime();
      const age = now - timestamp;

      const amountIn = parseFloat(eventData.amount_in || 0);
      const amountOut = parseFloat(eventData.amount_out || 0);
      const feeAmount = parseFloat(eventData.fee_amount || 0);
      const volume = Math.max(amountIn, amountOut);

      if (age <= day) {
        volume24h += volume;
        fees24h += feeAmount;
      }
      if (age <= 7 * day) {
        volume7d += volume;
        fees7d += feeAmount;
      }
      if (age <= 30 * day) {
        volume30d += volume;
        fees30d += feeAmount;
      }
    } catch (e) {
      continue;
    }
  }

  return { volume24h, volume7d, volume30d, fees24h, fees7d, fees30d };
}

/**
 * Fetch all pools for all tracked DEXs (with caching)
 */
export async function fetchAllPools(forceRefresh = false) {
  // Check cache first
  if (!forceRefresh) {
    const cached = getCachedData('pools');
    if (cached) return cached;
  }

  const allPools = [];

  for (const [dexName, poolType] of Object.entries(DEX_POOL_TYPES)) {
    try {
      console.log(`Fetching ${dexName} pools via GraphQL...`);
      const poolNodes = await fetchPoolObjects(poolType, 50);

      const pools = poolNodes
        .map(node => {
          if (dexName === 'Cetus') return parseCetusPool(node);
          return null;
        })
        .filter(p => p !== null);

      console.log(`Found ${pools.length} ${dexName} pools`);
      allPools.push(...pools);
    } catch (error) {
      console.error(`Failed to fetch ${dexName} pools:`, error);
    }
  }

  // Cache results
  setCachedData('pools', allPools);
  return allPools;
}

/**
 * Fetch DEX-level summary statistics
 */
export async function fetchDexSummary() {
  const summary = {
    totalTVL: 0,
    totalVolume: 0,
    dexCount: 0,
    dexData: {},
  };

  for (const [dexName, eventType] of Object.entries(DEX_SWAP_EVENTS)) {
    try {
      const events = await fetchSwapEvents(eventType, 50);
      const { volume24h, fees24h } = calculateVolumeAndFees(events);

      // Get pool count
      const poolType = DEX_POOL_TYPES[dexName];
      const pools = poolType ? await fetchPoolObjects(poolType, 50) : [];

      summary.dexData[dexName] = {
        name: dexName,
        volume_24h: volume24h,
        fees_24h: fees24h,
        poolCount: pools.length,
        swapCount: events.length,
      };

      summary.totalVolume += volume24h;
      summary.dexCount++;
    } catch (error) {
      console.error(`Failed to fetch ${dexName} summary:`, error);
    }
  }

  return summary;
}

/**
 * Fetch the current checkpoint info
 */
export async function fetchLatestCheckpoint() {
  const query = `
    query {
      checkpoint {
        sequenceNumber
        timestamp
        networkTotalTransactions
      }
    }
  `;

  try {
    const data = await executeGraphQL(query);
    return data?.checkpoint;
  } catch (error) {
    console.error('Failed to fetch checkpoint:', error);
    return null;
  }
}

/**
 * Test GraphQL connection
 */
export async function testConnection() {
  try {
    const checkpoint = await fetchLatestCheckpoint();
    if (checkpoint) {
      console.log('Sui GraphQL connected:', {
        checkpoint: checkpoint.sequenceNumber,
        transactions: checkpoint.networkTotalTransactions,
      });
      return true;
    }
    return false;
  } catch (error) {
    console.error('GraphQL connection test failed:', error);
    return false;
  }
}

export { DEX_POOL_TYPES, DEX_SWAP_EVENTS, executeGraphQL };
