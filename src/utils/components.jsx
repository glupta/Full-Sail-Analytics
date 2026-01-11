import React from 'react';
import { formatNumber } from './format';

/**
 * Skeleton loading placeholder
 */
export const Skeleton = ({ className }) => (
    <div className={`skeleton ${className}`}></div>
);

/**
 * Stat card with icon, label and value
 */
export const StatCard = ({ icon: Icon, label, value, loading, variant = 'cyan' }) => (
    <div className="glass-card glass-card-hover rounded-xl p-5 relative overflow-hidden">
        <div className={`absolute inset-0 opacity-10 bg-gradient-to-br ${variant === 'cyan' ? 'from-cyan-500 to-cyan-600' :
                variant === 'blue' ? 'from-blue-500 to-blue-600' :
                    'from-purple-500 to-purple-600'
            }`} />
        <div className="relative">
            <div className="flex items-center gap-2 text-slate-400 mb-2">
                <Icon size={18} className={
                    variant === 'cyan' ? 'text-cyan-400' :
                        variant === 'blue' ? 'text-blue-400' :
                            'text-purple-400'
                } />
                <span className="text-sm font-medium">{label}</span>
            </div>
            {loading ? (
                <Skeleton className="h-8 w-32" />
            ) : (
                <div className="text-3xl font-bold text-white animate-count">{value}</div>
            )}
        </div>
    </div>
);

/**
 * Custom tooltip for Recharts
 */
export const ChartTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div className="glass-card rounded-lg p-3 text-sm">
                <p className="font-semibold text-white mb-1">{label}</p>
                {payload.map((entry, idx) => (
                    <p key={idx} style={{ color: entry.color }}>
                        {entry.name}: {formatNumber(entry.value)}
                    </p>
                ))}
            </div>
        );
    }
    return null;
};

/**
 * Status badge for data source connection
 */
export const StatusBadge = ({ status }) => {
    const config = {
        live: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Live' },
        cached: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'Cached' },
        error: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Error' },
    };
    const { bg, text, label } = config[status] || config.cached;

    return (
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${bg} ${text}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
            {label}
        </span>
    );
};
