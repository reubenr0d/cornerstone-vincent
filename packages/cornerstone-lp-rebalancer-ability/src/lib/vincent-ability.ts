import type { Contract, Event, EventFilter } from 'ethers';

import { ethers as nodeEthers } from 'ethers';

import {
  createVincentAbility,
  supportedPoliciesForAbility,
} from '@lit-protocol/vincent-ability-sdk';
import { laUtils } from '@lit-protocol/vincent-scaffold-sdk';

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
const DEFAULT_DEVIATION_THRESHOLD_BPS = 150; // 1.5%
const DEFAULT_REBALANCE_LIQUIDITY_BPS = 2_500; // 25%
const HISTORY_LOOKBACK_BLOCKS = 5_000;
const MAX_EVENT_BLOCK_SPAN = 10;
const ENABLE_BACKFILL = false;
const RPC_MAX_RETRIES = 3;
const RPC_RETRY_BASE_DELAY_MS = 1_000;

const WEI_PER_ETHER = ethers.constants.WeiPerEther;
const Q192 = ethers.BigNumber.from(2).pow(192);
const MAX_UINT128 = ethers.BigNumber.from(2).pow(128).sub(1);

type JsonRpcProvider = InstanceType<EthersType['providers']['JsonRpcProvider']>;
type BigNumber = ReturnType<typeof ethers.BigNumber.from>;
type Direction = 'increase' | 'decrease' | 'none';

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
};

const PROJECT_REGISTRY_ABI = [
  'event ProjectCreated(address indexed project, address indexed token, address indexed creator)',
  'function projectCount() external view returns (uint256)',
] as const;

const CORNERSTONE_PROJECT_ABI = [
  'function token() external view returns (address)',
  'function pyusd() external view returns (address)',
  'function getNAVPerShare() external view returns (uint256)',
  'function getTargetPoolPrice() external view returns (uint256)',
  'function accrueInterest() external returns (uint256)',
] as const;

const UNISWAP_V3_FACTORY_ABI = [
  'function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)',
] as const;

const UNISWAP_V3_POOL_ABI = [
  'function slot0() external view returns (uint160 sqrtPriceX96,int24 tick,uint16 observationIndex,uint16 observationCardinality,uint16 observationCardinalityNext,uint8 feeProtocol,bool unlocked)',
  'function liquidity() external view returns (uint128)',
] as const;

const NONFUNGIBLE_POSITION_MANAGER_ABI = [
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
  'function balanceOf(address owner) external view returns (uint256)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) external view returns (uint256)',
  'function positions(uint256 tokenId) external view returns (uint96 nonce,address operator,address token0,address token1,uint24 fee,int24 tickLower,int24 tickUpper,uint128 liquidity,uint256 feeGrowthInside0LastX128,uint256 feeGrowthInside1LastX128,uint128 tokensOwed0,uint128 tokensOwed1)',
  'function decreaseLiquidity((uint256 tokenId,uint128 liquidity,uint256 amount0Min,uint256 amount1Min,uint256 deadline)) external payable returns (uint256 amount0,uint256 amount1)',
  'function increaseLiquidity((uint256 tokenId,uint256 amount0Desired,uint256 amount1Desired,uint256 amount0Min,uint256 amount1Min,uint256 deadline)) external payable returns (uint128 liquidity,uint256 amount0,uint256 amount1)',
  'function collect((uint256 tokenId,address recipient,uint128 amount0Max,uint128 amount1Max)) external payable returns (uint256 amount0,uint256 amount1)',
] as const;

const ERC20_ABI = [
  'function balanceOf(address owner) external view returns (uint256)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function approve(address spender, uint256 amount) external returns (bool)',
] as const;

type ProjectInfo = {
  projectAddress: string;
  tokenAddress: string;
  pyusdAddress: string;
};

type ProjectMetrics = {
  project: ProjectInfo;
  poolAddress?: string;
  navPerShare: BigNumber;
  targetPoolPrice: BigNumber;
  currentPoolPrice: BigNumber;
  poolLiquidity: BigNumber;
  deviationBps: BigNumber;
  direction: Direction;
  positions: PositionInfo[];
};

type PositionInfo = {
  tokenId: string;
  token0: string;
  token1: string;
  fee: number;
  liquidity: BigNumber;
  tickLower: number;
  tickUpper: number;
};

type ActionRecord = {
  projectAddress: string;
  tokenId?: string;
  name: string;
  txHash: string;
};

const computePoolPrice = (sqrtPriceX96: BigNumber): BigNumber => {
  const priceX192 = sqrtPriceX96.mul(sqrtPriceX96);
  return priceX192.mul(WEI_PER_ETHER).div(Q192);
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

const calculateDeviation = (
  currentPrice: BigNumber,
  targetPrice: BigNumber,
): { deviation: BigNumber; deviationBps: BigNumber; direction: Direction } => {
  if (targetPrice.isZero()) {
    return {
      deviation: ethers.BigNumber.from(0),
      deviationBps: ethers.BigNumber.from(0),
      direction: 'none',
    };
  }

  if (currentPrice.eq(targetPrice)) {
    return {
      deviation: ethers.BigNumber.from(0),
      deviationBps: ethers.BigNumber.from(0),
      direction: 'none',
    };
  }

  const direction: Direction = currentPrice.gt(targetPrice) ? 'decrease' : 'increase';
  const deviation = currentPrice.gt(targetPrice)
    ? currentPrice.sub(targetPrice)
    : targetPrice.sub(currentPrice);
  const deviationBps = deviation.mul(10_000).div(targetPrice);

  return { deviation, deviationBps, direction };
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

const fetchProjectCreationEvents = async (provider: JsonRpcProvider, registry: Contract) => {
  const latestBlock = (await withRpcRetry(
    () => provider.getBlockNumber(),
    'project discovery: getBlockNumber',
  )) as number;
  const projectCountBn = (await withRpcRetry(
    () => registry.projectCount(),
    'project discovery: projectCount',
  )) as BigNumber;
  const totalProjects = projectCountBn.toNumber();

  if (totalProjects === 0) {
    return [];
  }

  const filter = registry.filters.ProjectCreated();
  const events: Event[] = [];
  const seenProjects = new Set<string>();

  let currentEndBlock = latestBlock;

  while (currentEndBlock >= 0 && seenProjects.size < totalProjects) {
    const currentStartBlock = Math.max(0, currentEndBlock - MAX_EVENT_BLOCK_SPAN + 1);
    const batch = await withRpcRetry(
      () => registry.queryFilter(filter, currentStartBlock, currentEndBlock),
      `project discovery: queryFilter [${currentStartBlock}, ${currentEndBlock}]`,
    );

    for (const event of batch) {
      const args = event.args;
      if (!args) {
        continue;
      }

      const projectAddress = (args[0] ?? args.project) as string | undefined;
      if (!projectAddress) {
        continue;
      }

      const normalized = projectAddress.toLowerCase();
      if (!seenProjects.has(normalized)) {
        seenProjects.add(normalized);
        events.push(event);
      }
    }

    currentEndBlock = currentStartBlock - 1;
  }

  events.sort((a, b) => a.blockNumber - b.blockNumber);

  return events;
};

const discoverProjects = async (
  provider: JsonRpcProvider,
  registryAddress: string,
): Promise<ProjectInfo[]> => {
  const registry = new ethers.Contract(registryAddress, PROJECT_REGISTRY_ABI, provider);
  const events = await fetchProjectCreationEvents(provider, registry);

  const projectsMap = new Map<string, ProjectInfo>();

  for (const event of events) {
    const projectAddress = event.args?.project;
    const tokenAddress = event.args?.token;
    if (!projectAddress || !tokenAddress) {
      continue;
    }

    if (projectsMap.has(projectAddress)) {
      continue;
    }

    const projectContract = new ethers.Contract(projectAddress, CORNERSTONE_PROJECT_ABI, provider);

    const pyusdAddress = (await withRpcRetry(
      () => projectContract.pyusd(),
      'project discovery: pyusd',
    )) as string;

    projectsMap.set(projectAddress, {
      projectAddress,
      tokenAddress,
      pyusdAddress,
    });
  }

  return Array.from(projectsMap.values());
};

const fetchProjectMetrics = async (
  provider: JsonRpcProvider,
  project: ProjectInfo,
  config: NetworkConfig,
): Promise<ProjectMetrics> => {
  const projectContract = new ethers.Contract(
    project.projectAddress,
    CORNERSTONE_PROJECT_ABI,
    provider,
  );
  const factory = new ethers.Contract(config.uniswapFactory, UNISWAP_V3_FACTORY_ABI, provider);

  const [navPerShareRaw, targetPoolPriceRaw, poolAddressRaw] = await Promise.all([
    withRpcRetry(() => projectContract.getNAVPerShare(), 'metrics: getNAVPerShare'),
    withRpcRetry(() => projectContract.getTargetPoolPrice(), 'metrics: getTargetPoolPrice'),
    withRpcRetry(
      () => factory.getPool(project.tokenAddress, project.pyusdAddress, 3_000),
      'metrics: getPool',
    ),
  ]);
  const navPerShare = ethers.BigNumber.from(navPerShareRaw);
  const targetPoolPrice = ethers.BigNumber.from(targetPoolPriceRaw);
  const poolAddress = (
    typeof poolAddressRaw === 'string' ? poolAddressRaw : String(poolAddressRaw || '0x')
  ) as string;

  if (targetPoolPrice.isZero()) {
    throw new Error('Target pool price returned 0 from CornerstoneProject');
  }

  let currentPoolPrice = ethers.BigNumber.from(0);
  let poolLiquidity = ethers.BigNumber.from(0);

  if (poolAddress && poolAddress !== ethers.constants.AddressZero) {
    const poolContract = new ethers.Contract(poolAddress, UNISWAP_V3_POOL_ABI, provider);
    const slot0Data = (await withRpcRetry(() => poolContract.slot0(), 'metrics: pool slot0')) as [
      BigNumber,
      number,
      number,
      number,
      number,
      number,
      boolean,
    ];
    currentPoolPrice = computePoolPrice(slot0Data[0]);
    poolLiquidity = ethers.BigNumber.from(
      await withRpcRetry(() => poolContract.liquidity(), 'metrics: pool liquidity'),
    );
  }

  const { deviationBps, direction } = calculateDeviation(currentPoolPrice, targetPoolPrice);

  return {
    project,
    poolAddress:
      poolAddress && poolAddress !== ethers.constants.AddressZero ? poolAddress : undefined,
    navPerShare,
    targetPoolPrice,
    currentPoolPrice,
    poolLiquidity,
    deviationBps,
    direction,
    positions: [],
  };
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

const backfillHistoricalTokenIds = async (
  provider: JsonRpcProvider,
  config: NetworkConfig,
  ownerAddress: string,
): Promise<Set<string>> => {
  const positionManager = new ethers.Contract(
    config.positionManager,
    NONFUNGIBLE_POSITION_MANAGER_ABI,
    provider,
  );
  const latestBlock = (await withRpcRetry(
    () => provider.getBlockNumber(),
    'backfill: getBlockNumber',
  )) as number;
  const fromBlock = Math.max(0, latestBlock - HISTORY_LOOKBACK_BLOCKS);

  const incomingFilter = positionManager.filters.Transfer(null, ownerAddress);
  const outgoingFilter = positionManager.filters.Transfer(ownerAddress, null);

  const queryTransfers = async (filter: EventFilter): Promise<Event[]> => {
    const collected: Event[] = [];
    let currentEndBlock = latestBlock;

    while (currentEndBlock >= fromBlock) {
      const currentStartBlock = Math.max(fromBlock, currentEndBlock - MAX_EVENT_BLOCK_SPAN + 1);
      const batch = await withRpcRetry(
        () => positionManager.queryFilter(filter, currentStartBlock, currentEndBlock),
        `backfill: queryFilter [${currentStartBlock}, ${currentEndBlock}]`,
      );
      collected.push(...batch);
      currentEndBlock = currentStartBlock - 1;
    }

    return collected;
  };

  const [incomingEvents, outgoingEvents] = await Promise.all([
    queryTransfers(incomingFilter),
    queryTransfers(outgoingFilter),
  ]);

  const tokenIds = new Set<string>();

  for (const event of incomingEvents) {
    const tokenId = event.args?.tokenId;
    if (tokenId) {
      tokenIds.add(tokenId.toString());
    }
  }

  for (const event of outgoingEvents) {
    const tokenId = event.args?.tokenId;
    if (tokenId) {
      tokenIds.add(tokenId.toString());
    }
  }

  return tokenIds;
};

const attachPositionsToProjects = (metrics: ProjectMetrics[], positions: PositionInfo[]): void => {
  const projectTokenPairs = new Map<string, ProjectMetrics>();

  for (const metric of metrics) {
    const keyTokens = [
      metric.project.tokenAddress.toLowerCase(),
      metric.project.pyusdAddress.toLowerCase(),
    ]
      .sort()
      .join(':');
    projectTokenPairs.set(keyTokens, metric);
  }

  for (const position of positions) {
    const tokenPair = [position.token0.toLowerCase(), position.token1.toLowerCase()]
      .sort()
      .join(':');
    const metric = projectTokenPairs.get(tokenPair);
    if (metric) {
      metric.positions.push(position);
    }
  }
};

const summarizeMetric = (metric: ProjectMetrics) => ({
  projectAddress: metric.project.projectAddress,
  tokenAddress: metric.project.tokenAddress,
  pyusdAddress: metric.project.pyusdAddress,
  poolAddress: metric.poolAddress,
  navPerShare: metric.navPerShare.toString(),
  targetPoolPrice: metric.targetPoolPrice.toString(),
  currentPoolPrice: metric.currentPoolPrice.toString(),
  poolLiquidity: metric.poolLiquidity.toString(),
  totalPositionLiquidity: metric.positions
    .reduce((acc, position) => acc.add(position.liquidity), ethers.BigNumber.from(0))
    .toString(),
  deviationBps: Number(metric.deviationBps.toString()),
  direction: metric.direction,
  positionCount: metric.positions.length,
  positionTokenIds: metric.positions.map((position) => position.tokenId),
});

const shouldRebalance = (metric: ProjectMetrics): boolean =>
  metric.direction !== 'none' &&
  metric.deviationBps.gte(ethers.BigNumber.from(DEFAULT_DEVIATION_THRESHOLD_BPS));

export const vincentAbility = createVincentAbility({
  packageName: '@reubenr0d/lp-rebalancer-ability' as const,
  abilityParamsSchema,
  abilityDescription:
    'Monitor Cornerstone registry projects and manage Uniswap V3 LP positions held by the Vincent PKP',
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

      const projects = await discoverProjects(provider, registryAddress);
      const metrics = await Promise.all(
        projects.map((project) => fetchProjectMetrics(provider, project, networkConfig)),
      );

      const pkpAddress = delegation?.delegatorPkpInfo?.ethAddress;
      let ownedPositions: PositionInfo[] = [];
      let backfilledPositions = new Set<string>();

      if (pkpAddress) {
        ownedPositions = await fetchOwnedPositions(provider, networkConfig, pkpAddress);
        if (ENABLE_BACKFILL) {
          backfilledPositions = await backfillHistoricalTokenIds(
            provider,
            networkConfig,
            pkpAddress,
          );
        }
      }

      attachPositionsToProjects(metrics, ownedPositions);

      return succeed({
        registryAddress,
        projectCount: metrics.length,
        trackedPositions: ownedPositions.length,
        backfilledPositions: backfilledPositions.size,
        projects: metrics.map(summarizeMetric),
      });
    } catch (error) {
      console.error(
        '[@reubenr0d/lp-rebalancer-ability/precheck] Failed to evaluate registry projects',
        error,
      );

      return fail({
        reason:
          error instanceof Error && error.message.includes('Target pool price')
            ? KNOWN_ERRORS.NAV_TARGET_ZERO
            : KNOWN_ERRORS.PROVIDER_ERROR,
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

      const projects = await discoverProjects(provider, registryAddress);
      const metrics = await Promise.all(
        projects.map((project) => fetchProjectMetrics(provider, project, networkConfig)),
      );

      const pkpPublicKey = delegation?.delegatorPkpInfo?.publicKey;
      const pkpAddress = delegation?.delegatorPkpInfo?.ethAddress;

      if (!pkpPublicKey || !pkpAddress) {
        throw new Error('Delegation context missing PKP information');
      }

      const ownedPositions = await fetchOwnedPositions(provider, networkConfig, pkpAddress);
      const backfilledTokenIds = ENABLE_BACKFILL
        ? await backfillHistoricalTokenIds(provider, networkConfig, pkpAddress)
        : new Set<string>();

      attachPositionsToProjects(metrics, ownedPositions);

      const actions: ActionRecord[] = [];

      const recordAction = (action: ActionRecord) => {
        actions.push(action);
      };

      for (const metric of metrics) {
        if (!shouldRebalance(metric)) {
          continue;
        }

        const projectAddress = metric.project.projectAddress;

        const accrueTx = await laUtils.transaction.handler.contractCall({
          provider,
          pkpPublicKey,
          callerAddress: pkpAddress,
          abi: Array.from(CORNERSTONE_PROJECT_ABI),
          contractAddress: projectAddress,
          functionName: 'accrueInterest',
          args: [],
        });

        recordAction({
          projectAddress,
          name: 'accrueInterest',
          txHash: accrueTx,
        });

        for (const position of metric.positions) {
          if (position.liquidity.isZero()) {
            continue;
          }

          const liquidityToUse = position.liquidity
            .mul(DEFAULT_REBALANCE_LIQUIDITY_BPS)
            .div(10_000);

          if (liquidityToUse.isZero() && metric.direction === 'decrease') {
            continue;
          }

          if (metric.direction === 'decrease') {
            const decreaseTxHash = await laUtils.transaction.handler.contractCall({
              provider,
              pkpPublicKey,
              callerAddress: pkpAddress,
              abi: Array.from(NONFUNGIBLE_POSITION_MANAGER_ABI),
              contractAddress: networkConfig.positionManager,
              functionName: 'decreaseLiquidity',
              args: [
                {
                  tokenId: position.tokenId,
                  liquidity: liquidityToUse.isZero()
                    ? position.liquidity.toString()
                    : liquidityToUse.toString(),
                  amount0Min: 0,
                  amount1Min: 0,
                  deadline: Math.floor(Date.now() / 1000) + 900,
                },
              ],
            });

            recordAction({
              projectAddress,
              tokenId: position.tokenId,
              name: 'decreaseLiquidity',
              txHash: decreaseTxHash,
            });

            const collectTxHash = await laUtils.transaction.handler.contractCall({
              provider,
              pkpPublicKey,
              callerAddress: pkpAddress,
              abi: Array.from(NONFUNGIBLE_POSITION_MANAGER_ABI),
              contractAddress: networkConfig.positionManager,
              functionName: 'collect',
              args: [
                {
                  tokenId: position.tokenId,
                  recipient: pkpAddress,
                  amount0Max: MAX_UINT128.toString(),
                  amount1Max: MAX_UINT128.toString(),
                },
              ],
            });

            recordAction({
              projectAddress,
              tokenId: position.tokenId,
              name: 'collect',
              txHash: collectTxHash,
            });
          } else if (metric.direction === 'increase') {
            const token0Contract = new ethers.Contract(position.token0, ERC20_ABI, provider);
            const token1Contract = new ethers.Contract(position.token1, ERC20_ABI, provider);

            const [balance0, balance1, allowance0, allowance1] = await Promise.all([
              token0Contract.balanceOf(pkpAddress),
              token1Contract.balanceOf(pkpAddress),
              token0Contract.allowance(pkpAddress, networkConfig.positionManager),
              token1Contract.allowance(pkpAddress, networkConfig.positionManager),
            ]);

            if (balance0.isZero() && balance1.isZero()) {
              continue;
            }

            if (balance0.gt(0) && allowance0.lt(balance0)) {
              const approve0TxHash = await laUtils.transaction.handler.contractCall({
                provider,
                pkpPublicKey,
                callerAddress: pkpAddress,
                abi: Array.from(ERC20_ABI),
                contractAddress: position.token0,
                functionName: 'approve',
                args: [networkConfig.positionManager, balance0.toString()],
              });

              recordAction({
                projectAddress,
                tokenId: position.tokenId,
                name: 'approveToken0',
                txHash: approve0TxHash,
              });
            }

            if (balance1.gt(0) && allowance1.lt(balance1)) {
              const approve1TxHash = await laUtils.transaction.handler.contractCall({
                provider,
                pkpPublicKey,
                callerAddress: pkpAddress,
                abi: Array.from(ERC20_ABI),
                contractAddress: position.token1,
                functionName: 'approve',
                args: [networkConfig.positionManager, balance1.toString()],
              });

              recordAction({
                projectAddress,
                tokenId: position.tokenId,
                name: 'approveToken1',
                txHash: approve1TxHash,
              });
            }

            const increaseTxHash = await laUtils.transaction.handler.contractCall({
              provider,
              pkpPublicKey,
              callerAddress: pkpAddress,
              abi: Array.from(NONFUNGIBLE_POSITION_MANAGER_ABI),
              contractAddress: networkConfig.positionManager,
              functionName: 'increaseLiquidity',
              args: [
                {
                  tokenId: position.tokenId,
                  amount0Desired: balance0.toString(),
                  amount1Desired: balance1.toString(),
                  amount0Min: 0,
                  amount1Min: 0,
                  deadline: Math.floor(Date.now() / 1000) + 900,
                },
              ],
            });

            recordAction({
              projectAddress,
              tokenId: position.tokenId,
              name: 'increaseLiquidity',
              txHash: increaseTxHash,
            });
          }
        }
      }

      const metricsSummary = metrics.map((metric) => ({
        ...summarizeMetric(metric),
        actions: actions
          .filter((action) => action.projectAddress === metric.project.projectAddress)
          .map((action) => ({
            projectAddress: action.projectAddress,
            tokenId: action.tokenId,
            name: action.name,
            txHash: action.txHash,
          })),
      }));

      return succeed({
        registryAddress,
        totalActions: actions.length,
        backfilledPositions: backfilledTokenIds.size,
        projects: metricsSummary,
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
