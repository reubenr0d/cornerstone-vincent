# Vincent Starter Kit

A complete example repository for Vincent Ability and Policy authors. This monorepo uses Nx and pnpm and includes:

- A Vincent Ability that monitors Cornerstone projects and rebalances Uniswap V3 LP positions
- A Vincent Policy that rate-limits ability executions
- End-to-end tests that automatically build, deploy, and exercise the ability and policy

### See detailed documentation / guides at [docs.heyvincent.ai](https://docs.heyvincent.ai)

## Requirements

- Node.js: ^20.19.4
- pnpm: 10.7.0 (managed via Corepack)

### Using Corepack to use pnpm

This repo is configured to use pnpm and enforces it in the preinstall step. If you do not have pnpm set up, use Corepack:

```bash
# Enable Corepack globally (ships with Node 16.9+)
corepack enable

# Ensure npm & pnpm shims are enabled
corepack enable npm
corepack enable pnpm

# Or run the helper script from the repo root
pnpm run use-corepack
```

Notes:

- The repo sets "packageManager": "pnpm@10.7.0" in package.json. Corepack will automatically provision that version.
- The preinstall script scripts/check-packagemanager.sh verifies Node and Corepack are available and enforces pnpm via `npx only-allow pnpm`.

## Scripts

Root-level scripts you will commonly use:

| Script       | What it does                                                                 | Notes                                                                   |
| ------------ | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| preinstall   | Ensures Node + Corepack are available and enforces pnpm                      | Runs automatically during `pnpm install`                                |
| build        | nx run-many -t build                                                         | Builds all packages (includes action bundling via Nx deps)              |
| test         | nx run-many -t test                                                          | Runs unit tests (if any)                                                |
| test-e2e     | nx run-many -t test-e2e                                                      | Builds + deploys the example Ability & Policy, then runs Jest E2E tests |
| reset-e2e    | Moves packages/cornerstone-lp-rebalancer-e2e/.env.test-e2e to a .backup file | Useful to re-run bootstrap for a new env                                |
| lint         | nx run-many -t lint                                                          | Lints all packages                                                      |
| typecheck    | nx run-many -t typecheck                                                     | Types checks all packages                                               |
| clean        | nx reset and per-project clean                                               | Removes build artifacts and node_modules in projects                    |
| prepare      | husky                                                                        | Git hooks setup                                                         |
| use-corepack | corepack enable ...                                                          | Quickly enables pnpm via Corepack                                       |
| reset        | pnpm clean && pnpm install                                                   | Full reinstall                                                          |
| hard-build   | pnpm reset && pnpm build                                                     | Clean reinstall and build                                               |
| bootstrap    | tsx ./src/bin/bootstrap.ts                                                   | Interactive environment setup (see Bootstrap flow)                      |

Project-level Nx targets you may find useful (run via pnpm nx ...):

| Target        | Project(s)                                                          | What it does                                                           |
| ------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| action:build  | cornerstone-lp-rebalancer-ability, cornerstone-lp-rebalancer-policy | Bundles the Lit Action code for the Ability/Policy                     |
| action:deploy | cornerstone-lp-rebalancer-ability, cornerstone-lp-rebalancer-policy | Builds (if needed) and deploys the Lit Action code                     |
| build         | all                                                                 | TypeScript build (depends on action:build where applicable)            |
| test-e2e      | cornerstone-lp-rebalancer-e2e                                       | Depends on deploying both the example Ability & Policy, then runs Jest |

## Packages in this repository

| Package                          | Path                                       | Purpose                                                                                                                                              |
| -------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| @reubenr0d/lp-rebalancer-ability | packages/cornerstone-lp-rebalancer-ability | LP Rebalancer Ability. Demonstrates Ability authoring, bundling, and deployment.                                                                     |
| @reubenr0d/lp-rebalancer-policy  | packages/cornerstone-lp-rebalancer-policy  | LP Rebalancer Policy. Demonstrates Policy authoring, bundling, and deployment.                                                                       |
| @reubenr0d/lp-rebalancer-e2e     | packages/cornerstone-lp-rebalancer-e2e     | Private package with end-to-end tests. It orchestrates building and deploying the example Ability & Policy and then runs integration tests via Jest. |

## Bootstrap flow

The bootstrap script guides you through configuring the repo for the first time and preparing the E2E environment.

Command:

```bash
pnpm bootstrap
```

What happens:

1. Pinata JWT setup
   - A Pinata JWT is required for e2e tests and for publishing Vincent Abilities and Policies to the Registry.
   - You will be prompted to obtain a Pinata JWT from https://app.pinata.cloud/developers/api-keys.
   - The JWT you provide will be stored in a root-level .env as `PINATA_JWT`. Tooling will use this to authenticate with Pinata.
   - If you already have a .env file, the script will skip this step.
2. Funder environment setup for E2E
   - You must fund a wallet with testLPX on the LIT testnet (Yellowstone). You can fund your wallet using the faucet as https://chronicle-yellowstone-faucet.getlit.dev/
   - Once you have funded your wallet, you must provide its private key for usage by tooling in the repository.
   - The bootstrap process creates additional test private keys (app manager, app delegatee, agent wallet PKP owner) and stores those keys in packages/cornerstone-lp-rebalancer-e2e/.env.test-e2e

Notes:

- If a root .env already exists, the Pinata JWT step is skipped.
- If packages/cornerstone-lp-rebalancer-e2e/.env.test-e2e already exists, bootstrap aborts with an error so you don’t overwrite your private keys. Use `pnpm reset-e2e` to back up the existing .env.test-e2e file, and re-run bootstrap.

## Quick start

It is recommended to use Corepack to ensure pnpm is used for the repository's package management. If you use a different package manager, you may experience problematic behavior.

1. Verify your version of corepack and ensure you are on > 0.31.0
   ```bash
   corepack -v
   npm install -g corepack@latest
   ```
2. Enable Corepack:
   ```bash
   corepack enable && corepack enable pnpm
   ```
3. Run bootstrap to build and configure the repository :
   ```bash
   pnpm bootstrap
   ```
4. (Optional) Configure a test registry address:

   ```bash
   # In packages/cornerstone-lp-rebalancer-e2e/.env.test-e2e
   TEST_REGISTRY_ADDRESS=0xYourCornerstoneRegistryAddress
   ```

   If not configured, the test will use a placeholder address. For full end-to-end testing with real data, deploy a Cornerstone registry contract and configure this address.

5. Run the example end-to-end test flow:
   ```bash
   pnpm test-e2e
   ```
