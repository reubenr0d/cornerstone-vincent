import { Wallet } from 'ethers';

export function createRandomWallets() {
  return {
    appDelegatee: Wallet.createRandom(),
    appManager: Wallet.createRandom(),
    agentWalletOwner: Wallet.createRandom(),
  };
}
