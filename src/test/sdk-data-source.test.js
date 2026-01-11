/**
 * SDK Data Source Unit Tests
 * Tests for direct DEX SDK data parsing, normalization, aggregation, and caching
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the individual DEX SDK fetchers before importing the module
vi.mock('../lib/fetch-cetus-sdk.js', () => ({
    fetchCetusPools: vi.fn(),
}));

vi.mock('../lib/fetch-bluefin-sdk.js', () => ({
    fetchBluefinPools: vi.fn(),
}));

vi.mock('../lib/fetch-fullsail-sdk.js', () => ({
    fetchFullSailPools: vi.fn(),
}));

// Import after mocking
import { fetchSDKPoolData, clearSDKCache } from '../lib/sdk-data-source.js';
import { fetchCetusPools } from '../lib/fetch-cetus-sdk.js';
import { fetchBluefinPools } from '../lib/fetch-bluefin-sdk.js';
import { fetchFullSailPools } from '../lib/fetch-fullsail-sdk.js';

describe('sdk-data-source', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        clearSDKCache();
    });

    describe('fetchSDKPoolData', () => {
        it('aggregates pools from all three DEX SDKs', async () => {
            fetchCetusPools.mockResolvedValue([
                { id: 'cetus-sdk-1', name: 'SUI/USDC', dex: 'Cetus', tvl: 1200000, volume_24h: 60000 },
            ]);
            fetchBluefinPools.mockResolvedValue([
                { id: 'bluefin-sdk-1', name: 'SUI/USDT', dex: 'Bluefin', tvl: 900000, volume_24h: 45000 },
            ]);
            fetchFullSailPools.mockResolvedValue([
                { id: 'fullsail-sdk-1', name: 'IKA/SUI', dex: 'Full Sail', tvl: 600000, volume_24h: 30000 },
            ]);

            const result = await fetchSDKPoolData({ forceRefresh: true });

            expect(result.pools).toHaveLength(3);
            expect(result.summary.totalPools).toBe(3);
            expect(result.summary.totalTVL).toBe(2700000);
            expect(result.summary.totalVolume24h).toBe(135000);
            expect(result.mode).toBe('SDK');
        });

        it('normalizes pool data from SDKs to standard schema', async () => {
            fetchCetusPools.mockResolvedValue([
                {
                    pool: 'sdk-pool-id',
                    symbol: 'SUI/WETH',
                    dex: 'Cetus',
                    tvl: 1500000,
                    apy: 18.5,
                },
            ]);
            fetchBluefinPools.mockResolvedValue([]);
            fetchFullSailPools.mockResolvedValue([]);

            const result = await fetchSDKPoolData({ forceRefresh: true });

            const pool = result.pools[0];
            expect(pool.id).toBe('sdk-pool-id');
            expect(pool.name).toBe('SUI/WETH');
            expect(pool.tvl).toBe(1500000);
            expect(pool.apr).toBe(18.5);
            expect(pool.feeRate).toBe(0.003); // defaulted
        });

        it('handles partial SDK failures gracefully', async () => {
            fetchCetusPools.mockResolvedValue([
                { id: 'cetus-1', name: 'SUI/USDC', dex: 'Cetus', tvl: 1000000 },
            ]);
            fetchBluefinPools.mockResolvedValue([
                { id: 'bluefin-1', name: 'SUI/USDT', dex: 'Bluefin', tvl: 800000 },
            ]);
            fetchFullSailPools.mockRejectedValue(new Error('SDK initialization failed'));

            const result = await fetchSDKPoolData({ forceRefresh: true });

            expect(result.pools).toHaveLength(2);
            expect(result.fetchStatus.Cetus).toBe('success');
            expect(result.fetchStatus.Bluefin).toBe('success');
            expect(result.fetchStatus['Full Sail']).toBe('failed');
        });

        it('returns cached data within TTL', async () => {
            fetchCetusPools.mockResolvedValue([]);
            fetchBluefinPools.mockResolvedValue([]);
            fetchFullSailPools.mockResolvedValue([]);

            await fetchSDKPoolData({ forceRefresh: true });
            await fetchSDKPoolData(); // Should use cache

            expect(fetchCetusPools).toHaveBeenCalledTimes(1);
        });

        it('bypasses cache with forceRefresh', async () => {
            fetchCetusPools.mockResolvedValue([]);
            fetchBluefinPools.mockResolvedValue([]);
            fetchFullSailPools.mockResolvedValue([]);

            await fetchSDKPoolData({ forceRefresh: true });
            await fetchSDKPoolData({ forceRefresh: true });

            expect(fetchCetusPools).toHaveBeenCalledTimes(2);
        });

        it('calculates DEX stats correctly from SDK data', async () => {
            fetchCetusPools.mockResolvedValue([
                { id: 'cetus-1', dex: 'Cetus', tvl: 1000000, volume_24h: 50000, fees_24h: 500 },
                { id: 'cetus-2', dex: 'Cetus', tvl: 2000000, volume_24h: 100000, fees_24h: 1000 },
            ]);
            fetchBluefinPools.mockResolvedValue([
                { id: 'bluefin-1', dex: 'Bluefin', tvl: 800000, volume_24h: 40000, fees_24h: 400 },
            ]);
            fetchFullSailPools.mockResolvedValue([]);

            const result = await fetchSDKPoolData({ forceRefresh: true });

            expect(result.dexStats.Cetus.poolCount).toBe(2);
            expect(result.dexStats.Cetus.totalTVL).toBe(3000000);
            expect(result.dexStats.Bluefin.poolCount).toBe(1);
        });

        it('handles empty results from all DEXes', async () => {
            fetchCetusPools.mockResolvedValue([]);
            fetchBluefinPools.mockResolvedValue([]);
            fetchFullSailPools.mockResolvedValue([]);

            const result = await fetchSDKPoolData({ forceRefresh: true });

            expect(result.pools).toHaveLength(0);
            expect(result.summary.totalTVL).toBe(0);
            expect(result.summary.totalPools).toBe(0);
        });
    });

    describe('clearSDKCache', () => {
        it('forces fresh fetch after being called', async () => {
            fetchCetusPools.mockResolvedValue([]);
            fetchBluefinPools.mockResolvedValue([]);
            fetchFullSailPools.mockResolvedValue([]);

            await fetchSDKPoolData({ forceRefresh: true });
            clearSDKCache();
            await fetchSDKPoolData();

            expect(fetchCetusPools).toHaveBeenCalledTimes(2);
        });
    });
});
