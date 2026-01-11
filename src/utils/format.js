/**
 * Shared formatting utilities for the DEX dashboard
 */

/**
 * Format a number as currency with appropriate suffix (K, M, B)
 * @param {number} num - The number to format
 * @returns {string} Formatted currency string
 */
export const formatNumber = (num) => {
    if (!num || isNaN(num)) return '$0';
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(1)}K`;
    return `$${num.toFixed(0)}`;
};

/**
 * Format a number as a percentage
 * @param {number} num - The number to format
 * @returns {string} Formatted percentage string
 */
export const formatPercent = (num) => {
    if (!num || isNaN(num)) return '0%';
    return `${num.toFixed(2)}%`;
};

/**
 * Format a number as a ratio (e.g., for Fee/TVL)
 * @param {number} num - The number to format
 * @returns {string} Formatted ratio string
 */
export const formatRatio = (num) => {
    if (!num || isNaN(num)) return '0.00';
    return num.toFixed(4);
};

/**
 * Format a percentage difference with + or - sign
 * @param {number} num - The number to format
 * @returns {string} Formatted difference string
 */
export const formatPercentDiff = (num) => {
    if (!num || isNaN(num)) return '0%';
    const sign = num >= 0 ? '+' : '';
    return `${sign}${num.toFixed(1)}%`;
};

/**
 * Format a value based on its type
 * @param {number} value - The value to format
 * @param {string} format - The format type: 'currency', 'percent', 'ratio', 'percentDiff'
 * @returns {string} Formatted value
 */
export const formatValue = (value, format) => {
    switch (format) {
        case 'currency': return formatNumber(value);
        case 'percent': return formatPercent(value);
        case 'ratio': return formatRatio(value);
        case 'percentDiff': return formatPercentDiff(value);
        default: return value?.toString() || '-';
    }
};
