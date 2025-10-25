# New Delegatee Setup Guide

## Problem

You're hitting the "one app per delegatee" limit in Vincent. The current delegatee wallet (`0x846Aec0c62F866BB682f7e4d419F869240C6aBa5`) has already registered an app, so you can't register a new one with the updated ability.

## Solution

Use a different delegatee wallet to register the new app, while keeping the same PKP that holds your LP NFT.

## Architecture Clarification

1. **PKP (Programmable Key Pair)**: `0xaB0D5922AEB47d6E028E46a66752F054d639bAeb`

   - ✅ This is the wallet that HOLDS your LP NFT
   - ✅ This is what EXECUTES the ability
   - ✅ This stays the same - you don't need to transfer anything!

2. **Delegatee Wallet**: `0x846Aec0c62F866BB682f7e4d419F869240C6aBa5` (OLD)

   - ❌ This is just the wallet that REGISTERS Vincent apps
   - ❌ This is what's hitting the "one app per delegatee" limit
   - ✅ This can be changed without affecting the PKP

3. **PKP Owner**: `0xa7E3aE4df9655749E2a366E30b83a1B3374c8267`
   - ✅ This owns/controls the PKP NFT itself
   - ✅ This stays the same

## Step-by-Step Solution

### Step 1: Generate New Delegatee Wallet

```bash
pnpm generate-new-delegatee
```

This will:

- Generate a new delegatee wallet
- Save the details to `delegatee-update.json`
- Show you the new private key to update in your environment

### Step 2: Update Environment Configuration

Update your `.env.test-e2e` file (or wherever your environment variables are stored) with the new delegatee private key:

```bash
# Update this line with the new private key from Step 1
TEST_APP_DELEGATEE_PRIVATE_KEY=0x[new-private-key-from-step-1]
```

### Step 3: Fund the New Delegatee Wallet

Send some testnet ETH to the new delegatee address (shown in Step 1 output).

### Step 4: Run Setup with New Delegatee

```bash
pnpm setup-with-new-delegatee
```

This will:

- Use the existing PKP (no changes needed)
- Register a new app with the updated ability using the new delegatee
- Grant the same PKP permission to use the new app
- Save setup details to `pkp-setup-result-new-delegatee.json`

### Step 5: Execute with Same PKP

```bash
pnpm execute-ability-with-pkp
```

The same PKP that holds your LP NFT will execute the ability with the new app registration.

## What Changes vs What Stays the Same

### ✅ Stays the Same (No Action Needed)

- **PKP Address**: `0xaB0D5922AEB47d6E028E46a66752F054d639bAeb`
- **PKP Owner**: `0xa7E3aE4df9655749E2a366E30b83a1B3374c8267`
- **Your LP NFT**: Already in the PKP, no transfer needed
- **Execution**: Same PKP executes the ability

### 🔄 Changes (New Setup)

- **Delegatee Wallet**: New wallet for app registration
- **App ID/Version**: New app registration with updated ability
- **Environment**: Updated delegatee private key

## Files Created/Updated

- `delegatee-update.json` - Details about the delegatee change
- `pkp-setup-result-new-delegatee.json` - New setup details
- `.env.test-e2e` - Updated with new delegatee private key

## Verification

After setup, you can verify everything is working by:

1. Checking that the PKP address is unchanged
2. Confirming the new app is registered
3. Running the execution script successfully

## Troubleshooting

If you get errors:

1. Make sure the new delegatee wallet is funded
2. Verify the environment variables are updated correctly
3. Check that the new delegatee doesn't already have an app registered
4. Ensure the PKP details in `pkp-details.json` are correct

## Summary

This approach bypasses the "one app per delegatee" limit by using a fresh delegatee wallet while keeping your existing PKP that holds the LP NFT. No transfers or changes to your PKP are needed!
