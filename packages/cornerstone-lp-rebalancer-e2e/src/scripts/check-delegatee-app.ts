#!/usr/bin/env tsx
/**
 * Check Delegatee's App
 */

import { resolve } from 'path';

import { config } from 'dotenv';

import { getClient } from '@lit-protocol/vincent-contracts-sdk';

import { getChainHelpers } from '../lib/chain';

async function main() {
  // Load environment
  const envPath = resolve(__dirname, '../../.env.test-e2e');
  config({ path: envPath });

  const {
    wallets: { appManager, appDelegatee },
  } = await getChainHelpers();

  console.log('\n🔍 Checking delegatee app...');
  console.log(`Delegatee Address: ${appDelegatee.address}`);
  console.log('');

  const vincentClient = getClient({ signer: appManager });

  try {
    const app = await vincentClient.getAppByDelegateeAddress({
      delegateeAddress: appDelegatee.address,
    });

    console.log('App data:');
    console.dir(app, { depth: null });
  } catch (error) {
    console.error('Error getting app:');
    console.error(error);
  }
}

main().catch(console.error);
