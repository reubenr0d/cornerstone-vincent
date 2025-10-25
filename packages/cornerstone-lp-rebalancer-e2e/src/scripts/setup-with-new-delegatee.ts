#!/usr/bin/env tsx
/**
 * Setup with New Delegatee Script
 *
 * This script sets up the PKP with a new delegatee wallet to bypass the "one app per delegatee" limit
 * while keeping the same PKP that holds the LP NFT.
 *
 * Usage:
 *   pnpm setup-with-new-delegatee
 */

import { writeFileSync } from 'fs';
import { resolve, join } from 'path';

import { bundledVincentAbility as rebalancerAbility } from '@reubenr0d/lp-rebalancer-ability';
import { config } from 'dotenv';

import type { PermissionData } from '@lit-protocol/vincent-contracts-sdk';

import { getClient } from '@lit-protocol/vincent-contracts-sdk';

import { registerNewApp } from '../lib/appManager/register-new-app';
import { getChainHelpers } from '../lib/chain';
import { addPermissionForAbilities } from '../lib/delegator/add-permission-for-abilities';
import { permitAppVersionForAgentWalletPkp } from '../lib/delegator/permit-vincent-app-version';
import { getEnv } from '../lib/env';

interface SetupResult {
  pkpInfo: {
    ethAddress: string;
    tokenId: string;
  };
  appInfo: {
    appId: number;
    appVersion: number;
  };
  abilityIpfsCid: string;
  delegateeInfo: {
    oldDelegatee: string;
    newDelegatee: string;
  };
  setupDate: string;
}

async function main() {
  console.log('\n🚀 ===== SETUP WITH NEW DELEGATEE =====\n');

  // Load environment variables
  const envPath = resolve(__dirname, '../../.env.test-e2e');
  config({ path: envPath });
  console.log(`📋 Loading environment from: ${envPath}\n`);

  // Validate environment
  try {
    getEnv();
  } catch (error) {
    console.error('❌ Environment validation failed!');
    console.error('   Make sure all required variables are set in .env.test-e2e:');
    console.error('   - TEST_FUNDER_PRIVATE_KEY');
    console.error('   - TEST_APP_MANAGER_PRIVATE_KEY');
    console.error('   - TEST_APP_DELEGATEE_PRIVATE_KEY (should be the NEW delegatee)');
    console.error('   - TEST_AGENT_WALLET_PKP_OWNER_PRIVATE_KEY\n');
    throw error;
  }

  const {
    wallets: { agentWalletOwner, appManager, appDelegatee },
  } = await getChainHelpers();

  console.log('📋 Configuration:');
  console.log(`   Agent Wallet Owner: ${agentWalletOwner.address}`);
  console.log(`   App Manager: ${appManager.address}`);
  console.log(`   App Delegatee (NEW): ${appDelegatee.address}`);
  console.log('');

  // Use the existing PKP from pkp-details.json
  const pkpDetailsPath = join(process.cwd(), 'pkp-details.json');
  let pkpInfo;

  try {
    const pkpDetails = JSON.parse(require('fs').readFileSync(pkpDetailsPath, 'utf8'));
    pkpInfo = {
      ethAddress: pkpDetails.ethAddress,
      tokenId: pkpDetails.tokenId,
    };
    console.log('🪙 Using existing PKP:');
    console.log(`   PKP Address: ${pkpInfo.ethAddress}`);
    console.log(`   PKP Token ID: ${pkpInfo.tokenId}`);
    console.log('');
  } catch (error) {
    console.error('❌ Could not load existing PKP details from pkp-details.json');
    console.error('   Make sure the file exists and contains valid PKP information.');
    throw error;
  }

  // Get the ability IPFS CID
  const abilityIpfsCid = process.env.DEPLOYED_ABILITY_IPFS_CID || rebalancerAbility.ipfsCid || '';

  if (!abilityIpfsCid) {
    throw new Error(
      'No ability IPFS CID found. Please set DEPLOYED_ABILITY_IPFS_CID or ensure bundled ability has ipfsCid.',
    );
  }

  console.log(`📦 Using ability IPFS CID: ${abilityIpfsCid}`);
  console.log('');

  // Check if the new delegatee already has an app
  console.log('🔍 Checking if new delegatee already has an app...');
  const vincentClient = getClient({ signer: appManager });
  const existingApp = await vincentClient.getAppByDelegateeAddress({
    delegateeAddress: appDelegatee.address,
  });

  if (existingApp) {
    console.log(`⚠️  New delegatee already has an app: ID ${existingApp.appId}`);
    console.log('   This delegatee cannot be used. Please generate a different one.');
    console.log('');
    console.log('   Run: pnpm generate-new-delegatee');
    console.log('');
    process.exit(1);
  }

  console.log('✅ New delegatee is available for app registration');
  console.log('');

  // Register new app with the new delegatee
  console.log('🏗️  Registering new app with updated ability...');
  const result = await registerNewApp({
    abilityIpfsCids: [abilityIpfsCid],
    abilityPolicies: [[]],
  });

  const appId = result.appId;
  const appVersion = result.appVersion;
  console.log(`✅ App registered: ID ${appId}, Version ${appVersion}`);
  console.log('');

  // Add Lit Protocol permissions for the ability (if not already added)
  console.log('🔐 Adding Lit Protocol permissions for ability...');
  await addPermissionForAbilities(agentWalletOwner, pkpInfo.tokenId, [abilityIpfsCid]);
  console.log('✅ Lit Protocol permissions added successfully');
  console.log('');

  // Permit the PKP to use the new app version
  console.log('🔑 Permitting PKP to use new app version...');

  const permissionData: PermissionData = {
    [abilityIpfsCid]: {
      // No policies configured - ability will run without policy restrictions
    },
  };

  await permitAppVersionForAgentWalletPkp({
    permissionData,
    appId,
    appVersion,
    agentPkpInfo: pkpInfo,
  });
  console.log('✅ PKP permitted to use new app version');
  console.log('');

  // Save setup details to file
  const setupResult: SetupResult = {
    pkpInfo: {
      ethAddress: pkpInfo.ethAddress,
      tokenId: pkpInfo.tokenId,
    },
    appInfo: {
      appId,
      appVersion,
    },
    abilityIpfsCid,
    delegateeInfo: {
      oldDelegatee: '0x846Aec0c62F866BB682f7e4d419F869240C6aBa5', // From pkp-details.json
      newDelegatee: appDelegatee.address,
    },
    setupDate: new Date().toISOString(),
  };

  const setupFilePath = join(process.cwd(), 'pkp-setup-result-new-delegatee.json');
  writeFileSync(setupFilePath, JSON.stringify(setupResult, null, 2));

  console.log('💾 Setup details saved to file:');
  console.log(`   File: ${setupFilePath}`);
  console.log('');

  // Show next steps
  console.log('📋 ===== SETUP COMPLETE =====');
  console.log('');
  console.log('✅ Your PKP is ready with the new app registration!');
  console.log('');
  console.log('🔑 Key Information:');
  console.log(`   PKP Address: ${pkpInfo.ethAddress} (unchanged - holds your LP NFT)`);
  console.log(`   New App ID: ${appId}`);
  console.log(`   New App Version: ${appVersion}`);
  console.log(`   New Delegatee: ${appDelegatee.address}`);
  console.log('');
  console.log('🚀 Next Steps:');
  console.log('1. Your LP NFT should already be in the PKP (no transfer needed)');
  console.log('2. Run the execution script: pnpm execute-ability-with-pkp');
  console.log('3. The same PKP will execute the ability with the new app registration');
  console.log('');
}

main().catch((error) => {
  console.error('\n❌ Setup failed:');
  console.error(error);
  process.exit(1);
});
