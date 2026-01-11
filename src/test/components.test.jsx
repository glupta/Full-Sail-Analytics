import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Skeleton, StatCard, StatusBadge } from '../utils/components';
import { Droplets } from 'lucide-react';

describe('Skeleton', () => {
    it('renders with provided className', () => {
        const { container } = render(<Skeleton className="h-8 w-32" />);
        const skeleton = container.firstChild;
        expect(skeleton).toHaveClass('skeleton', 'h-8', 'w-32');
    });
});

describe('StatCard', () => {
    it('renders label and value when not loading', () => {
        render(
            <StatCard
                icon={Droplets}
                label="Total TVL"
                value="$100M"
                loading={false}
                variant="cyan"
            />
        );

        expect(screen.getByText('Total TVL')).toBeInTheDocument();
        expect(screen.getByText('$100M')).toBeInTheDocument();
    });

    it('renders skeleton when loading', () => {
        const { container } = render(
            <StatCard
                icon={Droplets}
                label="Total TVL"
                value="$100M"
                loading={true}
                variant="cyan"
            />
        );

        expect(screen.getByText('Total TVL')).toBeInTheDocument();
        expect(screen.queryByText('$100M')).not.toBeInTheDocument();
        expect(container.querySelector('.skeleton')).toBeInTheDocument();
    });

    it('applies correct variant classes', () => {
        const { container: cyanContainer } = render(
            <StatCard icon={Droplets} label="Test" value="1" loading={false} variant="cyan" />
        );
        expect(cyanContainer.innerHTML).toContain('from-cyan-500');

        const { container: blueContainer } = render(
            <StatCard icon={Droplets} label="Test" value="1" loading={false} variant="blue" />
        );
        expect(blueContainer.innerHTML).toContain('from-blue-500');

        const { container: purpleContainer } = render(
            <StatCard icon={Droplets} label="Test" value="1" loading={false} variant="purple" />
        );
        expect(purpleContainer.innerHTML).toContain('from-purple-500');
    });
});

describe('StatusBadge', () => {
    it('renders live status correctly', () => {
        render(<StatusBadge status="live" />);
        expect(screen.getByText('Live')).toBeInTheDocument();
    });

    it('renders cached status correctly', () => {
        render(<StatusBadge status="cached" />);
        expect(screen.getByText('Cached')).toBeInTheDocument();
    });

    it('renders error status correctly', () => {
        render(<StatusBadge status="error" />);
        expect(screen.getByText('Error')).toBeInTheDocument();
    });

    it('defaults to cached for unknown status', () => {
        render(<StatusBadge status="unknown" />);
        expect(screen.getByText('Cached')).toBeInTheDocument();
    });
});
