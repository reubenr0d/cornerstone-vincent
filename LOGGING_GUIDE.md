# LP Rebalancer E2E Test Logging Guide

## What Logs You'll See When Running the Test

When you run `pnpm test-e2e`, you'll see comprehensive logging that shows exactly what your LP rebalancer ability is doing. Here's what to expect:

### 🔧 Setup Phase Logs

```
🔧 ===== SETTING UP LP REBALANCER E2E TEST =====
📊 Wallet Status:
┌─────────────────┬──────────────────────────────────────────┬─────────────────┐
│ Wallet          │ Address                                   │ Balance         │
├─────────────────┼──────────────────────────────────────────┼─────────────────┤
│ Funder          │ 0x1234...                                │ 1.234567890     │
│ agentWalletOwner│ 0x5678...                                │ 0.000000000     │
│ appManager      │ 0x9abc...                                │ 0.000000000     │
│ appDelegatee    │ 0xdef0...                                │ 0.000000000     │
└─────────────────┴──────────────────────────────────────────┴─────────────────┘

💰 Funding wallets...
✅ Wallets funded successfully

🔑 Setting up PKP (Programmable Key Pair)...
✅ PKP created: 0xabcd... (Token ID: 12345)

📱 Registering app with Vincent...
✅ App registered: ID 67890, Version 1

🔐 Setting up permissions...
✅ Permissions configured successfully
🎯 Setup complete! Ready to execute LP rebalancer ability.
```

### ⚡ Ability Execution Logs

```
🚀 ===== STARTING LP REBALANCER ABILITY EXECUTION =====
📋 Test Configuration:
   Registry Address: 0x1234567890123456789012345678901234567890
   RPC URL: https://yellowstone-rpc.litprotocol.com/
   PKP Address: 0xabcd...
   PKP Token ID: 12345
================================================

⚡ Executing LP rebalancer ability...
📝 Note: You will see logs from your ability as it runs (project discovery, metrics, etc.)
⏳ This may take a moment as your ability interacts with the blockchain...
```

### 📊 Your Ability's Internal Logs

**You'll see logs from your ability code itself, such as:**

- `[@reubenr0d/lp-rebalancer-ability/precheck] 🔍 Policy precheck params:`
- `[@reubenr0d/lp-rebalancer-ability/precheck] Registry run failed`
- `[@reubenr0d/lp-rebalancer-ability/execute] Registry run failed`
- Network calls to discover projects
- RPC calls to fetch pool data
- Transaction signing and execution

### 📈 Success Results (if registry is valid)

```
📊 ===== ABILITY EXECUTION RESULTS =====
✅ LP Rebalancer execution succeeded!

📈 Execution Summary:
   Success: true
   Registry Address: 0x1234...
   Total Actions: 3
   Backfilled Positions: 0
   Projects Found: 2

🏗️  Projects Discovered:
   Project 1:
     Address: 0xproject1...
     Token: 0xtoken1...
     PYUSD: 0xpyusd1...
     Pool Address: 0xpool1...
     NAV Per Share: 1000000000000000000
     Target Price: 2000000000000000000
     Current Price: 1950000000000000000
     Deviation: 250 bps
     Direction: increase
     Position Count: 1
     Actions Taken: 2
     Action Details:
       1. accrueInterest - TX: 0xtx1...
       2. increaseLiquidity - TX: 0xtx2...

📋 Full Result Object:
{
  "registryAddress": "0x1234...",
  "totalActions": 3,
  "backfilledPositions": 0,
  "projects": [...]
}
```

### ❌ Failure Results (with placeholder registry)

```
📊 ===== ABILITY EXECUTION RESULTS =====
❌ LP Rebalancer execution failed

🔍 Failure Analysis:
   Success: false
   Context:
   {
     "reason": "PROVIDER_ERROR",
     "error": "Invalid registry address: 0x1234567890123456789012345678901234567890"
   }

💡 This is expected if using a placeholder registry address.
   To see full functionality, deploy a real Cornerstone registry
   and set TEST_REGISTRY_ADDRESS in your .env.test-e2e file.
```

### 🏁 Test Completion

```
🏁 ===== TEST COMPLETED =====
```

## What These Logs Tell You

### ✅ **Infrastructure Validation**

- Vincent SDK integration works
- PKP creation and funding successful
- App registration and permissions configured
- Your ability can be executed through the Vincent system

### 🔍 **Ability Behavior**

- How your ability handles different inputs
- What errors it produces with invalid data
- How it processes registry addresses and RPC calls
- Whether it can discover projects and positions

### 📊 **Real Performance Data** (with real registry)

- Actual project discovery results
- Pool metrics and price deviations
- LP position management
- Transaction execution and gas usage
- Rebalancing actions taken

## Running the Test

```bash
# Run with full logging
pnpm test-e2e

# Run with more verbose output
pnpm test-e2e --verbose

# Run just the LP rebalancer test
pnpm nx test-e2e cornerstone-lp-rebalancer-e2e
```

## Pro Tips

1. **Watch for your ability's internal logs** - These show the actual logic execution
2. **Check the full result object** - Contains all the data your ability discovered
3. **Look for transaction hashes** - Shows real blockchain interactions
4. **Monitor the setup phase** - Ensures all infrastructure is working
5. **Use a real registry** - Set `TEST_REGISTRY_ADDRESS` for full functionality

The logs give you complete visibility into how your LP rebalancer ability performs in the Vincent ecosystem! 🎯
