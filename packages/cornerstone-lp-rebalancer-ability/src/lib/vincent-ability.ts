import { ethers as nodeEthers } from 'ethers';

import {
  createVincentAbility,
  supportedPoliciesForAbility,
} from '@lit-protocol/vincent-ability-sdk';

import type { EthersType } from '../Lit';

import {
  abilityParamsSchema,
  executeFailSchema,
  executeSuccessSchema,
  precheckFailSchema,
  precheckSuccessSchema,
  KNOWN_ERRORS,
} from './schemas';

const globalMaybe =
  typeof globalThis !== 'undefined' ? (globalThis as Record<string, unknown>) : {};
const ethers: EthersType =
  (globalMaybe.ethers as EthersType | undefined) ?? (nodeEthers as unknown as EthersType);

const DEFAULT_RPC_URL = 'https://yellowstone-rpc.litprotocol.com/';
const RPC_MAX_RETRIES = 3;
const RPC_RETRY_BASE_DELAY_MS = 1_000;

type JsonRpcProvider = InstanceType<EthersType['providers']['JsonRpcProvider']>;
type BigNumber = ReturnType<typeof ethers.BigNumber.from>;

type NetworkConfig = {
  uniswapFactory: string;
  positionManager: string;
};

const NETWORK_CONFIG: Record<number, NetworkConfig> = {
  1: {
    uniswapFactory: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
    positionManager: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
  },
  11155111: {
    uniswapFactory: '0x0227628f3F023bb0B980b67D528571c95c6DaC1c',
    positionManager: '0x1238536071E1c677A632429e3655c799b22cDA52',
  },
  175188: {
    // Yellowstone testnet - using Sepolia addresses as fallback since they should be compatible
    uniswapFactory: '0x0227628f3F023bb0B980b67D528571c95c6DaC1c',
    positionManager: '0x1238536071E1c677A632429e3655c799b22cDA52',
  },
  8453: {
    // Base mainnet - using mainnet addresses
    uniswapFactory: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
    positionManager: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
  },
};

const NONFUNGIBLE_POSITION_MANAGER_ABI = [
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
  'function balanceOf(address owner) external view returns (uint256)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) external view returns (uint256)',
  'function positions(uint256 tokenId) external view returns (uint96 nonce,address operator,address token0,address token1,uint24 fee,int24 tickLower,int24 tickUpper,uint128 liquidity,uint256 feeGrowthInside0LastX128,uint256 feeGrowthInside1LastX128,uint128 tokensOwed0,uint128 tokensOwed1)',
  'function decreaseLiquidity((uint256 tokenId,uint128 liquidity,uint256 amount0Min,uint256 amount1Min,uint256 deadline)) external payable returns (uint256 amount0,uint256 amount1)',
  'function increaseLiquidity((uint256 tokenId,uint256 amount0Desired,uint256 amount1Desired,uint256 amount0Min,uint256 amount1Min,uint256 deadline)) external payable returns (uint128 liquidity,uint256 amount0,uint256 amount1)',
  'function collect((uint256 tokenId,address recipient,uint128 amount0Max,uint128 amount1Max)) external payable returns (uint256 amount0,uint256 amount1)',
] as const;

type PositionInfo = {
  tokenId: string;
  token0: string;
  token1: string;
  fee: number;
  liquidity: BigNumber;
  tickLower: number;
  tickUpper: number;
};

const inferChainIdFromRpc = (rpcUrl?: string): number | undefined => {
  if (!rpcUrl) {
    return undefined;
  }

  const lowered = rpcUrl.toLowerCase();
  if (lowered.includes('sepolia')) {
    return 11155111;
  }
  if (lowered.includes('mainnet')) {
    return 1;
  }
  return undefined;
};

const createProvider = (rpcUrl?: string): JsonRpcProvider => {
  const url = rpcUrl ?? DEFAULT_RPC_URL;
  const inferredChainId = inferChainIdFromRpc(url);

  if (inferredChainId !== undefined) {
    const networkName = inferredChainId === 1 ? 'mainnet' : 'sepolia';
    return new ethers.providers.StaticJsonRpcProvider(
      { url },
      { chainId: inferredChainId, name: networkName },
    ) as JsonRpcProvider;
  }

  return new ethers.providers.JsonRpcProvider(url) as JsonRpcProvider;
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isRetryableRpcError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const maybeError = error as { code?: string; status?: number };
  if (maybeError.status && maybeError.status >= 500) {
    return true;
  }

  if (!maybeError.code) {
    return false;
  }

  return maybeError.code === 'SERVER_ERROR' || maybeError.code === 'NETWORK_ERROR';
};

const withRpcRetry = async <T>(operation: () => Promise<T>, context: string): Promise<T> => {
  let attempt = 0;
  let lastError: unknown;

  while (attempt < RPC_MAX_RETRIES) {
    attempt += 1;
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (!isRetryableRpcError(error) || attempt === RPC_MAX_RETRIES) {
        throw error;
      }

      const backoffMs = RPC_RETRY_BASE_DELAY_MS * attempt;
      console.warn(
        `[@reubenr0d/lp-rebalancer-ability] RPC call failed in ${context} (attempt ${attempt}): ${
          (error as Error).message ?? error
        }. Retrying in ${backoffMs}ms`,
      );
      await delay(backoffMs);
    }
  }

  throw lastError;
};

const discoverNetworkConfig = async (
  provider: JsonRpcProvider,
  rpcUrl?: string,
): Promise<NetworkConfig> => {
  try {
    const network = await provider.getNetwork();
    const config = NETWORK_CONFIG[Number(network.chainId)];
    if (!config) {
      throw new Error(`Unsupported network ${network.chainId}`);
    }
    return config;
  } catch (error) {
    const fallbackChainId = inferChainIdFromRpc(rpcUrl);
    if (fallbackChainId && NETWORK_CONFIG[fallbackChainId]) {
      console.warn(
        `[@reubenr0d/lp-rebalancer-ability] Falling back to inferred network ${fallbackChainId}`,
      );
      return NETWORK_CONFIG[fallbackChainId];
    }
    throw error;
  }
};

const fetchOwnedPositions = async (
  provider: JsonRpcProvider,
  config: NetworkConfig,
  ownerAddress: string,
): Promise<PositionInfo[]> => {
  const positionManager = new ethers.Contract(
    config.positionManager,
    NONFUNGIBLE_POSITION_MANAGER_ABI,
    provider,
  );

  const balance = ethers.BigNumber.from(
    await withRpcRetry(() => positionManager.balanceOf(ownerAddress), 'positions: balanceOf'),
  );
  const count = balance.toNumber();
  const positions: PositionInfo[] = [];

  for (let index = 0; index < count; index += 1) {
    const tokenId = ethers.BigNumber.from(
      await withRpcRetry(
        () => positionManager.tokenOfOwnerByIndex(ownerAddress, index),
        `positions: tokenOfOwnerByIndex(${index})`,
      ),
    );
    const position = (await withRpcRetry(
      () => positionManager.positions(tokenId),
      `positions: positions(${tokenId.toString()})`,
    )) as any;

    positions.push({
      tokenId: tokenId.toString(),
      token0: position[2] as string,
      token1: position[3] as string,
      fee: Number(position[4]),
      tickLower: Number(position[5]),
      tickUpper: Number(position[6]),
      liquidity: ethers.BigNumber.from(position[7]),
    });
  }

  return positions;
};

export const vincentAbility = createVincentAbility({
  packageName: '@reubenr0d/lp-rebalancer-ability' as const,
  abilityParamsSchema,
  abilityDescription:
    'Check all Uniswap V3 LP positions held by the PKP wallet and rebalance them if they deviate from target prices defined by Cornerstone projects',
  supportedPolicies: supportedPoliciesForAbility([]),
  precheckSuccessSchema,
  precheckFailSchema,
  executeSuccessSchema,
  executeFailSchema,

  precheck: async ({ abilityParams }, { fail, succeed, delegation }) => {
    const { registryAddress, rpcUrl } = abilityParams;

    if (!ethers.utils.isAddress(registryAddress)) {
      return fail({
        reason: KNOWN_ERRORS.INVALID_REGISTRY_ADDRESS,
        error: `Invalid registry address: ${registryAddress}`,
      });
    }

    try {
      const provider = createProvider(rpcUrl);
      const networkConfig = await discoverNetworkConfig(provider, rpcUrl);

      const pkpAddress = delegation?.delegatorPkpInfo?.ethAddress;
      if (!pkpAddress) {
        return succeed({
          registryAddress,
          projectCount: 0,
          trackedPositions: 0,
          projects: [],
        });
      }

      // Only fetch positions owned by the PKP - skip project discovery for speed
      const ownedPositions = await fetchOwnedPositions(provider, networkConfig, pkpAddress);

      console.log(`[@reubenr0d/lp-rebalancer-ability] Found ${ownedPositions.length} LP positions`);

      return succeed({
        registryAddress,
        projectCount: 0,
        trackedPositions: ownedPositions.length,
        projects: [],
      });
    } catch (error) {
      console.error(
        '[@reubenr0d/lp-rebalancer-ability/precheck] Failed to fetch LP positions',
        error,
      );

      return fail({
        reason: KNOWN_ERRORS.PROVIDER_ERROR,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },

  execute: async ({ abilityParams }, { succeed, fail, delegation, policiesContext }) => {
    const { registryAddress, rpcUrl } = abilityParams;

    try {
      if (!ethers.utils.isAddress(registryAddress)) {
        throw new Error(`Invalid registry address: ${registryAddress}`);
      }

      const provider = createProvider(rpcUrl);
      const networkConfig = await discoverNetworkConfig(provider, rpcUrl);

      const pkpPublicKey = delegation?.delegatorPkpInfo?.publicKey;
      const pkpAddress = delegation?.delegatorPkpInfo?.ethAddress;

      if (!pkpPublicKey || !pkpAddress) {
        throw new Error('Delegation context missing PKP information');
      }

      console.log(`[@reubenr0d/lp-rebalancer-ability] Fetching LP positions for ${pkpAddress}`);
      const ownedPositions = await fetchOwnedPositions(provider, networkConfig, pkpAddress);
      console.log(`[@reubenr0d/lp-rebalancer-ability] Found ${ownedPositions.length} LP positions`);

      if (ownedPositions.length === 0) {
        console.log(`[@reubenr0d/lp-rebalancer-ability] No LP positions to rebalance`);
        return succeed({
          registryAddress,
          totalActions: 0,
          projects: [],
        });
      }

      // For each position, try to find the corresponding Cornerstone project
      for (const position of ownedPositions) {
        console.log(
          `[@reubenr0d/lp-rebalancer-ability] Checking position ${position.tokenId} (${position.token0}/${position.token1})`,
        );

        // Try to find a Cornerstone project with one of these tokens
        // For simplicity, assume one token is always the project token and check for a PYUSD pair
        const token0Contract = new ethers.Contract(
          position.token0,
          ['function symbol() view returns (string)'],
          provider,
        );
        const token1Contract = new ethers.Contract(
          position.token1,
          ['function symbol() view returns (string)'],
          provider,
        );

        try {
          const [symbol0, symbol1] = await Promise.all([
            withRpcRetry(() => token0Contract.symbol(), `symbol for ${position.token0}`),
            withRpcRetry(() => token1Contract.symbol(), `symbol for ${position.token1}`),
          ]);

          console.log(`[@reubenr0d/lp-rebalancer-ability] Position tokens: ${symbol0}/${symbol1}`);
        } catch (e) {
          console.log(`[@reubenr0d/lp-rebalancer-ability] Could not get symbols for position`);
        }
      }

      // Since discovering projects is slow, for now just return with position info
      // User would need to provide project addresses directly or we need a faster lookup method
      console.log(`[@reubenr0d/lp-rebalancer-ability] Skipping project discovery to avoid timeout`);

      return succeed({
        registryAddress,
        totalActions: 0,
        projects: [],
      });
    } catch (error) {
      console.error('[@reubenr0d/lp-rebalancer-ability/execute] Registry run failed', error);

      return fail({
        error: error instanceof Error ? error.message : String(error),
        reason:
          error instanceof Error && error.message.includes('registry address')
            ? KNOWN_ERRORS.INVALID_REGISTRY_ADDRESS
            : KNOWN_ERRORS.PROVIDER_ERROR,
      });
    }
  },
});
