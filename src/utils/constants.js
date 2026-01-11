/**
 * Shared constants for the DEX dashboard
 */

// DEX Colors (Full Sail Brand)
export const DEX_COLORS = {
    'Full Sail': '#7D99FD',  // Full Sail Blue
    'Cetus': '#10b981',      // Emerald
    'Bluefin': '#3b82f6',    // Blue
};

// List of all DEX names
export const DEX_LIST = Object.keys(DEX_COLORS);

// Metrics for charts
export const METRICS = [
    { key: 'tvl', label: 'TVL', description: 'Total Value Locked (USD)' },
    { key: 'fees', label: 'Fees', description: 'Annualized fees (USD)' },
    { key: 'volume', label: 'Volume', description: '24h trading volume (USD)' },
    { key: 'feeTvl', label: 'Fee/TVL', description: 'Fee efficiency (annualized)' },
];

// Time period options
export const PERIODS = [
    { days: 7, label: '7d' },
    { days: 14, label: '14d' },
    { days: 30, label: '30d' },
    { days: 90, label: '3m' },
];

// Pool filter options
export const POOL_FILTERS = [
    { value: 'all', label: 'All Pools' },
    { value: 'stables', label: 'Stablecoins Only' },
    { value: 'IKA/SUI', label: 'IKA/SUI' },
    { value: 'DEEP', label: 'DEEP Pools' },
    { value: 'SUI', label: 'All SUI Pairs' },
    { value: 'USDC', label: 'All USDC Pairs' },
];

// Column configuration for pool tables
export const COLUMN_CONFIG = [
    { key: 'name', label: 'Pool', required: true, group: 'basic' },
    { key: 'dex', label: 'DEX', required: true, group: 'basic' },
    { key: 'tvl', label: 'TVL', group: 'liquidity', format: 'currency' },
    { key: 'volume_24h', label: '24h Vol', group: 'volume', format: 'currency' },
    { key: 'volume_7d', label: '7d Vol', group: 'volume', format: 'currency' },
    { key: 'fees_24h', label: '24h Fees', group: 'fees', format: 'currency' },
    { key: 'fees_7d', label: '7d Fees', group: 'fees', format: 'currency' },
    { key: 'feeToTvl', label: 'Fee/TVL', group: 'efficiency', format: 'ratio', tooltip: 'Annualized fee efficiency' },
    { key: 'volToTvl', label: 'Vol/TVL', group: 'efficiency', format: 'ratio', tooltip: 'Capital turnover rate' },
    { key: 'apr', label: 'APR', group: 'rewards', format: 'percent', tooltip: 'Annual percentage rate from fees' },
    { key: 'apyBase', label: 'Base APY', group: 'rewards', format: 'percent', tooltip: 'APY from trading fees' },
    { key: 'apyReward', label: 'Reward APY', group: 'rewards', format: 'percent', tooltip: 'APY from token incentives' },
    { key: 'emissions', label: 'Emissions', group: 'rewards', format: 'currency', tooltip: 'Daily token emissions value' },
    { key: 'defillama_tvl', label: 'DL TVL', group: 'validation', format: 'currency', tooltip: 'DefiLlama TVL for comparison' },
    { key: 'tvlDiff', label: 'TVL Δ', group: 'validation', format: 'percentDiff', tooltip: 'Difference from DefiLlama TVL' },
];

// Column groups for organization
export const COLUMN_GROUPS = {
    basic: 'Basic',
    liquidity: 'Liquidity',
    volume: 'Volume',
    fees: 'Fees',
    efficiency: 'Efficiency',
    rewards: 'Rewards',
    validation: 'Validation',
};

// Items per page for pagination
export const ITEMS_PER_PAGE = 20;
