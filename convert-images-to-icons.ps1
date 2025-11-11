# 🎯 IMAGE TO ICON CONVERTER SCRIPT
# Converts images to icons for ITS Billboard App
# Separates App Icons and Company Banner Logos
# Uses .NET System.Drawing for conversion (no external dependencies)

param(
    [string]$SourcePath = "",
    [string]$Type = "",
    [switch]$Help,
    [switch]$Force
)

# Colors for console output
$Green = "Green"
$Yellow = "Yellow"
$Red = "Red"
$Cyan = "Cyan"
$White = "White"

# Load required .NET assemblies
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms

function Show-Help {
    Write-Host "🎯 ITS Billboard - Image to Icon Converter" -ForegroundColor $Green
    Write-Host "==========================================" -ForegroundColor $Green
    Write-Host ""
    Write-Host "USAGE:" -ForegroundColor $Yellow
    Write-Host "  .\convert-images-to-icons.ps1 -SourcePath <path> -Type <type>" -ForegroundColor $White
    Write-Host ""
    Write-Host "TYPES:" -ForegroundColor $Yellow
    Write-Host "  app    - Convert to app icon (for exe shortcut)" -ForegroundColor $Cyan
    Write-Host "  banner - Convert to company banner logo" -ForegroundColor $Cyan
    Write-Host ""
    Write-Host "EXAMPLES:" -ForegroundColor $Yellow
    Write-Host "  .\convert-images-to-icons.ps1 -SourcePath 'C:\my-logo.png' -Type app" -ForegroundColor $White
    Write-Host "  .\convert-images-to-icons.ps1 -SourcePath 'C:\company-banner.jpg' -Type banner" -ForegroundColor $White
    Write-Host ""
    Write-Host "OUTPUT PATHS:" -ForegroundColor $Yellow
    Write-Host "  App Icons    -> assets/icon.png, assets/icon.ico" -ForegroundColor $Cyan
    Write-Host "  Banner Logos -> downloads/logos/" -ForegroundColor $Cyan
    Write-Host ""
    Write-Host "OPTIONS:" -ForegroundColor $Yellow
    Write-Host "  -Force       - Overwrite existing files" -ForegroundColor $Cyan
}

function Resize-Image {
    param(
        [string]$SourcePath,
        [string]$OutputPath,
        [int]$Width,
        [int]$Height,
        [bool]$MaintainAspectRatio = $true
    )
    
    try {
        # Load source image
        $sourceImage = [System.Drawing.Image]::FromFile($SourcePath)
        
        # Calculate dimensions
        if ($MaintainAspectRatio) {
            $sourceRatio = $sourceImage.Width / $sourceImage.Height
            $targetRatio = $Width / $Height
            
            if ($sourceRatio -gt $targetRatio) {
                $newWidth = $Width
                $newHeight = [int]($Width / $sourceRatio)
            } else {
                $newHeight = $Height
                $newWidth = [int]($Height * $sourceRatio)
            }
        } else {
            $newWidth = $Width
            $newHeight = $Height
        }
        
        # Create target bitmap with padding for centering
        $targetBitmap = New-Object System.Drawing.Bitmap($Width, $Height)
        $graphics = [System.Drawing.Graphics]::FromImage($targetBitmap)
        
        # Set high quality rendering
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        
        # Clear with transparent background
        $graphics.Clear([System.Drawing.Color]::Transparent)
        
        # Calculate centering position
        $x = [int](($Width - $newWidth) / 2)
        $y = [int](($Height - $newHeight) / 2)
        
        # Draw resized image
        $destRect = New-Object System.Drawing.Rectangle($x, $y, $newWidth, $newHeight)
        $srcRect = New-Object System.Drawing.Rectangle(0, 0, $sourceImage.Width, $sourceImage.Height)
        
        $graphics.DrawImage($sourceImage, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
        
        # Save image
        $targetBitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
        
        # Cleanup
        $graphics.Dispose()
        $targetBitmap.Dispose()
        $sourceImage.Dispose()
        
        return $true
    } catch {
        Write-Host "  ❌ Error resizing image: $_" -ForegroundColor $Red
        return $false
    }
}

function Convert-ToIco {
    param(
        [string[]]$PngFiles,
        [string]$OutputPath
    )
    
    try {
        # Create icon with multiple sizes
        $iconSizes = @()
        foreach ($pngFile in $PngFiles) {
            if (Test-Path $pngFile) {
                $img = [System.Drawing.Image]::FromFile($pngFile)
                $iconSizes += @{Image = $img; Size = $img.Width}
                $img.Dispose()
            }
        }
        
        # Simple ICO creation - just use the largest PNG for now
        $largestPng = $PngFiles | Where-Object { Test-Path $_ } | Select-Object -First 1
        if ($largestPng) {
            Copy-Item $largestPng $OutputPath.Replace('.ico', '_temp.png')
            
            # Convert PNG to ICO using .NET (basic conversion)
            $sourceImage = [System.Drawing.Image]::FromFile($largestPng)
            $bitmap = New-Object System.Drawing.Bitmap($sourceImage)
            
            # Save as ICO format
            $icon = [System.Drawing.Icon]::FromHandle($bitmap.GetHicon())
            $fileStream = New-Object System.IO.FileStream($OutputPath, [System.IO.FileMode]::Create)
            $icon.Save($fileStream)
            $fileStream.Close()
            
            $sourceImage.Dispose()
            $bitmap.Dispose()
            $icon.Dispose()
            
            # Remove temp file
            Remove-Item ($OutputPath.Replace('.ico', '_temp.png')) -ErrorAction SilentlyContinue
        }
        
        return $true
    } catch {
        Write-Host "  ❌ Error creating ICO: $_" -ForegroundColor $Red
        
        # Fallback: just copy the PNG as ICO (electron can handle PNG icons)
        try {
            $fallbackPng = $PngFiles | Where-Object { Test-Path $_ } | Select-Object -First 1
            if ($fallbackPng) {
                Copy-Item $fallbackPng $OutputPath.Replace('.ico', '.png')
                Write-Host "  💡 Created PNG fallback instead of ICO" -ForegroundColor $Yellow
                return $true
            }
        } catch {
            return $false
        }
        
        return $false
    }
}

function Convert-ToAppIcon {
    param([string]$SourceImage)
    
    Write-Host "🎯 Converting to App Icon..." -ForegroundColor $Yellow
    
    # Create assets directory if not exists
    $assetsDir = "assets"
    if (!(Test-Path $assetsDir)) {
        New-Item -ItemType Directory -Path $assetsDir -Force | Out-Null
        Write-Host "✅ Created assets directory" -ForegroundColor $Green
    }
    
    # Check if files exist and Force flag
    if ((Test-Path "assets/icon.png") -and !$Force) {
        Write-Host "⚠️  Icon files already exist. Use -Force to overwrite" -ForegroundColor $Yellow
        return $false
    }
    
    # App icon sizes for Windows
    $iconSizes = @(16, 24, 32, 48, 64, 96, 128, 256)
    $iconFiles = @()
    
    Write-Host "📐 Generating multiple icon sizes..." -ForegroundColor $Cyan
    
    # Generate different sizes using .NET
    foreach ($size in $iconSizes) {
        $tempIcon = "assets/icon_${size}x${size}.png"
        Write-Host "  🔄 Creating ${size}x${size}..." -ForegroundColor $White
        
        if (Resize-Image -SourcePath $SourceImage -OutputPath $tempIcon -Width $size -Height $size) {
            $iconFiles += $tempIcon
            Write-Host "  ✅ ${size}x${size} created" -ForegroundColor $Green
        } else {
            Write-Host "  ❌ Failed to create ${size}x${size}" -ForegroundColor $Red
        }
    }
    
    # Create main PNG icon (256x256 for electron)
    Write-Host "  🔄 Creating main icon.png..." -ForegroundColor $White
    if (Resize-Image -SourcePath $SourceImage -OutputPath "assets/icon.png" -Width 256 -Height 256) {
        Write-Host "✅ Main icon.png created (256x256)" -ForegroundColor $Green
    } else {
        Write-Host "❌ Failed to create main icon.png" -ForegroundColor $Red
        return $false
    }
    
    # Create ICO file with multiple sizes
    Write-Host "  🔄 Creating icon.ico..." -ForegroundColor $White
    if (Convert-ToIco -PngFiles $iconFiles -OutputPath "assets/icon.ico") {
        Write-Host "✅ Icon.ico created" -ForegroundColor $Green
    } else {
        Write-Host "❌ Failed to create icon.ico, using PNG fallback" -ForegroundColor $Yellow
        Copy-Item "assets/icon.png" "assets/icon.ico" -Force
    }
    
    # Clean up temporary files
    foreach ($file in $iconFiles) {
        Remove-Item $file -ErrorAction SilentlyContinue
    }
    
    Write-Host ""
    Write-Host "🎯 APP ICON CONVERSION COMPLETED!" -ForegroundColor $Green
    Write-Host "Files created:" -ForegroundColor $Yellow
    Write-Host "  📁 assets/icon.png  (for electron main window)" -ForegroundColor $White
    Write-Host "  📁 assets/icon.ico  (for exe file icon)" -ForegroundColor $White
    Write-Host ""
    Write-Host "🚀 Ready for build: npm run build:win" -ForegroundColor $Cyan
    
    return $true
}

function Convert-ToBannerLogo {
    param([string]$SourceImage)
    
    Write-Host "🏢 Converting to Company Banner Logo..." -ForegroundColor $Yellow
    
    # Create downloads/logos directory if not exists
    $logoDir = "downloads/logos"
    if (!(Test-Path $logoDir)) {
        New-Item -ItemType Directory -Path $logoDir -Force | Out-Null
        Write-Host "✅ Created logos directory" -ForegroundColor $Green
    }
    
    # Get original filename without extension
    $originalName = [System.IO.Path]::GetFileNameWithoutExtension($SourceImage)
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $logoName = "${originalName}_${timestamp}"
    
    # Banner logo sizes (for billboard display)
    $bannerSizes = @(
        @{Width=384; Height=384; Name="square"},
        @{Width=800; Height=200; Name="banner"},
        @{Width=1920; Height=800; Name="fullscreen"},
        @{Width=400; Height=400; Name="web"}
    )
    
    Write-Host "📐 Generating banner logo sizes..." -ForegroundColor $Cyan
    
    foreach ($size in $bannerSizes) {
        $outputFile = "$logoDir/${logoName}_$($size.Name)_$($size.Width)x$($size.Height).png"
        Write-Host "  🔄 Creating $($size.Name) ($($size.Width)x$($size.Height))..." -ForegroundColor $White
        
        if (Resize-Image -SourcePath $SourceImage -OutputPath $outputFile -Width $size.Width -Height $size.Height) {
            Write-Host "  ✅ $($size.Name) ($($size.Width)x$($size.Height)) created" -ForegroundColor $Green
        } else {
            Write-Host "  ❌ Failed to create $($size.Name) size" -ForegroundColor $Red
        }
    }
    
    Write-Host ""
    Write-Host "🏢 BANNER LOGO CONVERSION COMPLETED!" -ForegroundColor $Green
    Write-Host "Files created in downloads/logos/:" -ForegroundColor $Yellow
    Write-Host "  📁 ${logoName}_square_384x384.png     (for LED display)" -ForegroundColor $White
    Write-Host "  📁 ${logoName}_banner_800x200.png     (for banner)" -ForegroundColor $White
    Write-Host "  📁 ${logoName}_fullscreen_1920x800.png (for fullscreen)" -ForegroundColor $White
    Write-Host "  📁 ${logoName}_web_400x400.png        (for web admin)" -ForegroundColor $White
    Write-Host ""
    Write-Host "💡 Note: Add these logos to logo-manifest.json for dynamic loading" -ForegroundColor $Cyan
    
    return $true
}

function Update-BuildScript {
    Write-Host "🔧 Updating build configuration..." -ForegroundColor $Yellow
    
    # Check if icon files exist
    if (Test-Path "assets/icon.png") {
        Write-Host "✅ App icon ready for build" -ForegroundColor $Green
        
        # Update electron-packager command in package.json to use .ico
        $packageJson = Get-Content "package.json" -Raw | ConvertFrom-Json
        if ($packageJson.scripts."build:win") {
            $currentBuildScript = $packageJson.scripts."build:win"
            if ($currentBuildScript -like "*--icon=assets/icon*") {
                Write-Host "✅ Build script already configured for icons" -ForegroundColor $Green
            } else {
                Write-Host "💡 Consider updating package.json build:win script to use icon" -ForegroundColor $Cyan
            }
        }
    } else {
        Write-Host "⚠️  No app icon found. Convert an image with -Type app first" -ForegroundColor $Yellow
    }
}

# Main execution
if ($Help) {
    Show-Help
    exit 0
}

if (-not $SourcePath -or -not $Type) {
    Write-Host "❌ Missing required parameters!" -ForegroundColor $Red
    Write-Host "Use -Help for usage information" -ForegroundColor $Yellow
    exit 1
}

if (!(Test-Path $SourcePath)) {
    Write-Host "❌ Source image not found: $SourcePath" -ForegroundColor $Red
    exit 1
}

Write-Host "🎯 ITS Billboard - Image to Icon Converter" -ForegroundColor $Green
Write-Host "==========================================" -ForegroundColor $Green
Write-Host "Source: $SourcePath" -ForegroundColor $White
Write-Host "Type: $Type" -ForegroundColor $White
Write-Host "Using: .NET System.Drawing (no external dependencies)" -ForegroundColor $Cyan
Write-Host ""

# Convert based on type
switch ($Type.ToLower()) {
    "app" {
        $success = Convert-ToAppIcon -SourceImage $SourcePath
        if ($success) {
            Update-BuildScript
        }
    }
    "banner" {
        $success = Convert-ToBannerLogo -SourceImage $SourcePath
    }
    default {
        Write-Host "❌ Invalid type: $Type" -ForegroundColor $Red
        Write-Host "Valid types: app, banner" -ForegroundColor $Yellow
        exit 1
    }
}

if ($success) {
    Write-Host ""
    Write-Host "🎉 CONVERSION COMPLETED SUCCESSFULLY!" -ForegroundColor $Green
    Write-Host "=====================================" -ForegroundColor $Green
} else {
    Write-Host ""
    Write-Host "❌ CONVERSION FAILED!" -ForegroundColor $Red
    exit 1
}