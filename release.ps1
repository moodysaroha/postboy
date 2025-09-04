#!/usr/bin/env pwsh

# Release Script for PostBoy
# This script automates the process of:
# 1. Committing and pushing to the private source repository
# 2. Building the application
# 3. Publishing releases to the public releases repository

param(
    [Parameter(Mandatory=$false)]
    [string]$CommitMessage = "Release update",
    
    [Parameter(Mandatory=$false)]
    [string]$Version = "",
    
    [Parameter(Mandatory=$false)]
    [switch]$SkipBuild = $false,
    
    [Parameter(Mandatory=$false)]
    [switch]$PublishOnly = $false
)

# Colors for output
function Write-Success { Write-Host $args -ForegroundColor Green }
function Write-Info { Write-Host $args -ForegroundColor Cyan }
function Write-Warning { Write-Host $args -ForegroundColor Yellow }
function Write-Error { Write-Host $args -ForegroundColor Red }

Write-Info "========================================="
Write-Info "       PostBoy Release Script"
Write-Info "========================================="

# Configuration
$sourceRepo = "https://github.com/moodysaroha/postboy.git"
$releasesRepo = "https://github.com/moodysaroha/postboy-releases.git"
$releasesDir = "..\postboy-releases"

# Check if we're in a git repository
if (!(Test-Path .git)) {
    Write-Error "Error: Not in a git repository!"
    exit 1
}

# Check for uncommitted changes
$status = git status --porcelain
if ($status -and !$PublishOnly) {
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
    
    if (!$PublishOnly) {
        # Update package.json with new version
        $packageJson.version = $Version
        $packageJson | ConvertTo-Json -Depth 10 | Set-Content package.json
        Write-Success "Updated package.json with version $Version"
    }
}

# Ensure version starts with 'v' for the tag
$tagVersion = if ($Version.StartsWith('v')) { $Version } else { "v$Version" }

# Prompt for commit message if not provided
if ($CommitMessage -eq "Release update" -and !$PublishOnly) {
    $userMessage = Read-Host "Enter commit message (default: 'Release $tagVersion')"
    if (![string]::IsNullOrWhiteSpace($userMessage)) {
        $CommitMessage = $userMessage
    } else {
        $CommitMessage = "Release $tagVersion"
    }
}

Write-Info "`nRelease Summary:"
if (!$PublishOnly) {
    Write-Info "  Commit Message: $CommitMessage"
}
Write-Info "  Version Tag: $tagVersion"
Write-Info "  Skip Build: $($SkipBuild)"
Write-Info "  Publish Only: $($PublishOnly)"
Write-Info ""

# Confirm before proceeding
$confirm = Read-Host "Do you want to proceed? (Y/n)"
if ($confirm -eq 'n' -or $confirm -eq 'N') {
    Write-Warning "Release cancelled."
    exit 0
}

Write-Info "`nStarting release process..."

# PART 1: Update source repository (skip if PublishOnly)
if (!$PublishOnly) {
    Write-Info "`n=== Part 1: Updating Source Repository ==="
    
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
    
    # Step 4: Create and push tag to source repo
    Write-Info "`n[4/4] Creating and pushing tag $tagVersion to source repo..."
    
    # Check if tag already exists
    $existingTag = git tag -l $tagVersion
    if ($existingTag) {
        Write-Warning "Tag $tagVersion already exists in source repo!"
        $overwrite = Read-Host "Do you want to delete and recreate it? (y/N)"
        if ($overwrite -eq 'y' -or $overwrite -eq 'Y') {
            git tag -d $tagVersion
            git push origin --delete $tagVersion 2>$null
            Write-Info "Deleted existing tag $tagVersion"
        } else {
            Write-Warning "Skipping tag creation in source repo"
        }
    }
    
    if (!$existingTag -or ($overwrite -eq 'y' -or $overwrite -eq 'Y')) {
        git tag $tagVersion
        if ($LASTEXITCODE -eq 0) {
            Write-Success "✓ Tag $tagVersion created in source repo"
        } else {
            Write-Error "✗ Failed to create tag"
            exit 1
        }
        
        git push origin $tagVersion
        if ($LASTEXITCODE -eq 0) {
            Write-Success "✓ Tag pushed to source repo successfully"
        } else {
            Write-Error "✗ Failed to push tag"
            exit 1
        }
    }
}

# PART 2: Build the application
if (!$SkipBuild) {
    Write-Info "`n=== Part 2: Building Application ==="
    
    Write-Info "Building PostBoy $Version..."
    
    # Ensure GH_TOKEN is set for the build
    if ([string]::IsNullOrEmpty($env:GH_TOKEN)) {
        Write-Warning "GH_TOKEN not set. Build may work but updates might fail for users."
        $token = Read-Host "Enter GitHub token (or press Enter to skip)" -AsSecureString
        if ($token.Length -gt 0) {
            $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($token)
            $env:GH_TOKEN = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
        }
    }
    
    Write-Info "Running: pnpm run make"
    pnpm run make
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "✓ Build completed successfully"
    } else {
        Write-Error "✗ Build failed"
        exit 1
    }
    
    # Find the built files
    $outDir = "out\make"
    if (!(Test-Path $outDir)) {
        Write-Error "Build output directory not found: $outDir"
        exit 1
    }
    
    Write-Info "Build artifacts:"
    Get-ChildItem -Path $outDir -Recurse -Include "*.exe", "*.zip", "*.deb", "*.rpm", "*.dmg", "*.AppImage" | ForEach-Object {
        Write-Info "  - $($_.FullName)"
    }
}

# PART 3: Publish to releases repository
Write-Info "`n=== Part 3: Publishing to Releases Repository ==="

# Clone or update the releases repository
if (!(Test-Path $releasesDir)) {
    Write-Info "Cloning releases repository..."
    git clone $releasesRepo $releasesDir
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to clone releases repository"
        Write-Info "Please create the repository first: https://github.com/moodysaroha/postboy-releases"
        exit 1
    }
} else {
    Write-Info "Updating releases repository..."
    Push-Location $releasesDir
    git pull origin main
    Pop-Location
}

# Create release using GitHub CLI or API
Write-Info "`nCreating GitHub release $tagVersion in releases repository..."

# Check if GitHub CLI is installed
$ghInstalled = Get-Command gh -ErrorAction SilentlyContinue
if ($ghInstalled) {
    Push-Location $releasesDir
    
    # Create tag in releases repo
    git tag $tagVersion 2>$null
    git push origin $tagVersion 2>$null
    
    # Find release artifacts
    $artifacts = @()
    if (!$SkipBuild) {
        $artifacts = Get-ChildItem -Path "..\postboy\out\make" -Recurse -Include "*.exe", "*.zip", "*.deb", "*.rpm", "*.dmg", "*.AppImage"
    }
    
    if ($artifacts.Count -eq 0) {
        Write-Warning "No release artifacts found. Please build the application first."
        Pop-Location
        exit 1
    }
    
    # Create release notes
    $releaseNotes = @"
# PostBoy $Version

## What's New
$CommitMessage

## Downloads
Download the appropriate version for your platform below.

### Windows
- **PostBoySetup.exe** - Windows installer (recommended)
- **postboy-$Version-win32-x64.zip** - Portable version

### macOS
- **postboy-$Version-darwin-x64.zip** - macOS version

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
    Write-Info "Creating release with gh CLI..."
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
        Write-Success "✓ Release created successfully"
    } else {
        Write-Error "Failed to create release"
        Pop-Location
        exit 1
    }
    
    # Clean up temp file
    Remove-Item $releaseNotesFile -Force
    
    Pop-Location
} else {
    Write-Warning "GitHub CLI not found. Please install it from: https://cli.github.com/"
    Write-Info "Or manually create the release at: https://github.com/moodysaroha/postboy-releases/releases/new"
    Write-Info ""
    Write-Info "Upload these files to the release:"
    Get-ChildItem -Path "out\make" -Recurse -Include "*.exe", "*.zip", "*.deb", "*.rpm", "*.dmg", "*.AppImage" | ForEach-Object {
        Write-Info "  - $($_.Name)"
    }
}

Write-Info ""
Write-Success "========================================="
Write-Success "     Release $tagVersion Complete! 🚀"
Write-Success "========================================="
Write-Info ""
Write-Info "Source repository tag: https://github.com/moodysaroha/postboy/releases/tag/$tagVersion"
Write-Info "Public release: https://github.com/moodysaroha/postboy-releases/releases/tag/$tagVersion"
Write-Info ""
Write-Info "Users can now update their PostBoy installations automatically!"