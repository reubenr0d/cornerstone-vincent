import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

// Ref: https://github.com/t3-oss/t3-env/pull/145
const booleanStrings = ['true', 'false', true, false, '1', '0', 'yes', 'no', 'y', 'n', 'on', 'off'];
// @ts-expect-error Currently not using any boolean env vars, but keeping this for the future
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const BooleanOrBooleanStringSchema = z
  .any()
  .refine((val) => booleanStrings.includes(val), { message: 'must be boolean' })
  .transform((val) => {
    if (typeof val === 'boolean') return val;
    if (typeof val === 'string') {
      const normalized = val.toLowerCase().trim();
      if (['true', 'yes', 'y', '1', 'on'].includes(normalized)) return true;
      if (['false', 'no', 'n', '0', 'off'].includes(normalized)) return false;
      throw new Error(`Invalid boolean string: "${val}"`);
    }
    throw new Error(`Expected boolean or boolean string, got: ${typeof val}`);
  });

export const getEnv = () => {
  try {
    return createEnv({
      emptyStringAsUndefined: true,
      runtimeEnv: process.env,
      server: {
        TEST_FUNDER_PRIVATE_KEY: z.string(),
        TEST_APP_MANAGER_PRIVATE_KEY: z.string(),
        TEST_APP_DELEGATEE_PRIVATE_KEY: z.string(),
        TEST_AGENT_WALLET_PKP_OWNER_PRIVATE_KEY: z.string(),
        // Optional: Use a specific pre-configured PKP instead of auto-discovering/minting
        TEST_PKP_TOKEN_ID: z.string().optional(),
        TEST_PKP_ETH_ADDRESS: z
          .string()
          .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address')
          .optional(),
        YELLOWSTONE_RPC_URL: z
          .string()
          .optional()
          .default('https://yellowstone-rpc.litprotocol.com/'),
        BASE_RPC_URL: z.string().optional().default('https://base.llamarpc.com'),
        TEST_REGISTRY_ADDRESS: z
          .string()
          .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address')
          .optional(),
        DEPLOYED_ABILITY_IPFS_CID: z.string().optional(),
        DEPLOYED_POLICY_IPFS_CID: z.string().optional(),
      },
    });
  } catch (e) {
    console.error(
      'Failed to load all required environment variables! Have you finished the `pnpm bootstrap` process that configures the repo?',
    );
    throw e;
  }
};
