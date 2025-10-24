#!/usr/bin/env tsx
/**
 * PKP Setup and Permissions Script
 *
 * This script will:
 * 1. Mint a new PKP for your delegatee wallet
 * 2. Set up all required permissions
 * 3. Save PKP details to a file
 * 4. Show you how to transfer your LP NFT
 *
 * Usage:
 *   pnpm setup-pkp-and-permissions
 *
 * Required Environment Variables:
 *   - TEST_APP_DELEGATEE_PRIVATE_KEY: Private key for the delegatee wallet
 *   - TEST_REGISTRY_ADDRESS: Cornerstone registry contract address
 *
 * Optional Environment Variables:
 *   - SEPOLIA_RPC_URL: RPC URL for blockchain queries (default: Sepolia Infura)
 */

import { writeFileSync } from 'fs';
import { join } from 'path';

import { bundledVincentAbility as rebalancerAbility } from '@reubenr0d/lp-rebalancer-ability';
import { ethers } from 'ethers';

import { AUTH_METHOD_SCOPE, AUTH_METHOD_TYPE } from '@lit-protocol/constants';
import { getClient } from '@lit-protocol/vincent-contracts-sdk';

import { getLitContractsClient } from '../lib/litContractsClient/getLitContractsClient';

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
  console.log('\n🚀 ===== PKP SETUP AND PERMISSIONS SCRIPT =====\n');

  // Load environment variables
  const delegateePrivateKey = process.env.TEST_APP_DELEGATEE_PRIVATE_KEY;
  const registryAddress =
    process.env.TEST_REGISTRY_ADDRESS || '0x832d9D61E076791Ae7c625C27Ab1Ca4D7499f6cb';
  const rpcUrl =
    process.env.SEPOLIA_RPC_URL || 'https://sepolia.infura.io/v3/8cd7c812dfe546888949c99de3b9a4c9';

  // Validate required environment variables
  if (!delegateePrivateKey) {
    throw new Error('TEST_APP_DELEGATEE_PRIVATE_KEY is required');
  }

  // Normalize private key format
  let normalizedPrivateKey = delegateePrivateKey;
  if (!delegateePrivateKey.startsWith('0x')) {
    normalizedPrivateKey = '0x' + delegateePrivateKey;
  }

  // Validate private key length
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

  // Create delegatee wallet with provider
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  const delegateeWallet = new ethers.Wallet(normalizedPrivateKey, provider);

  // For Lit contracts, we need to use DatilDev testnet
  const datilProvider = new ethers.providers.JsonRpcProvider(
    'https://yellowstone-rpc.litprotocol.com',
  );
  const datilWallet = new ethers.Wallet(normalizedPrivateKey, datilProvider);

  console.log('📋 Configuration:');
  console.log(`   Delegatee Wallet: ${delegateeWallet.address}`);
  console.log(`   Registry Address: ${registryAddress}`);
  console.log(`   RPC URL: ${rpcUrl}`);
  console.log('');

  // Check wallet balance
  console.log('💰 Checking wallet balance...');
  try {
    const balance = await delegateeWallet.getBalance();
    console.log(`   Balance: ${ethers.utils.formatEther(balance)} ETH`);

    if (balance.lt(ethers.utils.parseEther('0.01'))) {
      console.log('⚠️  Low balance detected. You may need to fund this wallet for gas fees.');
    } else {
      console.log('✅ Wallet has sufficient balance for gas fees');
    }
  } catch (error) {
    console.log('⚠️  Could not check balance:');
    console.log(`   ${error instanceof Error ? error.message : String(error)}`);
  }
  console.log('');

  // Mint new PKP
  console.log('🪙 Minting new PKP for delegatee wallet...');
  console.log('   Using DatilDev testnet for Lit Protocol contracts...');
  const litContractClient = await getLitContractsClient({ wallet: datilWallet });

  const mintPkpTx = await litContractClient.pkpHelperContract.write.mintNextAndAddAuthMethods(
    AUTH_METHOD_TYPE.EthWallet,
    [AUTH_METHOD_TYPE.EthWallet],
    [delegateeWallet.address],
    ['0x'],
    [[AUTH_METHOD_SCOPE.SignAnything]],
    true, // addPkpEthAddressAsPermittedAddress
    false, // sendPkpToItself
    { value: await litContractClient.pkpNftContract.read.mintCost() },
  );

  console.log('   Waiting for transaction confirmation...');
  const mintPkpReceipt = await mintPkpTx.wait();

  if (!mintPkpReceipt.events) {
    throw new Error('Mint Pkp Receipt does not have events');
  }

  const pkpMintedEvent = mintPkpReceipt.events.find(
    (event) =>
      event.topics[0] === '0x3b2cc0657d0387a736293d66389f78e4c8025e413c7a1ee67b7707d4418c46b8',
  );

  if (!pkpMintedEvent) {
    throw new Error(
      'Mint Pkp Receipt does not have PkpMinted event; cannot identify minted PKPs publicKey',
    );
  }

  const tokenId = ethers.utils.keccak256('0x' + pkpMintedEvent.data.slice(130, 260));
  const ethAddress = await litContractClient.pkpNftContract.read.getEthAddress(tokenId);

  console.log(`✅ Successfully minted new PKP!`);
  console.log(`   PKP Address: ${ethAddress}`);
  console.log(`   PKP Token ID: ${ethers.BigNumber.from(tokenId).toString()}`);
  console.log('');

  // Set up Lit Protocol permissions
  console.log('🔐 Setting up Lit Protocol permissions...');
  try {
    // Use the hardcoded deployed ability IPFS CID
    const abilityIpfsCid = 'QmcSMxbPv13RxP23FtQbpwLfvBHDcBFbfH46HDkaHDdfET';

    await litContractClient.addPermittedAction({
      pkpTokenId: tokenId,
      ipfsId: abilityIpfsCid,
      authMethodScopes: [AUTH_METHOD_SCOPE.SignAnything],
    });

    console.log('✅ Lit Protocol permissions set up successfully');
    console.log(`   Ability IPFS CID: ${abilityIpfsCid}`);
  } catch (error) {
    console.log('⚠️  Lit Protocol permission setup failed:');
    console.log(`   ${error instanceof Error ? error.message : String(error)}`);
  }
  console.log('');

  // Set up Vincent permissions
  console.log('🔐 Setting up Vincent permissions...');
  try {
    const vincentClient = getClient({ signer: datilWallet });

    // Get app info for the delegatee
    const app = await vincentClient.getAppByDelegateeAddress({
      delegateeAddress: delegateeWallet.address,
    });

    if (!app) {
      console.log('   No app found for delegatee - this is expected for a new setup');
      console.log('   Vincent permissions will be set up when the app is registered');
    } else {
      console.log(`   Found app: ID ${app.id}, Version ${app.latestVersion}`);
      console.log(`   App latestVersion type: ${typeof app.latestVersion}`);
      console.log(`   App latestVersion value: ${JSON.stringify(app.latestVersion)}`);

      // Get the ability IPFS CID
      const abilityIpfsCid = 'QmcSMxbPv13RxP23FtQbpwLfvBHDcBFbfH46HDkaHDdfET';

      // Check if the ability is already registered with this app version
      try {
        // Validate that app.latestVersion is a valid BigNumber
        if (!app.latestVersion || app.latestVersion === undefined) {
          throw new Error('App latestVersion is undefined or invalid');
        }

        // Convert BigNumber to number if needed
        const appVersion =
          typeof app.latestVersion === 'object' && app.latestVersion.toNumber
            ? app.latestVersion.toNumber()
            : app.latestVersion;

        const appVersionInfo = await vincentClient.getAppVersion({
          appId: app.id,
          appVersion: appVersion,
        });

        const isAbilityRegistered = appVersionInfo.abilityIpfsCids.includes(abilityIpfsCid);

        if (isAbilityRegistered) {
          console.log('   ✅ Ability already registered with app version');

          // Try to set up permissions
          try {
            console.log('   Setting up Vincent permissions...');

            const permissionData = {
              [abilityIpfsCid]: {
                // No policies configured - ability will run without policy restrictions
              },
            };

            const result = await vincentClient.permitApp({
              pkpEthAddress: ethAddress,
              appId: app.id,
              appVersion: appVersion,
              permissionData,
            });

            console.log('✅ Vincent ability permissions set up successfully');
            console.log(`   App ID: ${app.id}`);
            console.log(`   App Version: ${appVersion}`);
            console.log(`   PKP Address: ${ethAddress}`);
            console.log(`   Transaction Hash: ${result.txHash}`);
          } catch (permissionError) {
            console.log('⚠️  Vincent permission setup failed:');
            console.log(
              `   ${permissionError instanceof Error ? permissionError.message : String(permissionError)}`,
            );
          }
        } else {
          console.log('   ⚠️  Ability not registered with app version');
          console.log(
            '   The ability needs to be registered with the app version by the app manager',
          );
          console.log('   For now, the PKP is ready with Lit Protocol permissions');
        }
      } catch (versionError) {
        console.log('   ⚠️  Could not check app version:');
        console.log(
          `   ${versionError instanceof Error ? versionError.message : String(versionError)}`,
        );
        console.log(`   App ID: ${app.id}`);
        console.log(`   App Version: ${app.latestVersion}`);
        console.log('   Vincent permissions will need to be set up by the app manager');
      }
    }
  } catch (error) {
    console.log('⚠️  Vincent permission setup failed (this might be expected):');
    console.log(`   ${error instanceof Error ? error.message : String(error)}`);
  }
  console.log('');

  // Save PKP details to file
  const pkpDetails: PkpDetails = {
    ethAddress,
    tokenId: ethers.BigNumber.from(tokenId).toString(),
    delegateeWallet: delegateeWallet.address,
    registryAddress,
    rpcUrl,
    abilityIpfsCid: rebalancerAbility.ipfsCid || '',
    setupDate: new Date().toISOString(),
  };

  const pkpDetailsPath = join(process.cwd(), 'pkp-details.json');
  writeFileSync(pkpDetailsPath, JSON.stringify(pkpDetails, null, 2));

  console.log('💾 PKP details saved to file:');
  console.log(`   File: ${pkpDetailsPath}`);
  console.log('');

  // Show next steps
  console.log('📋 ===== NEXT STEPS =====');
  console.log('');
  console.log('1. 🎯 Transfer your LP NFT to the new PKP:');
  console.log(`   LP NFT should be transferred to: ${ethAddress}`);
  console.log('');
  console.log('2. 🚀 Run the execution script:');
  console.log('   pnpm execute-ability-with-pkp');
  console.log('');
  console.log('3. 📄 PKP details are saved in:');
  console.log(`   ${pkpDetailsPath}`);
  console.log('');
  console.log('✅ Setup complete! Your PKP is ready for LP token management.');
  console.log('');
}

main().catch(console.error);
