# PKP Setup and LP Token Management Guide

This guide will help you set up a new PKP (Programmable Key Pair) with all the necessary permissions and then transfer your LP tokens to it for automated rebalancing.

## 🚀 Quick Start

### Step 1: Set up PKP and Permissions

```bash
# Set your environment variables
export TEST_APP_DELEGATEE_PRIVATE_KEY="your_private_key_here"
export TEST_REGISTRY_ADDRESS="0x832d9D61E076791Ae7c625C27Ab1Ca4D7499f6cb"
export SEPOLIA_RPC_URL="your_rpc_url_here"

# Run the setup script
pnpm setup-pkp-and-permissions
```

This will:

- ✅ Mint a new PKP for your delegatee wallet
- ✅ Set up all required Lit Protocol permissions
- ✅ Save PKP details to `pkp-details.json`
- ✅ Show you the PKP address for LP token transfer

### Step 2: Transfer Your LP NFT

After the setup completes, you'll see output like:

```
✅ Successfully minted new PKP!
   PKP Address: 0x1234567890abcdef1234567890abcdef12345678
   PKP Token ID: 1234567890123456789012345678901234567890123456789012345678901234
```

**Transfer your LP NFT to this PKP address:**

- Use your wallet to transfer the LP NFT to: `0x1234567890abcdef1234567890abcdef12345678`
- The PKP will then be able to manage and rebalance your LP positions

### Step 3: Execute the Ability

```bash
# Run the execution script (uses saved PKP details)
pnpm execute-ability-with-pkp
```

## 📋 Detailed Workflow

### What the Setup Script Does

1. **Creates a new PKP** owned by your delegatee wallet
2. **Sets up Lit Protocol permissions** for the ability to execute
3. **Saves all details** to `pkp-details.json` for easy reuse
4. **Provides clear instructions** for the next steps

### What the Execution Script Does

1. **Loads PKP details** from the saved file
2. **Verifies wallet ownership** matches the setup
3. **Executes the LP rebalancer ability** using the PKP
4. **Shows detailed results** of the execution

## 🔧 Environment Variables

### Required

- `TEST_APP_DELEGATEE_PRIVATE_KEY`: Your delegatee wallet private key (64 hex chars)

### Optional

- `TEST_REGISTRY_ADDRESS`: Cornerstone registry address (default: `0x832d9D61E076791Ae7c625C27Ab1Ca4D7499f6cb`)
- `SEPOLIA_RPC_URL`: Your RPC URL for Sepolia testnet

## 📁 Generated Files

### `pkp-details.json`

This file contains all the PKP information needed for execution:

```json
{
  "ethAddress": "0x1234567890abcdef1234567890abcdef12345678",
  "tokenId": "1234567890123456789012345678901234567890123456789012345678901234",
  "delegateeWallet": "0xabcdef1234567890abcdef1234567890abcdef12",
  "registryAddress": "0x832d9D61E076791Ae7c625C27Ab1Ca4D7499f6cb",
  "rpcUrl": "https://sepolia.infura.io/v3/...",
  "abilityIpfsCid": "QmcSMxbPv13RxP23FtQbpwLfvBHDcBFbfH46HDkaHDdfET",
  "setupDate": "2025-10-24T15:30:00.000Z"
}
```

## 🎯 Benefits of This Approach

1. **✅ Clean Setup**: New PKP with proper permissions
2. **✅ Easy Transfer**: Clear instructions for LP NFT transfer
3. **✅ Reusable**: PKP details saved for future executions
4. **✅ Secure**: PKP owned by your delegatee wallet
5. **✅ Automated**: No manual permission setup required

## 🔍 Troubleshooting

### "PKP details file not found"

- Run `pnpm setup-pkp-and-permissions` first

### "Wallet mismatch"

- Make sure you're using the same private key that was used during setup

### "Insufficient funds"

- The setup script will try to fund your wallet with test tokens
- On mainnet, ensure your wallet has enough ETH for gas

### "Permission denied"

- The setup script handles all permission setup automatically
- If issues persist, check that the PKP is owned by your delegatee wallet

## 🚀 Next Steps

After successful setup:

1. **Transfer your LP NFT** to the generated PKP address
2. **Run the execution script** to test the ability
3. **Monitor the results** to see your LP positions being managed
4. **Set up automation** to run the script periodically

## 📞 Support

If you encounter any issues:

1. Check the console output for detailed error messages
2. Verify your environment variables are set correctly
3. Ensure your wallet has sufficient funds for gas
4. Make sure you're on the correct network (Sepolia testnet)
