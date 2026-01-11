/**
 * Data Source Configuration
 * Controls where pool data is fetched from
 */

// Data source modes
export const DATA_SOURCE_MODES = {
    DEFILLAMA: 'defillama',   // Use DefiLlama yields API
    GRAPHQL: 'graphql',       // Use local JSON (from Sui GraphQL processing)
};

// Read from environment or default to defillama
const getMode = () => {
    // Vite exposes env vars via import.meta.env
    const envMode = import.meta.env?.VITE_DATA_SOURCE_MODE;
    if (envMode && Object.values(DATA_SOURCE_MODES).includes(envMode)) {
        return envMode;
    }
    // Default to DefiLlama
    return DATA_SOURCE_MODES.DEFILLAMA;
};

/**
 * Data source configuration
 */
export const DATA_SOURCE_CONFIG = {
    // Current mode - can be overridden via VITE_DATA_SOURCE_MODE env var
    mode: getMode(),

    // Cache settings
    cacheEnabled: true,
    cacheTTLMinutes: 5,
};

export default DATA_SOURCE_CONFIG;
