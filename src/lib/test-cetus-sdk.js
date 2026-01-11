/**
 * Test script for Cetus SDK integration
 * Run with: node --loader ts-node/esm src/lib/test-cetus-sdk.js
 */

import { initCetusSDK } from '@cetusprotocol/cetus-sui-clmm-sdk';

async function testCetusPools() {
    console.log('Initializing Cetus SDK for mainnet...');

    try {
        const sdk = initCetusSDK({ network: 'mainnet' });
        console.log('SDK initialized successfully');

        // Try to get pools
        console.log('Fetching pools...');
        const pools = await sdk.Pool.getPools([]);

        console.log(`Found ${pools?.length || 0} pools`);

        if (pools && pools.length > 0) {
            // Show first 3 pools
            console.log('\nSample pools:');
            pools.slice(0, 3).forEach((pool, i) => {
                console.log(`\nPool ${i + 1}:`);
                console.log(`  Address: ${pool.poolAddress}`);
                console.log(`  Coin A: ${pool.coinTypeA?.split('::').pop() || 'unknown'}`);
                console.log(`  Coin B: ${pool.coinTypeB?.split('::').pop() || 'unknown'}`);
                console.log(`  Fee Rate: ${pool.fee_rate ? pool.fee_rate / 10000 : 'N/A'}%`);
                console.log(`  Liquidity: ${pool.liquidity || 'N/A'}`);
            });

            return true;
        }

        return false;
    } catch (error) {
        console.error('Test failed:', error.message);
        console.error('Stack:', error.stack);
        return false;
    }
}

testCetusPools()
    .then(success => {
        console.log(`\n${success ? '✓ Test passed' : '✗ Test failed'}`);
        process.exit(success ? 0 : 1);
    });
