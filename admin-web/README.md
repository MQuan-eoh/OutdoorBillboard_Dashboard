# ITS Billboard Admin Web - Simplified Version

## 🚀 Hệ thống quản lý banner đơn giản với GitHub CDN

**THAY ĐỔI QUAN TRỌNG**: Đã loại bỏ duplicate upload sections để đơn giản hóa.
Chỉ sử dụng **GitHub CDN workflow duy nhất**.

## ✨ Tính năng sau tối giản hóa

- 🎨 **GitHub CDN Upload Only** - Một workflow duy nhất, không confusing
- ⚡ **Real-time Sync** - MQTT communication với desktop app
- 📱 **Clean Interface** - Giao diện được đơn giản hóa đáng kể
- 🔒 **GitHub Authentication** - Secure upload qua GitHub Personal Access Token

## 🛠️ Cách sử dụng đơn giản

### Bước 1: GitHub Authentication

1. Mở `admin-web/index.html`
2. Nhập GitHub Personal Access Token
3. Click "Authenticate"

### Bước 2: Upload Banner

1. Click "� Test Connection" để kiểm tra
2. Click để chọn banner files
3. Click "📤 Upload Banner"
4. Banner sẽ tự động sync xuống desktop app

### Bước 3: Quản lý Banner

- Xem danh sách banner trong "Current Banners in CDN"
- Enable/Disable banner theo nhu cầu
- Click "⚡ Force Billboard Refresh" nếu cần

## 🎛️ Settings đồng bộ

- **Display Mode**: Loop/Fixed/Scheduled
- **Loop Duration**: 1-60 giây
- Click "Đồng bộ cài đặt" để áp dụng via MQTT

## 🔧 Technical Workflow (Đơn giản hóa)

```
Admin Web (GitHub Auth)
    ↓ Upload via GitHub API
GitHub Repository + GitHub Pages CDN
    ↓ MQTT Notification
Desktop App (Auto refresh)
    ↓ Display update
Billboard Screen
```

## 📞 Troubleshooting

### Không upload được:

1. Kiểm tra GitHub token có quyền `repo`
2. Repository `billboard-logos-cdn` phải tồn tại và public
3. Test connection trước khi upload

### Desktop app không nhận:

1. Kiểm tra MQTT connection status
2. Verify logoManifestService đang chạy
3. Check GitHub Pages URL accessibility

## 🎯 Lợi ích sau tối giản hóa

✅ **User Experience**: Không còn bối rối về 2 upload sections  
✅ **Maintenance**: Code đơn giản hơn, ít bugs  
✅ **Performance**: Faster load, ít duplicate logic  
✅ **Clarity**: Một workflow duy nhất, dễ hiểu

---

**💡 Kết luận**: Chỉ sử dụng GitHub CDN workflow - reliable, scalable, và FREE!
