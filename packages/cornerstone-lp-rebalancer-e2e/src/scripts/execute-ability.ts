#!/usr/bin/env tsx
/**
 * Standalone script to execute the LP Rebalancer ability
 *
 * Usage:
 *   pnpm execute-ability
 *
 * Required Environment Variables:
 *   - TEST_APP_DELEGATEE_PRIVATE_KEY: Private key for the delegatee wallet
 *   - TEST_PKP_ETH_ADDRESS: PKP Ethereum address that will execute the ability
 *   - TEST_PKP_TOKEN_ID: PKP token ID (required for permission setup)
 *   - TEST_REGISTRY_ADDRESS: Cornerstone registry contract address
 *
 * Optional Environment Variables:
 *   - SEPOLIA_RPC_URL: RPC URL for blockchain queries (default: Sepolia Infura)
 *   - DEPLOYED_ABILITY_IPFS_CID: Use deployed ability instead of local (optional)
 */

import { bundledVincentAbility as rebalancerAbility } from '@reubenr0d/lp-rebalancer-ability';
import { ethers } from 'ethers';

import { AUTH_METHOD_SCOPE } from '@lit-protocol/constants';
import {
  getVincentAbilityClient,
  disconnectVincentAbilityClients,
} from '@lit-protocol/vincent-app-sdk/abilityClient';

import { getLitContractsClient } from '../lib/litContractsClient/getLitContractsClient';

async function main() {
  console.log('\n🚀 ===== LP REBALANCER ABILITY EXECUTOR =====\n');

  // Load environment variables directly from process.env
  const delegateePrivateKey = process.env.TEST_APP_DELEGATEE_PRIVATE_KEY;
  const pkpEthAddress = process.env.TEST_PKP_ETH_ADDRESS;
  const registryAddress =
    process.env.TEST_REGISTRY_ADDRESS || '0x832d9D61E076791Ae7c625C27Ab1Ca4D7499f6cb';
  const rpcUrl =
    process.env.SEPOLIA_RPC_URL || 'https://sepolia.infura.io/v3/8cd7c812dfe546888949c99de3b9a4c9';
  const deployedAbilityIpfsCid = process.env.DEPLOYED_ABILITY_IPFS_CID;

  // Validate required environment variables
  if (!delegateePrivateKey) {
    throw new Error('TEST_APP_DELEGATEE_PRIVATE_KEY is required');
  }

  if (!pkpEthAddress) {
    throw new Error('TEST_PKP_ETH_ADDRESS is required - set the PKP wallet address');
  }

  // Normalize private key format
  let normalizedPrivateKey = delegateePrivateKey;
  if (!delegateePrivateKey.startsWith('0x')) {
    normalizedPrivateKey = '0x' + delegateePrivateKey;
  }

  // Validate private key length (should be 66 chars with 0x prefix = 64 hex chars)
  if (normalizedPrivateKey.length !== 66) {
    if (normalizedPrivateKey.length === 130) {
      throw new Error(
        `❌ Invalid private key: This appears to be a public key (128 hex chars). Private keys should be 64 hex characters.`,
      );
    }
    throw new Error(
      `❌ Invalid private key length: ${normalizedPrivateKey.length} characters. Expected 64 hex characters (with or without 0x prefix)`,
    );
  }

  console.log('📋 Configuration:');
  console.log(`   PKP Address: ${pkpEthAddress}`);
  console.log(`   Registry Address: ${registryAddress}`);
  console.log(`   RPC URL: ${rpcUrl}`);
  console.log(`   Using ${deployedAbilityIpfsCid ? 'deployed' : 'local'} ability`);
  console.log('');

  // Create delegatee wallet
  const delegateeWallet = new ethers.Wallet(normalizedPrivateKey);
  console.log(`👤 Delegatee Wallet: ${delegateeWallet.address}`);
  console.log('');

  // Set up permissions if PKP token ID is provided
  const pkpTokenId = process.env.TEST_PKP_TOKEN_ID;
  if (pkpTokenId) {
    console.log('🔐 Setting up permissions...');
    try {
      // Create a provider for the delegatee wallet
      const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
      const walletWithProvider = delegateeWallet.connect(provider);

      const litContractClient = await getLitContractsClient({ wallet: walletWithProvider });

      // Get the ability IPFS CID
      const abilityIpfsCid = deployedAbilityIpfsCid || rebalancerAbility.ipfsCid;
      if (abilityIpfsCid) {
        console.log(`   Adding permission for ability: ${abilityIpfsCid}`);
        await litContractClient.addPermittedAction({
          pkpTokenId,
          ipfsId: abilityIpfsCid,
          authMethodScopes: [AUTH_METHOD_SCOPE.SignAnything],
        });
        console.log('✅ Permissions set up successfully');
      } else {
        console.log('⚠️  No ability IPFS CID found, skipping permission setup');
      }
    } catch (error) {
      console.log(
        '⚠️  Permission setup failed (this might be expected if permissions already exist):',
      );
      console.log(`   ${error instanceof Error ? error.message : String(error)}`);
    }
    console.log('');
  } else {
    console.log('⚠️  No PKP token ID provided - skipping permission setup');
    console.log(
      '   Set TEST_PKP_TOKEN_ID environment variable to enable automatic permission setup',
    );
    console.log('');
  }

  // Verify PKP exists and get token ID
  console.log('🔧 Verifying PKP information...');
  try {
    const litContractClient = await getLitContractsClient({ wallet: delegateeWallet });

    // Get all PKPs owned by the delegatee wallet
    console.log('   Looking up PKPs owned by delegatee wallet...');
    const ownedPkps = await litContractClient.pkpNftContractUtils.read.getTokensInfoByAddress(
      delegateeWallet.address,
    );

    // Find the PKP with the matching address
    const matchingPkp = ownedPkps.find(
      (pkp) => pkp.ethAddress.toLowerCase() === pkpEthAddress?.toLowerCase(),
    );

    if (matchingPkp) {
      console.log(`✅ Found PKP Token ID: ${matchingPkp.tokenId.toString()}`);
      console.log(`   PKP Address: ${matchingPkp.ethAddress}`);
      console.log('✅ PKP ownership verified - delegatee wallet owns this PKP');

      // Update environment variable for the rest of the script
      process.env.TEST_PKP_TOKEN_ID = matchingPkp.tokenId.toString();
    } else {
      console.log('❌ PKP not found or not owned by delegatee wallet');
      console.log(`   Looking for PKP address: ${pkpEthAddress}`);
      console.log(`   Delegatee wallet: ${delegateeWallet.address}`);
      console.log(`   Owned PKPs: ${ownedPkps.map((pkp) => pkp.ethAddress).join(', ')}`);

      // If no PKPs found, we need to work with the specified PKP
      if (ownedPkps.length === 0) {
        console.log('');
        console.log('💡 No PKPs found for delegatee wallet.');
        console.log('   You want to use the specified PKP (where your LP tokens are held).');
        console.log(
          '   This requires the PKP owner to set up permissions for this delegatee wallet.',
        );
        console.log('');
        console.log('   To fix this, the PKP owner needs to:');
        console.log('   1. Set up permissions for this delegatee wallet to execute abilities');
        console.log('   2. Or transfer the PKP to this delegatee wallet');
        console.log('');
        console.log('   For now, continuing with the specified PKP address...');
        console.log('   (This will likely fail due to permission issues)');

        // Use the token ID from environment if available
        if (process.env.TEST_PKP_TOKEN_ID) {
          console.log(`   Using PKP Token ID from environment: ${process.env.TEST_PKP_TOKEN_ID}`);
        } else {
          console.log('   No PKP Token ID provided in environment');
        }
      } else {
        console.log('   The delegatee wallet must own the PKP to set up permissions');
      }
    }
  } catch (error) {
    console.log('⚠️  PKP lookup failed:');
    console.log(`   ${error instanceof Error ? error.message : String(error)}`);
    console.log("   This might indicate the PKP address is incorrect or the PKP doesn't exist");
  }
  console.log('');

  // Create ability client
  let abilityToUse = rebalancerAbility;

  // If using deployed ability, create a bundled ability object with the IPFS CID
  if (deployedAbilityIpfsCid) {
    console.log(`📦 Using deployed ability: ${deployedAbilityIpfsCid}`);
    abilityToUse = {
      ...rebalancerAbility,
      ipfsCid: deployedAbilityIpfsCid,
    };
  }

  const abilityClient = getVincentAbilityClient({
    bundledVincentAbility: abilityToUse,
    ethersSigner: delegateeWallet,
  });

  console.log('⚡ Executing LP Rebalancer ability...\n');

  try {
    const startTime = Date.now();

    // Execute the ability
    const result = await abilityClient.execute(
      {
        registryAddress,
        rpcUrl,
      },
      {
        delegatorPkpEthAddress: pkpEthAddress,
      },
    );

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n📊 ===== EXECUTION RESULTS =====\n');
    console.log(`⏱️  Duration: ${duration}s`);
    console.log(`✅ Success: ${result.success}\n`);

    if (result.success && result.result) {
      console.log('📈 Summary:');
      console.log(`   Registry: ${result.result.registryAddress}`);
      console.log(`   Total Actions: ${result.result.totalActions || 0}`);
      console.log(`   Projects: ${result.result.projects?.length || 0}`);
      console.log('');

      if (result.result.projects && result.result.projects.length > 0) {
        console.log('🏗️  Projects Details:\n');
        result.result.projects.forEach((project: any, index: number) => {
          console.log(`   ${index + 1}. ${project.projectAddress}`);
          console.log(`      Token: ${project.tokenAddress}`);
          console.log(`      PYUSD: ${project.pyusdAddress}`);
          console.log(`      Pool: ${project.poolAddress || 'No pool'}`);
          console.log(`      NAV/Share: ${project.navPerShare}`);
          console.log(`      Target Price: ${project.targetPoolPrice}`);
          console.log(`      Current Price: ${project.currentPoolPrice}`);
          console.log(`      Deviation: ${project.deviationBps} bps (${project.direction})`);
          console.log(`      Positions: ${project.positionCount}`);

          if (project.actions && project.actions.length > 0) {
            console.log(`      Actions:`);
            project.actions.forEach((action: any) => {
              console.log(`         - ${action.name} (tx: ${action.txHash.slice(0, 10)}...)`);
            });
          }
          console.log('');
        });
      }

      console.log('📄 Full Result:');
      console.log(JSON.stringify(result.result, null, 2));
    } else if (!result.success) {
      console.log('❌ Execution Failed\n');

      if (result.context) {
        console.log('🔍 Error Context:');
        console.log(JSON.stringify(result.context, null, 2));
      }
    }

    console.log('\n✨ Done!\n');
  } catch (error) {
    console.error('\n❌ Error executing ability:\n');
    console.error(error);
    process.exit(1);
  } finally {
    await disconnectVincentAbilityClients();
  }
}

// Run the script
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
