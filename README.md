# Sui DEX Analytics Dashboard

Real-time pool analytics dashboard for Sui DEXs using the **Full Sail SDK** and direct API calls to Cetus, Momentum, and Bluefin.

## Features

- **Full Sail SDK Integration** - Fetches pool data using `@fullsailfinance/sdk`
- **Multi-DEX Support** - Full Sail, Cetus, Momentum, Bluefin
- **Real-time Data** - TVL, 24h volume, APR, efficiency metrics
- **Sortable Table** - Click headers to sort by TVL, volume, or APR
- **DEX Filtering** - Toggle DEXs on/off with filter pills
- **Search** - Filter pools by name

## Full Sail Pools (from SDK)

All 11 official pools from [docs.fullsail.finance/developer/liquidity-pools](https://docs.fullsail.finance/developer/liquidity-pools):

| Pool | Address |
|------|---------|
| IKA/SUI | `0xa7aa7807a87a771206571d3dd40e53ccbc395d7024def57b49ed9200b5b7e4e5` |
| SUI/USDC | `0x7fc2f2f3807c6e19f0d418d1aaad89e6f0e866b5e4ea10b295ca0b686b6c4980` |
| USDT/USDC | `0xb41cf6d7b9dfdf21279571a1128292b56b70ad5e0106243db102a8e4aea842c7` |
| WBTC/USDC | `0x195fa451874754e5f14f88040756d4897a5fe4b872dffc4e451d80376fa7c858` |
| ETH/USDC | `0x90ad474a2b0e4512e953dbe9805eb233ffe5659b93b4bb71ce56bd4110b38c91` |
| WAL/SUI | `0x20e2f4d32c633be7eac9cba3b2d18b8ae188c0b639f3028915afe2af7ed7c89f` |
| DEEP/SUI | `0xd0dd3d7ae05c22c80e1e16639fb0d4334372a8a45a8f01c85dac662cc8850b60` |
| ALKIMI/SUI | `0x17bac48cb12d565e5f5fdf37da71705de2bf84045fac5630c6d00138387bf46a` |
| SAIL/USDC | `0x038eca6cc3ba17b84829ea28abac7238238364e0787ad714ac35c1140561a6b9` |
| USDZ/USDC | `0xe676d09899c8a4f4ecd3e4b9adac181f3f2e1e439db19454cacce1b4ea5b40f4` |
| USDB/USDC | `0x36d46edb1b89923a8ebe78103865f2a3ed933678bfd7acd2081c88a659ff68fa` |

## Setup

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

## Full Sail SDK Usage

```javascript
import { initFullSailSDK } from '@fullsailfinance/sdk';

const sdk = initFullSailSDK({ network: 'mainnet-production' });

// Get backend pool data (TVL, volume, APR, gauge_id)
const pool = await sdk.Pool.getById(poolId);

// Get chain pool data (real-time price, liquidity, rewards)
const chainPool = await sdk.Pool.getByIdFromChain(poolId);
```

## API Endpoints

- **Cetus**: `https://api-sui.cetus.zone/v2/sui/pools_info`
- **Momentum**: `https://api.mmt.finance/api/v1/pools`
- **Bluefin**: `https://swap.api.sui-prod.bluefin.io/pools/info`

## Project Structure

```
├── src/
│   ├── components/
│   │   └── SuiDexDashboard.jsx   # Main dashboard component
│   ├── lib/
│   │   └── fetch-fullsail.js     # Full Sail SDK integration
│   ├── data/
│   │   └── fullsail-pools.json   # Pool addresses
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
└── postcss.config.js
```

## Tech Stack

- React 18
- Vite
- Tailwind CSS
- Full Sail SDK (`@fullsailfinance/sdk`)
- Lucide React (icons)
