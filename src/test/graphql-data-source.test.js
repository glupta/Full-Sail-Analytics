/**
 * GraphQL Data Source Unit Tests
 * Tests for data parsing, normalization, aggregation, and caching
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the individual DEX fetchers before importing the module
vi.mock('../lib/fetch-cetus-graphql.js', () => ({
    fetchCetusPools: vi.fn(),
}));

vi.mock('../lib/fetch-bluefin-graphql.js', () => ({
    fetchBluefinPools: vi.fn(),
}));

vi.mock('../lib/fetch-fullsail-graphql.js', () => ({
    fetchFullSailPools: vi.fn(),
}));

// Import after mocking
import { fetchGraphQLPoolData, clearGraphQLCache } from '../lib/graphql-data-source.js';
import { fetchCetusPools } from '../lib/fetch-cetus-graphql.js';
import { fetchBluefinPools } from '../lib/fetch-bluefin-graphql.js';
import { fetchFullSailPools } from '../lib/fetch-fullsail-graphql.js';

describe('graphql-data-source', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        clearGraphQLCache();
    });

    describe('fetchGraphQLPoolData', () => {
        it('aggregates pools from all three DEXes', async () => {
            fetchCetusPools.mockResolvedValue([
                { id: 'cetus-1', name: 'SUI/USDC', dex: 'Cetus', tvl: 1000000, volume_24h: 50000 },
            ]);
            fetchBluefinPools.mockResolvedValue([
                { id: 'bluefin-1', name: 'SUI/USDT', dex: 'Bluefin', tvl: 800000, volume_24h: 40000 },
            ]);
            fetchFullSailPools.mockResolvedValue([
                { id: 'fullsail-1', name: 'IKA/SUI', dex: 'Full Sail', tvl: 500000, volume_24h: 25000 },
            ]);

            const result = await fetchGraphQLPoolData({ forceRefresh: true });

            expect(result.pools).toHaveLength(3);
            expect(result.summary.totalPools).toBe(3);
            expect(result.summary.totalTVL).toBe(2300000);
            expect(result.summary.totalVolume24h).toBe(115000);
        });

        it('normalizes pool data to standard schema', async () => {
            fetchCetusPools.mockResolvedValue([
                {
                    pool: 'test-pool-id', // alternate ID field
                    symbol: 'SUI/WETH',   // alternate name field
                    dex: 'Cetus',
                    tvl: 1500000,
                    apy: 15.5,            // alternate APR field
                },
            ]);
            fetchBluefinPools.mockResolvedValue([]);
            fetchFullSailPools.mockResolvedValue([]);

            const result = await fetchGraphQLPoolData({ forceRefresh: true });

            const pool = result.pools[0];
            expect(pool.id).toBe('test-pool-id');
            expect(pool.name).toBe('SUI/WETH');
            expect(pool.tvl).toBe(1500000);
            expect(pool.apr).toBe(15.5);
            expect(pool.volume_24h).toBe(0); // defaulted
            expect(pool.feeRate).toBe(0.003); // defaulted
        });

        it('handles partial DEX failures gracefully', async () => {
            fetchCetusPools.mockResolvedValue([
                { id: 'cetus-1', name: 'SUI/USDC', dex: 'Cetus', tvl: 1000000 },
            ]);
            fetchBluefinPools.mockRejectedValue(new Error('Network error'));
            fetchFullSailPools.mockResolvedValue([
                { id: 'fullsail-1', name: 'IKA/SUI', dex: 'Full Sail', tvl: 500000 },
            ]);

            const result = await fetchGraphQLPoolData({ forceRefresh: true });

            expect(result.pools).toHaveLength(2);
            expect(result.fetchStatus.Cetus).toBe('success');
            expect(result.fetchStatus.Bluefin).toBe('failed');
            expect(result.fetchStatus['Full Sail']).toBe('success');
        });

        it('returns cached data within TTL', async () => {
            fetchCetusPools.mockResolvedValue([
                { id: 'cetus-1', name: 'SUI/USDC', dex: 'Cetus', tvl: 1000000 },
            ]);
            fetchBluefinPools.mockResolvedValue([]);
            fetchFullSailPools.mockResolvedValue([]);

            // First call populates cache
            await fetchGraphQLPoolData({ forceRefresh: true });
            expect(fetchCetusPools).toHaveBeenCalledTimes(1);

            // Second call should use cache
            await fetchGraphQLPoolData();
            expect(fetchCetusPools).toHaveBeenCalledTimes(1); // Still 1
        });

        it('bypasses cache with forceRefresh', async () => {
            fetchCetusPools.mockResolvedValue([
                { id: 'cetus-1', name: 'SUI/USDC', dex: 'Cetus', tvl: 1000000 },
            ]);
            fetchBluefinPools.mockResolvedValue([]);
            fetchFullSailPools.mockResolvedValue([]);

            await fetchGraphQLPoolData({ forceRefresh: true });
            await fetchGraphQLPoolData({ forceRefresh: true });

            expect(fetchCetusPools).toHaveBeenCalledTimes(2);
        });

        it('calculates DEX stats correctly', async () => {
            fetchCetusPools.mockResolvedValue([
                { id: 'cetus-1', dex: 'Cetus', tvl: 1000000, volume_24h: 50000, fees_24h: 500 },
                { id: 'cetus-2', dex: 'Cetus', tvl: 2000000, volume_24h: 100000, fees_24h: 1000 },
            ]);
            fetchBluefinPools.mockResolvedValue([
                { id: 'bluefin-1', dex: 'Bluefin', tvl: 800000, volume_24h: 40000, fees_24h: 400 },
            ]);
            fetchFullSailPools.mockResolvedValue([]);

            const result = await fetchGraphQLPoolData({ forceRefresh: true });

            expect(result.dexStats.Cetus.poolCount).toBe(2);
            expect(result.dexStats.Cetus.totalTVL).toBe(3000000);
            expect(result.dexStats.Cetus.volume24h).toBe(150000);
            expect(result.dexStats.Cetus.fees24h).toBe(1500);

            expect(result.dexStats.Bluefin.poolCount).toBe(1);
            expect(result.dexStats.Bluefin.totalTVL).toBe(800000);
        });

        it('includes mode and lastUpdated in result', async () => {
            fetchCetusPools.mockResolvedValue([]);
            fetchBluefinPools.mockResolvedValue([]);
            fetchFullSailPools.mockResolvedValue([]);

            const result = await fetchGraphQLPoolData({ forceRefresh: true });

            expect(result.mode).toBe('GraphQL');
            expect(result.lastUpdated).toBeDefined();
            expect(new Date(result.lastUpdated).getTime()).toBeLessThanOrEqual(Date.now());
        });
    });

    describe('clearGraphQLCache', () => {
        it('forces fresh fetch after being called', async () => {
            fetchCetusPools.mockResolvedValue([]);
            fetchBluefinPools.mockResolvedValue([]);
            fetchFullSailPools.mockResolvedValue([]);

            await fetchGraphQLPoolData({ forceRefresh: true });
            clearGraphQLCache();
            await fetchGraphQLPoolData(); // Should fetch again

            expect(fetchCetusPools).toHaveBeenCalledTimes(2);
        });
    });
});
