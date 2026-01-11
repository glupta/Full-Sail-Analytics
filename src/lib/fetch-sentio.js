/**
 * Sentio API integration for Sui DEX data
 * Provides reliable access to DEX metrics via Sentio's analytics platform
 * 
 * Setup: Add your Sentio API key to .env.local:
 *   VITE_SENTIO_API_KEY=your_key_here
 *   VITE_SENTIO_PROJECT_ID=your_project_id
 */

const SENTIO_API_BASE = 'https://app.sentio.xyz/api/v1';

/**
 * Get Sentio API headers with authentication
 */
function getHeaders() {
    const apiKey = import.meta.env.VITE_SENTIO_API_KEY;
    if (!apiKey || apiKey === 'your_api_key_here') {
        console.warn('Sentio API key not configured. Add VITE_SENTIO_API_KEY to .env.local');
        return null;
    }
    return {
        'Content-Type': 'application/json',
        'api-key': apiKey,
    };
}

/**
 * Query metrics from Sentio
 * @param {string} projectId - Sentio project ID
 * @param {object} query - Query parameters
 */
export async function querySentioMetrics(projectId, query) {
    const headers = getHeaders();
    if (!headers) return null;

    try {
        const res = await fetch(`${SENTIO_API_BASE}/metrics/${projectId}/query`, {
            method: 'POST',
            headers,
            body: JSON.stringify(query),
        });

        if (!res.ok) {
            throw new Error(`Sentio API error: ${res.status}`);
        }

        return await res.json();
    } catch (e) {
        console.error('Sentio query failed:', e.message);
        return null;
    }
}

/**
 * Fetch Sui DEX pool data from Sentio
 * This requires a Sentio project configured to index Sui DEX data
 */
export async function fetchSentioSuiPools() {
    const projectId = import.meta.env.VITE_SENTIO_PROJECT_ID;

    if (!projectId || projectId === 'your_project_id_here') {
        console.warn('Sentio Project ID not configured');
        return [];
    }

    // Query for pool metrics - adjust based on your Sentio processor
    const query = {
        queries: [
            {
                metricsQuery: {
                    query: 'pool_tvl',
                    alias: 'tvl',
                    id: 'tvl',
                    aggregation: 'AGGREGATION_LAST',
                },
            },
            {
                metricsQuery: {
                    query: 'pool_volume_24h',
                    alias: 'volume',
                    id: 'volume',
                    aggregation: 'AGGREGATION_LAST',
                },
            },
            {
                metricsQuery: {
                    query: 'pool_fees_24h',
                    alias: 'fees',
                    id: 'fees',
                    aggregation: 'AGGREGATION_LAST',
                },
            },
        ],
    };

    const data = await querySentioMetrics(projectId, query);

    if (!data?.results) {
        return [];
    }

    // Transform Sentio data to match our pool format
    // This structure depends on your specific Sentio processor
    return data.results.map(pool => ({
        id: pool.id || pool.pool_address,
        name: pool.name || pool.symbol,
        dex: pool.dex || pool.protocol,
        tvl: parseFloat(pool.tvl) || 0,
        volume_24h: parseFloat(pool.volume) || 0,
        fees_24h: parseFloat(pool.fees) || 0,
        apr: parseFloat(pool.apr) || 0,
    }));
}

/**
 * Check if Sentio is configured
 */
export function isSentioConfigured() {
    const apiKey = import.meta.env.VITE_SENTIO_API_KEY;
    const projectId = import.meta.env.VITE_SENTIO_PROJECT_ID;

    return apiKey &&
        apiKey !== 'your_api_key_here' &&
        projectId &&
        projectId !== 'your_project_id_here';
}

/**
 * Get Sentio dashboard data via exported API
 * Use this if you have created a Sentio Dash and exported it as an API
 * @param {string} dashboardApiUrl - The exported dashboard API URL
 */
export async function fetchSentioDashboard(dashboardApiUrl) {
    const headers = getHeaders();
    if (!headers) return null;

    try {
        const res = await fetch(dashboardApiUrl, { headers });
        if (!res.ok) throw new Error(`Dashboard fetch failed: ${res.status}`);
        return await res.json();
    } catch (e) {
        console.error('Sentio dashboard fetch failed:', e.message);
        return null;
    }
}
