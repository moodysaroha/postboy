#!/usr/bin/env pwsh

# Simplified Release Script for PostBoy
# This script automates the process of:
# 1. Committing and pushing changes
# 2. Creating a version tag
# 3. Pushing the tag to trigger GitHub Actions workflow

param(
    [Parameter(Mandatory=$false)]
    [string]$CommitMessage = "Release update",
    
    [Parameter(Mandatory=$false)]
    [string]$Version = ""
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

# STEP 2: Create and Push Tag
Write-Info "`n=== Step 2: Creating and Pushing Tag ==="

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

Write-Info "`n=== Step 3: GitHub Actions Workflow ==="
Write-Success "✓ Tag $tagVersion has been pushed to GitHub"
Write-Info "GitHub Actions will now:"
Write-Info "  1. Build the application for Windows"
Write-Info "  2. Create a GitHub Release"
Write-Info "  3. Upload the release artifacts"
Write-Info ""
Write-Info "You can monitor the build progress at:"
Write-Info "  https://github.com/moodysaroha/postboy/actions"
Write-Info ""
Write-Success "✓ Release process initiated successfully!"

# Exit successfully
exit 0