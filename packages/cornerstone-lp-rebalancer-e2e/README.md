# LP Rebalancer E2E Tests

This package contains end-to-end tests for the LP Rebalancer Vincent Ability.

## Overview

The LP Rebalancer ability monitors Cornerstone registry projects and manages Uniswap V3 LP positions held by a Vincent PKP. The e2e tests verify that:

1. The ability can successfully execute and discover projects from a Cornerstone registry
2. Integration between the ability and Vincent infrastructure works correctly
3. The ability can handle both successful and failed scenarios gracefully

## Test Configuration

### Required Environment Variables

The tests require several environment variables to be set in `.env.test-e2e`:

- `TEST_FUNDER_PRIVATE_KEY` - Private key for the funder wallet (must have testLPX on Yellowstone)
- `TEST_APP_MANAGER_PRIVATE_KEY` - Private key for the app manager wallet
- `TEST_APP_DELEGATEE_PRIVATE_KEY` - Private key for the app delegatee wallet
- `TEST_AGENT_WALLET_PKP_OWNER_PRIVATE_KEY` - Private key for the agent wallet PKP owner

These are automatically generated during the `pnpm bootstrap` process.

### Optional Environment Variables

- `TEST_PKP_TOKEN_ID` - Token ID of a specific PKP to use for testing
  - If provided along with `TEST_PKP_ETH_ADDRESS`, the test will use this PKP instead of auto-discovering one
  - Useful for testing with a PKP that already has LP positions set up
- `TEST_PKP_ETH_ADDRESS` - Ethereum address of the specific PKP to use
  - Must be provided together with `TEST_PKP_TOKEN_ID`
  - Example: `0xaB0D5922AEB47d6E028E46a66752F054d639bAeb`
- `TEST_REGISTRY_ADDRESS` - The address of a deployed Cornerstone registry contract to test against
  - If not provided, defaults to a placeholder address for testing
  - For real testing, deploy a Cornerstone registry and set this address
- `YELLOWSTONE_RPC_URL` - RPC URL for the Yellowstone testnet
  - Default: `https://yellowstone-rpc.litprotocol.com/`
- `DEPLOYED_ABILITY_IPFS_CID` - IPFS CID of your deployed ability from the Vincent dashboard
  - If not provided, defaults to a placeholder CID
  - Get this from your ability's dashboard page after deployment

## PKP Wallet Configuration

The test can use a PKP in three ways:

### 1. Use a Specific PKP (Recommended for Testing with Existing Positions)

If you have a PKP that already has LP positions, you can configure the test to use it:

```bash
# In your .env.test-e2e file
TEST_PKP_TOKEN_ID=109013493400997875669076524913886707440794405726417064608244294394864993874667
TEST_PKP_ETH_ADDRESS=0xaB0D5922AEB47d6E028E46a66752F054d639bAeb
```

**Important Requirements:**

- The PKP **MUST be owned** by the wallet specified in `TEST_AGENT_WALLET_PKP_OWNER_PRIVATE_KEY`
- If the PKP is not owned by this wallet, permissions will fail and the test will fall back to auto-discovery
- The test will validate PKP ownership before using it

### 2. Auto-Discover PKP (Default Behavior)

If `TEST_PKP_TOKEN_ID` and `TEST_PKP_ETH_ADDRESS` are not set:

- The test looks for PKPs owned by the wallet specified in `TEST_AGENT_WALLET_PKP_OWNER_PRIVATE_KEY`
- If a PKP is found, it uses that PKP
- This is the default behavior and what happens if you just run the tests after `pnpm bootstrap`

### 3. Auto-Create PKP (Fallback)

If no PKP is configured and the owner wallet doesn't have any PKPs:

- The test will mint a new PKP for the owner wallet
- This new PKP won't have any LP positions initially
- The test will still pass, but no rebalancing actions will be performed

## Test Flow

The e2e test follows this flow:

### Setup (beforeAll)

1. Ensures the funder wallet has sufficient testLPX
2. Funds the app manager and delegatee wallets
3. Configures the PKP wallet (using one of the three methods above)
4. Ensures the agent PKP wallet is funded
5. Ensures the delegatee has an unexpired capacity token
6. Registers the ability with the Vincent app system
7. Grants the necessary permissions for the agent PKP to execute the ability

### Test Execution

1. **Ability execution**: Calls the LP rebalancer ability with a registry address
   - The ability discovers projects from the registry
   - Fetches metrics for each project (NAV, pool price, deviation)
   - Identifies LP positions owned by the PKP
   - Performs rebalancing actions if needed
   - The test expects this to succeed or fail gracefully

## Running the Tests

From the repository root:

```bash
# Run all e2e tests
pnpm test-e2e

# Run only the LP rebalancer e2e tests
pnpm nx test-e2e @reubenr0d/lp-rebalancer-e2e
```

## Quick Execution Script

For quick testing without the full e2e test setup, use the standalone execution script:

```bash
# Execute the ability directly
pnpm execute-ability
```

### Script Requirements

The execution script requires these environment variables:

**Required:**

- `TEST_APP_DELEGATEE_PRIVATE_KEY` - Private key for the delegatee wallet that will execute the ability
- `TEST_PKP_ETH_ADDRESS` - PKP wallet address that owns the LP positions

**Optional:**

- `TEST_REGISTRY_ADDRESS` - Registry contract address (defaults to placeholder)
- `SEPOLIA_RPC_URL` - RPC URL for blockchain queries (defaults to Sepolia Infura)
- `DEPLOYED_ABILITY_IPFS_CID` - Use deployed ability from IPFS instead of local build

### Quick Example

```bash
# In your .env.test-e2e file
TEST_APP_DELEGATEE_PRIVATE_KEY=0x...
TEST_PKP_ETH_ADDRESS=0xaB0D5922AEB47d6E028E46a66752F054d639bAeb
TEST_REGISTRY_ADDRESS=0x832d9D61E076791Ae7c625C27Ab1Ca4D7499f6cb
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY

# Then run
pnpm execute-ability
```

### Script vs Full E2E Test

| Feature           | Quick Script             | Full E2E Test            |
| ----------------- | ------------------------ | ------------------------ |
| Setup wallets     | ❌ No                    | ✅ Yes                   |
| Register app      | ❌ No                    | ✅ Yes                   |
| Setup permissions | ❌ No                    | ✅ Yes                   |
| Execute ability   | ✅ Yes                   | ✅ Yes                   |
| Speed             | ⚡ Fast (~5s)            | 🐌 Slow (~50s)           |
| Use case          | Quick testing, debugging | Full integration testing |

**Use the script when:**

- You want to quickly test ability execution
- Permissions are already set up
- You're debugging ability logic
- You want to manually trigger rebalancing

**Use the full e2e test when:**

- Setting up from scratch
- Testing the complete integration
- Verifying permissions work correctly
- Running in CI/CD

## Using Your Deployed Ability

To test your deployed ability from the Vincent dashboard instead of the local development version:

### 1. Get Your IPFS CIDs

1. Go to your Vincent dashboard
2. Navigate to your deployed ability
3. Copy the IPFS CID (starts with `Qm...`)
4. Do the same for your deployed policy

### 2. Configure Environment Variables

Add to your `.env.test-e2e` file:

```bash
# Your deployed ability and policy IPFS CIDs
DEPLOYED_ABILITY_IPFS_CID=QmYourActualAbilityCid
DEPLOYED_POLICY_IPFS_CID=QmYourActualPolicyCid

# Optional: Real registry address for full testing
TEST_REGISTRY_ADDRESS=0xYourCornerstoneRegistryAddress
```

### 3. Run the Test

```bash
pnpm test-e2e
```

The test will now use your deployed ability from IPFS instead of the local development version.

## Test Timeout

The tests have a 120-second timeout to account for:

- Network calls to the blockchain
- Lit Protocol node interactions
- Transaction confirmations
- Multiple rebalancing actions if positions exist

## Using a Real Registry Address

To test with a real Cornerstone registry:

1. Deploy a Cornerstone registry contract to Yellowstone testnet
2. Add the registry address to your environment:
   ```bash
   # In packages/cornerstone-lp-rebalancer-e2e/.env.test-e2e
   TEST_REGISTRY_ADDRESS=0xYourRegistryAddress
   ```
3. Optionally, create test projects in the registry
4. Optionally, create Uniswap V3 LP positions for the test PKP
5. Run the tests

## Expected Results

### Without Projects or Positions

- The ability will successfully discover that the registry has no projects
- The precheck will return `projectCount: 0` and `trackedPositions: 0`
- No rebalancing actions will be performed
- The test will still pass, as this is a valid outcome

### With Projects and Positions

- The ability will discover projects from the registry
- It will fetch current pool prices and compare against target prices
- If positions need rebalancing, it will execute the necessary transactions
- The result will include details of all actions taken
- The second execution will be blocked by the policy

## Troubleshooting

### "Invalid registry address" error

- Ensure `TEST_REGISTRY_ADDRESS` is a valid Ethereum address (0x + 40 hex chars)
- The address doesn't need to be a deployed contract for basic testing

### RPC timeout errors

- The default RPC might be rate-limited
- Consider using a custom RPC URL via `YELLOWSTONE_RPC_URL`

### Policy denial not working

- Verify the policy is correctly deployed (check the IPFS CID)
- Ensure permissions are properly set up in the beforeAll block
- Check the time window settings in `PERMISSION_DATA`

### Insufficient funds errors

- Ensure the funder wallet has enough testLPX
- Use the Yellowstone faucet: https://chronicle-yellowstone-faucet.getlit.dev/
- The test automatically funds other wallets from the funder

## No Policy Configuration

The test currently runs without any policy restrictions, allowing the ability to execute freely.

## Architecture

The test exercises the complete Vincent architecture:

- **Ability**: LP Rebalancer (discovers projects and rebalances positions)
- **PKP**: Programmable Key Pair (owns the LP positions and signs transactions)
- **Delegation**: Agent PKP delegates execution rights to the app
- **Capacity Credits**: Required for Lit Protocol node usage
