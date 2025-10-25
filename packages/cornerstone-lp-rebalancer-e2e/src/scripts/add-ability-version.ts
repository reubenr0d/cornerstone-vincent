#!/usr/bin/env tsx
/**
 * Add New Ability Version to Existing App
 *
 * This script adds a new version with the updated ability to an existing app.
 * Use this when you've updated your ability and want to deploy it to an existing app.
 *
 * Usage:
 *   DEPLOYED_ABILITY_IPFS_CID=QmW2piwDaAY7bky94zufG11hZ5jZLJTwWjPwR74Vv2Cs6p pnpm add-ability-version
 *
 * Required Environment Variables (in .env.test-e2e):
 *   - TEST_APP_MANAGER_PRIVATE_KEY: Private key for app manager
 *   - DEPLOYED_ABILITY_IPFS_CID: New ability IPFS CID
 */

import { writeFileSync } from 'fs';
import { resolve, join } from 'path';

import { bundledVincentAbility as rebalancerAbility } from '@reubenr0d/lp-rebalancer-ability';
import { config } from 'dotenv';

import type { PermissionData } from '@lit-protocol/vincent-contracts-sdk';

import { getClient } from '@lit-protocol/vincent-contracts-sdk';

import { addAppVersion } from '../lib/appManager/add-app-version';
import { getChainHelpers } from '../lib/chain';
import { addPermissionForAbilities } from '../lib/delegator/add-permission-for-abilities';
import { ensureFundedAgentPkpExists } from '../lib/delegator/agent-pkp';
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
  setupDate: string;
}

async function main() {
  console.log('\n🔄 ===== ADD NEW ABILITY VERSION TO EXISTING APP =====\n');

  // Load environment variables from .env.test-e2e
  const envPath = resolve(__dirname, '../../.env.test-e2e');
  config({ path: envPath });
  console.log(`📋 Loading environment from: ${envPath}\n`);

  // Validate environment
  try {
    getEnv();
  } catch (error) {
    console.error('❌ Environment validation failed!');
    console.error('   Make sure all required variables are set in .env.test-e2e');
    throw error;
  }

  const {
    wallets: { agentWalletOwner, appManager, appDelegatee },
  } = await getChainHelpers();

  console.log('📋 Configuration:');
  console.log(`   Agent Wallet Owner: ${agentWalletOwner.address}`);
  console.log(`   App Manager: ${appManager.address}`);
  console.log(`   App Delegatee: ${appDelegatee.address}`);
  console.log('');

  // Step 1: Get PKP info
  console.log('🪙 Step 1: Getting Agent PKP...');
  const pkpInfo = await ensureFundedAgentPkpExists();
  console.log(`✅ Agent PKP ready:`);
  console.log(`   PKP Address: ${pkpInfo.ethAddress}`);
  console.log(`   PKP Token ID: ${pkpInfo.tokenId}`);
  console.log('');

  // Step 2: Get new ability IPFS CID
  console.log('📦 Step 2: Getting ability IPFS CID...');
  const abilityIpfsCid = process.env.DEPLOYED_ABILITY_IPFS_CID || rebalancerAbility.ipfsCid || '';

  if (!abilityIpfsCid) {
    throw new Error(
      'No ability IPFS CID found. Please set DEPLOYED_ABILITY_IPFS_CID or ensure bundled ability has ipfsCid.',
    );
  }

  console.log(`   Using ability IPFS CID: ${abilityIpfsCid}`);
  console.log('');

  // Step 3: Add Lit Protocol permissions for the new ability
  console.log('🔐 Step 3: Adding Lit Protocol permissions for new ability...');
  await addPermissionForAbilities(agentWalletOwner, pkpInfo.tokenId, [abilityIpfsCid]);
  console.log('✅ Lit Protocol permissions added successfully');
  console.log('');

  // Step 4: Get existing app
  console.log('🔍 Step 4: Finding existing app...');
  const vincentClient = getClient({ signer: appManager });
  const existingApp = await vincentClient.getAppByDelegateeAddress({
    delegateeAddress: appDelegatee.address,
  });

  if (!existingApp || !existingApp.appId) {
    throw new Error(
      `No app found for delegatee ${appDelegatee.address}. Please run setup-pkp-programmatic first.`,
    );
  }

  const appId =
    typeof existingApp.appId === 'object' && 'toNumber' in existingApp.appId
      ? (existingApp.appId as { toNumber(): number }).toNumber()
      : existingApp.appId;

  console.log(`✅ Found existing app: ID ${appId}`);
  console.log('');

  // Step 5: Add new version to existing app
  console.log('🏗️  Step 5: Adding new version to app...');
  const { appVersion } = await addAppVersion({
    appId,
    abilityIpfsCids: [abilityIpfsCid],
    abilityPolicies: [[]],
  });
  console.log(`✅ New version added: Version ${appVersion}`);
  console.log('');

  // Step 6: Permit the PKP to use the new app version
  console.log('🔑 Step 6: Permitting PKP to use new app version...');

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
    setupDate: new Date().toISOString(),
  };

  const setupFilePath = join(process.cwd(), 'pkp-setup-result.json');
  writeFileSync(setupFilePath, JSON.stringify(setupResult, null, 2));

  console.log('💾 Setup details saved to file:');
  console.log(`   File: ${setupFilePath}`);
  console.log('');

  // Show summary
  console.log('📋 ===== SUMMARY =====');
  console.log('');
  console.log(`✅ Added ability version ${appVersion} to app ${appId}`);
  console.log(`   Ability IPFS CID: ${abilityIpfsCid}`);
  console.log(`   PKP Address: ${pkpInfo.ethAddress}`);
  console.log('');
  console.log('📋 ===== NEXT STEPS =====');
  console.log('');
  console.log('1. 🚀 Test the new ability version:');
  console.log('   DEPLOYED_ABILITY_IPFS_CID=' + abilityIpfsCid + ' pnpm execute-ability-with-pkp');
  console.log('');
  console.log('2. ⚠️  If you hit rate limits:');
  console.log('   - Set up capacity credits: pnpm setup-capacity-credits');
  console.log('   - Then run execution again');
  console.log('');
}

main().catch((error) => {
  console.error('\n❌ Failed to add ability version:');
  console.error(error);
  process.exit(1);
});
