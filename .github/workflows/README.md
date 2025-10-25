# GitHub Actions Workflows

## Execute Ability with PKP (Hourly)

This workflow automatically executes the ability with PKP every hour.

### Prerequisites

Before the workflow can run successfully, ensure the following files are committed to your repository:

1. **`pkp-details.json`** (Required)

   - Created by running: `pnpm setup-pkp-and-permissions`
   - Contains PKP address, token ID, registry address, and other essential details
   - Must be committed to the repository root

2. **`capacity-delegation-auth-sig.json`** (Optional but recommended)
   - Created by running: `pnpm setup-capacity-credits`
   - Helps bypass rate limits
   - If missing, the script will still run but may hit rate limits

### Setup Instructions

#### Option 1: Using GitHub Secrets (Recommended)

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add the following secret:
   - **Name**: `TEST_APP_DELEGATEE_PRIVATE_KEY`
   - **Value**: `0xf3837f453052a1b7710ed7d021ec1fdeb583dffa5afe9f06bdb00369caa2226a`
5. Click **Add secret**

The workflow is already configured to use this secret by default.

#### Option 2: Hardcoded Value (Not Recommended)

If you want to hardcode the private key directly in the workflow file (not recommended for security reasons):

1. Open `.github/workflows/execute-ability-hourly.yml`
2. In the "Execute ability with PKP" step, comment out the line:
   ```yaml
   TEST_APP_DELEGATEE_PRIVATE_KEY: ${{ secrets.TEST_APP_DELEGATEE_PRIVATE_KEY }}
   ```
3. Uncomment the line:
   ```yaml
   TEST_APP_DELEGATEE_PRIVATE_KEY: '0xf3837f453052a1b7710ed7d021ec1fdeb583dffa5afe9f06bdb00369caa2226a'
   ```

### Schedule

The workflow runs:

- **Automatically**: Every hour at minute 0 (00:00, 01:00, 02:00, etc.)
- **Manually**: Can be triggered from the GitHub Actions tab using "Run workflow"

### Monitoring

- Check the **Actions** tab in your GitHub repository to see workflow runs
- Each run will show the execution logs
- Failed runs will send notifications if you have them enabled
- Execution logs are uploaded as artifacts for debugging

### Manual Trigger

To run the workflow manually:

1. Go to the **Actions** tab
2. Select "Execute Ability with PKP (Hourly)"
3. Click "Run workflow"
4. Select the branch and click "Run workflow"

### Troubleshooting

- Ensure all dependencies are properly installed
- Check that the private key is correctly set in secrets
- Review the build step logs if the execution fails
- Verify that the pnpm lock file is up to date
