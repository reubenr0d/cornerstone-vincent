# Capacity Credits Setup Guide

## Current State

Your LP Rebalancer ability has been successfully updated and deployed:

- **PKP Address**: `0xaB0D5922AEB47d6E028E46a66752F054d639bAeb`
- **Updated Ability IPFS CID**: `QmW2piwDaAY7bky94zufG11hZ5jZLJTwWjPwR74Vv2Cs6p`
- **LP NFT Token ID**: `212185` (already transferred to PKP)
- **Delegatee Wallet**: `0x43115E9C858825a5812FEC05cD6195D018d49893`

### Updated Ability Features

The ability now:

1. ✅ Directly identifies Cornerstone projects via `token.project()` method
2. ✅ Gets NAV per share from project contract
3. ✅ Calculates pool price deviation
4. ✅ Determines if rebalancing is needed (>1% deviation threshold)
5. ✅ Returns actionable rebalancing recommendations

## Current Blocker: Rate Limits

When you try to execute the ability, you're hitting Lit Protocol rate limits:

```
Error: Rate limit exceeded. Try again later.
errorCode: rate_limit_exceeded
```

## Solution: Capacity Credits

Capacity credits are NFT tokens that provide reserved computational capacity on Lit Network, bypassing rate limits.

### Step 1: Find Your Capacity Credit Token ID

After running `/upgrade`, you should have received a capacity credits NFT. To find your token ID:

**Option A: Check your transaction history**

- Go to https://yellowstone-explorer.litprotocol.com/
- Search for your wallet address that ran `/upgrade`
- Look for a "Capacity Credit" NFT mint transaction

**Option B: Check the RateLimitNFT contract**

- Contract: `0x01205d94Fee4d9F59A4aB24bf80D11d4DdAf6Eed` (Datil network)
- Use a block explorer to view your NFT balance

**Option C: Ask in Discord**

- The Lit Protocol team can help you find your capacity credit token ID

### Step 2: Configure Environment Variables

Add these to `.env.test-e2e`:

```bash
# Your capacity credit NFT token ID
CAPACITY_CREDIT_TOKEN_ID=<your-token-id-here>

# Private key that owns the capacity credit NFT
# (defaults to TEST_AGENT_WALLET_PKP_OWNER_PRIVATE_KEY if not set)
CAPACITY_CREDIT_OWNER_PRIVATE_KEY=0xe2320613c86fdbdb420f7c0ed5286ba2d03f365b525b264ec1e58233d72d86e4
```

### Step 3: Run Capacity Credits Setup

```bash
pnpm setup-capacity-credits
```

This will:

1. Connect to Lit Network
2. Create a capacity delegation auth sig
3. Delegate capacity credits to your PKP
4. Save the auth sig to `capacity-delegation-auth-sig.json`

### Step 4: Execute Ability with Capacity Credits

```bash
DEPLOYED_ABILITY_IPFS_CID=QmW2piwDaAY7bky94zufG11hZ5jZLJTwWjPwR74Vv2Cs6p \\
TEST_APP_DELEGATEE_PRIVATE_KEY=0xf3837f453052a1b7710ed7d021ec1fdeb583dffa5afe9f06bdb00369caa2226a \\
pnpm execute-ability-with-pkp
```

The execution script will automatically detect and use the capacity delegation auth sig if it exists, bypassing rate limits.

## Alternative: Wait for Rate Limit Reset

If you don't have capacity credits yet, you can wait 10-15 minutes for the rate limit to reset, then try executing again. However, this is not a long-term solution as you'll hit limits frequently during testing.

## Troubleshooting

### "No app found for delegatee"

The Vincent framework has a limitation where each delegatee wallet can only register ONE app. Your current delegatee has app ID 80734625229 registered.

**Solution**: The ability version management is complex. For now, focus on getting execution working with capacity credits. Once that works, we can update the app version if needed.

### "CAPACITY_CREDIT_TOKEN_ID not set"

Make sure you've added the token ID to `.env.test-e2e` as shown in Step 2 above.

### "Owner does not own capacity credit"

Verify that the `CAPACITY_CREDIT_OWNER_PRIVATE_KEY` wallet actually owns the capacity credit NFT with the specified token ID.

## Next Steps After Setup

Once capacity credits are working and you can execute the ability:

1. **Verify LP NFT Detection**: Check that the ability detects LP NFT token ID 212185
2. **Verify Project Identification**: Confirm it identifies the Cornerstone project via `token.project()`
3. **Verify NAV Calculation**: Check that it correctly gets NAV and calculates deviation
4. **Verify Rebalancing Logic**: Ensure it returns correct rebalancing actions if needed

## Files Created

- `packages/cornerstone-lp-rebalancer-e2e/src/scripts/setup-capacity-credits.ts` - Setup script
- `packages/cornerstone-lp-rebalancer-e2e/src/scripts/execute-ability-with-pkp.ts` - Updated to use capacity credits
- Updated `.env.test-e2e` with capacity credits configuration section

## Commands Reference

```bash
# Setup capacity credits (run once)
pnpm setup-capacity-credits

# Execute ability with capacity credits
DEPLOYED_ABILITY_IPFS_CID=QmW2piwDaAY7bky94zufG11hZ5jZLJTwWjPwR74Vv2Cs6p \\
TEST_APP_DELEGATEE_PRIVATE_KEY=0xf3837f453052a1b7710ed7d021ec1fdeb583dffa5afe9f06bdb00369caa2226a \\
pnpm execute-ability-with-pkp
```

## Summary

✅ Updated ability deployed to IPFS
✅ PKP has LP NFT
✅ Lit Protocol permissions added
✅ Execution script updated to use capacity credits
⏳ Waiting for: Capacity credit token ID to be configured

Once you configure your capacity credit token ID and run the setup, you'll be able to execute the ability without hitting rate limits!
