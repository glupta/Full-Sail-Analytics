/**
 * SDK Data Test Script
 * Tests data fetching from each of the 3 DEX SDKs: Cetus, Bluefin, Full Sail
 * Run with: node test-sdk-data.js
 */

// Bluefin API Test (direct fetch, no SDK required)
async function testBluefinAPI() {
    console.log('\n' + '='.repeat(60));
    console.log('🔵 BLUEFIN SPOT API TEST');
    console.log('='.repeat(60));

    try {
        const response = await fetch('https://swap.api.sui-prod.bluefin.io/pools/info', {
            headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) {
            throw new Error(`API returned ${response.status}`);
        }

        const data = await response.json();
        const pools = data.pools || data.data || data || [];

        console.log(`✅ Success! Fetched ${pools.length} pools`);
        console.log('\nSample pool structure:');
        if (pools.length > 0) {
            console.log(JSON.stringify(pools[0], null, 2));
        }

        console.log('\nTop 5 pools by TVL:');
        const sorted = [...pools].sort((a, b) =>
            (Number(b.tvl || b.tvlUsd || 0)) - (Number(a.tvl || a.tvlUsd || 0))
        ).slice(0, 5);

        sorted.forEach((p, i) => {
            const name = p.name || p.symbol || `${p.baseSymbol}/${p.quoteSymbol}`;
            const tvl = Number(p.tvl || p.tvlUsd || 0);
            const vol24h = Number(p.volume24h || p.dailyVolume || 0);
            console.log(`  ${i + 1}. ${name}: TVL=$${tvl.toLocaleString()}, Vol24h=$${vol24h.toLocaleString()}`);
        });

        return { success: true, poolCount: pools.length };
    } catch (error) {
        console.log(`❌ Failed: ${error.message}`);
        return { success: false, error: error.message };
    }
}

// Cetus SDK Test (using dynamic import for ESM compatibility)
async function testCetusSDK() {
    console.log('\n' + '='.repeat(60));
    console.log('🟢 CETUS SDK TEST');
    console.log('='.repeat(60));

    try {
        const { initCetusSDK } = await import('@cetusprotocol/cetus-sui-clmm-sdk');

        console.log('Initializing Cetus SDK...');
        const sdk = initCetusSDK({ network: 'mainnet' });

        console.log('Fetching pools...');
        const pools = await sdk.Pool.getPools();

        console.log(`✅ Success! Fetched ${pools?.length || 0} pools`);

        if (pools && pools.length > 0) {
            console.log('\nSample pool structure (first pool):');
            console.log(JSON.stringify(pools[0], null, 2).slice(0, 800) + '...');

            console.log('\nTop 5 pools by liquidity:');
            const sorted = [...pools].sort((a, b) =>
                Number(BigInt(b.liquidity || '0') - BigInt(a.liquidity || '0'))
            ).slice(0, 5);

            sorted.forEach((p, i) => {
                const coinA = (p.coinTypeA || '').split('::').pop() || 'Unknown';
                const coinB = (p.coinTypeB || '').split('::').pop() || 'Unknown';
                const liq = BigInt(p.liquidity || '0');
                console.log(`  ${i + 1}. ${coinA}/${coinB}: Liquidity=${liq.toString()}`);
            });
        }

        return { success: true, poolCount: pools?.length || 0 };
    } catch (error) {
        console.log(`❌ Failed: ${error.message}`);
        return { success: false, error: error.message };
    }
}

// Full Sail SDK Test
async function testFullSailSDK() {
    console.log('\n' + '='.repeat(60));
    console.log('⛵ FULL SAIL SDK TEST');
    console.log('='.repeat(60));

    const POOL_IDS = [
        { id: '0x038eca6cc3ba17b84829ea28abac7238238364e0787ad714ac35c1140561a6b9', name: 'SAIL/USDC' },
        { id: '0x7fc2f2f3807c6e19f0d418d1aaad89e6f0e866b5e4ea10b295ca0b686b6c4980', name: 'SUI/USDC' },
        { id: '0xa7aa7807a87a771206571d3dd40e53ccbc395d7024def57b49ed9200b5b7e4e5', name: 'IKA/SUI' },
    ];

    try {
        const FullSailSDK = (await import('@fullsailfinance/sdk')).default;

        console.log('Initializing Full Sail SDK...');
        await FullSailSDK.initFullSailSDK({ network: 'mainnet-production' });

        console.log('Fetching sample pools...');
        const results = [];

        for (const { id, name } of POOL_IDS) {
            try {
                console.log(`  Fetching ${name}...`);
                const pool = await FullSailSDK.Pool.getByIdFromChain(id);
                if (pool) {
                    console.log(`    ✅ ${name}: TVL=${pool.tvl || 'N/A'}`);
                    results.push({ name, pool });
                } else {
                    console.log(`    ⚠️ ${name}: No data returned`);
                }
            } catch (e) {
                console.log(`    ❌ ${name}: ${e.message}`);
            }
        }

        if (results.length > 0) {
            console.log('\nSample pool structure:');
            console.log(JSON.stringify(results[0].pool, null, 2).slice(0, 800) + '...');
        }

        return { success: results.length > 0, poolCount: results.length };
    } catch (error) {
        console.log(`❌ Failed: ${error.message}`);
        return { success: false, error: error.message };
    }
}

// Main test runner
async function main() {
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║         DEX SDK DATA FETCHING TEST SUITE                 ║');
    console.log('║         Testing: Cetus, Bluefin, Full Sail               ║');
    console.log('╚══════════════════════════════════════════════════════════╝');

    const results = {};

    // Test each SDK
    results.bluefin = await testBluefinAPI();
    results.cetus = await testCetusSDK();
    results.fullsail = await testFullSailSDK();

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(60));

    for (const [sdk, result] of Object.entries(results)) {
        const status = result.success ? '✅ PASS' : '❌ FAIL';
        const info = result.success
            ? `${result.poolCount} pools fetched`
            : result.error;
        console.log(`  ${sdk.toUpperCase().padEnd(10)}: ${status} - ${info}`);
    }

    const allPassed = Object.values(results).every(r => r.success);
    console.log('\n' + (allPassed ? '✅ All tests passed!' : '⚠️ Some tests failed'));
}

main().catch(console.error);
