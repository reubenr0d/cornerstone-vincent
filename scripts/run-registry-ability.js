#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.resolve(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) {
    return;
  }

  const contents = fs.readFileSync(envPath, 'utf8');
  for (const line of contents.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();

    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadEnv();

const {
  vincentAbility,
} = require('../packages/cornerstone-lp-rebalancer-ability/dist/src/lib/vincent-ability');

async function main() {
  const registryAddress = process.env.REGISTRY_ADDRESS;
  const rpcUrl = process.env.RPC_URL;
  const pkpAddress = process.env.PKP_ADDRESS;
  const pkpPublicKey = process.env.PKP_PUBLIC_KEY;

  if (!registryAddress || !rpcUrl || !pkpAddress || !pkpPublicKey) {
    throw new Error('Missing one of REGISTRY_ADDRESS, RPC_URL, PKP_ADDRESS, PKP_PUBLIC_KEY');
  }

  console.log('Running ability execute with:');
  console.log(`  registryAddress: ${registryAddress}`);
  console.log(`  rpcUrl: ${rpcUrl}`);
  console.log(`  pkpAddress: ${pkpAddress}`);
  console.log(`  pkpPublicKey: ${pkpPublicKey}`);

  const result = await vincentAbility.execute(
    {
      abilityParams: {
        registryAddress,
        rpcUrl,
      },
    },
    {
      delegation: {
        delegatorPkpInfo: {
          ethAddress: pkpAddress,
          publicKey: pkpPublicKey,
        },
      },
      policiesContext: {
        allowedPolicies: {},
      },
      succeed: (res) => ({ ok: true, value: res }),
      fail: (err) => ({ ok: false, value: err }),
    },
  );

  if (result.ok) {
    console.log('Ability execute succeeded:');
    console.dir(result.value, { depth: null });
  } else {
    console.error('Ability execute failed:');
    console.dir(result.value, { depth: null });
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('Unexpected error while running ability:', error);
  process.exit(1);
});
