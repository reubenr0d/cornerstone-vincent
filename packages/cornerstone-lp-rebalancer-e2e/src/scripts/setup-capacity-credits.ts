#!/usr/bin/env tsx
/**
 * Setup Capacity Credits Delegation
 *
 * This script creates a capacity delegation auth sig that allows your PKP
 * to use your capacity credits, bypassing rate limits.
 *
 * Prerequisites:
 * - You must own a Capacity Credits NFT
 * - Set CAPACITY_CREDIT_TOKEN_ID in .env.test-e2e
 */

import { writeFileSync } from 'fs';
import { resolve, join  } from 'path';

import { config } from 'dotenv';
import { ethers } from 'ethers';

import { LitNetwork } from '@lit-protocol/constants';
import { LitNodeClient } from '@lit-protocol/lit-node-client';

async function main() {
  console.log('\n🎫 ===== CAPACITY CREDITS SETUP =====\n');

  // Load environment
  const envPath = resolve(__dirname, '../../.env.test-e2e');
  config({ path: envPath });

  const pkpAddress = process.env.TEST_PKP_ETH_ADDRESS;
  const capacityTokenId = process.env.CAPACITY_CREDIT_TOKEN_ID;
  const ownerPrivateKey =
    process.env.CAPACITY_CREDIT_OWNER_PRIVATE_KEY ||
    process.env.TEST_AGENT_WALLET_PKP_OWNER_PRIVATE_KEY;

  if (!pkpAddress) {
    throw new Error('TEST_PKP_ETH_ADDRESS not set in .env.test-e2e');
  }

  if (!capacityTokenId) {
    console.log('⚠️  CAPACITY_CREDIT_TOKEN_ID not set in .env.test-e2e');
    console.log('');
    console.log('To use capacity credits:');
    console.log(
      '1. Mint capacity credits: https://developer.litprotocol.com/paying-for-lit/capacity-credits',
    );
    console.log('2. Set CAPACITY_CREDIT_TOKEN_ID in .env.test-e2e');
    console.log('3. Run this script again');
    console.log('');
    process.exit(1);
  }

  if (!ownerPrivateKey) {
    throw new Error('CAPACITY_CREDIT_OWNER_PRIVATE_KEY not set in .env.test-e2e');
  }

  console.log(`📋 Configuration:`);
  console.log(`   PKP Address: ${pkpAddress}`);
  console.log(`   Capacity Credit Token ID: ${capacityTokenId}`);
  console.log('');

  // Create wallet from private key
  const wallet = new ethers.Wallet(ownerPrivateKey);
  console.log(`   Owner Address: ${wallet.address}`);
  console.log('');

  // Connect to Lit Network
  console.log('🔌 Connecting to Lit Network...');
  const litNodeClient = new LitNodeClient({
    litNetwork: LitNetwork.DatilDev,
    debug: false,
  });

  await litNodeClient.connect();
  console.log('✅ Connected to Lit Network');
  console.log('');

  // Create capacity delegation auth sig
  console.log('🎫 Creating capacity delegation auth sig...');

  const { capacityDelegationAuthSig } = await litNodeClient.createCapacityDelegationAuthSig({
    uses: '100', // Number of uses
    dAppOwnerWallet: wallet,
    capacityTokenId: capacityTokenId,
    delegateeAddresses: [pkpAddress], // Delegate to the PKP
  });

  console.log('✅ Capacity delegation auth sig created');
  console.log('');

  // Save to file
  const outputPath = join(process.cwd(), 'capacity-delegation-auth-sig.json');
  writeFileSync(outputPath, JSON.stringify(capacityDelegationAuthSig, null, 2));

  console.log('💾 Saved capacity delegation auth sig to:');
  console.log(`   ${outputPath}`);
  console.log('');

  console.log('📋 ===== NEXT STEPS =====');
  console.log('');
  console.log('1. The capacity delegation auth sig has been saved');
  console.log('2. Update execute-ability-with-pkp.ts to use it');
  console.log('3. Run: pnpm execute-ability-with-pkp');
  console.log('');

  await litNodeClient.disconnect();
}

main().catch((error) => {
  console.error('\n❌ Setup failed:');
  console.error(error);
  process.exit(1);
});
