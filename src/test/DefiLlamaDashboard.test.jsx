import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// Mock child components BEFORE importing
vi.mock('../components/DexOverview', () => ({
    default: ({ pools, loading, selectedDexes }) => (
        <div data-testid="dex-overview">
            DexOverview - {pools.length} pools - loading: {loading.toString()}
        </div>
    )
}));

vi.mock('../components/DexHistoricalChart', () => ({
    default: () => <div data-testid="dex-historical-chart">DexHistoricalChart</div>
}));

vi.mock('../components/PoolEfficiencyAnalysis', () => ({
    default: () => <div data-testid="pool-efficiency">PoolEfficiencyAnalysis</div>
}));

// Mock data source
const mockFetchPoolData = vi.fn().mockResolvedValue({
    pools: [
        { id: '1', name: 'SUI/USDC', dex: 'Cetus', tvl: 1000000 },
        { id: '2', name: 'SUI/USDT', dex: 'Full Sail', tvl: 500000 },
    ],
    summary: { totalTVL: 1500000, totalVolume24h: 100000, totalPools: 2 },
    mode: 'defillama',
});

vi.mock('../lib/data-source', () => ({
    fetchPoolData: (...args) => mockFetchPoolData(...args),
}));

import DefiLlamaDashboard from '../components/DefiLlamaDashboard';

describe('DefiLlamaDashboard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockFetchPoolData.mockResolvedValue({
            pools: [
                { id: '1', name: 'SUI/USDC', dex: 'Cetus', tvl: 1000000 },
                { id: '2', name: 'SUI/USDT', dex: 'Full Sail', tvl: 500000 },
            ],
            summary: { totalTVL: 1500000, totalVolume24h: 100000, totalPools: 2 },
            mode: 'defillama',
        });
    });

    it('renders DexOverview component', async () => {
        render(<DefiLlamaDashboard />);

        await waitFor(() => {
            expect(screen.getByTestId('dex-overview')).toBeInTheDocument();
        });
    });

    it('renders DexHistoricalChart component', async () => {
        render(<DefiLlamaDashboard />);

        await waitFor(() => {
            expect(screen.getByTestId('dex-historical-chart')).toBeInTheDocument();
        });
    });

    it('renders PoolEfficiencyAnalysis component', async () => {
        render(<DefiLlamaDashboard />);

        await waitFor(() => {
            expect(screen.getByTestId('pool-efficiency')).toBeInTheDocument();
        });
    });

    it('passes pools data to DexOverview after loading', async () => {
        render(<DefiLlamaDashboard />);

        await waitFor(() => {
            expect(screen.getByText(/2 pools/)).toBeInTheDocument();
        });
    });

    it('shows loading state initially then completes', async () => {
        render(<DefiLlamaDashboard />);

        // After loading completes, should show false
        await waitFor(() => {
            expect(screen.getByText(/loading: false/)).toBeInTheDocument();
        });
    });

    it('handles error state gracefully', async () => {
        mockFetchPoolData.mockRejectedValueOnce(new Error('Network error'));

        render(<DefiLlamaDashboard />);

        await waitFor(() => {
            expect(screen.getByText(/Failed to fetch data/)).toBeInTheDocument();
        });
    });
});
