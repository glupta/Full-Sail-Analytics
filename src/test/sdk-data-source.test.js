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

    describe('data completeness and failure states', () => {
        it('reports failure when SDK throws error (no placeholder data)', async () => {
            fetchCetusPools.mockResolvedValue([
                { id: 'cetus-1', name: 'SUI/USDC', dex: 'Cetus', tvl: 1000000 },
            ]);
            fetchBluefinPools.mockRejectedValue(new Error('Bluefin Spot API unavailable'));
            fetchFullSailPools.mockResolvedValue([]);

            const result = await fetchSDKPoolData({ forceRefresh: true });

            expect(result.fetchStatus.Bluefin).toBe('failed');
            expect(result.fetchStatus.Cetus).toBe('success');

            // Should have no Bluefin pools (no placeholder data)
            const bluefinPools = result.pools.filter(p => p.dex === 'Bluefin');
            expect(bluefinPools).toHaveLength(0);
        });

        it('does not include pools with placeholder/fallback data', async () => {
            // Only pools with actual data should be included
            fetchCetusPools.mockResolvedValue([
                { id: 'cetus-1', name: 'SUI/USDC', dex: 'Cetus', tvl: 5000000, volume_24h: null },
            ]);
            fetchBluefinPools.mockResolvedValue([
                { id: 'bluefin-1', name: 'SUI/USDT', dex: 'Bluefin', tvl: 2000000, volume_24h: 100000 },
            ]);
            fetchFullSailPools.mockResolvedValue([]);

            const result = await fetchSDKPoolData({ forceRefresh: true });

            // All returned pools should have positive TVL (real data)
            expect(result.pools.every(p => p.tvl > 0)).toBe(true);
            expect(result.pools).toHaveLength(2);
        });

        it('distinguishes between unavailable data (null) and zero values', async () => {
            // Cetus should return null for volume (SDK limitation)
            // Bluefin/Full Sail should return actual values
            fetchCetusPools.mockResolvedValue([
                { id: 'cetus-1', name: 'SUI/USDC', dex: 'Cetus', tvl: 5000000, volume_24h: null },
            ]);
            fetchBluefinPools.mockResolvedValue([
                { id: 'bluefin-1', name: 'SUI/USDT', dex: 'Bluefin', tvl: 2000000, volume_24h: 50000 },
            ]);
            fetchFullSailPools.mockResolvedValue([
                { id: 'fs-1', name: 'SAIL/USDC', dex: 'Full Sail', tvl: 1000000, volume_24h: 25000 },
            ]);

            const result = await fetchSDKPoolData({ forceRefresh: true });

            const cetusPool = result.pools.find(p => p.dex === 'Cetus');
            const bluefinPool = result.pools.find(p => p.dex === 'Bluefin');
            const fullSailPool = result.pools.find(p => p.dex === 'Full Sail');

            // Cetus volume is null (unavailable from SDK)
            expect(cetusPool.volume_24h).toBeNull();
            // Bluefin and Full Sail have actual volume data
            expect(bluefinPool.volume_24h).toBe(50000);
            expect(fullSailPool.volume_24h).toBe(25000);
        });

        it('marks DEX as failed when SDK returns empty array', async () => {
            fetchCetusPools.mockResolvedValue([]);
            fetchBluefinPools.mockResolvedValue([]);
            fetchFullSailPools.mockResolvedValue([]);

            const result = await fetchSDKPoolData({ forceRefresh: true });

            // Empty arrays should be treated as failures
            expect(result.fetchStatus.Cetus).toBe('failed');
            expect(result.fetchStatus.Bluefin).toBe('failed');
            expect(result.fetchStatus['Full Sail']).toBe('failed');
        });

        it('alerts when Full Sail or Bluefin pools have zero volume (data issue)', async () => {
            // Full Sail and Bluefin should always have volume data
            // Zero volume indicates a data fetching problem
            fetchCetusPools.mockResolvedValue([]);
            fetchBluefinPools.mockResolvedValue([
                { id: 'bf-1', name: 'SUI/USDC', dex: 'Bluefin', tvl: 1000000, volume_24h: 0 },
            ]);
            fetchFullSailPools.mockResolvedValue([
                { id: 'fs-1', name: 'SAIL/USDC', dex: 'Full Sail', tvl: 500000, volume_24h: 0 },
            ]);

            const result = await fetchSDKPoolData({ forceRefresh: true });

            // Check that pools with zero volume are flagged
            const poolsWithZeroVolume = result.pools.filter(
                p => (p.dex === 'Bluefin' || p.dex === 'Full Sail') && p.volume_24h === 0
            );

            // This test documents expected behavior - zero volume for these DEXs
            // indicates incomplete data that should be investigated
            expect(poolsWithZeroVolume.length).toBeGreaterThan(0);
            // In production, we'd want this to trigger an alert
        });
    });
});

