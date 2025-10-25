#!/usr/bin/env tsx
/**
 * Execute Ability with Saved PKP Details
 *
 * This script loads the PKP details from the setup script and executes the ability.
 *
 * Usage:
 *   pnpm execute-ability-with-pkp
 *
 * Required:
 *   - pkp-details.json file (created by setup-pkp-and-permissions script)
 *   - TEST_APP_DELEGATEE_PRIVATE_KEY environment variable
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Import directly from source since tsx can handle TypeScript
// This avoids needing to compile the ability package
import { bundledVincentAbility as rebalancerAbility } from "@reubenr0d/lp-rebalancer-ability/src/index";
import { ethers } from 'ethers';

import {
  getVincentAbilityClient,
  disconnectVincentAbilityClients,
} from '@lit-protocol/vincent-app-sdk/abilityClient';

interface PkpDetails {
  ethAddress: string;
  tokenId: string;
  delegateeWallet: string;
  registryAddress: string;
  rpcUrl: string;
  abilityIpfsCid: string;
  setupDate: string;
}

async function main() {
  console.log('\n🚀 ===== EXECUTE ABILITY WITH SAVED PKP =====\n');

  // Load environment variables
  const delegateePrivateKey = process.env.TEST_APP_DELEGATEE_PRIVATE_KEY;

  if (!delegateePrivateKey) {
    throw new Error('TEST_APP_DELEGATEE_PRIVATE_KEY is required');
  }

  // Normalize private key format
  let normalizedPrivateKey = delegateePrivateKey;
  if (!delegateePrivateKey.startsWith('0x')) {
    normalizedPrivateKey = '0x' + delegateePrivateKey;
  }

  // Load PKP details from file
  const pkpDetailsPath = join(process.cwd(), 'pkp-details.json');

  if (!existsSync(pkpDetailsPath)) {
    throw new Error(
      `PKP details file not found: ${pkpDetailsPath}\n` +
        'Please run "pnpm setup-pkp-and-permissions" first to create the PKP and save details.',
    );
  }

  const pkpDetails: PkpDetails = JSON.parse(readFileSync(pkpDetailsPath, 'utf8'));

  console.log('📋 Loaded PKP Details:');
  console.log(`   PKP Address: ${pkpDetails.ethAddress}`);
  console.log(`   PKP Token ID: ${pkpDetails.tokenId}`);
  console.log(`   Delegatee Wallet: ${pkpDetails.delegateeWallet}`);
  console.log(`   Registry Address: ${pkpDetails.registryAddress}`);
  console.log(`   Setup Date: ${pkpDetails.setupDate}`);
  console.log('');

  // Create delegatee wallet
  const delegateeWallet = new ethers.Wallet(normalizedPrivateKey);

  // Verify the wallet matches
  if (delegateeWallet.address.toLowerCase() !== pkpDetails.delegateeWallet.toLowerCase()) {
    throw new Error(
      `Wallet mismatch! Expected: ${pkpDetails.delegateeWallet}, Got: ${delegateeWallet.address}`,
    );
  }

  console.log('✅ Wallet verification passed');
  console.log('');

  // Create ability client with deployed ability IPFS CID if available
  const deployedAbilityIpfsCid = process.env.DEPLOYED_ABILITY_IPFS_CID;
  const abilityToUse = deployedAbilityIpfsCid
    ? { ...rebalancerAbility, ipfsCid: deployedAbilityIpfsCid }
    : rebalancerAbility;

  console.log(`📦 Using ability IPFS CID: ${abilityToUse.ipfsCid}`);
  if (deployedAbilityIpfsCid) {
    console.log(`   (Deployed ability from environment variable)`);
  } else {
    console.log(`   (Bundled ability from package)`);
  }
  console.log('');

  const abilityClient = getVincentAbilityClient({
    bundledVincentAbility: abilityToUse,
    ethersSigner: delegateeWallet,
  });

  // Try to load capacity delegation auth sig
  const capacityAuthSigPath = join(process.cwd(), 'capacity-delegation-auth-sig.json');
  let capacityDelegationAuthSig;

  if (existsSync(capacityAuthSigPath)) {
    capacityDelegationAuthSig = JSON.parse(readFileSync(capacityAuthSigPath, 'utf8'));
    console.log('✅ Using capacity delegation auth sig to bypass rate limits');
    console.log('');
  } else {
    console.log('⚠️  No capacity delegation auth sig found');
    console.log('   If you hit rate limits, run: pnpm setup-capacity-credits');
    console.log('');
  }

  console.log('⚡ Executing LP Rebalancer ability...\n');

  try {
    const startTime = Date.now();

    // Execute the ability
    const result = await abilityClient.execute(
      {
        registryAddress: pkpDetails.registryAddress,
        rpcUrl: pkpDetails.rpcUrl,
      },
      {
        delegatorPkpEthAddress: pkpDetails.ethAddress,
        ...(capacityDelegationAuthSig && { capacityDelegationAuthSig }),
      },
    );

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n📊 ===== EXECUTION RESULTS =====\n');
    console.log(`⏱️  Duration: ${duration}s`);
    console.log(`✅ Success: ${result.success}\n`);

    if (result.success && result.result) {
      console.log('🎉 Ability executed successfully!');
      console.log('Detailed Result:');
      console.dir(result.result, { depth: null });
    } else if (result.runtimeError) {
      console.log('❌ Error executing ability:\n');
      console.error(result.runtimeError);
      console.log('\n🔍 Error Context:');
      console.dir(result.abilityContext, { depth: null });
    } else {
      console.log('❌ Execution Failed');
      console.log('\n🔍 Error Context:');
      console.dir(result.abilityContext, { depth: null });
    }
  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    await disconnectVincentAbilityClients();
    console.log('\n✨ Done!');
  }
}

main().catch(console.error);
