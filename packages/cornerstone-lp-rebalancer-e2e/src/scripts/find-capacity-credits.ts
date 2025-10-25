#!/usr/bin/env tsx
/**
 * Find Capacity Credit Tokens
 *
 * This script checks all your wallets for capacity credit NFTs
 */

import { resolve } from 'path';

import { config } from 'dotenv';

import { getChainHelpers } from '../lib/chain';
import { getLitContractsClient } from '../lib/litContractsClient/getLitContractsClient';

async function main() {
  console.log('\n🔍 ===== SEARCHING FOR CAPACITY CREDITS =====\n');

  // Load environment
  const envPath = resolve(__dirname, '../../.env.test-e2e');
  config({ path: envPath });

  const {
    wallets: { funder, agentWalletOwner, appManager, appDelegatee },
  } = await getChainHelpers();

  const walletsToCheck = [
    { name: 'Funder', wallet: funder },
    { name: 'Agent Wallet Owner', wallet: agentWalletOwner },
    { name: 'App Manager', wallet: appManager },
    { name: 'App Delegatee', wallet: appDelegatee },
  ];

  console.log('Checking the following wallets for capacity credits:\n');

  const foundTokens: Array<{ tokenId: string; owner: string; walletName: string; expiry: string }> =
    [];

  for (const { name, wallet } of walletsToCheck) {
    console.log(`📋 ${name}: ${wallet.address}`);

    try {
      const litContractClient = await getLitContractsClient({ wallet });

      const tokens = await litContractClient.rateLimitNftContractUtils.read.getTokensByOwnerAddress(
        wallet.address,
      );

      if (tokens.length > 0) {
        console.log(`   ✅ Found ${tokens.length} capacity credit token(s):`);

        for (const token of tokens) {
          const status = token.isExpired ? '❌ EXPIRED' : '✅ ACTIVE';
          console.log(`      Token ID: ${token.tokenId.toString()}`);
          console.log(`      Status: ${status}`);
          console.log(`      Requests Per Kilosecond: ${token.capacity.requestsPerKilosecond}`);
          console.log(
            `      Expires At: ${new Date(Number(token.capacity.expiresAt) * 1000).toISOString()}`,
          );
          console.log('');

          if (!token.isExpired) {
            foundTokens.push({
              wallet: name,
              address: wallet.address,
              tokenId: token.tokenId.toString(),
              capacity: token.capacity,
            });
          }
        }
      } else {
        console.log(`   ℹ️  No capacity credits found`);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`   ⚠️  Error checking wallet: ${errorMessage}`);
    }

    console.log('');
  }

  if (foundTokens.length > 0) {
    console.log('\n🎉 ===== ACTIVE CAPACITY CREDITS FOUND =====\n');

    const recommended = foundTokens[0];
    console.log('Recommended token to use:');
    console.log(`   Wallet: ${recommended.wallet} (${recommended.address})`);
    console.log(`   Token ID: ${recommended.tokenId}`);
    console.log('');
    console.log('📋 To use this capacity credit:');
    console.log('');
    console.log('1. Add to .env.test-e2e:');
    console.log(`   CAPACITY_CREDIT_TOKEN_ID=${recommended.tokenId}`);
    if (recommended.wallet !== 'Agent Wallet Owner') {
      console.log(`   CAPACITY_CREDIT_OWNER_PRIVATE_KEY=<private-key-for-${recommended.wallet}>`);
    }
    console.log('');
    console.log('2. Run setup:');
    console.log('   pnpm setup-capacity-credits');
    console.log('');
  } else {
    console.log('\n⚠️  ===== NO ACTIVE CAPACITY CREDITS FOUND =====\n');
    console.log('You may need to:');
    console.log('1. Run /upgrade in Claude Code to get capacity credits');
    console.log('2. Or mint capacity credits manually');
    console.log('');
    console.log('For now, you can wait 10-15 minutes for rate limits to reset.');
    console.log('');
  }
}

main().catch((error) => {
  console.error('\n❌ Error searching for capacity credits:');
  console.error(error);
  process.exit(1);
});
