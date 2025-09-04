# Icon Setup Guide for PostBoy

## 🎨 Required Icon Files

Place these files in `src/assets/`:

### **1. icon.png** (Required)
- **Size**: 512x512 pixels (recommended) or 256x256
- **Format**: PNG with transparency
- **Usage**: App window, taskbar, dock
- **File**: `src/assets/icon.png`

### **2. icon.ico** (Required for Windows)
- **Sizes**: Multiple sizes embedded (16x16, 32x32, 48x48, 64x64, 128x128, 256x256)
- **Format**: Windows ICO format
- **Usage**: Windows installer, executable file
- **File**: `src/assets/icon.ico`

### **3. icon.icns** (Optional - for macOS support)
- **Sizes**: Multiple sizes embedded
- **Format**: Apple ICNS format  
- **Usage**: macOS app bundle
- **File**: `src/assets/icon.icns`

### **Option 3: Command Line (Advanced)**
```bash
# Install imagemagick
# Windows: choco install imagemagick
# macOS: brew install imagemagick

# Create ICO from PNG
magick icon.png -define icon:auto-resize=256,128,64,48,32,16 icon.ico

# Create ICNS from PNG  
magick icon.png -define icon:auto-resize=512,256,128,64,32,16 icon.icns
```

## ✅ **Testing Icons**

After adding icons:

1. **Development**: `pnpm start` - check window icon
2. **Package**: `pnpm run package` - check packaged app icon
3. **Installer**: `pnpm run make` - check installer and installed app

## 🚀 **Quick Start**

1. Create or download a 512x512 PNG icon
2. Save as `src/assets/icon.png`
3. Convert to ICO format and save as `src/assets/icon.ico`
4. Test with `pnpm start`
