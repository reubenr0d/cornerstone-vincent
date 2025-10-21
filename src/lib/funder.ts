import { access, writeFile } from 'fs/promises';
import { join } from 'path';

// eslint-disable-next-line @nx/enforce-module-boundaries
import { funder } from '@reubenr0d/lp-rebalancer-e2e';
// eslint-disable-next-line import-x/no-named-as-default
import Table from 'cli-table3';
import { stringify } from 'envfile';

import { getPrivateKeysEnv } from './env';
import { getFunderAccount } from './prompts/get-funder-account';
import { pressEnterToContinue } from './prompts/press-enter-to-continue';

const { checkFunderBalance } = funder;

async function fileExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Guides user through funding, captures funder key, generates env vars, checks balance, prints table, writes .env.test-e2e
 */
export async function setupFunderEnv(repoRoot: string): Promise<void> {
  const envTestE2EPath = join(
    repoRoot,
    'packages',
    'cornerstone-lp-rebalancer-e2e',
    '.env.test-e2e',
  );

  // We should only set up a new funder if there isn't already defined packages/cornerstone-lp-rebalancer-e2e/.env.test-e2e
  if (await fileExists(envTestE2EPath)) {
    throw new Error(
      'An env file already exists at packages/cornerstone-lp-rebalancer-e2e/.env.test-e2e. Please remove or rename it before running bootstrap again.',
    );
  }

  console.log(
    'To get started, you will need a wallet that is funded with testLPX tokens on the LIT testnet, Yellowstone.',
  );
  console.log(
    'This account will be used to ensure that the accounts that are used by the e2e tests are funded with enough testLPX tokens to run the tests.',
  );
  console.log(
    'You can get testLPX tokens from the LIT faucet: https://chronicle-yellowstone-faucet.getlit.dev/',
  );

  // Require the user to press Enter to continue after reading the faucet note
  await pressEnterToContinue('funded your wallet with testLPX tokens');

  const { funderPrivateKey } = await getFunderAccount();

  const envVars = getPrivateKeysEnv(funderPrivateKey);

  // Make these env vars available immediately so e2e helpers functions can read them instead of re-implementing the logic here
  for (const [k, v] of Object.entries(envVars)) {
    process.env[k] = v;
  }

  // Throws with a link to the faucet if the funder account doesn't have enough funds
  await checkFunderBalance();

  const table = new Table({
    head: ['Environment Variable', 'Value'],
    style: { head: ['green'] },
    wordWrap: true,
    colWidths: [40, 70],
  });

  Object.entries(envVars).forEach(([key, value]) => {
    table.push([key, value]);
  });

  console.log('\nGenerated private keys for your test environment:');
  console.log(table.toString());

  // Write .env.test-e2e
  await writeFile(envTestE2EPath, stringify(envVars), { encoding: 'utf8', flag: 'wx' });
}
