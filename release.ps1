#!/usr/bin/env pwsh

# Simplified Release Script for PostBoy
# This script automates the process of:
# 1. Building the application
# 2. Creating a GitHub release in the main postboy repository
# 3. Publishing release assets for auto-updates

param(
    [Parameter(Mandatory=$false)]
    [string]$CommitMessage = "Release update",
    
    [Parameter(Mandatory=$false)]
    [string]$Version = "",
    
    [Parameter(Mandatory=$false)]
    [switch]$SkipBuild = $false
)

# Colors for output
function Write-Success { Write-Host $args -ForegroundColor Green }
function Write-Info { Write-Host $args -ForegroundColor Cyan }
function Write-Warning { Write-Host $args -ForegroundColor Yellow }
function Write-Error { Write-Host $args -ForegroundColor Red }

Write-Info "========================================="
Write-Info "   PostBoy Simplified Release Script"
Write-Info "========================================="

# Check if we're in a git repository
if (!(Test-Path .git)) {
    Write-Error "Error: Not in a git repository!"
    exit 1
}

# Check for uncommitted changes
$status = git status --porcelain
if ($status) {
    Write-Info "`nUncommitted changes detected:"
    Write-Host $status
    Write-Info ""
}

# Get current version from package.json
$packageJson = Get-Content package.json | ConvertFrom-Json
$currentVersion = $packageJson.version
Write-Info "Current version in package.json: $currentVersion"

# If no version provided, auto-increment patch version
if ([string]::IsNullOrEmpty($Version)) {
    $versionParts = $currentVersion -split '\.'
    $major = [int]$versionParts[0]
    $minor = [int]$versionParts[1]
    $patch = [int]$versionParts[2]
    $patch++
    $Version = "$major.$minor.$patch"
    Write-Info "Auto-incrementing to version: $Version"
    
    # Update package.json with new version
    $packageJson.version = $Version
    $packageJson | ConvertTo-Json -Depth 10 | Set-Content package.json
    Write-Success "Updated package.json with version $Version"
}

# Ensure version starts with 'v' for the tag
$tagVersion = if ($Version.StartsWith('v')) { $Version } else { "v$Version" }

# Prompt for commit message if not provided
if ($CommitMessage -eq "Release update") {
    $userMessage = Read-Host "Enter commit message (default: 'Release $tagVersion')"
    if (![string]::IsNullOrWhiteSpace($userMessage)) {
        $CommitMessage = $userMessage
    } else {
        $CommitMessage = "Release $tagVersion"
    }
}

Write-Info "`nRelease Summary:"
Write-Info "  Commit Message: $CommitMessage"
Write-Info "  Version Tag: $tagVersion"
Write-Info "  Skip Build: $($SkipBuild)"
Write-Info ""

# Confirm before proceeding
$confirm = Read-Host "Do you want to proceed? (Y/n)"
if ($confirm -eq 'n' -or $confirm -eq 'N') {
    Write-Warning "Release cancelled."
    exit 0
}

Write-Info "`nStarting release process..."

# STEP 1: Commit and push changes
Write-Info "`n=== Step 1: Committing Changes ==="

Write-Info "Adding all changes..."
git add .
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to stage changes"
    exit 1
}

Write-Info "Committing changes..."
git commit -m $CommitMessage
if ($LASTEXITCODE -ne 0) {
    Write-Warning "No changes to commit or commit failed"
}

Write-Info "Pushing to main branch..."
git push origin main
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to push to main branch"
    Write-Info "You may need to pull latest changes first: git pull origin main"
    exit 1
}

Write-Success "✓ Changes pushed successfully"

# STEP 2: Build the application
if (!$SkipBuild) {
    Write-Info "`n=== Step 2: Building Application ==="
    
    Write-Info "Building PostBoy $Version..."
    pnpm run make
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Build failed"
        exit 1
    }
    
    Write-Success "✓ Build completed successfully"
    
    # Find the built files
    $outDir = "out\make"
    if (!(Test-Path $outDir)) {
        Write-Error "Build output directory not found: $outDir"
        exit 1
    }
    
    Write-Info "Build artifacts:"
    Get-ChildItem -Path $outDir -Recurse -Include "*.exe", "*.nupkg", "*RELEASES*", "*.zip", "*.deb", "*.rpm", "*.dmg", "*.AppImage" | ForEach-Object {
        Write-Info "  - $($_.Name)"
    }
}

# STEP 3: Create GitHub Release
Write-Info "`n=== Step 3: Creating GitHub Release ==="

# Check if GitHub CLI is installed
$ghInstalled = Get-Command gh -ErrorAction SilentlyContinue
if (!$ghInstalled) {
    Write-Error "GitHub CLI not found. Please install it from: https://cli.github.com/"
    Write-Info "After installing gh CLI, run: gh auth login"
    exit 1
}

# Check if tag already exists
$existingTag = git tag -l $tagVersion
if ($existingTag) {
    Write-Warning "Tag $tagVersion already exists!"
    $overwrite = Read-Host "Do you want to delete and recreate it? (y/N)"
    if ($overwrite -eq 'y' -or $overwrite -eq 'Y') {
        git tag -d $tagVersion
        git push origin --delete $tagVersion 2>$null
        Write-Info "Deleted existing tag $tagVersion"
    } else {
        Write-Warning "Skipping release creation"
        exit 0
    }
}

# Create and push tag
Write-Info "Creating tag $tagVersion..."
git tag $tagVersion
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to create tag"
    exit 1
}

git push origin $tagVersion
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to push tag"
    exit 1
}

Write-Success "✓ Tag created and pushed"

# Find release artifacts
$artifacts = @()
if (!$SkipBuild) {
    $artifacts = Get-ChildItem -Path "out\make" -Recurse -Include "*.exe", "*.nupkg", "*RELEASES*", "*.zip", "*.deb", "*.rpm", "*.dmg", "*.AppImage"
}

if ($artifacts.Count -eq 0) {
    Write-Warning "No release artifacts found. Creating release without assets."
}

# Create release notes
$releaseNotes = @"
# PostBoy $Version

## What's New
$CommitMessage

## Downloads
Download the appropriate version for your platform below.

### Windows
- **Setup.exe** - Windows installer (recommended)
- **.zip** - Portable version

### macOS
- **.zip** - macOS version

### Linux
- **.deb** - Debian/Ubuntu
- **.rpm** - Fedora/RedHat
- **.AppImage** - Universal Linux package

## Auto-Update
This version supports automatic updates. The app will check for updates periodically and notify you when a new version is available.
"@

# Save release notes to temp file
$releaseNotesFile = [System.IO.Path]::GetTempFileName()
$releaseNotes | Out-File -FilePath $releaseNotesFile -Encoding UTF8

# Create the release
Write-Info "Creating GitHub release..."
$ghArgs = @(
    "release", "create", $tagVersion,
    "--title", "PostBoy $Version",
    "--notes-file", $releaseNotesFile,
    "--target", "main"
)

# Add artifact paths
foreach ($artifact in $artifacts) {
    $ghArgs += $artifact.FullName
}

gh @ghArgs

if ($LASTEXITCODE -eq 0) {
    Write-Success "✓ GitHub release created successfully"
} else {
    Write-Error "Failed to create GitHub release"
    # Clean up temp file
    Remove-Item $releaseNotesFile -Force
    exit 1
}

# Clean up temp file
Remove-Item $releaseNotesFile -Force

Write-Info ""
Write-Success "========================================="
Write-Success "     Release $tagVersion Complete! 🚀"
Write-Success "========================================="
Write-Info ""
Write-Info "Release URL: https://github.com/moodysaroha/postboy/releases/tag/$tagVersion"
Write-Info ""
Write-Info "Users can now update their PostBoy installations automatically!"
Write-Info ""
Write-Info "Next steps:"
Write-Info "1. Test the auto-update functionality"
Write-Info "2. Announce the release to users"
Write-Info "3. Monitor for any update issues"