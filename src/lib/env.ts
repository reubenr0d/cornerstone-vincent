// eslint-disable-next-line @nx/enforce-module-boundaries
import { createRandomWallets } from '@reubenr0d/lp-rebalancer-e2e';

// Create a helper that returns the private keys for all 4 test wallets.
// It uses createRandomWallets() to generate the three non-funder wallets and
// accepts a funderWallet (already constructed) so callers can supply the
// already funded funder account.
// The returned object uses the same keys as packages/cornerstone-lp-rebalancer-e2e/src/lib/env.ts getEnv()
// i.e., TEST_FUNDER_PRIVATE_KEY, TEST_APP_MANAGER_PRIVATE_KEY,
// TEST_APP_DELEGATEE_PRIVATE_KEY, TEST_AGENT_WALLET_PKP_OWNER_PRIVATE_KEY, which will be merged
// into the process.env object before attempting to use helper methods exposed by the e2e package
export function getPrivateKeysEnv(funderPrivateKey: string) {
  const { appDelegatee, appManager, agentWalletOwner } = createRandomWallets();

  return {
    TEST_FUNDER_PRIVATE_KEY: funderPrivateKey,
    TEST_APP_MANAGER_PRIVATE_KEY: appManager.privateKey,
    TEST_APP_DELEGATEE_PRIVATE_KEY: appDelegatee.privateKey,
    TEST_AGENT_WALLET_PKP_OWNER_PRIVATE_KEY: agentWalletOwner.privateKey,
  } as const;
}
