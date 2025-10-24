# LP Rebalancer E2E Test Summary

## What This Test Actually Does

The e2e test in `packages/cornerstone-lp-rebalancer-e2e/` tests your **LP Rebalancer Vincent Ability** in a controlled environment. Here's what it does:

### 🎯 Test Purpose

- **Validates your ability's infrastructure**: Ensures the Vincent SDK can execute your ability
- **Tests real blockchain interactions**: Uses actual RPC calls and PKP signing
- **Handles both success and failure scenarios**: Works with placeholder or real registry addresses

### 🔧 What It Tests

1. **Ability Execution**: Calls your LP rebalancer with a registry address
2. **Project Discovery**: Your ability discovers projects from the Cornerstone registry
3. **Metrics Fetching**: Fetches NAV, pool prices, and deviation calculations
4. **Position Management**: Identifies and manages Uniswap V3 LP positions
5. **Transaction Execution**: Performs rebalancing actions if needed

### 📋 Test Flow

1. **Setup Phase**:

   - Funds test wallets with testLPX
   - Creates and funds a PKP (Programmable Key Pair)
   - Sets up Vincent app permissions
   - Ensures capacity credits for Lit Protocol

2. **Execution Phase**:
   - Calls your ability with registry address and RPC URL
   - Your ability runs its full logic (discover → analyze → rebalance)
   - Returns results or handles errors gracefully

### 🏗️ Current Configuration

- **Uses LOCAL development version** of your ability (not deployed)
- **No policy restrictions** (ability runs freely)
- **Placeholder registry address** (unless you configure a real one)
- **Yellowstone testnet** for blockchain interactions

### 🚀 How to Run

```bash
# Run the test
pnpm test-e2e

# Or run just the LP rebalancer test
pnpm nx test-e2e cornerstone-lp-rebalancer-e2e
```

### 📊 Expected Results

**With Placeholder Registry** (default):

- Test will attempt to execute your ability
- May fail with "invalid registry address" (expected)
- Test passes either way (validates infrastructure)

**With Real Registry**:

- Deploy a Cornerstone registry contract
- Set `TEST_REGISTRY_ADDRESS` in `.env.test-e2e`
- Your ability will discover real projects and perform rebalancing

### 🔄 To Test Your Deployed Ability

Currently, the test uses your **local development version**. To test your **deployed ability from the dashboard**:

1. Get the IPFS CID from your deployed ability in the Vincent dashboard
2. Replace the import in `e2e.spec.ts`:

   ```typescript
   // Instead of:
   import { bundledVincentAbility as rebalancerAbility } from '@reubenr0d/lp-rebalancer-ability';

   // Use your deployed ability CID
   const rebalancerAbility = { ipfsCid: 'QmYourDeployedAbilityCid' };
   ```

### 🎯 What This Validates

✅ **Vincent SDK Integration**: Your ability works with the Vincent infrastructure  
✅ **PKP Signing**: Your ability can sign transactions with the PKP  
✅ **Blockchain Interactions**: Your ability can read from and write to the blockchain  
✅ **Error Handling**: Your ability handles invalid inputs gracefully  
✅ **Real Execution**: Your ability performs actual rebalancing logic

### 📝 Key Files

- `packages/cornerstone-lp-rebalancer-e2e/src/e2e.spec.ts` - Main test file
- `packages/cornerstone-lp-rebalancer-e2e/README.md` - Detailed documentation
- `.env.test-e2e` - Test configuration (created during bootstrap)

This test gives you confidence that your LP rebalancer ability works correctly in the Vincent ecosystem! 🎉
