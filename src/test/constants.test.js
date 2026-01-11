import { describe, it, expect } from 'vitest';
import { DEX_COLORS, DEX_LIST, METRICS, PERIODS, COLUMN_CONFIG, COLUMN_GROUPS } from '../utils/constants';

describe('DEX_COLORS', () => {
    it('contains all expected DEXes', () => {
        expect(DEX_COLORS).toHaveProperty('Full Sail');
        expect(DEX_COLORS).toHaveProperty('Cetus');
        expect(DEX_COLORS).toHaveProperty('Bluefin');
    });

    it('has valid hex color values', () => {
        const hexPattern = /^#[0-9a-fA-F]{6}$/;
        Object.values(DEX_COLORS).forEach(color => {
            expect(color).toMatch(hexPattern);
        });
    });
});

describe('DEX_LIST', () => {
    it('matches keys from DEX_COLORS', () => {
        expect(DEX_LIST).toEqual(Object.keys(DEX_COLORS));
    });

    it('has 3 DEXes', () => {
        expect(DEX_LIST).toHaveLength(3);
    });
});

describe('METRICS', () => {
    it('has required keys for each metric', () => {
        METRICS.forEach(metric => {
            expect(metric).toHaveProperty('key');
            expect(metric).toHaveProperty('label');
            expect(metric).toHaveProperty('description');
        });
    });

    it('includes expected metrics', () => {
        const keys = METRICS.map(m => m.key);
        expect(keys).toContain('tvl');
        expect(keys).toContain('fees');
        expect(keys).toContain('volume');
        expect(keys).toContain('feeTvl');
    });
});

describe('PERIODS', () => {
    it('has required keys for each period', () => {
        PERIODS.forEach(period => {
            expect(period).toHaveProperty('days');
            expect(period).toHaveProperty('label');
            expect(typeof period.days).toBe('number');
        });
    });

    it('includes expected periods', () => {
        const days = PERIODS.map(p => p.days);
        expect(days).toContain(7);
        expect(days).toContain(30);
    });
});

describe('COLUMN_CONFIG', () => {
    it('has required fields for each column', () => {
        COLUMN_CONFIG.forEach(col => {
            expect(col).toHaveProperty('key');
            expect(col).toHaveProperty('label');
            expect(col).toHaveProperty('group');
        });
    });

    it('has required columns marked as required', () => {
        const requiredCols = COLUMN_CONFIG.filter(c => c.required);
        const requiredKeys = requiredCols.map(c => c.key);
        expect(requiredKeys).toContain('name');
        expect(requiredKeys).toContain('dex');
    });
});

describe('COLUMN_GROUPS', () => {
    it('has all groups referenced by COLUMN_CONFIG', () => {
        const usedGroups = [...new Set(COLUMN_CONFIG.map(c => c.group))];
        usedGroups.forEach(group => {
            expect(COLUMN_GROUPS).toHaveProperty(group);
        });
    });
});
