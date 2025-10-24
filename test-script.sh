#!/bin/bash

# Test script for the execute-ability command
# This shows how to use the script with your PKP details

echo "🚀 Testing the execute-ability script"
echo ""

# Set your environment variables
export TEST_APP_DELEGATEE_PRIVATE_KEY="9b2e011359ae304c17fbb1bcfa5d1f2847c90d0f5533d5276bc269a05ea603f9"  # Your delegatee private key
export TEST_PKP_ETH_ADDRESS="0xF5525701Ca7608C739a91DAdc794b8734892101B"  # Your PKP address
export TEST_PKP_TOKEN_ID="106661824429801962249326826545502225241386013395683171422426579759946965771433"  # Your PKP token ID
export TEST_REGISTRY_ADDRESS="0x832d9D61E076791Ae7c625C27Ab1Ca4D7499f6cb"  # Registry address
export SEPOLIA_RPC_URL="https://eth-sepolia.g.alchemy.com/v2/bdF7qBu81tW0nrjFVnAAJ"  # Your RPC URL

echo "📋 Environment variables set:"
echo "   TEST_APP_DELEGATEE_PRIVATE_KEY: ${TEST_APP_DELEGATEE_PRIVATE_KEY:0:10}..."
echo "   TEST_PKP_ETH_ADDRESS: $TEST_PKP_ETH_ADDRESS"
echo "   TEST_PKP_TOKEN_ID: ${TEST_PKP_TOKEN_ID:0:20}..."
echo "   TEST_REGISTRY_ADDRESS: $TEST_REGISTRY_ADDRESS"
echo "   SEPOLIA_RPC_URL: $SEPOLIA_RPC_URL"
echo ""

echo "⚡ Running the ability execution script..."
echo ""

# Run the script
npm run execute-ability
