import { vincentPolicyHandler } from '@lit-protocol/vincent-ability-sdk';

import type { abilityParamsSchema } from './schemas';

import { vincentPolicy } from './vincent-policy';

declare const context: {
  abilityIpfsCid: string;
  delegatorPkpEthAddress: string;
};

declare const abilityParams: typeof abilityParamsSchema;

(async () => {
  return await vincentPolicyHandler({
    vincentPolicy: vincentPolicy,
    context,
    abilityParams,
  });
})();
