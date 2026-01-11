/**
 * GraphQL Client Unit Tests
 * Tests for retry logic, error handling, and response parsing
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Store original fetch
const originalFetch = global.fetch;

// Import the module under test
import { executeQuery, queryObjectById, queryObjectsByIds } from '../lib/graphql-client.js';

describe('graphql-client', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        global.fetch = originalFetch;
    });

    describe('executeQuery', () => {
        it('returns data on successful request', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({
                    data: { object: { address: '0x123', version: 1 } },
                }),
            });

            const result = await executeQuery('query { object { address } }');

            expect(result.object.address).toBe('0x123');
            expect(global.fetch).toHaveBeenCalledTimes(1);
        });

        it('retries on network failure', async () => {
            const failThenSucceed = vi.fn()
                .mockRejectedValueOnce(new Error('Network error'))
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({ data: { success: true } }),
                });

            global.fetch = failThenSucceed;

            const result = await executeQuery('query { test }');

            expect(result.success).toBe(true);
            expect(global.fetch).toHaveBeenCalledTimes(2);
        });

        it('throws after max retries', async () => {
            global.fetch = vi.fn().mockRejectedValue(new Error('Persistent error'));

            await expect(executeQuery('query { test }')).rejects.toThrow('Persistent error');
            expect(global.fetch).toHaveBeenCalledTimes(3); // MAX_RETRIES = 3
        });

        it('handles HTTP error responses', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error',
            });

            await expect(executeQuery('query { test }')).rejects.toThrow('GraphQL request failed: 500');
        });

        it('handles GraphQL errors in response', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({
                    errors: [{ message: 'Field not found' }],
                    data: null,
                }),
            });

            await expect(executeQuery('query { test }')).rejects.toThrow('GraphQL errors: Field not found');
        });

        it('sends correct request format', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ data: {} }),
            });

            await executeQuery('query GetTest { test }', { id: '123' });

            expect(global.fetch).toHaveBeenCalledWith(
                'https://graphql.mainnet.sui.io/graphql',
                expect.objectContaining({
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        query: 'query GetTest { test }',
                        variables: { id: '123' },
                    }),
                })
            );
        });
    });

    describe('queryObjectById', () => {
        it('returns object data for valid ID', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({
                    data: {
                        object: {
                            address: '0xabc123',
                            version: 42,
                            asMoveObject: {
                                contents: {
                                    type: { repr: 'Pool' },
                                    json: { liquidity: '1000000' },
                                },
                            },
                        },
                    },
                }),
            });

            const result = await queryObjectById('0xabc123');

            expect(result.address).toBe('0xabc123');
            expect(result.version).toBe(42);
            expect(result.asMoveObject.contents.json.liquidity).toBe('1000000');
        });

        it('returns null for non-existent object', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ data: { object: null } }),
            });

            const result = await queryObjectById('0xnonexistent');

            expect(result).toBeNull();
        });
    });

    describe('queryObjectsByIds', () => {
        it('returns array of objects for multiple IDs', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({
                    data: {
                        obj0: { address: '0x111', version: 1 },
                        obj1: { address: '0x222', version: 2 },
                        obj2: { address: '0x333', version: 3 },
                    },
                }),
            });

            const result = await queryObjectsByIds(['0x111', '0x222', '0x333']);

            expect(result).toHaveLength(3);
            expect(result[0].address).toBe('0x111');
            expect(result[1].address).toBe('0x222');
            expect(result[2].address).toBe('0x333');
        });

        it('returns empty array for empty input', async () => {
            // Mock fetch to verify it's not called
            global.fetch = vi.fn();

            const result = await queryObjectsByIds([]);

            expect(result).toEqual([]);
            expect(global.fetch).not.toHaveBeenCalled();
        });

        it('filters out null objects from results', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({
                    data: {
                        obj0: { address: '0x111', version: 1 },
                        obj1: null, // Object not found
                        obj2: { address: '0x333', version: 3 },
                    },
                }),
            });

            const result = await queryObjectsByIds(['0x111', '0x222', '0x333']);

            expect(result).toHaveLength(2);
            expect(result[0].address).toBe('0x111');
            expect(result[1].address).toBe('0x333');
        });
    });
});
