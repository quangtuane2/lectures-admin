# QLHocPhan

Ứng dụng quản lý giảng viên cho quản trị viên. React Native, Expo SDK 57, TypeScript, Firebase Authentication và Cloud Firestore dùng chung trên web và điện thoại.

## Chạy dự án

Mở PowerShell trong thư mục chứa `package.json`, rồi cài thư viện.

```powershell
npm.cmd ci
```

Máy hiện tại đã có `.env`. Khi clone sang máy khác, sao chép `.env.example` thành `.env` và điền cấu hình web app Firebase từ phần **Project settings → Your apps**.

- **Web**. Chạy `npm.cmd run web`. Mở địa chỉ Expo in ra, thường là [localhost:8081](http://localhost:8081).
- **Điện thoại**. Chạy `npm.cmd start`. Đặt điện thoại và máy tính cùng Wi-Fi, rồi quét QR bằng Expo Go tương thích SDK 57. Nếu cần dùng đường hầm, chạy `npx.cmd expo start --tunnel`.
- **Máy ảo Android**. Mở máy ảo rồi chạy `npm.cmd run android`.

Đăng nhập bằng email và mật khẩu quản trị Firebase. Khi thiết lập một tài khoản mới, bật **Email/Password** trong Firebase Authentication, tạo user rồi thêm document `admins/<UID>` có trường `active` kiểu boolean bằng `true`.

## Cloud Firestore

Dự án sử dụng Firestore `(default)` của Firebase project `lectures-admindb`. Trên gói Spark, `QLHocPhan` được thể hiện bằng đường dẫn **QLHocPhan → QuanLy → GiangVien**. `QuanLy` là document chứa collection `GiangVien`. Mỗi document giảng viên có đúng bốn trường.

- `IDGV` là mã giảng viên dạng chuỗi, duy nhất, ví dụ `GV001`. Mã được chuyển thành chữ hoa khi lưu.
- `Fullname` là họ và tên dạng chuỗi.
- `Image` là chuỗi ảnh dạng data URL Base64. Ứng dụng chấp nhận JPG, PNG, GIF hoặc WebP tối đa 700 KB sau khi xử lý.
- `SumClass` là tổng số lớp, kiểu số nguyên không âm.

Mã giảng viên cũng được dùng làm Document ID. Đổi mã sẽ tạo document theo mã mới và xóa document cũ trong cùng giao dịch. Rules kiểm tra quyền quản trị, kiểu dữ liệu và tập trường. Khi lưu giảng viên, Firestore ghi trực tiếp bốn trường từ biểu mẫu.

```powershell
firebase.cmd deploy --only firestore --project lectures-admindb
```

## Xuất JSON

[GiangVien.json](database/GiangVien.json) là bản xuất collection giảng viên, gồm ảnh. Chạy lệnh dưới đây từ thư mục dự án để xuất lại, rồi nhập tài khoản quản trị dùng trong ứng dụng. File được ghi vào `database/GiangVien.json`.

```powershell
& .\database\export-lecturers.ps1
```
