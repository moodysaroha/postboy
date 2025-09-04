#!/usr/bin/env pwsh

# Release Script for PostBoy
# This script automates the process of committing, pushing, and creating a release tag

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
Write-Info "       PostBoy Release Script"
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

# Step 1: Add all changes
Write-Info "`n[1/4] Adding all changes..."
git add .
if ($LASTEXITCODE -eq 0) {
    Write-Success "✓ Changes staged successfully"
} else {
    Write-Error "✗ Failed to stage changes"
    exit 1
}

# Step 2: Commit changes
Write-Info "`n[2/4] Committing changes..."
git commit -m $CommitMessage
if ($LASTEXITCODE -eq 0) {
    Write-Success "✓ Changes committed successfully"
} else {
    Write-Warning "⚠ No changes to commit or commit failed"
}

# Step 3: Push to main branch
Write-Info "`n[3/4] Pushing to main branch..."
git push origin main
if ($LASTEXITCODE -eq 0) {
    Write-Success "✓ Pushed to main branch successfully"
} else {
    Write-Error "✗ Failed to push to main branch"
    Write-Info "You may need to pull latest changes first: git pull origin main"
    exit 1
}

# Step 4: Create and push tag
Write-Info "`n[4/4] Creating and pushing tag $tagVersion..."

# Check if tag already exists
$existingTag = git tag -l $tagVersion
if ($existingTag) {
    Write-Warning "Tag $tagVersion already exists!"
    $overwrite = Read-Host "Do you want to delete and recreate it? (y/N)"
    if ($overwrite -eq 'y' -or $overwrite -eq 'Y') {
        git tag -d $tagVersion
        git push origin --delete $tagVersion
        Write-Info "Deleted existing tag $tagVersion"
    } else {
        Write-Warning "Skipping tag creation"
        exit 0
    }
}

git tag $tagVersion
if ($LASTEXITCODE -eq 0) {
    Write-Success "✓ Tag $tagVersion created"
} else {
    Write-Error "✗ Failed to create tag"
    exit 1
}

git push origin $tagVersion
if ($LASTEXITCODE -eq 0) {
    Write-Success "✓ Tag pushed successfully"
} else {
    Write-Error "✗ Failed to push tag"
    exit 1
}

Write-Info ""
Write-Success "========================================="
Write-Success "     Release $tagVersion Complete! 🚀"
Write-Success "========================================="
Write-Info ""
Write-Info "GitHub Actions will now build and publish the release."
Write-Info "Check the Actions tab in your repository for progress:"
Write-Info "https://github.com/moodysaroha/postboy/actions"
Write-Info ""
Write-Info "Once complete, the release will be available at:"
Write-Info "https://github.com/moodysaroha/postboy/releases/tag/$tagVersion"
