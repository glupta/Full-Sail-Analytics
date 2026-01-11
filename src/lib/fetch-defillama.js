/**
 * DefiLlama API integration for Sui DEX data
 * Provides unified access to TVL and volume metrics
 */

// Protocol slug mapping for Sui DEXs
const PROTOCOL_SLUGS = {
    'Full Sail': 'full-sail',
    'Cetus': 'cetus-amm',
    'Bluefin': 'bluefin-spot',
};

// Base URLs for DefiLlama API
const DEFILLAMA_API = 'https://api.llama.fi';
const DEFILLAMA_VOLUMES_API = 'https://api.llama.fi';

/**
 * Fetch TVL for a specific protocol
 * @param {string} slug - DefiLlama protocol slug
 * @returns {Promise<number>} TVL in USD
 */
export async function fetchProtocolTVL(slug) {
    try {
        const res = await fetch(`${DEFILLAMA_API}/tvl/${slug}`);
        if (!res.ok) throw new Error(`TVL fetch failed: ${res.status}`);
        const tvl = await res.json();
        return typeof tvl === 'number' ? tvl : 0;
    } catch (e) {
        console.warn(`DefiLlama TVL fetch failed for ${slug}:`, e.message);
        return 0;
    }
}

/**
 * Fetch detailed protocol data including chain-specific TVL
 * @param {string} slug - DefiLlama protocol slug
 * @returns {Promise<object>} Protocol data
 */
export async function fetchProtocolData(slug) {
    try {
        const res = await fetch(`${DEFILLAMA_API}/protocol/${slug}`);
        if (!res.ok) throw new Error(`Protocol fetch failed: ${res.status}`);
        return await res.json();
    } catch (e) {
        console.warn(`DefiLlama protocol fetch failed for ${slug}:`, e.message);
        return null;
    }
}

/**
 * Fetch 24h volume data for all Sui DEXs
 * @returns {Promise<object>} Volume data by DEX
 */
export async function fetchSuiDexVolumes() {
    try {
        const res = await fetch(`${DEFILLAMA_VOLUMES_API}/overview/dexs/sui`);
        if (!res.ok) throw new Error(`Volume fetch failed: ${res.status}`);
        const data = await res.json();

        // Get the latest day's breakdown
        const breakdown = data.totalDataChartBreakdown || [];
        if (breakdown.length === 0) return {};

        // Get the most recent day's data (last entry)
        const latestEntry = breakdown[breakdown.length - 1];
        const [, volumesByDex] = latestEntry;

        return volumesByDex || {};
    } catch (e) {
        console.error('DefiLlama volume fetch failed:', e);
        return {};
    }
}

/**
 * Map DefiLlama DEX names to our standard names
 */
const DEX_NAME_MAP = {
    'Cetus CLMM': 'Cetus',
    'Bluefin Spot': 'Bluefin',
    'Full Sail': 'Full Sail',
};

/**
 * Fetch aggregated data for all tracked Sui DEXs
 * @returns {Promise<object>} Aggregated DEX data with TVL and volumes
 */
export async function fetchAllSuiDexData() {
    // Fetch volumes (single API call gets all DEXs)
    const volumes = await fetchSuiDexVolumes();

    // Fetch TVL for each DEX in parallel
    const tvlPromises = Object.entries(PROTOCOL_SLUGS).map(async ([name, slug]) => {
        const tvl = await fetchProtocolTVL(slug);
        return { name, tvl };
    });

    const tvlResults = await Promise.all(tvlPromises);

    // Build aggregated data structure
    const dexData = {};

    for (const { name, tvl } of tvlResults) {
        dexData[name] = {
            name,
            tvl,
            volume_24h: 0,
        };
    }

    // Map volumes to our DEX names
    for (const [defiLlamaName, volume] of Object.entries(volumes)) {
        const ourName = DEX_NAME_MAP[defiLlamaName];
        if (ourName && dexData[ourName]) {
            dexData[ourName].volume_24h = volume || 0;
        }
    }

    return dexData;
}

/**
 * Fetch summary metrics for Sui DEX overview
 * @returns {Promise<object>} Summary with totalTVL, totalVolume, dexCount
 */
export async function fetchSuiDexSummary() {
    const dexData = await fetchAllSuiDexData();

    let totalTVL = 0;
    let totalVolume = 0;
    let dexCount = 0;

    for (const dex of Object.values(dexData)) {
        totalTVL += dex.tvl || 0;
        totalVolume += dex.volume_24h || 0;
        if (dex.tvl > 0 || dex.volume_24h > 0) dexCount++;
    }

    return {
        totalTVL,
        totalVolume,
        dexCount,
        dexData,
    };
}

// DefiLlama yields API for pool-level data
const DEFILLAMA_YIELDS_API = 'https://yields.llama.fi';

// Map DefiLlama project names to our standard DEX names
const PROJECT_TO_DEX = {
    'cetus-clmm': 'Cetus',
    'bluefin-spot': 'Bluefin',
    'full-sail': 'Full Sail',
};

/**
 * Fetch pool-level data for all Sui DEXs from DefiLlama yields API
 * @returns {Promise<Array>} Array of pool objects with TVL, APY, and metadata
 */
export async function fetchSuiPools() {
    try {
        const res = await fetch(`${DEFILLAMA_YIELDS_API}/pools`);
        if (!res.ok) throw new Error(`Pools fetch failed: ${res.status}`);
        const data = await res.json();

        if (!data.data || !Array.isArray(data.data)) {
            throw new Error('Invalid pools response');
        }

        // Filter for Sui chain and our tracked DEXs
        const suiPools = data.data.filter(pool => {
            if (pool.chain !== 'Sui') return false;
            const project = pool.project?.toLowerCase();
            return PROJECT_TO_DEX[project] !== undefined;
        });

        // Map to our standard format
        return suiPools.map(pool => {
            const project = pool.project?.toLowerCase();
            const tvl = pool.tvlUsd || 0;
            const volume24h = pool.volumeUsd1d || 0;
            const volume7d = pool.volumeUsd7d || 0;
            const volume30d = volume7d > 0 ? volume7d * 4.28 : volume24h * 30; // Estimate 30d

            // Derive fees from APY Base (Fees / TVL) if available, otherwise estimate from volume (0.25% generic swap fee)
            let fees24h = 0;
            let fees7d = 0;
            let fees30d = 0;

            if (pool.apyBase > 0) {
                const dailyFeeRate = pool.apyBase / (100 * 365);
                fees24h = tvl * dailyFeeRate;
                fees7d = fees24h * 7;
                fees30d = fees24h * 30;
            } else {
                // Fallback: Estimate 0.25% fee tier (common for AMMs)
                fees24h = volume24h * 0.0025;
                fees7d = volume7d * 0.0025;
                fees30d = volume30d * 0.0025;
            }

            return {
                id: pool.pool,
                name: pool.symbol || 'Unknown',
                dex: PROJECT_TO_DEX[project] || pool.project,
                tvl: tvl,
                volume_24h: volume24h,
                volume_7d: volume7d,
                volume_30d: volume30d,
                fees_24h: fees24h,
                fees_7d: fees7d,
                fees_30d: fees30d,
                apr: pool.apy || 0,
                apr_7d: pool.apyPct7D || 0,
                apr_30d: pool.apyMean30d || 0,
                apyBase: pool.apyBase || 0,
                apyReward: pool.apyReward || 0,
                stablecoin: pool.stablecoin || false,
                // Ratios
                fee_tvl_ratio: tvl > 0 ? (fees24h * 365) / tvl : 0, // Annualized
                vol_tvl_ratio: tvl > 0 ? volume24h / tvl : 0,
                fee_vol_ratio: volume24h > 0 ? fees24h / volume24h : 0,
            };
        }).filter(pool => pool.tvl > 0 || pool.apr > 0);
    } catch (e) {
        console.error('DefiLlama pools fetch failed:', e.message);
        return [];
    }
}

const FEE_NAME_MAP = {
    'Cetus CLMM': 'Cetus',
    'Bluefin Spot': 'Bluefin',
    'Full Sail': 'Full Sail',
};

/**
 * Fetch historical fee data for Sui DEXs
 * @param {number} days - Number of days to fetch (default 30)
 * @returns {Promise<object>} Fee data with breakdown by DEX
 */
export async function fetchSuiFees(days = 30) {
    try {
        const res = await fetch(`${DEFILLAMA_API}/overview/fees/sui`);
        if (!res.ok) throw new Error(`Fee fetch failed: ${res.status}`);
        const data = await res.json();

        const breakdown = data.totalDataChartBreakdown || [];
        if (breakdown.length === 0) return { daily: [], totals: {} };

        // Get last N days
        const recentData = breakdown.slice(-days);

        // Aggregate fees by DEX
        const totals = {};
        const daily = recentData.map(([timestamp, fees]) => {
            const dayData = { date: new Date(timestamp * 1000).toISOString().split('T')[0] };

            for (const [defiLlamaName, fee] of Object.entries(fees)) {
                const ourName = FEE_NAME_MAP[defiLlamaName];
                if (ourName) {
                    dayData[ourName] = (fee || 0);
                    totals[ourName] = (totals[ourName] || 0) + (fee || 0);
                }
            }
            return dayData;
        });

        return { daily, totals, daysIncluded: recentData.length };
    } catch (e) {
        console.error('DefiLlama fee fetch failed:', e.message);
        return { daily: [], totals: {}, daysIncluded: 0 };
    }
}

/**
 * Fetch historical volume data for Sui DEXs
 * @param {number} days - Number of days to fetch (default 30)
 * @returns {Promise<object>} Volume data with breakdown by DEX
 */
export async function fetchSuiHistoricalVolume(days = 30) {
    try {
        const res = await fetch(`${DEFILLAMA_API}/overview/dexs/sui`);
        if (!res.ok) throw new Error(`Volume fetch failed: ${res.status}`);
        const data = await res.json();

        const breakdown = data.totalDataChartBreakdown || [];
        if (breakdown.length === 0) return { daily: [], totals: {} };

        // Get last N days
        const recentData = breakdown.slice(-days);

        // Aggregate volume by DEX
        const totals = {};
        const daily = recentData.map(([timestamp, volumes]) => {
            const dayData = { date: new Date(timestamp * 1000).toISOString().split('T')[0] };

            for (const [defiLlamaName, volume] of Object.entries(volumes)) {
                const ourName = DEX_NAME_MAP[defiLlamaName];
                if (ourName) {
                    dayData[ourName] = (volume || 0);
                    totals[ourName] = (totals[ourName] || 0) + (volume || 0);
                }
            }
            return dayData;
        });

        return { daily, totals, daysIncluded: recentData.length };
    } catch (e) {
        console.error('DefiLlama volume fetch failed:', e.message);
        return { daily: [], totals: {}, daysIncluded: 0 };
    }
}

/**
 * Calculate capital efficiency metrics for all DEXs
 * @param {number} days - Time period in days (1, 7, 30)
 * @returns {Promise<object>} Efficiency metrics by DEX
 */
export async function calculateEfficiencyMetrics(days = 7) {
    try {
        // Fetch all data in parallel
        const [feeData, volumeData, tvlData] = await Promise.all([
            fetchSuiFees(days),
            fetchSuiHistoricalVolume(days),
            fetchAllSuiDexData(),
        ]);

        const metrics = {};
        const dexNames = ['Cetus', 'Bluefin', 'Full Sail'];

        for (const dex of dexNames) {
            const fees = feeData.totals[dex] || 0;
            const volume = volumeData.totals[dex] || 0;
            const tvl = tvlData[dex]?.tvl || 0;

            metrics[dex] = {
                name: dex,
                fees,
                volume,
                tvl,
                // Efficiency ratios
                feeToTvl: tvl > 0 ? (fees / tvl) * 100 : 0, // As percentage
                feeToVolume: volume > 0 ? (fees / volume) * 100 : 0, // As percentage (fee rate)
                volumeToTvl: tvl > 0 ? volume / tvl : 0, // Capital turnover
                // Annualized fee yield
                annualizedFeeYield: tvl > 0 ? ((fees / days) * 365 / tvl) * 100 : 0,
            };
        }

        return {
            metrics,
            period: days,
            feeData,
            volumeData,
        };
    } catch (e) {
        console.error('Efficiency metrics calculation failed:', e.message);
        return { metrics: {}, period: days };
    }
}

export { PROTOCOL_SLUGS, DEX_NAME_MAP, PROJECT_TO_DEX, FEE_NAME_MAP };


