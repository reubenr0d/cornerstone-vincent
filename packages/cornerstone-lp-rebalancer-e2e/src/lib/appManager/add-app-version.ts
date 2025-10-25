import { getClient } from '@lit-protocol/vincent-contracts-sdk';

import { getChainHelpers } from '../chain';

/**
 * Adds a new version to an existing app
 * @param appId - The app ID to add a version to
 * @param abilityIpfsCids - Array of ability IPFS CIDs for this version
 * @param abilityPolicies - Array of policy IPFS CIDs for each ability
 */
export async function addAppVersion({
  appId,
  abilityIpfsCids,
  abilityPolicies,
}: {
  appId: number;
  abilityIpfsCids: string[];
  abilityPolicies: string[][];
}) {
  const {
    wallets: { appManager },
  } = await getChainHelpers();

  const vincentClient = getClient({
    signer: appManager,
  });

  const { txHash } = await vincentClient.addVersion({
    appId,
    versionAbilities: {
      abilityIpfsCids,
      abilityPolicies,
    },
  });

  console.log(`Added new version to App ${appId}\nTx hash: ${txHash}`);

  // Get the app to find the new version number
  const app = await vincentClient.getApp({ appId });
  const newVersion =
    typeof app.latestVersion === 'object' && 'toNumber' in app.latestVersion
      ? (app.latestVersion as { toNumber(): number }).toNumber()
      : app.latestVersion;

  return { appVersion: newVersion, txHash };
}
