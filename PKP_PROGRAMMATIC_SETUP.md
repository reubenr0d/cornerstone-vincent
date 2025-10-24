# PKP Programmatic Setup Guide

This guide explains how to set up PKP (Programmable Key Pair) and permissions programmatically following the Vincent pattern.

## Overview

The programmatic setup script (`setup-pkp-programmatic`) follows the proper Vincent pattern:

1. **Ensure Agent PKP exists** - Creates or uses existing PKP
2. **Add Lit Protocol permissions** - Permits the ability IPFS CID for the PKP
3. **Register new app** - Registers a new Vincent app with the ability
4. **Permit PKP to use app** - Grants the PKP permission to execute the app version

## Prerequisites

All required environment variables must be set in `.env.test-e2e`:

```bash
# Required
TEST_FUNDER_PRIVATE_KEY=<your-funder-private-key>
TEST_APP_MANAGER_PRIVATE_KEY=<your-app-manager-private-key>
TEST_APP_DELEGATEE_PRIVATE_KEY=<your-delegatee-private-key>
TEST_AGENT_WALLET_PKP_OWNER_PRIVATE_KEY=<your-pkp-owner-private-key>

# Your deployed ability IPFS CID
DEPLOYED_ABILITY_IPFS_CID=QmcSMxbPv13RxP23FtQbpwLfvBHDcBFbfH46HDkaHDdfET
```

## Running the Setup

Simply run:

```bash
pnpm setup-pkp-programmatic
```

The script will:

1. Load environment variables from `.env.test-e2e`
2. Create or use existing PKP owned by `TEST_AGENT_WALLET_PKP_OWNER_PRIVATE_KEY`
3. Add Lit Protocol permissions for your ability
4. Register a new Vincent app with your ability
5. Grant PKP permission to use the app
6. Save all details to `pkp-setup-result.json`

## Output

The script creates a `pkp-setup-result.json` file with:

```json
{
  "pkpInfo": {
    "ethAddress": "0x...",
    "tokenId": "..."
  },
  "appInfo": {
    "appId": 12345,
    "appVersion": 1
  },
  "abilityIpfsCid": "Qm...",
  "setupDate": "2025-10-24T..."
}
```

## Next Steps

After setup:

1. **Transfer your LP NFT** to the PKP address shown in the output
2. **Run the execution script**:
   ```bash
   pnpm execute-ability-with-pkp
   ```

## Differences from Old Setup Script

The old `setup-pkp-and-permissions` script:

- Tries to find existing apps by delegatee address
- May not properly register the app in Vincent registry
- Can fail with Vincent permission errors

The new `setup-pkp-programmatic` script:

- ✅ Follows the Vincent test suite pattern
- ✅ Always registers a new app properly
- ✅ Sets up all permissions in the correct order
- ✅ Uses existing helper functions from the codebase
- ✅ More reliable and maintainable

## Troubleshooting

### Environment Variable Errors

If you see errors about missing environment variables, ensure all required variables are set in `.env.test-e2e` and not commented out.

### Insufficient Funds

The script requires:

- `TEST_FUNDER_PRIVATE_KEY` wallet to have funds for minting PKP (if new)
- `TEST_APP_MANAGER_PRIVATE_KEY` wallet to have funds for registering app
- `TEST_AGENT_WALLET_PKP_OWNER_PRIVATE_KEY` wallet to have funds for permissions

### Using Existing PKP

If you want to use a specific existing PKP instead of auto-discovery/minting, set in `.env.test-e2e`:

```bash
TEST_PKP_TOKEN_ID=<your-pkp-token-id>
TEST_PKP_ETH_ADDRESS=<your-pkp-eth-address>
```

The script will validate that the PKP is owned by `TEST_AGENT_WALLET_PKP_OWNER_PRIVATE_KEY`.
