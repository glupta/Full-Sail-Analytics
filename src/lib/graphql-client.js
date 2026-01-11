/**
 * Sui GraphQL Client
 * Unified client for querying Sui blockchain via GraphQL RPC
 */

const SUI_GRAPHQL_ENDPOINT = 'https://graphql.mainnet.sui.io/graphql';

// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 500;

/**
 * Execute a GraphQL query against Sui RPC
 * @param {string} query - GraphQL query string
 * @param {object} variables - Query variables
 * @returns {Promise<object>} Query result data
 */
export async function executeQuery(query, variables = {}) {
    let lastError;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            const response = await fetch(SUI_GRAPHQL_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ query, variables }),
            });

            if (!response.ok) {
                throw new Error(`GraphQL request failed: ${response.status} ${response.statusText}`);
            }

            const result = await response.json();

            if (result.errors && result.errors.length > 0) {
                throw new Error(`GraphQL errors: ${result.errors.map(e => e.message).join(', ')}`);
            }

            return result.data;
        } catch (error) {
            lastError = error;
            console.warn(`[GraphQL] Attempt ${attempt + 1}/${MAX_RETRIES} failed:`, error.message);

            if (attempt < MAX_RETRIES - 1) {
                const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
                await new Promise(resolve => setTimeout(resolve, backoff));
            }
        }
    }

    throw lastError;
}

/**
 * Query a single object by ID
 * @param {string} objectId - Sui object ID (address)
 * @returns {Promise<object>} Object data
 */
export async function queryObjectById(objectId) {
    const query = `
        query GetObject($address: SuiAddress!) {
            object(address: $address) {
                address
                version
                digest
                asMoveObject {
                    contents {
                        type { repr }
                        json
                    }
                }
            }
        }
    `;

    const data = await executeQuery(query, { address: objectId });
    return data?.object || null;
}

/**
 * Query multiple objects by IDs (batched)
 * @param {string[]} objectIds - Array of Sui object IDs
 * @returns {Promise<Array>} Array of object data
 */
export async function queryObjectsByIds(objectIds) {
    if (!objectIds.length) return [];

    // Build dynamic query for multiple objects
    const objectQueries = objectIds.map((id, i) => `
        obj${i}: object(address: "${id}") {
            address
            version
            digest
            asMoveObject {
                contents {
                    type { repr }
                    json
                }
            }
        }
    `).join('\n');

    const query = `query GetMultipleObjects { ${objectQueries} }`;

    const data = await executeQuery(query);
    return objectIds.map((_, i) => data[`obj${i}`]).filter(Boolean);
}

export default {
    executeQuery,
    queryObjectById,
    queryObjectsByIds,
};
