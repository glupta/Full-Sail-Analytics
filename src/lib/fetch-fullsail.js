// Full Sail pool addresses from docs: https://docs.fullsail.finance/developer/liquidity-pools
export const FULLSAIL_POOLS = [
  { id: '0xa7aa7807a87a771206571d3dd40e53ccbc395d7024def57b49ed9200b5b7e4e5', name: 'IKA/SUI' },
  { id: '0x7fc2f2f3807c6e19f0d418d1aaad89e6f0e866b5e4ea10b295ca0b686b6c4980', name: 'SUI/USDC' },
  { id: '0xb41cf6d7b9dfdf21279571a1128292b56b70ad5e0106243db102a8e4aea842c7', name: 'USDT/USDC' },
  { id: '0x195fa451874754e5f14f88040756d4897a5fe4b872dffc4e451d80376fa7c858', name: 'WBTC/USDC' },
  { id: '0x90ad474a2b0e4512e953dbe9805eb233ffe5659b93b4bb71ce56bd4110b38c91', name: 'ETH/USDC' },
  { id: '0x20e2f4d32c633be7eac9cba3b2d18b8ae188c0b639f3028915afe2af7ed7c89f', name: 'WAL/SUI' },
  { id: '0xd0dd3d7ae05c22c80e1e16639fb0d4334372a8a45a8f01c85dac662cc8850b60', name: 'DEEP/SUI' },
  { id: '0x17bac48cb12d565e5f5fdf37da71705de2bf84045fac5630c6d00138387bf46a', name: 'ALKIMI/SUI' },
  { id: '0x038eca6cc3ba17b84829ea28abac7238238364e0787ad714ac35c1140561a6b9', name: 'SAIL/USDC' },
  { id: '0xe676d09899c8a4f4ecd3e4b9adac181f3f2e1e439db19454cacce1b4ea5b40f4', name: 'USDZ/USDC' },
  { id: '0x36d46edb1b89923a8ebe78103865f2a3ed933678bfd7acd2081c88a659ff68fa', name: 'USDB/USDC' },
];

// Fetch Full Sail pools from their API directly
export async function fetchAllFullSailPools() {
  try {
    // Try the Full Sail API endpoint
    const res = await fetch('https://api.fullsail.finance/v1/pools');
    if (!res.ok) throw new Error(`API returned ${res.status}`);
    const data = await res.json();

    if (Array.isArray(data)) {
      return data.map(p => ({
        id: p.pool_id || p.address,
        name: p.name || p.symbol,
        dex: 'Full Sail',
        tvl: parseFloat(p.tvl) || 0,
        volume_24h: parseFloat(p.volume_24h) || 0,
        apr: parseFloat(p.apr) || 0,
        fee_rate: parseFloat(p.fee_rate) || 0,
      }));
    }
    throw new Error('Invalid response format');
  } catch (e) {
    // No sample data - clear error message only
    console.error('Full Sail API error:', e.message);
    return [];
  }
}

