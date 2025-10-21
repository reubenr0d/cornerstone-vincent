import { z } from 'zod';

export const KNOWN_ERRORS = {
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  INVALID_AMOUNT: 'INVALID_AMOUNT', // Here for example purposes
} as const;

/**
 * Tool parameters schema - defines the input parameters for the LP rebalancer tool
 */
export const abilityParamsSchema = z.object({
  to: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address'),
  amount: z
    .string()
    .regex(/^\d*\.?\d+$/, 'Invalid amount format')
    .refine((val) => parseFloat(val) > 0, 'Amount must be greater than 0'),
  rpcUrl: z
    .string()
    .url('Invalid RPC URL format')
    .optional()
    .default('https://yellowstone-rpc.litprotocol.com/'),
});

/**
 * Precheck success result schema
 */
export const precheckSuccessSchema = z.object({
  availableBalance: z.string(),
});

/**
 * Precheck failure result schema
 */
export const precheckFailSchema = z.object({
  reason: z.union([
    z.literal(KNOWN_ERRORS['INSUFFICIENT_BALANCE']),
    z.literal(KNOWN_ERRORS['INVALID_AMOUNT']), // Here for schema example purposes
  ]),
  error: z.string(),
});

/**
 * Execute success result schema
 */
export const executeSuccessSchema = z.object({
  txHash: z.string(),
  to: z.string(),
  amount: z.string(),
  timestamp: z.number(),
});

/**
 * Execute failure result schema
 */
export const executeFailSchema = z.object({
  error: z.string(),
});

// Type exports
export type AbilityParams = z.infer<typeof abilityParamsSchema>;
export type PrecheckSuccess = z.infer<typeof precheckSuccessSchema>;
export type PrecheckFail = z.infer<typeof precheckFailSchema>;
export type ExecuteSuccess = z.infer<typeof executeSuccessSchema>;
export type ExecuteFail = z.infer<typeof executeFailSchema>;
