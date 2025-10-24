#!/usr/bin/env tsx
/**
 * Programmatic PKP Setup Script (Following Vincent Pattern)
 *
 * This script follows the proper Vincent pattern for setting up PKP and permissions:
 * 1. Ensure agent PKP exists (or mint a new one)
 * 2. Add Lit Protocol permissions for the ability
 * 3. Register a new app with the ability (and optional policies)
 * 4. Permit the PKP to use the app version
 *
 * Usage:
 *   pnpm setup-pkp-programmatic
 *
 * Required Environment Variables (in .env.test-e2e):
 *   - TEST_FUNDER_PRIVATE_KEY: Private key for funding wallets
 *   - TEST_APP_MANAGER_PRIVATE_KEY: Private key for app manager (registers apps)
 *   - TEST_APP_DELEGATEE_PRIVATE_KEY: Private key for app delegatee
 *   - TEST_AGENT_WALLET_PKP_OWNER_PRIVATE_KEY: Private key for PKP owner
 *
 * Optional Environment Variables:
 *   - TEST_PKP_TOKEN_ID: Use specific PKP instead of auto-discovery/minting
 *   - TEST_PKP_ETH_ADDRESS: Use specific PKP address
 *   - DEPLOYED_ABILITY_IPFS_CID: Use specific ability IPFS CID
 */

import { writeFileSync } from 'fs';
import { resolve, join  } from 'path';

import { bundledVincentAbility as rebalancerAbility } from '@reubenr0d/lp-rebalancer-ability';
import { config } from 'dotenv';

import type { PermissionData } from '@lit-protocol/vincent-contracts-sdk';

import { getClient } from '@lit-protocol/vincent-contracts-sdk';

import { registerNewApp } from '../lib/appManager/register-new-app';
import { getChainHelpers } from '../lib/chain';
import { addPermissionForAbilities } from '../lib/delegator/add-permission-for-abilities';
// Import helper functions
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
  console.log('\n🚀 ===== PROGRAMMATIC PKP SETUP (Vincent Pattern) =====\n');

  // Load environment variables from .env.test-e2e
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
    console.error('   - TEST_APP_DELEGATEE_PRIVATE_KEY');
    console.error('   - TEST_AGENT_WALLET_PKP_OWNER_PRIVATE_KEY\n');
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

  // Step 1: Ensure agent PKP exists (will mint new one if needed)
  console.log('🪙 Step 1: Setting up Agent PKP...');
  const pkpInfo = await ensureFundedAgentPkpExists();
  console.log(`✅ Agent PKP ready:`);
  console.log(`   PKP Address: ${pkpInfo.ethAddress}`);
  console.log(`   PKP Token ID: ${pkpInfo.tokenId}`);
  console.log('');

  // Step 2: Add Lit Protocol permissions for the ability
  console.log('🔐 Step 2: Adding Lit Protocol permissions for ability...');
  const abilityIpfsCid = process.env.DEPLOYED_ABILITY_IPFS_CID || rebalancerAbility.ipfsCid || '';

  if (!abilityIpfsCid) {
    throw new Error(
      'No ability IPFS CID found. Please set DEPLOYED_ABILITY_IPFS_CID or ensure bundled ability has ipfsCid.',
    );
  }

  console.log(`   Using ability IPFS CID: ${abilityIpfsCid}`);

  await addPermissionForAbilities(agentWalletOwner, pkpInfo.tokenId, [abilityIpfsCid]);
  console.log('✅ Lit Protocol permissions added successfully');
  console.log('');

  // Step 3: Register new app or use existing app
  console.log('🏗️  Step 3: Setting up app with ability...');

  let appId: number;
  let appVersion: number;

  // Check if delegatee already has an app registered
  const vincentClient = getClient({ signer: appManager });
  const existingApp = await vincentClient.getAppByDelegateeAddress({
    delegateeAddress: appDelegatee.address,
  });

  if (existingApp) {
    console.log(`   Found existing app: ID ${existingApp.id}`);
    appId = existingApp.id;

    // Get the latest version to check if ability is already registered
    const latestVersion =
      typeof existingApp.latestVersion === 'object' && existingApp.latestVersion.toNumber
        ? existingApp.latestVersion.toNumber()
        : existingApp.latestVersion;

    console.log(`   Latest version: ${latestVersion}`);

    // Try to check if ability is already in the latest version
    let abilityExists = false;
    try {
      const versionInfo = await vincentClient.getAppVersion({
        appId: existingApp.id,
        appVersion: latestVersion,
      });
      abilityExists = versionInfo.abilityIpfsCids.includes(abilityIpfsCid);
    } catch (error) {
      console.log(`   ⚠️  Could not check app version details, will add new version`);
      abilityExists = false;
    }

    if (abilityExists) {
      console.log(`   ✅ Ability already registered in version ${latestVersion}`);
      appVersion = latestVersion;
    } else {
      console.log(`   ⚠️  Could not verify if ability exists in current version`);
      console.log(`   Will attempt to permit PKP with version ${latestVersion}`);
      console.log(`   Note: If the ability is not registered in this version, permission may fail`);
      appVersion = latestVersion;
    }
  } else {
    console.log('   No existing app found, registering new app...');
    const result = await registerNewApp({
      abilityIpfsCids: [abilityIpfsCid],
      abilityPolicies: [[]],
    });
    appId = result.appId;
    appVersion = result.appVersion;
    console.log(`   ✅ App registered: ID ${appId}, Version ${appVersion}`);
  }
  console.log('');

  // Step 4: Permit the PKP to use the app version
  console.log('🔑 Step 4: Permitting PKP to use app version...');

  // Define permission data (no policy restrictions)
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
  console.log('✅ PKP permitted to use app version');
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

  // Show next steps
  console.log('📋 ===== NEXT STEPS =====');
  console.log('');
  console.log('1. 🎯 Transfer your LP NFT to the PKP:');
  console.log(`   LP NFT should be transferred to: ${pkpInfo.ethAddress}`);
  console.log('');
  console.log('2. 🚀 Run the execution script:');
  console.log('   pnpm execute-ability-with-pkp');
  console.log('');
  console.log('3. 📄 Setup details are saved in:');
  console.log(`   ${setupFilePath}`);
  console.log('');
  console.log('✅ Setup complete! Your PKP is ready with full Vincent permissions.');
  console.log('');
}

main().catch((error) => {
  console.error('\n❌ Setup failed:');
  console.error(error);
  process.exit(1);
});
