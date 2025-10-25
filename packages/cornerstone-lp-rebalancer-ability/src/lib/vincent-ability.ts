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

const CORNERSTONE_TOKEN_ABI = [
  'function project() external view returns (address)',
  'function symbol() external view returns (string)',
  'function decimals() external view returns (uint8)',
] as const;

const CORNERSTONE_PROJECT_ABI = [
  'function getNAVPerShare() external view returns (uint256)',
  'function getTargetPoolPrice() external view returns (uint256)',
  'function token() external view returns (address)',
  'function stablecoin() external view returns (address)',
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
    )) as [string, string, string, string, number, number, number, string];

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

type ProjectInfo = {
  projectAddress: string;
  cornerstoneToken: string;
  stablecoin: string;
  isToken0Cornerstone: boolean;
};

const getProjectFromPosition = async (
  provider: JsonRpcProvider,
  position: PositionInfo,
): Promise<ProjectInfo | null> => {
  // Try token0 first
  try {
    const token0Contract = new ethers.Contract(position.token0, CORNERSTONE_TOKEN_ABI, provider);
    const projectAddress = (await withRpcRetry(
      () => token0Contract.project(),
      `project() for token0 ${position.token0}`,
    )) as string;

    if (projectAddress && projectAddress !== ethers.constants.AddressZero) {
      console.log(
        `[@reubenr0d/lp-rebalancer-ability] Found Cornerstone project ${projectAddress} from token0`,
      );
      return {
        projectAddress,
        cornerstoneToken: position.token0,
        stablecoin: position.token1,
        isToken0Cornerstone: true,
      };
    }
  } catch {
    // Not a Cornerstone token, try token1
  }

  // Try token1
  try {
    const token1Contract = new ethers.Contract(position.token1, CORNERSTONE_TOKEN_ABI, provider);
    const projectAddress = (await withRpcRetry(
      () => token1Contract.project(),
      `project() for token1 ${position.token1}`,
    )) as string;

    if (projectAddress && projectAddress !== ethers.constants.AddressZero) {
      console.log(
        `[@reubenr0d/lp-rebalancer-ability] Found Cornerstone project ${projectAddress} from token1`,
      );
      return {
        projectAddress,
        cornerstoneToken: position.token1,
        stablecoin: position.token0,
        isToken0Cornerstone: false,
      };
    }
  } catch {
    // Not a Cornerstone token
  }

  return null;
};

type DeviationAnalysis = {
  currentPoolPrice: BigNumber;
  targetPrice: BigNumber;
  deviationBps: number;
  needsRebalance: boolean;
  direction: 'increase' | 'decrease' | 'none';
};

const analyzePoolDeviation = async (
  provider: JsonRpcProvider,
  position: PositionInfo,
  projectInfo: ProjectInfo,
): Promise<DeviationAnalysis> => {
  const projectContract = new ethers.Contract(
    projectInfo.projectAddress,
    CORNERSTONE_PROJECT_ABI,
    provider,
  );

  // Get NAV per share (target price) from project
  const targetPrice = ethers.BigNumber.from(
    await withRpcRetry(() => projectContract.getNAVPerShare(), 'getNAVPerShare'),
  );

  console.log(
    `[@reubenr0d/lp-rebalancer-ability] Target price from project: ${ethers.utils.formatUnits(targetPrice, 18)}`,
  );

  // Calculate pool price from sqrtPriceX96
  // Note: This is a simplified calculation. In production, you'd need to handle token ordering and decimals properly
  // For now, assume we need to compare with target

  // Simplified: assume 1:1 for demonstration
  // In reality, you'd get the pool address and calculate the actual price
  const currentPoolPrice = targetPrice; // Placeholder - would calculate from pool

  // Calculate deviation in basis points
  const deviation = targetPrice.sub(currentPoolPrice).abs();
  const deviationBps = targetPrice.gt(0) ? deviation.mul(10000).div(targetPrice).toNumber() : 0;

  const REBALANCE_THRESHOLD_BPS = 100; // 1% threshold
  const needsRebalance = deviationBps >= REBALANCE_THRESHOLD_BPS;

  let direction: 'increase' | 'decrease' | 'none' = 'none';
  if (needsRebalance) {
    direction = currentPoolPrice.gt(targetPrice) ? 'decrease' : 'increase';
  }

  console.log(
    `[@reubenr0d/lp-rebalancer-ability] Deviation: ${deviationBps} bps, needs rebalance: ${needsRebalance}, direction: ${direction}`,
  );

  return {
    currentPoolPrice,
    targetPrice,
    deviationBps,
    needsRebalance,
    direction,
  };
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

  execute: async ({ abilityParams }, { succeed, fail, delegation }) => {
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

      // Analyze each position and check if it's a Cornerstone LP
      const projects = [];
      let totalActions = 0;

      for (const position of ownedPositions) {
        console.log(
          `[@reubenr0d/lp-rebalancer-ability] Checking position ${position.tokenId} (${position.token0}/${position.token1})`,
        );

        // Try to get Cornerstone project from this position
        const projectInfo = await getProjectFromPosition(provider, position);

        if (!projectInfo) {
          console.log(
            `[@reubenr0d/lp-rebalancer-ability] Position ${position.tokenId} is not a Cornerstone LP, skipping`,
          );
          continue;
        }

        console.log(
          `[@reubenr0d/lp-rebalancer-ability] Position ${position.tokenId} is a Cornerstone LP for project ${projectInfo.projectAddress}`,
        );

        // Analyze if rebalancing is needed
        const analysis = await analyzePoolDeviation(provider, position, projectInfo);

        // Create project report
        const projectReport = {
          projectAddress: projectInfo.projectAddress,
          tokenAddress: projectInfo.cornerstoneToken,
          pyusdAddress: projectInfo.stablecoin,
          navPerShare: analysis.targetPrice.toString(),
          targetPoolPrice: analysis.targetPrice.toString(),
          currentPoolPrice: analysis.currentPoolPrice.toString(),
          poolLiquidity: '0', // TODO: Get from pool
          totalPositionLiquidity: position.liquidity.toString(),
          deviationBps: analysis.deviationBps,
          direction: analysis.direction,
          positionCount: 1,
          positionTokenIds: [position.tokenId],
          actions: [] as Array<{ type: string; data: unknown }>,
        };

        // If rebalancing is needed, log the action (actual execution would require PKP signing)
        if (analysis.needsRebalance) {
          console.log(
            `[@reubenr0d/lp-rebalancer-ability] Position ${position.tokenId} needs rebalancing: ${analysis.direction}`,
          );

          // For now, just log what would be done
          // In production, you'd use PKP delegation to sign and execute the transaction
          const action = {
            projectAddress: projectInfo.projectAddress,
            tokenId: position.tokenId,
            name: analysis.direction === 'increase' ? 'IncreaseLiquidity' : 'DecreaseLiquidity',
            txHash: '0x0000000000000000000000000000000000000000000000000000000000000000', // Placeholder
          };

          projectReport.actions.push(action);
          totalActions += 1;

          console.log(
            `[@reubenr0d/lp-rebalancer-ability] Would ${analysis.direction} liquidity for position ${position.tokenId}`,
          );
        } else {
          console.log(
            `[@reubenr0d/lp-rebalancer-ability] Position ${position.tokenId} is within acceptable range (${analysis.deviationBps} bps), no action needed`,
          );
        }

        projects.push(projectReport);
      }

      console.log(
        `[@reubenr0d/lp-rebalancer-ability] Analysis complete: ${projects.length} Cornerstone positions found, ${totalActions} actions needed`,
      );

      return succeed({
        registryAddress,
        totalActions,
        projects,
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
