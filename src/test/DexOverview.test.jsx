import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DexOverview from '../components/DexOverview';

// Mock pool data
const mockPools = [
    { dex: 'Full Sail', tvl: 1000000, volume_24h: 50000, fees_24h: 1000, apr: 25 },
    { dex: 'Full Sail', tvl: 500000, volume_24h: 25000, fees_24h: 500, apr: 20 },
    { dex: 'Cetus', tvl: 2000000, volume_24h: 100000, fees_24h: 2000, apr: 15 },
    { dex: 'Cetus', tvl: 3000000, volume_24h: 150000, fees_24h: 3000, apr: 18 },
    { dex: 'Bluefin', tvl: 1500000, volume_24h: 75000, fees_24h: 1500, apr: 22 },
];

describe('DexOverview', () => {
    const defaultProps = {
        pools: mockPools,
        loading: false,
        selectedDexes: ['Full Sail', 'Cetus', 'Bluefin'],
        onToggleDex: vi.fn(),
    };

    it('renders total TVL stat card', () => {
        render(<DexOverview {...defaultProps} />);
        expect(screen.getByText('Total TVL')).toBeInTheDocument();
        // Total TVL = 1M + 0.5M + 2M + 3M + 1.5M = 8M
        expect(screen.getByText('$8.00M')).toBeInTheDocument();
    });

    it('renders total pools stat card', () => {
        render(<DexOverview {...defaultProps} />);
        expect(screen.getByText('Total Pools')).toBeInTheDocument();
        expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('renders DEX filter pills for all DEXes', () => {
        render(<DexOverview {...defaultProps} />);
        expect(screen.getByRole('button', { name: /Full Sail/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Cetus/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Bluefin/i })).toBeInTheDocument();
    });

    it('displays pool counts in DEX pills', () => {
        render(<DexOverview {...defaultProps} />);
        // Full Sail has 2 pools, Cetus has 2 pools, Bluefin has 1 pool
        // There are two (2) counts, so use getAllByText
        const twoCounts = screen.getAllByText('(2)');
        expect(twoCounts.length).toBe(2); // Full Sail and Cetus both have 2 pools
        expect(screen.getByText('(1)')).toBeInTheDocument(); // Bluefin has 1 pool
    });

    it('calls onToggleDex when DEX pill is clicked', () => {
        const onToggleDex = vi.fn();
        render(<DexOverview {...defaultProps} onToggleDex={onToggleDex} />);

        const cetusPill = screen.getByRole('button', { name: /Cetus/i });
        fireEvent.click(cetusPill);

        expect(onToggleDex).toHaveBeenCalledWith('Cetus');
    });

    it('renders DEX stats cards for selected DEXes', () => {
        render(<DexOverview {...defaultProps} />);

        // Check for TVL labels in stats cards
        const tvlLabels = screen.getAllByText('TVL');
        expect(tvlLabels.length).toBeGreaterThan(0);

        // Check for 24h Vol labels
        const volLabels = screen.getAllByText('24h Vol');
        expect(volLabels.length).toBe(3); // One for each DEX

        // Check for Avg APR labels
        const aprLabels = screen.getAllByText('Avg APR');
        expect(aprLabels.length).toBe(3);
    });

    it('shows skeleton when loading', () => {
        const { container } = render(<DexOverview {...defaultProps} loading={true} />);
        const skeletons = container.querySelectorAll('.skeleton');
        expect(skeletons.length).toBeGreaterThan(0);
    });

    it('handles empty pools array - shows zero values', () => {
        render(<DexOverview {...defaultProps} pools={[]} />);
        // Look for the Total TVL text first
        expect(screen.getByText('Total TVL')).toBeInTheDocument();
        // There will be multiple $0 values, so use getAllByText
        const zeroValues = screen.getAllByText('$0');
        expect(zeroValues.length).toBeGreaterThan(0);
    });

    it('only renders stats cards for selected DEXes', () => {
        render(<DexOverview {...defaultProps} selectedDexes={['Cetus']} />);

        // Should only see one set of DEX stats (for Cetus)
        const volLabels = screen.getAllByText('24h Vol');
        expect(volLabels.length).toBe(1);
    });
});
