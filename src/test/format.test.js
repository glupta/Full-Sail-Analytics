import { describe, it, expect } from 'vitest';
import { formatNumber, formatPercent, formatRatio, formatPercentDiff, formatValue } from '../utils/format';

describe('formatNumber', () => {
    it('returns $0 for null/undefined/NaN', () => {
        expect(formatNumber(null)).toBe('$0');
        expect(formatNumber(undefined)).toBe('$0');
        expect(formatNumber(NaN)).toBe('$0');
    });

    it('formats billions correctly', () => {
        expect(formatNumber(1_000_000_000)).toBe('$1.00B');
        expect(formatNumber(5_500_000_000)).toBe('$5.50B');
    });

    it('formats millions correctly', () => {
        expect(formatNumber(1_000_000)).toBe('$1.00M');
        expect(formatNumber(45_670_000)).toBe('$45.67M');
    });

    it('formats thousands correctly', () => {
        expect(formatNumber(1_000)).toBe('$1.0K');
        expect(formatNumber(999_500)).toBe('$999.5K');
    });

    it('formats small numbers correctly', () => {
        expect(formatNumber(500)).toBe('$500');
        expect(formatNumber(99.5)).toBe('$100');
    });
});

describe('formatPercent', () => {
    it('returns 0% for null/undefined/NaN', () => {
        expect(formatPercent(null)).toBe('0%');
        expect(formatPercent(undefined)).toBe('0%');
        expect(formatPercent(NaN)).toBe('0%');
    });

    it('formats percentages with 2 decimal places', () => {
        expect(formatPercent(12.345)).toBe('12.35%');
        expect(formatPercent(0.5)).toBe('0.50%');
        expect(formatPercent(100)).toBe('100.00%');
    });
});

describe('formatRatio', () => {
    it('returns 0.00 for null/undefined/NaN', () => {
        expect(formatRatio(null)).toBe('0.00');
        expect(formatRatio(undefined)).toBe('0.00');
        expect(formatRatio(NaN)).toBe('0.00');
    });

    it('formats ratios with 4 decimal places', () => {
        expect(formatRatio(0.12345)).toBe('0.1235');
        expect(formatRatio(1.5)).toBe('1.5000');
    });
});

describe('formatPercentDiff', () => {
    it('returns 0% for null/undefined/NaN', () => {
        expect(formatPercentDiff(null)).toBe('0%');
        expect(formatPercentDiff(undefined)).toBe('0%');
        expect(formatPercentDiff(NaN)).toBe('0%');
    });

    it('adds + sign for positive values', () => {
        expect(formatPercentDiff(5.5)).toBe('+5.5%');
        expect(formatPercentDiff(0.1)).toBe('+0.1%');
    });

    it('keeps - sign for negative values', () => {
        expect(formatPercentDiff(-3.2)).toBe('-3.2%');
    });
});

describe('formatValue', () => {
    it('delegates to correct formatter based on format type', () => {
        expect(formatValue(1_000_000, 'currency')).toBe('$1.00M');
        expect(formatValue(12.5, 'percent')).toBe('12.50%');
        expect(formatValue(0.1234, 'ratio')).toBe('0.1234');
        expect(formatValue(5.5, 'percentDiff')).toBe('+5.5%');
    });

    it('returns value as string for unknown format', () => {
        expect(formatValue(123, 'unknown')).toBe('123');
        expect(formatValue(null, 'unknown')).toBe('-');
    });
});
