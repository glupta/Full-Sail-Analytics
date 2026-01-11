import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mock child components BEFORE importing App
vi.mock('../components/DefiLlamaDashboard', () => ({
    default: () => <div data-testid="defillama-dashboard">DefiLlama Dashboard</div>
}));

vi.mock('../components/GraphQLDashboard', () => ({
    default: ({ initialDataSource }) => (
        <div data-testid="graphql-dashboard">GraphQL Dashboard - {initialDataSource}</div>
    )
}));

import App from '../App';

describe('App', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the main title', () => {
        render(<App />);
        expect(screen.getByText('Sui DEX Capital Efficiency')).toBeInTheDocument();
    });

    it('renders DefiLlama dashboard by default', () => {
        render(<App />);
        expect(screen.getByTestId('defillama-dashboard')).toBeInTheDocument();
    });

    it('renders data source dropdown with correct options', () => {
        render(<App />);
        const dropdown = screen.getByRole('combobox');
        expect(dropdown).toBeInTheDocument();
        expect(dropdown.value).toBe('defillama');
    });

    it('switches to GraphQL dashboard when selected', async () => {
        render(<App />);
        const dropdown = screen.getByRole('combobox');

        fireEvent.change(dropdown, { target: { value: 'graphql' } });

        await waitFor(() => {
            expect(screen.getByTestId('graphql-dashboard')).toBeInTheDocument();
            expect(screen.getByText(/GraphQL Dashboard - graphql/)).toBeInTheDocument();
        });
    });

    it('switches to SDK dashboard when selected', async () => {
        render(<App />);
        const dropdown = screen.getByRole('combobox');

        fireEvent.change(dropdown, { target: { value: 'sdk' } });

        await waitFor(() => {
            expect(screen.getByTestId('graphql-dashboard')).toBeInTheDocument();
            expect(screen.getByText(/GraphQL Dashboard - sdk/)).toBeInTheDocument();
        });
    });

    it('renders refresh button', () => {
        render(<App />);
        const refreshButton = screen.getByRole('button', { name: /refresh/i });
        expect(refreshButton).toBeInTheDocument();
    });

    it('displays updated timestamp', () => {
        render(<App />);
        expect(screen.getByText(/Updated/)).toBeInTheDocument();
    });

    it('renders footer with correct data source', () => {
        render(<App />);
        expect(screen.getByText(/Powered by/)).toBeInTheDocument();
        expect(screen.getByText(/Full Sail/)).toBeInTheDocument();
    });

    it('updates footer when data source changes', async () => {
        render(<App />);
        const dropdown = screen.getByRole('combobox');

        fireEvent.change(dropdown, { target: { value: 'graphql' } });

        await waitFor(() => {
            // Text appears in both header and footer, so use getAllByText
            const graphqlTexts = screen.getAllByText(/Sui GraphQL/);
            expect(graphqlTexts.length).toBeGreaterThan(0);
        });
    });
});
