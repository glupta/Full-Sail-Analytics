import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import GraphQLDashboard from '../components/GraphQLDashboard';

// Mock data sources
vi.mock('../lib/graphql-data-source', () => ({
    fetchGraphQLPoolData: vi.fn().mockResolvedValue({
        pools: [
            { id: '1', name: 'SUI/USDC', dex: 'Cetus', tvl: 2000000, volume_24h: 100000 },
            { id: '2', name: 'SUI/USDT', dex: 'Full Sail', tvl: 1500000, volume_24h: 75000 },
            { id: '3', name: 'SUI/WETH', dex: 'Bluefin', tvl: 1000000, volume_24h: 50000 },
        ],
        summary: { totalTVL: 4500000, totalVolume24h: 225000, totalPools: 3 },
        dexStats: {},
        fetchStatus: { 'Full Sail': 'success', 'Cetus': 'success', 'Bluefin': 'success' },
    }),
    clearGraphQLCache: vi.fn(),
}));

vi.mock('../lib/data-source', () => ({
    fetchPoolData: vi.fn().mockResolvedValue({
        pools: [
            { id: '1', name: 'SUI/USDC', dex: 'Cetus', tvl: 2100000 },
        ],
        summary: { totalTVL: 2100000, totalVolume24h: 100000, totalPools: 1 },
    }),
}));

vi.mock('../lib/sdk-data-source', () => ({
    fetchSDKPoolData: vi.fn().mockResolvedValue({
        pools: [
            { id: '1', name: 'SUI/USDC', dex: 'Cetus', tvl: 2050000, volume_24h: 105000 },
        ],
        summary: { totalTVL: 2050000, totalVolume24h: 105000, totalPools: 1 },
        fetchStatus: { 'Full Sail': 'success', 'Cetus': 'success', 'Bluefin': 'success' },
    }),
}));

describe('GraphQLDashboard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders in embedded mode without standalone header', async () => {
        render(<GraphQLDashboard embedded={true} />);

        await waitFor(() => {
            // Should not have the standalone header
            expect(screen.queryByText('DEX Analytics Dashboard')).not.toBeInTheDocument();
        });
    });

    it('renders in standalone mode with header', async () => {
        render(<GraphQLDashboard embedded={false} />);

        await waitFor(() => {
            expect(screen.getByText('DEX Analytics Dashboard')).toBeInTheDocument();
        });
    });

    it('shows connection status for GraphQL mode', async () => {
        render(<GraphQLDashboard embedded={true} initialDataSource="graphql" />);

        await waitFor(() => {
            expect(screen.getByText('GraphQL Connection Status')).toBeInTheDocument();
        });
    });

    it('shows connection status for SDK mode', async () => {
        render(<GraphQLDashboard embedded={true} initialDataSource="sdk" />);

        await waitFor(() => {
            expect(screen.getByText('SDK Connection Status')).toBeInTheDocument();
        });
    });

    it('renders stat cards with correct values', async () => {
        render(<GraphQLDashboard embedded={true} />);

        await waitFor(() => {
            expect(screen.getByText('$4.50M')).toBeInTheDocument(); // Total TVL
            expect(screen.getByText('3')).toBeInTheDocument(); // Total Pools
        });
    });

    it('renders search input', async () => {
        render(<GraphQLDashboard embedded={true} />);

        await waitFor(() => {
            expect(screen.getByPlaceholderText('Search pools...')).toBeInTheDocument();
        });
    });

    it('filters pools by search query', async () => {
        render(<GraphQLDashboard embedded={true} />);

        await waitFor(() => {
            expect(screen.getByText('SUI/USDC')).toBeInTheDocument();
        });

        const searchInput = screen.getByPlaceholderText('Search pools...');
        fireEvent.change(searchInput, { target: { value: 'WETH' } });

        await waitFor(() => {
            expect(screen.getByText('SUI/WETH')).toBeInTheDocument();
            expect(screen.queryByText('SUI/USDC')).not.toBeInTheDocument();
        });
    });

    it('renders pool table with correct columns', async () => {
        render(<GraphQLDashboard embedded={true} />);

        await waitFor(() => {
            expect(screen.getByText('Pool')).toBeInTheDocument();
            expect(screen.getByText('DEX')).toBeInTheDocument();
            expect(screen.getByText('TVL')).toBeInTheDocument();
        });
    });

    it('displays DEX badges in pool table', async () => {
        render(<GraphQLDashboard embedded={true} />);

        await waitFor(() => {
            // Just check that Cetus text appears in the table (as a badge)
            const cetusElements = screen.getAllByText('Cetus');
            expect(cetusElements.length).toBeGreaterThan(0);
        });
    });

    it('handles column sorting', async () => {
        render(<GraphQLDashboard embedded={true} />);

        await waitFor(() => {
            expect(screen.getByText('TVL')).toBeInTheDocument();
        });

        const tvlHeader = screen.getByText('TVL');
        fireEvent.click(tvlHeader);

        // Should trigger sort (verify no errors)
        await waitFor(() => {
            expect(screen.getByText('SUI/USDC')).toBeInTheDocument();
        });
    });

    it('shows connected status for each DEX', async () => {
        render(<GraphQLDashboard embedded={true} initialDataSource="graphql" />);

        await waitFor(() => {
            const connectedBadges = screen.getAllByText('Connected');
            expect(connectedBadges.length).toBe(3); // One for each DEX
        });
    });

    it('renders columns button', async () => {
        render(<GraphQLDashboard embedded={true} />);

        await waitFor(() => {
            expect(screen.getAllByText('Columns').length).toBeGreaterThan(0);
        });
    });

    it('shows data source note at bottom', async () => {
        render(<GraphQLDashboard embedded={true} initialDataSource="graphql" />);

        await waitFor(() => {
            expect(screen.getByText(/Sui GraphQL RPC/)).toBeInTheDocument();
        });
    });

    // ===== DATA ACCURACY TESTS =====

    it('displays correct total TVL from aggregated pools', async () => {
        render(<GraphQLDashboard embedded={true} />);

        await waitFor(() => {
            // Mock returns 4.5M total TVL (2M + 1.5M + 1M)
            expect(screen.getByText('$4.50M')).toBeInTheDocument();
        });
    });

    it('displays correct pool count from aggregated data', async () => {
        render(<GraphQLDashboard embedded={true} />);

        await waitFor(() => {
            // Mock returns 3 pools
            expect(screen.getByText('3')).toBeInTheDocument();
        });
    });

    it('renders all pool names from mock data', async () => {
        render(<GraphQLDashboard embedded={true} />);

        await waitFor(() => {
            expect(screen.getByText('SUI/USDC')).toBeInTheDocument();
            expect(screen.getByText('SUI/USDT')).toBeInTheDocument();
            expect(screen.getByText('SUI/WETH')).toBeInTheDocument();
        });
    });
});

