import { createVincentPolicy } from '@lit-protocol/vincent-ability-sdk';
import { laUtils } from '@lit-protocol/vincent-scaffold-sdk';

import type { LitNamespace, EthersType } from '../Lit';

import { counterSignatures } from './abi/counterSignatures';
import { checkSendLimit, resetSendCounter } from './helpers/index';
import {
  commitAllowResultSchema,
  commitDenyResultSchema,
  commitParamsSchema,
  evalAllowResultSchema,
  evalDenyResultSchema,
  precheckAllowResultSchema,
  precheckDenyResultSchema,
  abilityParamsSchema,
  userParamsSchema,
} from './schemas';

declare const Lit: typeof LitNamespace;
declare const ethers: EthersType;

export const vincentPolicy = createVincentPolicy({
  packageName: '@reubenr0d/lp-rebalancer-policy' as const,

  abilityParamsSchema,
  userParamsSchema,
  commitParamsSchema,

  precheckAllowResultSchema,
  precheckDenyResultSchema,

  evalAllowResultSchema,
  evalDenyResultSchema,

  commitAllowResultSchema,
  commitDenyResultSchema,

  precheck: async (
    { abilityParams, userParams },
    { allow, deny, appId, delegation: { delegatorPkpInfo } },
  ) => {
    console.log('[@reubenr0d/lp-rebalancer-policy/precheck] 🔍 Policy precheck params:', {
      abilityParams,
      userParams,
      ethAddress: delegatorPkpInfo.ethAddress,
      appId,
    });

    // Only use what we actually need - no defaults in policy logic
    const { maxSends, timeWindowSeconds } = userParams;
    const { ethAddress } = delegatorPkpInfo;

    const limitCheck = await checkSendLimit(ethAddress, maxSends, timeWindowSeconds);

    if (!limitCheck.allowed) {
      const denyResult = {
        reason: `Send limit exceeded. Maximum ${maxSends} sends per ${timeWindowSeconds} seconds. Try again in ${
          limitCheck.secondsUntilReset
        } seconds.`,
        currentCount: limitCheck.currentCount,
        maxSends: maxSends,
        secondsUntilReset: limitCheck.secondsUntilReset || 0,
      };

      console.log('[@reubenr0d/lp-rebalancer-policy/precheck] 🚫 POLICY PRECHECK DENYING REQUEST:');
      console.log(
        '[@reubenr0d/lp-rebalancer-policy/precheck] 🚫 Deny result:',
        JSON.stringify(denyResult, null, 2),
      );
      console.log(
        '[@reubenr0d/lp-rebalancer-policy/precheck] 🚫 Current count:',
        limitCheck.currentCount,
      );
      console.log('[@reubenr0d/lp-rebalancer-policy/precheck] 🚫 Max sends:', maxSends);
      console.log(
        '[@reubenr0d/lp-rebalancer-policy/precheck] 🚫 Limit check result:',
        JSON.stringify(limitCheck, null, 2),
      );

      return deny(denyResult);
    }

    const allowResult = {
      maxSends,
      timeWindowSeconds,
      currentCount: limitCheck.currentCount,
      remainingSends: limitCheck.remainingSends,
    };

    console.log('[SendLimitPolicy/precheck] ✅ POLICY PRECHECK ALLOWING REQUEST:');
    console.log(
      '[SendLimitPolicy/precheck] ✅ Allow result:',
      JSON.stringify(allowResult, null, 2),
    );
    console.log('[SendLimitPolicy/precheck] ✅ Current count:', limitCheck.currentCount);
    console.log('[SendLimitPolicy/precheck] ✅ Max sends:', maxSends);
    console.log('[SendLimitPolicy/precheck] ✅ Remaining sends:', limitCheck.remainingSends);

    return allow(allowResult);
  },

  evaluate: async (
    { abilityParams, userParams },
    { allow, deny, delegation: { delegatorPkpInfo } },
  ) => {
    console.log('[@reubenr0d/lp-rebalancer-policy/evaluate] Evaluating send limit policy', {
      abilityParams,
      userParams,
    });

    const { maxSends, timeWindowSeconds } = userParams;
    const { ethAddress } = delegatorPkpInfo;

    const checkSendResponse = await Lit.Actions.runOnce(
      { waitForResponse: true, name: 'checkSendLimit' },
      async () => {
        try {
          const limitCheck = await checkSendLimit(ethAddress, maxSends, timeWindowSeconds);

          return JSON.stringify({
            status: 'success',
            ...limitCheck,
          });
        } catch (error) {
          return JSON.stringify({
            status: 'error',
            error: error instanceof Error ? error.message : String(error),
          });
        }
      },
    );

    const parsedResponse = JSON.parse(checkSendResponse);
    if (parsedResponse.status === 'error') {
      return deny({
        maxSends,
        timeWindowSeconds,
        reason: `Error checking send limit: ${parsedResponse.error} (evaluate)`,
        currentCount: 0,
        secondsUntilReset: 0,
      });
    }

    const { allowed, currentCount, remainingSends, secondsUntilReset } = parsedResponse;

    if (!allowed) {
      return deny({
        reason: `Send limit exceeded during evaluation. Maximum ${maxSends} sends per ${timeWindowSeconds} seconds. Try again in ${secondsUntilReset} seconds.`,
        currentCount,
        maxSends,
        timeWindowSeconds,
        secondsUntilReset: secondsUntilReset || 0,
      });
    }

    console.log('[@reubenr0d/lp-rebalancer-policy/evaluate] Evaluated send limit policy', {
      currentCount,
      maxSends,
      remainingSends,
    });

    return allow({
      currentCount,
      maxSends,
      remainingSends,
      timeWindowSeconds,
    });
  },

  commit: async (
    { currentCount, maxSends, timeWindowSeconds },
    { allow, appId, delegation: { delegatorPkpInfo } },
  ) => {
    const { ethAddress } = delegatorPkpInfo;

    console.log('[@reubenr0d/lp-rebalancer-policy/commit] 🚀 Committing counter update.');

    // Check if we need to reset the counter first
    const checkResponse = await checkSendLimit(ethAddress, maxSends, timeWindowSeconds);

    if (checkResponse.shouldReset) {
      console.log(
        `[@reubenr0d/lp-rebalancer-policy/commit] Resetting counter for ${ethAddress} due to time window expiration`,
      );
      await resetSendCounter(ethAddress, delegatorPkpInfo.publicKey);
    }

    console.log(
      `[@reubenr0d/lp-rebalancer-policy/commit] Recording send to contract for ${ethAddress} (appId: ${appId})`,
    );

    // Call contract directly without Lit.Actions.runOnce wrapper
    const txHash = await laUtils.transaction.handler.contractCall({
      provider: new ethers.providers.JsonRpcProvider(
        await Lit.Actions.getRpcUrl({ chain: 'yellowstone' }),
      ),
      pkpPublicKey: delegatorPkpInfo.publicKey,
      callerAddress: ethAddress,
      abi: [counterSignatures.methods.increment],
      contractAddress: counterSignatures.address,
      functionName: 'increment',
      args: [],
    });

    const newCount = currentCount + 1;
    const remainingSends = maxSends - newCount;

    console.log('[@reubenr0d/lp-rebalancer-policy/commit] Policy commit successful', {
      ethAddress,
      newCount,
      maxSends,
      remainingSends,
      txHash,
    });

    return allow({
      recorded: true,
      newCount,
      remainingSends: Math.max(0, remainingSends),
    });
  },
});
