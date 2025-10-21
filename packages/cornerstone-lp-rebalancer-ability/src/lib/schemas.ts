import { z } from 'zod';

const ethereumAddressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address');

export const KNOWN_ERRORS = {
  INVALID_REGISTRY_ADDRESS: 'INVALID_REGISTRY_ADDRESS',
  PROJECT_DISCOVERY_FAILED: 'PROJECT_DISCOVERY_FAILED',
  POSITION_DISCOVERY_FAILED: 'POSITION_DISCOVERY_FAILED',
  NAV_TARGET_ZERO: 'NAV_TARGET_ZERO',
  PROVIDER_ERROR: 'PROVIDER_ERROR',
  POLICY_ERROR: 'POLICY_ERROR',
} as const;

export const abilityParamsSchema = z.object({
  registryAddress: ethereumAddressSchema,
  rpcUrl: z
    .string()
    .url('Invalid RPC URL format')
    .optional()
    .default('https://yellowstone-rpc.litprotocol.com/'),
});

const projectReportSchema = z.object({
  projectAddress: ethereumAddressSchema,
  tokenAddress: ethereumAddressSchema,
  pyusdAddress: ethereumAddressSchema,
  poolAddress: ethereumAddressSchema.optional(),
  navPerShare: z.string(),
  targetPoolPrice: z.string(),
  currentPoolPrice: z.string(),
  poolLiquidity: z.string(),
  totalPositionLiquidity: z.string(),
  deviationBps: z.number(),
  direction: z.enum(['increase', 'decrease', 'none']),
  positionCount: z.number(),
  positionTokenIds: z.array(z.string()),
});

const actionSchema = z.object({
  projectAddress: ethereumAddressSchema,
  tokenId: z.string().optional(),
  name: z.string(),
  txHash: z.string(),
});

export const precheckSuccessSchema = z.object({
  registryAddress: ethereumAddressSchema,
  projectCount: z.number(),
  trackedPositions: z.number(),
  backfilledPositions: z.number(),
  projects: z.array(projectReportSchema),
});

export const precheckFailSchema = z.object({
  reason: z.union([
    z.literal(KNOWN_ERRORS['INVALID_REGISTRY_ADDRESS']),
    z.literal(KNOWN_ERRORS['PROJECT_DISCOVERY_FAILED']),
    z.literal(KNOWN_ERRORS['POSITION_DISCOVERY_FAILED']),
    z.literal(KNOWN_ERRORS['NAV_TARGET_ZERO']),
    z.literal(KNOWN_ERRORS['PROVIDER_ERROR']),
    z.literal(KNOWN_ERRORS['POLICY_ERROR']),
  ]),
  error: z.string(),
});

export const executeSuccessSchema = z.object({
  registryAddress: ethereumAddressSchema,
  totalActions: z.number(),
  backfilledPositions: z.number(),
  projects: z.array(projectReportSchema.extend({ actions: z.array(actionSchema).default([]) })),
});

export const executeFailSchema = z.object({
  error: z.string(),
  reason: z
    .union([
      z.literal(KNOWN_ERRORS['INVALID_REGISTRY_ADDRESS']),
      z.literal(KNOWN_ERRORS['PROJECT_DISCOVERY_FAILED']),
      z.literal(KNOWN_ERRORS['POSITION_DISCOVERY_FAILED']),
      z.literal(KNOWN_ERRORS['NAV_TARGET_ZERO']),
      z.literal(KNOWN_ERRORS['PROVIDER_ERROR']),
      z.literal(KNOWN_ERRORS['POLICY_ERROR']),
    ])
    .optional(),
});

export type AbilityParams = z.infer<typeof abilityParamsSchema>;
export type ProjectReport = z.infer<typeof projectReportSchema>;
export type PrecheckSuccess = z.infer<typeof precheckSuccessSchema>;
export type PrecheckFail = z.infer<typeof precheckFailSchema>;
export type ExecuteSuccess = z.infer<typeof executeSuccessSchema>;
export type ExecuteFail = z.infer<typeof executeFailSchema>;
