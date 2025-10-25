#!/usr/bin/env tsx
/**
 * Mint Capacity Credits
 *
 * This script mints a new capacity credit NFT for testing
 */

import { resolve } from 'path';

import { config } from 'dotenv';

import { getChainHelpers } from '../lib/chain';
import { ensureUnexpiredCapacityToken } from '../lib/ensure-capacity-credit';

async function main() {
  console.log('\n🎫 ===== MINT CAPACITY CREDITS =====\n');

  // Load environment
  const envPath = resolve(__dirname, '../../.env.test-e2e');
  config({ path: envPath });

  const {
    wallets: { agentWalletOwner },
  } = await getChainHelpers();

  console.log(`Minting capacity credit for: ${agentWalletOwner.address}\n`);

  try {
    await ensureUnexpiredCapacityToken(agentWalletOwner);

    console.log('\n✅ Capacity credit minted successfully!\n');
    console.log('📋 Next steps:');
    console.log('1. Run: pnpm find-capacity-credits');
    console.log('2. Add the token ID to .env.test-e2e');
    console.log('3. Run: pnpm setup-capacity-credits');
    console.log('');
  } catch (error: unknown) {
    console.error('\n❌ Failed to mint capacity credit:');
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(errorMessage);
    console.log('\nPossible reasons:');
    console.log('- Insufficient LIT tokens in wallet');
    console.log('- Wallet has insufficient balance for gas');
    console.log('\nYou can try waiting for the rate limit to reset instead (10-15 minutes).');
  }
}

main().catch((error) => {
  console.error('\n❌ Error:');
  console.error(error);
  process.exit(1);
});
