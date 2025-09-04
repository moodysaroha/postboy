# GitHub Releases Auto-Update Setup Guide

## Prerequisites Completed ✅

1. **Electron Forge Configuration**: Updated with GitHub publisher
2. **GitHub Action Workflow**: Created for automated releases
3. **Squirrel Configuration**: Enhanced for proper update file generation
4. **Updater URL**: Configured to point to GitHub releases

## Manual Steps You Need to Complete

### 1. Replace Placeholder Values

**In `forge.config.js`:**
- Replace `'yourusername'` with your actual GitHub username
- Replace `'postboy'` with your actual repository name (if different)

**In `src/updater.js`:**
- Replace `'yourusername'` with your actual GitHub username

### 2. Install Dependencies

Run this command to install the new GitHub publisher dependency:
```bash
pnpm install
```

### 3. Repository Settings

1. **Enable GitHub Actions**: Go to your repository → Settings → Actions → Allow all actions
2. **Repository Permissions**: Ensure Actions have write permissions to create releases

### 4. Create Your First Release

#### Option A: Manual Release (Recommended for first time)
1. Update your version in `package.json` (e.g., "1.0.1")
2. Commit your changes
3. Create and push a tag:
   ```bash
   git tag v1.0.1
   git push origin v1.0.1
   ```
4. The GitHub Action will automatically build and create a release

#### Option B: Local Build and Publish
```bash
# Build locally first to test
pnpm run make

# If successful, publish to GitHub
pnpm run publish
```

### 5. Verify Release Files

After the release is created, check that your GitHub release includes:
- `PostBoySetup.exe` (installer)
- `postboy-1.0.1-full.nupkg` (full update package)
- `RELEASES` (update metadata file)

### 6. Test Auto-Updates

1. Install the app from the release
2. Create a new release with a higher version number
3. Open the installed app - it should detect and offer the update

## Important Notes

### Update Process Flow
1. **Squirrel.Windows** checks the `RELEASES` file at your GitHub URL
2. Downloads the appropriate `.nupkg` file for updates
3. Applies the update and restarts the application

### File Structure in GitHub Releases
```
https://github.com/yourusername/postboy/releases/latest/download/
├── PostBoySetup.exe          # Full installer
├── postboy-1.0.1-full.nupkg  # Full update package
├── postboy-1.0.1-delta.nupkg # Delta update (if available)
└── RELEASES                   # Update metadata
```

### Troubleshooting

**If auto-updates don't work:**
1. Check the browser network tab for 404 errors on the update URL
2. Verify the `RELEASES` file is accessible at the URL
3. Ensure the app version in `package.json` matches the release tag
4. Check Windows Event Viewer for Squirrel errors

**Common Issues:**
- **404 errors**: Usually means the repository name or username is incorrect
- **Update not detected**: Version in `package.json` might not be higher than installed version
- **Download fails**: The `.nupkg` files might be missing from the release

## Next Steps

1. Replace the placeholder usernames with your actual values
2. Run `pnpm install` to get the new dependencies
3. Create your first release using the steps above
4. Test the auto-update functionality

## Version Bumping Strategy

For future releases:
1. Update version in `package.json`
2. Commit changes
3. Create and push a new tag (e.g., `v1.0.2`)
4. GitHub Actions will handle the rest automatically

The auto-updater will only update to higher version numbers, so make sure to increment appropriately:
- **Patch**: 1.0.0 → 1.0.1 (bug fixes)
- **Minor**: 1.0.0 → 1.1.0 (new features)
- **Major**: 1.0.0 → 2.0.0 (breaking changes)
