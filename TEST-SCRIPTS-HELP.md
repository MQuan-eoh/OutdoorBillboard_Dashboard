# 🔧 Hướng Dẫn Sử Dụng Test Scripts

## Scripts Có Sẵn

### 1. `test-ota-system.ps1` - Script Test Đầy Đủ

**Cách sử dụng cơ bản:**

```powershell
# Test với build NSIS only (mặc định)
.\test-ota-system.ps1

# Test với build tất cả targets (NSIS + Portable)
.\test-ota-system.ps1 -BuildAll

# Chỉ validate không build lại
.\test-ota-system.ps1 -OnlyValidate

# Bỏ qua build nếu đã build rồi
.\test-ota-system.ps1 -SkipBuild

# Test với version mới và build tất cả
.\test-ota-system.ps1 -NewVersion "1.0.4" -BuildAll
```

**Các tham số:**

- `-NewVersion`: Version cho tag git (mặc định: "1.0.3")
- `-SkipBuild`: Bỏ qua build, chỉ validate
- `-OnlyValidate`: Chỉ validate, không git operations
- `-BuildAll`: Build cả NSIS và Portable (mặc định chỉ NSIS)

### 2. `quick-test.ps1` - Test Nhanh

```powershell
# Test nhanh chỉ build và kiểm tra files
.\quick-test.ps1
```

## Các Trường Hợp Sử Dụng

### ✅ Trường Hợp 1: Development Testing

```powershell
# Test nhanh trong quá trình phát triển
.\quick-test.ps1
```

### ✅ Trường Hợp 2: Pre-Release Testing

```powershell
# Test đầy đủ trước khi release
.\test-ota-system.ps1 -NewVersion "1.0.4"
```

### ✅ Trường Hợp 3: Build All Targets

```powershell
# Build cả NSIS và Portable cho release
.\test-ota-system.ps1 -BuildAll -NewVersion "1.0.4"
```

### ✅ Trường Hợp 4: Validate Only

```powershell
# Chỉ kiểm tra files đã build
.\test-ota-system.ps1 -OnlyValidate
```

## NPM Scripts Có Sẵn

### Build Commands:

```powershell
npm run build:renderer     # Build React renderer
npm run build:nsis         # Build NSIS installer only
npm run build:all          # Build cả NSIS và Portable
npm run build:portable     # Build portable executable only
```

### Utility Commands:

```powershell
npm run start             # Chạy app development
npm run dev              # Development với auto-reload
npm run clean-start      # Clean restart
```

## Troubleshooting

### ❌ Lỗi: "ITS-Billboard-Portable-\*.exe - KHÔNG TÌM THẤY"

**Giải pháp:** Dùng flag `-BuildAll` hoặc chỉ test NSIS:

```powershell
.\test-ota-system.ps1         # Chỉ test NSIS (OK)
.\test-ota-system.ps1 -BuildAll  # Test cả hai
```

### ❌ Lỗi: "Build renderer thất bại"

**Giải pháp:** Kiểm tra TypeScript errors:

```powershell
npx tsc --noEmit    # Kiểm tra TypeScript errors
npm run build:renderer  # Thử build lại
```

### ❌ Lỗi: "Git không có trong PATH"

**Giải pháp:** Cài đặt Git hoặc chạy trong Git Bash

### ❌ Lỗi: GitHub Actions workflow fails

**Giải pháp:** Kiểm tra patterns trong workflow:

- File output: `dist/ITS-Billboard-Setup-1.0.2.exe`
- Workflow pattern: `dist/ITS-Billboard-Setup-*.exe` ✅

## Best Practices

### 🎯 Thứ Tự Test Khuyến Nghị:

1. `.\quick-test.ps1` - Test nhanh
2. `.\test-ota-system.ps1` - Test đầy đủ
3. Monitor GitHub Actions
4. Test admin-web interface
5. Test OTA update end-to-end

### 🔒 Security Notes:

- Không commit GitHub tokens vào code
- Test trên máy ảo hoặc test environment
- Backup config trước khi test
- Keep rollback plan ready

### 📊 Performance Tips:

- Dùng `-SkipBuild` khi chỉ cần validate
- Dùng `quick-test.ps1` cho iterative testing
- Build All chỉ khi cần thiết (tốn thời gian)

## Output Files Expected

### NSIS Only Mode:

```
dist/
├── ITS-Billboard-Setup-1.0.2.exe  ✅
├── latest.yml                       ✅
└── win-unpacked/                   (folder)
```

### Build All Mode:

```
dist/
├── ITS-Billboard-Setup-1.0.2.exe     ✅
├── ITS-Billboard-Portable-1.0.2.exe  ✅
├── latest.yml                         ✅
└── win-unpacked/                     (folder)
```

## Links Quan Trọng

- GitHub Actions: https://github.com/MinhQuan7/ITS_OurdoorBillboard-/actions
- Releases: https://github.com/MinhQuan7/ITS_OurdoorBillboard-/releases
- Electron Builder Docs: https://www.electron.build/
