#!/usr/bin/env node
/**
 * DEX Data Processor
 * Fetches pool data from Sui GraphQL, gets token prices, calculates USD values,
 * and stores processed data to a JSON file for the dashboard.
 * 
 * Supports historical data accumulation with pagination.
 * 
 * Run with: node scripts/process-dex-data.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Command-line arguments
const ARGS = process.argv.slice(2);
const HISTORICAL_MODE = ARGS.includes('--historical');

// Configuration
const SUI_GRAPHQL_URL = 'https://graphql.mainnet.sui.io/graphql';
const SUI_RPC_URL = 'https://fullnode.mainnet.sui.io:443'; // JSON-RPC for historical events
const COINGECKO_API = 'https://api.coingecko.com/api/v3';
const OUTPUT_FILE = path.join(__dirname, '../public/dex-data.json');
const HISTORY_FILE = path.join(__dirname, '../public/dex-history.json');
const EVENT_CACHE_FILE = path.join(__dirname, '../public/event-cache.json');
const CHECKPOINT_FILE = path.join(__dirname, '../public/historical-checkpoint.json');
const CACHE_TTL_HOURS = 1; // Re-fetch events if cache is older than this
const QUICK_MODE_LIMIT = 1000; // Events per DEX in quick mode

// DEX pool types (for GraphQL pool queries)
const DEX_POOL_TYPES = {
    Cetus: '0x1eabed72c53feb3805120a081dc15963c204dc8d091542592abaf7a35689b2fb::pool::Pool',
    Bluefin: '0x3492c874c1e3b3e2984e8c41b589e642d4d0a5d6459e5a9cfc2d52fd7c89c267::pool::Pool',
    Momentum: '0x70285592c97965e811e0c6f98dccc3a9c2b4ad854b3594faab9597ada267b860::pool::Pool',
    'Full Sail': '0xe74104c66dd9f16b3096db2cc00300e556aa92edc871be4bc052b5dfb80db239::pool::Pool',
};

// DEX swap event types (for JSON-RPC event queries)
const DEX_SWAP_EVENTS = {
    Cetus: '0x1eabed72c53feb3805120a081dc15963c204dc8d091542592abaf7a35689b2fb::pool::SwapEvent',
    Bluefin: '0x3492c874c1e3b3e2984e8c41b589e642d4d0a5d6459e5a9cfc2d52fd7c89c267::events::AssetSwap',
    Momentum: '0x70285592c97965e811e0c6f98dccc3a9c2b4ad854b3594faab9597ada267b860::trade::SwapEvent',
    'Full Sail': '0xe74104c66dd9f16b3096db2cc00300e556aa92edc871be4bc052b5dfb80db239::pool::SwapEvent',
};

// Known token mappings for Sui
const TOKEN_CONFIG = {
    '0x2::sui::SUI': { symbol: 'SUI', coingeckoId: 'sui', decimals: 9 },
    '0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN': { symbol: 'USDC', coingeckoId: 'usd-coin', decimals: 6 },
    '0xc060006111016b8a020ad5b33834984a437aaa7d3c74c18e09a95d48aceab08c::coin::COIN': { symbol: 'USDT', coingeckoId: 'tether', decimals: 6 },
};

/**
 * Execute GraphQL query
 */
async function executeGraphQL(query, variables = {}) {
    const response = await fetch(SUI_GRAPHQL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) throw new Error(`GraphQL request failed: ${response.status}`);
    const result = await response.json();
    if (result.errors) throw new Error(`GraphQL error: ${result.errors[0]?.message}`);
    return result.data;
}

/**
 * Fetch token prices from CoinGecko
 */
async function fetchTokenPrices() {
    const coingeckoIds = [...new Set(Object.values(TOKEN_CONFIG).map(t => t.coingeckoId))];

    try {
        const response = await fetch(`${COINGECKO_API}/simple/price?ids=${coingeckoIds.join(',')}&vs_currencies=usd`);
        if (!response.ok) throw new Error('CoinGecko API error');
        return await response.json();
    } catch (error) {
        console.warn('Price fetch failed, using fallback:', error.message);
        return { sui: { usd: 4.50 }, 'usd-coin': { usd: 1.0 }, tether: { usd: 1.0 } };
    }
}

/**
 * Fetch pool objects with pagination
 */
async function fetchAllPoolObjects(poolType, maxPages = 5) {
    const allPools = [];
    let cursor = null;
    let page = 0;

    while (page < maxPages) {
        const query = `
      query GetPools($poolType: String!, $first: Int!, $after: String) {
        objects(filter: { type: $poolType }, first: $first, after: $after) {
          nodes { address asMoveObject { contents { type { repr } json } } }
          pageInfo { hasNextPage endCursor }
        }
      }
    `;

        const data = await executeGraphQL(query, { poolType, first: 50, after: cursor });
        const nodes = data?.objects?.nodes || [];
        allPools.push(...nodes);

        if (!data?.objects?.pageInfo?.hasNextPage) break;
        cursor = data.objects.pageInfo.endCursor;
        page++;
        console.log(`   Page ${page + 1}: fetched ${nodes.length} pools (total: ${allPools.length})`);
    }

    return allPools;
}

/**
 * Fetch swap events using JSON-RPC suix_queryEvents
 * In historical mode: fetches ALL events with checkpoint saving
 * In quick mode: fetches limited recent events
 */
async function fetchAllSwapEvents(eventType, maxEvents = 5000, dexName = '', checkpoint = null) {
    const allEvents = [];
    let cursor = checkpoint?.cursors?.[dexName] || null;
    const batchSize = 50; // Max per request
    const isHistorical = maxEvents === Infinity;
    const checkpointInterval = 10000; // Save checkpoint every 10K events
    let lastCheckpointCount = 0;

    console.log(`   Fetching ${isHistorical ? 'ALL historical' : `up to ${maxEvents}`} swap events via JSON-RPC...`);
    if (cursor) console.log(`   Resuming from checkpoint...`);

    while (!isHistorical || allEvents.length < 10000000) { // Safety limit: 10M events
        if (!isHistorical && allEvents.length >= maxEvents) break;

        try {
            const response = await fetch(SUI_RPC_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'suix_queryEvents',
                    params: [
                        { MoveEventType: eventType },
                        cursor,
                        batchSize,
                        false // descending = false (oldest first for historical, to build chronologically)
                    ]
                })
            });

            if (!response.ok) throw new Error(`RPC error: ${response.status}`);
            const result = await response.json();

            if (result.error) throw new Error(`RPC error: ${result.error.message}`);

            const events = result.result?.data || [];
            const nextCursor = result.result?.nextCursor;

            // Transform to our format
            for (const event of events) {
                allEvents.push({
                    timestamp: new Date(parseInt(event.timestampMs)).toISOString(),
                    timestampMs: event.timestampMs,
                    txDigest: event.id?.txDigest,
                    contents: { json: event.parsedJson },
                });
            }

            // Progress logging every 1000 events
            if (allEvents.length % 1000 < batchSize) {
                const oldestDate = events[events.length - 1]?.timestampMs
                    ? new Date(parseInt(events[events.length - 1].timestampMs)).toISOString().split('T')[0]
                    : 'N/A';
                console.log(`   ${dexName}: ${allEvents.length.toLocaleString()} events (latest: ${oldestDate})`);
            }

            // Save checkpoint periodically in historical mode
            if (isHistorical && checkpoint && allEvents.length - lastCheckpointCount >= checkpointInterval) {
                checkpoint.cursors[dexName] = nextCursor;
                checkpoint.processedEvents[dexName] = allEvents.length;
                saveCheckpoint(checkpoint);
                console.log(`   Checkpoint saved at ${allEvents.length.toLocaleString()} events`);
                lastCheckpointCount = allEvents.length;
            }

            if (!nextCursor || events.length < batchSize) {
                console.log(`   ${dexName}: Complete! Fetched ${allEvents.length.toLocaleString()} total events`);
                break;
            }
            cursor = nextCursor;

            // Rate limiting - faster for historical, slower for quick mode
            await new Promise(r => setTimeout(r, isHistorical ? 50 : 100));
        } catch (error) {
            console.error('   Event fetch error:', error.message);
            // Save checkpoint on error for resume
            if (isHistorical && checkpoint && cursor) {
                checkpoint.cursors[dexName] = cursor;
                checkpoint.processedEvents[dexName] = allEvents.length;
                saveCheckpoint(checkpoint);
                console.log(`   Checkpoint saved on error. Resume with --historical`);
            }
            break;
        }
    }

    return allEvents;
}

/**
 * Calculate volume and fees from swap events by time period
 */
function calculateMetrics(events, prices) {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const suiPrice = prices.sui?.usd || 4.5;

    const metrics = { volume24h: 0, volume7d: 0, volume30d: 0, fees24h: 0, fees7d: 0, fees30d: 0, totalSwaps: 0 };
    const dailyVolume = {}; // Group by date for historical charts
    const poolMetrics = {}; // Per-pool volume/fees tracking

    for (const event of events) {
        try {
            const eventData = event.contents?.json;
            if (!eventData) continue;

            const timestamp = new Date(event.timestamp).getTime();
            const age = now - timestamp;
            const dateKey = new Date(timestamp).toISOString().split('T')[0];
            const poolId = eventData.pool; // Pool ID from swap event

            // Handle different DEX field names
            // Cetus/Bluefin: amount_in, amount_out, fee_amount
            // Momentum: amount_x, amount_y, fee_amount
            const amountIn = parseFloat(eventData.amount_in || eventData.amount_x || 0);
            const amountOut = parseFloat(eventData.amount_out || eventData.amount_y || 0);
            const feeAmount = parseFloat(eventData.fee_amount || eventData.fee || 0);

            const volumeUSD = (Math.max(amountIn, amountOut) / 1e9) * suiPrice;
            const feeUSD = (feeAmount / 1e9) * suiPrice;

            // Aggregate by time period (DEX level)
            if (age <= day) { metrics.volume24h += volumeUSD; metrics.fees24h += feeUSD; }
            if (age <= 7 * day) { metrics.volume7d += volumeUSD; metrics.fees7d += feeUSD; }
            if (age <= 30 * day) { metrics.volume30d += volumeUSD; metrics.fees30d += feeUSD; }
            metrics.totalSwaps++;

            // Store daily for historical charts
            if (!dailyVolume[dateKey]) dailyVolume[dateKey] = { volume: 0, fees: 0, swaps: 0 };
            dailyVolume[dateKey].volume += volumeUSD;
            dailyVolume[dateKey].fees += feeUSD;
            dailyVolume[dateKey].swaps++;

            // Track per-pool metrics
            if (poolId) {
                if (!poolMetrics[poolId]) {
                    poolMetrics[poolId] = { volume24h: 0, volume7d: 0, volume30d: 0, fees24h: 0, fees7d: 0, fees30d: 0, swaps: 0 };
                }
                if (age <= day) { poolMetrics[poolId].volume24h += volumeUSD; poolMetrics[poolId].fees24h += feeUSD; }
                if (age <= 7 * day) { poolMetrics[poolId].volume7d += volumeUSD; poolMetrics[poolId].fees7d += feeUSD; }
                if (age <= 30 * day) { poolMetrics[poolId].volume30d += volumeUSD; poolMetrics[poolId].fees30d += feeUSD; }
                poolMetrics[poolId].swaps++;
            }
        } catch (e) { continue; }
    }

    return { metrics, dailyVolume, poolMetrics };
}

/**
 * Extract token symbols from Move type string
 * e.g., "0x...::pool::Pool<0x2::sui::SUI, 0x...::usdc::USDC>" -> "SUI/USDC"
 */
function extractTokenPair(typeString) {
    if (!typeString) return 'Unknown';

    // Match generic type parameters: Pool<TypeA, TypeB>
    const genericMatch = typeString.match(/<([^,]+),\s*([^>]+)>/);
    if (!genericMatch) return 'Unknown';

    const extractSymbol = (fullType) => {
        // Get the last part after :: (the actual type name)
        const parts = fullType.trim().split('::');
        const symbol = parts[parts.length - 1]?.toUpperCase() || 'UNKNOWN';
        // Handle common wrapped types
        if (symbol === 'COIN') {
            // Try to get the module name for wrapped coins like USDC, USDT
            return parts[parts.length - 2]?.toUpperCase() || symbol;
        }
        return symbol;
    };

    const tokenA = extractSymbol(genericMatch[1]);
    const tokenB = extractSymbol(genericMatch[2]);
    return `${tokenA}/${tokenB}`;
}

/**
 * Process pool data with prices - handles multiple DEX formats
 */
function processPool(node, prices, dexName) {
    const poolData = node.asMoveObject?.contents?.json;
    const poolType = node.asMoveObject?.contents?.type?.repr || node.asMoveObject?.contents?.type;
    if (!poolData) return null;

    const suiPrice = prices.sui?.usd || 4.5;

    // Extract reserves based on DEX structure
    let reserveA = 0, reserveB = 0, feeRate = 0;

    // Cetus & Full Sail use coin_a, coin_b
    if (poolData.coin_a !== undefined) {
        reserveA = Number(BigInt(poolData.coin_a || 0)) / 1e9;
        reserveB = Number(BigInt(poolData.coin_b || 0)) / 1e9;
        feeRate = parseInt(poolData.fee_rate || 0) / 1000000;
    }
    // Bluefin uses similar structure
    else if (poolData.reserve_a !== undefined) {
        reserveA = Number(BigInt(poolData.reserve_a || 0)) / 1e9;
        reserveB = Number(BigInt(poolData.reserve_b || 0)) / 1e9;
        feeRate = parseInt(poolData.fee_rate || 0) / 1000000;
    }
    // Momentum uses reserve_x, reserve_y
    else if (poolData.reserve_x !== undefined) {
        reserveA = Number(BigInt(poolData.reserve_x || 0)) / 1e9;
        reserveB = Number(BigInt(poolData.reserve_y || 0)) / 1e9;
        feeRate = parseInt(poolData.swap_fee_rate || poolData.fee_rate || 0) / 1000000;
    }

    // Extract token pair name from type first (needed for TVL calculation)
    const tokenPair = extractTokenPair(poolType);
    const tokens = tokenPair.split('/');
    const tokenA = tokens[0];
    const tokenB = tokens[1];

    // Calculate TVL based on pair composition
    // 1. If SUI is in pair: use SUI reserve * price * 2
    // 2. If stablecoin pair (USDC/USDT): use reserve directly (assuming 6 decimals for stables)
    // 3. Otherwise: use SUI price estimation on larger reserve

    let tvl = 0;
    const stablecoins = ['USDC', 'USDT', 'DAI', 'AUSD'];
    const hasSui = tokenA === 'SUI' || tokenB === 'SUI';
    const isStablePair = stablecoins.includes(tokenA) || stablecoins.includes(tokenB);

    if (hasSui) {
        // Use SUI reserve * 2 for SUI pairs
        const suiReserve = tokenA === 'SUI' ? reserveA : reserveB;
        tvl = suiReserve * suiPrice * 2;
    } else if (isStablePair) {
        // For stablecoin pairs, estimate using stablecoin reserve
        // Note: Stablecoins typically have 6 decimals, but we're already dividing by 1e9
        // This means we need to multiply by 1000 to correct for the 3 decimal place difference
        const stableReserve = stablecoins.includes(tokenA) ? reserveA * 1000 : reserveB * 1000;
        tvl = stableReserve * 2;
    } else {
        // For other pairs without SUI or stablecoins, use rough SUI price estimate
        const maxReserve = Math.max(reserveA, reserveB);
        tvl = maxReserve * suiPrice * 2;
    }

    if (tvl <= 0) return null;

    return {
        id: node.address,
        name: tokenPair,
        dex: dexName,
        tvl,
        feeRate,
        isPaused: poolData.is_pause || poolData.paused || false,
    };
}

/**
 * Load cached events to avoid re-fetching
 */
function loadEventCache() {
    try {
        if (fs.existsSync(EVENT_CACHE_FILE)) {
            const cache = JSON.parse(fs.readFileSync(EVENT_CACHE_FILE, 'utf-8'));
            const cacheAge = (Date.now() - new Date(cache.timestamp).getTime()) / (1000 * 60 * 60);
            if (cacheAge < CACHE_TTL_HOURS) {
                console.log(`   Using cached events (${cacheAge.toFixed(1)}h old)`);
                return cache;
            }
            console.log(`   Cache expired (${cacheAge.toFixed(1)}h old), will re-fetch`);
        }
    } catch (e) { console.warn('Could not load event cache:', e.message); }
    return null;
}

/**
 * Save events to cache
 */
function saveEventCache(eventsByDex) {
    const cache = {
        timestamp: new Date().toISOString(),
        events: eventsByDex,
    };
    fs.mkdirSync(path.dirname(EVENT_CACHE_FILE), { recursive: true });
    fs.writeFileSync(EVENT_CACHE_FILE, JSON.stringify(cache));
    console.log(`   Events cached for next run`);
}

/**
 * Load historical checkpoint (for resume capability)
 */
function loadCheckpoint() {
    try {
        if (fs.existsSync(CHECKPOINT_FILE)) {
            return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8'));
        }
    } catch (e) { console.warn('Could not load checkpoint:', e.message); }
    return { cursors: {}, processedEvents: {}, dailyPoolData: {} };
}

/**
 * Save historical checkpoint
 */
function saveCheckpoint(checkpoint) {
    fs.mkdirSync(path.dirname(CHECKPOINT_FILE), { recursive: true });
    fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(checkpoint, null, 2));
}

/**
 * Load existing history
 */
function loadHistory() {
    try {
        if (fs.existsSync(HISTORY_FILE)) {
            return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));
        }
    } catch (e) { console.warn('Could not load history:', e.message); }
    return { dailySnapshots: {} };
}

/**
 * Save history with new snapshot
 */
function saveHistory(history) {
    fs.mkdirSync(path.dirname(HISTORY_FILE), { recursive: true });
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
}

/**
 * Main processing function
 */
async function processAllData() {
    console.log('=== DEX Data Processor ===');
    console.log(`Mode: ${HISTORICAL_MODE ? '🔄 HISTORICAL (all events)' : '⚡ Quick (recent events)'}`);
    console.log(`Timestamp: ${new Date().toISOString()}\n`);

    // 1. Fetch token prices
    console.log('1. Fetching token prices...');
    const prices = await fetchTokenPrices();
    console.log(`   SUI: $${prices.sui?.usd || 'N/A'}`);

    // 2. Fetch pools with pagination
    console.log('\n2. Fetching pool data (with pagination)...');
    const allPools = [];
    const dexStats = {};

    for (const [dexName, poolType] of Object.entries(DEX_POOL_TYPES)) {
        console.log(`   ${dexName}:`);
        const poolNodes = await fetchAllPoolObjects(poolType, 3);
        const pools = poolNodes.map(n => processPool(n, prices, dexName)).filter(p => p !== null);

        console.log(`   Total: ${pools.length} pools with TVL > 0`);
        allPools.push(...pools);

        dexStats[dexName] = {
            poolCount: pools.length,
            totalTVL: pools.reduce((sum, p) => sum + p.tvl, 0),
        };
    }

    // 3. Fetch swap events (with caching to avoid re-fetching)
    console.log(`\n3. Fetching swap events... (${HISTORICAL_MODE ? 'HISTORICAL MODE - fetching ALL' : 'Quick mode'})`);
    const eventCache = HISTORICAL_MODE ? null : loadEventCache(); // Skip cache in historical mode
    const checkpoint = HISTORICAL_MODE ? loadCheckpoint() : null;
    const eventsByDex = eventCache?.events || {};
    let needsCacheUpdate = !eventCache;
    const allPoolMetrics = {}; // Aggregate per-pool metrics across all DEXs

    for (const [dexName, eventType] of Object.entries(DEX_SWAP_EVENTS)) {
        console.log(`   ${dexName}:`);

        let events;
        if (!HISTORICAL_MODE && eventsByDex[dexName] && !needsCacheUpdate) {
            events = eventsByDex[dexName];
            console.log(`   Using ${events.length} cached events`);
        } else {
            const maxEvents = HISTORICAL_MODE ? Infinity : QUICK_MODE_LIMIT;
            events = await fetchAllSwapEvents(eventType, maxEvents, dexName, checkpoint);
            eventsByDex[dexName] = events;
            needsCacheUpdate = true;
        }

        const { metrics, dailyVolume, poolMetrics } = calculateMetrics(events, prices);
        console.log(`   Total: ${metrics.totalSwaps} swaps, $${metrics.volume24h.toFixed(2)} 24h vol`);

        // Merge pool metrics
        Object.assign(allPoolMetrics, poolMetrics);

        if (dexStats[dexName]) {
            Object.assign(dexStats[dexName], metrics);
            dexStats[dexName].dailyVolume = dailyVolume;
        } else {
            // DEX has events but no pools (like Momentum)
            dexStats[dexName] = { poolCount: 0, totalTVL: 0, ...metrics, dailyVolume };
        }
    }

    // Save event cache if updated
    if (needsCacheUpdate) {
        saveEventCache(eventsByDex);
    }

    // 4. Build output - merge per-pool metrics into pools
    const today = new Date().toISOString().split('T')[0];

    // Enhance pools with their individual swap metrics
    const poolsWithMetrics = allPools.map(pool => {
        const pm = allPoolMetrics[pool.id] || {};
        return {
            ...pool,
            volume_24h: pm.volume24h || 0,
            volume_7d: pm.volume7d || 0,
            volume_30d: pm.volume30d || 0,
            fees_24h: pm.fees24h || 0,
            fees_7d: pm.fees7d || 0,
            fees_30d: pm.fees30d || 0,
            swaps_24h: pm.swaps || 0,
        };
    });

    const output = {
        lastUpdated: new Date().toISOString(),
        prices,
        summary: {
            totalTVL: Object.values(dexStats).reduce((sum, d) => sum + (d.totalTVL || 0), 0),
            totalVolume24h: Object.values(dexStats).reduce((sum, d) => sum + (d.volume24h || 0), 0),
            totalVolume7d: Object.values(dexStats).reduce((sum, d) => sum + (d.volume7d || 0), 0),
            totalFees24h: Object.values(dexStats).reduce((sum, d) => sum + (d.fees24h || 0), 0),
            totalPools: poolsWithMetrics.length,
        },
        dexStats,
        pools: poolsWithMetrics.sort((a, b) => b.tvl - a.tvl),
    };

    // 5. Save current data
    console.log('\n4. Saving data...');
    fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
    console.log(`   Current: ${OUTPUT_FILE}`);

    // 6. Update historical snapshots
    const history = loadHistory();
    history.dailySnapshots[today] = {
        date: today,
        totalTVL: output.summary.totalTVL,
        volume24h: output.summary.totalVolume24h,
        fees24h: output.summary.totalFees24h,
        poolCount: output.summary.totalPools,
        dexStats: Object.fromEntries(
            Object.entries(dexStats).map(([k, v]) => [k, {
                tvl: v.totalTVL,
                volume: v.volume24h,
                fees: v.fees24h,
                pools: v.poolCount
            }])
        ),
    };
    saveHistory(history);
    console.log(`   History: ${HISTORY_FILE} (${Object.keys(history.dailySnapshots).length} days)`);

    // Summary
    console.log('\n=== Summary ===');
    console.log(`Total TVL: $${output.summary.totalTVL.toFixed(2)}`);
    console.log(`24h Volume: $${output.summary.totalVolume24h.toFixed(2)}`);
    console.log(`24h Fees: $${output.summary.totalFees24h.toFixed(2)}`);
    console.log(`Pools: ${output.summary.totalPools}`);

    return output;
}

// Run
processAllData()
    .then(() => { console.log('\nDone!'); process.exit(0); })
    .catch(error => { console.error('Failed:', error); process.exit(1); });
