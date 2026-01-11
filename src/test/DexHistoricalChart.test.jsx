import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DexHistoricalChart from '../components/DexHistoricalChart';

// Mock recharts to avoid canvas issues in tests
vi.mock('recharts', () => ({
    LineChart: ({ children }) => <div data-testid="line-chart">{children}</div>,
    Line: () => <div data-testid="chart-line" />,
    XAxis: () => <div data-testid="x-axis" />,
    YAxis: () => <div data-testid="y-axis" />,
    Tooltip: () => <div data-testid="tooltip" />,
    ResponsiveContainer: ({ children }) => <div data-testid="responsive-container">{children}</div>,
    Legend: () => <div data-testid="legend" />,
}));

// Mock DefiLlama data
vi.mock('../lib/fetch-defillama', () => ({
    fetchSuiFees: vi.fn().mockResolvedValue({
        daily: [
            { date: '2024-01-01', 'Full Sail': 1000, 'Cetus': 5000, 'Bluefin': 3000 },
            { date: '2024-01-02', 'Full Sail': 1200, 'Cetus': 5500, 'Bluefin': 3200 },
            { date: '2024-01-03', 'Full Sail': 1100, 'Cetus': 5200, 'Bluefin': 3100 },
        ],
    }),
    fetchSuiHistoricalVolume: vi.fn().mockResolvedValue({
        daily: [
            { date: '2024-01-01', 'Full Sail': 100000, 'Cetus': 500000, 'Bluefin': 300000 },
            { date: '2024-01-02', 'Full Sail': 120000, 'Cetus': 550000, 'Bluefin': 320000 },
        ],
    }),
}));

describe('DexHistoricalChart', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Mock fetch for TVL data
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({
                tvl: [
                    { date: 1704067200, totalLiquidityUSD: 10000000 },
                    { date: 1704153600, totalLiquidityUSD: 10500000 },
                ],
            }),
        });
    });

    it('renders chart title', async () => {
        render(<DexHistoricalChart />);
        expect(screen.getByText('DEX Comparison Over Time')).toBeInTheDocument();
    });

    it('renders metric selector buttons', async () => {
        render(<DexHistoricalChart />);
        expect(screen.getByText('Fees')).toBeInTheDocument();
        expect(screen.getByText('Volume')).toBeInTheDocument();
        expect(screen.getByText('TVL')).toBeInTheDocument();
        expect(screen.getByText('Fee/TVL')).toBeInTheDocument();
    });

    it('renders period selector buttons', async () => {
        render(<DexHistoricalChart />);
        expect(screen.getByText('7d')).toBeInTheDocument();
        expect(screen.getByText('14d')).toBeInTheDocument();
        expect(screen.getByText('30d')).toBeInTheDocument();
        expect(screen.getByText('3m')).toBeInTheDocument();
    });

    it('shows loading state initially', () => {
        render(<DexHistoricalChart />);
        expect(screen.getByText('Loading historical data...')).toBeInTheDocument();
    });

    it('renders chart after loading', async () => {
        render(<DexHistoricalChart />);

        await waitFor(() => {
            expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
        });
    });

    it('switches metric when button is clicked', async () => {
        render(<DexHistoricalChart />);

        await waitFor(() => {
            expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
        });

        const volumeButton = screen.getByText('Volume');
        fireEvent.click(volumeButton);

        // Volume button should now be active (has the active class)
        expect(volumeButton).toHaveClass('text-[#7D99FD]');
    });

    it('switches period when button is clicked', async () => {
        render(<DexHistoricalChart />);

        await waitFor(() => {
            expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
        });

        const sevenDayButton = screen.getByText('7d');
        fireEvent.click(sevenDayButton);

        // 7d button should now be active
        expect(sevenDayButton).toHaveClass('text-blue-400');
    });

    it('renders refresh button', () => {
        render(<DexHistoricalChart />);
        // Find the refresh button (it's a button with RefreshCw icon)
        const buttons = screen.getAllByRole('button');
        expect(buttons.length).toBeGreaterThan(0);
    });

    it('renders lines for each DEX', async () => {
        render(<DexHistoricalChart />);

        await waitFor(() => {
            const chartLines = screen.getAllByTestId('chart-line');
            expect(chartLines.length).toBe(3); // Full Sail, Cetus, Bluefin
        });
    });

    it('handles API error gracefully', async () => {
        const { fetchSuiFees } = await import('../lib/fetch-defillama');
        fetchSuiFees.mockRejectedValueOnce(new Error('API Error'));

        render(<DexHistoricalChart />);

        await waitFor(() => {
            expect(screen.getByText('Failed to load historical data')).toBeInTheDocument();
        });
    });
});
