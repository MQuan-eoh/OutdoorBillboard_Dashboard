Đây là bộ hướng dẫn chi tiết dành cho dự án Mini App Desktop hiển thị thông tin lên màn hình LED quảng cáo, được soạn theo yêu cầu của bạn, với vai trò là Tech Lead Engineer.

Instruction Chuẩn cho Copilot/Dev Team (Phần chuyên nghiệp, tập trung vào kỹ thuật và yêu cầu dự án)
Chat và giải thích trong readme thì tiếng việt còn khi code và comment trong code thì sử dụng tiếng anh 
1. Instruction Chuẩn cho Copilot/Dev Team (Prompt Chuyên Nghiệp)
   Project Title: ITS Outdoor Billboard Display App (Electron + React/TS)

Context: Develop a cross-platform Electron mini-app for displaying real-time weather, IoT data, and scheduled advertisements on a dedicated outdoor LED screen.

🎯 Mục Tiêu Dự Án
Hiển thị giao diện toàn màn hình (Fullscreen) không viền (frameless) với độ phân giải cố định 384 x 384 pixels.

Đảm bảo hoạt động 24/7 ổn định với tính năng Auto-Start khi khởi động hệ điều hành.

Tích hợp dữ liệu thời tiết (Weather API) và dữ liệu IoT (ERA Platform qua MQTT/REST API).

Triển khai tính năng Lập lịch (Scheduling) cho việc hiển thị các nội dung quảng cáo (Video/Banner/Text) sử dụng node-cron.

💻 Cấu Trúc Thư Mục & Công Nghệ
Thư Mục/File Chức Năng Chính Công Nghệ/Lưu Ý
main.js Electron Main Process Khởi tạo cửa sổ 384x384 (fix size), fullscreen/frameless, auto-start.
/renderer UI Layer (React) TypeScript, sử dụng CSS/TailwindCSS để tạo layout 384x384.
/renderer/components UI Components Tái tạo các Element từ ảnh mẫu (Weather, IoT, Alert, Logo).
/renderer/store State Management Zustand cho trạng thái toàn cục (data, schedule, element positions).
/services Backend Logic TypeScript, quản lý kết nối API/MQTT và lập lịch.
package.json Project Config Định nghĩa dependencies, scripts (start, build).
///IMPORTANT TUYỆT ĐỐI KHÔNG ĐƯỢC TẠU TẠO FILE README
Export to Sheets
Ngôn ngữ/Framework: TypeScript (Node.js), Electron, React, Zustand, MQTT.js, node-cron.

⚙️ Yêu Cầu Kỹ Thuật Chi Tiết

1. Electron Main Process (main.js)
   Window Configuration:

Kích thước cố định: width: 384, height: 384.

Không viền: frame: false.

Chế độ khởi động: fullscreen: true (hoặc kiosk: true nếu cần).

Sử dụng webPreferences.preload để expose các hàm IPC cần thiết.

System Features:

Triển khai Auto-Start (System Tray/Registry) để ứng dụng chạy ngay khi máy khởi động.

Sử dụng IPC (Inter-Process Communication) để giao tiếp giữa Main Process và Renderer Process (ví dụ: thông báo trạng thái kết nối MQTT).

2. UI/UX (/renderer)
   Fixed Layout: Toàn bộ UI phải được thiết kế và render chính xác trong không gian 384x384 pixels. Sử dụng CSS vw/vh hoặc fixed px để đảm bảo tỷ lệ.

Element Structuring:

Scan & Breakdown: Phân tích ảnh mẫu (weather, sensor data, alert, logo) và chuyển thành các components riêng biệt (WeatherPanel, IoTPanel, AlertBanner, CompanyLogo).

Data Mapping: Các trường dữ liệu (Nhiệt độ, Độ ẩm, PM2.5, Mưa,...) phải được map chính xác từ nguồn API/MQTT vào các component tương ứng.

AdPlayer (AdPlayer.tsx): Component này sẽ chứa logic hiển thị nội dung quảng cáo (video, ảnh, text) dựa trên lịch trình từ scheduleService.

3. Services & Data Flow
   mqttService.ts:

Sử dụng thư viện mqtt để kết nối tới ERA IoT Platform.

Đăng ký (Subscribe) các topics cần thiết (Sensor data: Nhiệt độ, Độ ẩm, Chất lượng không khí - tương ứng với PM2.5/PM10).

Sử dụng Zustand để cập nhật trạng thái dữ liệu nhận được.

weatherService.ts:

Gọi API thời tiết (hoặc API từ ERA nếu có).

Lấy các thông số: Tên thành phố, Nhiệt độ chính, Tình trạng (Mưa/Nắng), Độ ẩm, Tốc độ gió, UV Index.

Sử dụng Axios/fetch và cập nhật Zustand state.

scheduleService.ts:

Sử dụng node-cron (chạy ở Main/Renderer Process tùy kiến trúc) để quản lý lịch quảng cáo.

Lịch trình (Schedule) sẽ được lưu trong Zustand state hoặc một file cấu hình.

Định nghĩa logic: Vào 10:00, hiển thị video_A.mp4; Vào 11:00, hiển thị banner_B.jpg.

🛑 Quy Tắc Code (Code Standards)
Clean Code & Review: Code phải rõ ràng, tuân thủ TypeScript standards. Hạn chế sử dụng any.

No Emojis/Icons in Code: Tuyệt đối không sử dụng emojis hoặc icon Unicode trong code (ngoại trừ trong phần UI JSX/TSX nếu cần thiết cho hiển thị, nhưng không trong logic/comments).

Logging: Chỉ log các data quan trọng (console.log(data), console.error(error)). Hạn chế log debug không cần thiết để tránh spam console khi chạy 24/7.

Code Comments: Hạn chế các comment không cần thiết. Không sử dụng các comment dạng enhanced with, update with, new feature added. Chỉ comment khi giải thích logic phức tạp.

No Unrequested Files: Không tự ý tạo test files, README (ngoại trừ file hướng dẫn học tập theo yêu cầu), hoặc các files cấu hình không liên quan.
