#!/usr/bin/env tsx
/**
 * Generate New Delegatee Wallet Script
 *
 * This script generates a new delegatee wallet to bypass the "one app per delegatee" limit
 * while keeping the same PKP that holds the LP NFT.
 *
 * Usage:
 *   pnpm generate-new-delegatee
 */

import { writeFileSync } from 'fs';
import { resolve, join } from 'path';

import { config } from 'dotenv';
import { Wallet } from 'ethers';

import { getChainHelpers } from '../lib/chain';

interface DelegateeUpdate {
  oldDelegatee: string;
  newDelegatee: string;
  newDelegateePrivateKey: string;
  updateDate: string;
}

async function main() {
  console.log('\n🔄 ===== GENERATING NEW DELEGATEE WALLET =====\n');

  // Load environment variables
  const envPath = resolve(__dirname, '../../.env.test-e2e');
  config({ path: envPath });
  console.log(`📋 Loading environment from: ${envPath}\n`);

  // Get current setup
  const { wallets: currentWallets } = await getChainHelpers();
  const oldDelegatee = currentWallets.appDelegatee.address;

  console.log('📋 Current Configuration:');
  console.log(`   Current Delegatee: ${oldDelegatee}`);
  console.log(`   PKP Address: 0xaB0D5922AEB47d6E028E46a66752F054d639bAeb (unchanged)`);
  console.log('');

  // Generate new delegatee wallet
  console.log('🆕 Generating new delegatee wallet...');
  const newDelegateeWallet = Wallet.createRandom();
  const newDelegateeAddress = newDelegateeWallet.address;
  const newDelegateePrivateKey = newDelegateeWallet.privateKey;

  console.log(`✅ New delegatee wallet generated:`);
  console.log(`   Address: ${newDelegateeAddress}`);
  console.log(`   Private Key: ${newDelegateePrivateKey}`);
  console.log('');

  // Save the update details
  const updateDetails: DelegateeUpdate = {
    oldDelegatee,
    newDelegatee: newDelegateeAddress,
    newDelegateePrivateKey,
    updateDate: new Date().toISOString(),
  };

  const updateFilePath = join(process.cwd(), 'delegatee-update.json');
  writeFileSync(updateFilePath, JSON.stringify(updateDetails, null, 2));

  console.log('💾 Update details saved to:');
  console.log(`   ${updateFilePath}`);
  console.log('');

  // Show next steps
  console.log('📋 ===== NEXT STEPS =====');
  console.log('');
  console.log('1. 🔧 Update your environment file:');
  console.log(`   Update TEST_APP_DELEGATEE_PRIVATE_KEY to: ${newDelegateePrivateKey}`);
  console.log('');
  console.log('2. 💰 Fund the new delegatee wallet:');
  console.log(`   Send some testnet ETH to: ${newDelegateeAddress}`);
  console.log('');
  console.log('3. 🚀 Run the updated setup:');
  console.log('   pnpm setup-pkp-programmatic');
  console.log('');
  console.log('✅ New delegatee wallet ready! This will bypass the "one app per delegatee" limit.');
  console.log('');
}

main().catch((error) => {
  console.error('\n❌ Generation failed:');
  console.error(error);
  process.exit(1);
});
