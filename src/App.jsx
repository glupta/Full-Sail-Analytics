import React, { useState, useEffect } from 'react';
import { RefreshCw, ChevronDown } from 'lucide-react';

// Dashboard components
import DefiLlamaDashboard from './components/DefiLlamaDashboard';
import GraphQLDashboard from './components/GraphQLDashboard';

/**
 * Get initial data source from URL parameter
 * Supports ?source=sdk, ?source=graphql, ?source=defillama
 */
function getInitialDataSource() {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const source = params.get('source');
    if (source && ['sdk', 'graphql', 'defillama'].includes(source)) {
      return source;
    }
  }
  return 'defillama';
}

/**
 * App - Root component with data source routing
 * 
 * The data source dropdown lives here and determines which dashboard to render.
 * 
 * URL Parameters:
 * - ?source=sdk - Load DEX SDK dashboard
 * - ?source=graphql - Load GraphQL dashboard  
 * - ?source=defillama - Load DefiLlama dashboard (default)
 */
export default function App() {
  const [dataSource, setDataSource] = useState(getInitialDataSource);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  // Sync URL with data source changes
  useEffect(() => {
    const url = new URL(window.location);
    url.searchParams.set('source', dataSource);
    window.history.replaceState({}, '', url);
  }, [dataSource]);

  const handleRefresh = () => {
    setLastUpdated(new Date());
    // Force re-render of child dashboard
    window.location.reload();
  };

  return (
    <div className="min-h-screen animated-bg text-white p-6 lg:p-8">
      {/* Global Header */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-[#7D99FD] via-blue-400 to-purple-400 bg-clip-text text-transparent glow-text">
            Sui DEX Capital Efficiency
          </h1>
          <p className="text-slate-400 mt-2">
            {dataSource === 'sdk'
              ? 'Direct data via DEX SDKs (Cetus SDK, Bluefin API, Full Sail SDK)'
              : dataSource === 'graphql'
                ? 'Real-time on-chain data via Sui GraphQL RPC'
                : 'Compare LP yields and capital efficiency across Sui DEXs'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Data Source Dropdown */}
          <div className="relative">
            <select
              id="data-source-selector"
              data-testid="data-source-selector"
              value={dataSource}
              onChange={(e) => setDataSource(e.target.value)}
              className="appearance-none bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 pr-8 text-white text-sm font-medium cursor-pointer focus:outline-none focus:border-[#7D99FD] transition-colors"
            >
              <option value="defillama">DefiLlama</option>
              <option value="sdk">DEX SDK</option>
              <option value="graphql">GraphQL</option>
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          {/* Timestamp */}
          <span className="text-slate-500 text-sm">
            Updated {lastUpdated.toLocaleTimeString()}
          </span>

          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            aria-label="Refresh data"
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#7D99FD] to-blue-600 hover:from-[#9DB5FF] hover:to-blue-500 rounded-xl font-medium transition-all duration-300 shadow-lg shadow-[#7D99FD]/20 hover:shadow-[#7D99FD]/40"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </div>

      {/* Render dashboard based on data source */}
      {dataSource === 'defillama' && <DefiLlamaDashboard />}
      {(dataSource === 'graphql' || dataSource === 'sdk') && (
        <GraphQLDashboard embedded={true} initialDataSource={dataSource} />
      )}

      {/* Footer */}
      <div className="mt-8 text-center text-slate-500 text-sm">
        Powered by <span className="text-[#7D99FD] font-medium">Full Sail</span> • Data via {dataSource === 'defillama' ? 'DefiLlama' : dataSource === 'graphql' ? 'Sui GraphQL' : 'DEX SDKs'}
      </div>
    </div>
  );
}
