# Phase 5 — Tiếp nhận khách hàng và Firebase

## Quyết định đã chốt
- Kênh liên hệ ưu tiên: Zalo chính thức của GROVA (đường dẫn chưa được cung cấp; không tự tạo link).
- Nơi lưu lead: Firebase project hiện có, tên người dùng cung cấp là `GROVA-WEBSITE`.
- Không tự tạo tài khoản, email, Firebase project, credential hoặc liên kết Zalo.
- Không bật form nhận dữ liệu thật cho đến khi xác minh đúng Firebase project và kiểm tra bảo mật.

## Trạng thái trong mã nguồn
- Đã thêm khung biểu mẫu: họ tên, số điện thoại, email tùy chọn và lĩnh vực cần tư vấn.
- Các trường và nút gửi đang bị vô hiệu hóa có chủ đích. Biểu mẫu không gửi dữ liệu đi đâu và không lưu dữ liệu ở trình duyệt.
- Số điện thoại công khai đã được chủ website xác nhận trước đó vẫn có thể gọi trực tiếp.
- Chưa có nút/link Zalo vì chưa được cung cấp URL OA/tài khoản chính thức.

## Việc cần làm trước khi kích hoạt
1. Trong Firebase Console, xác nhận project ID chính xác. Tên hiển thị `GROVA-WEBSITE` không nhất thiết là Project ID; không đoán ID.
2. Kiểm tra Firestore đã bật hay chưa, khu vực dữ liệu, quota/gói thanh toán và liệu project có dữ liệu ứng dụng khác. Không thay đổi billing plan và không xóa/ghi đè dữ liệu hiện có.
3. Xác định cấu trúc collection riêng cho lead, ví dụ `website_leads`, sau khi kiểm tra không xung đột với dữ liệu hiện hữu.
4. Thiết kế quy tắc Firestore tối thiểu quyền. Không dùng rule kiểu `allow read, write: if true`; người truy cập website không được đọc danh sách lead hoặc sửa/xóa lead.
5. Trước khi mở ghi công khai, phải có biện pháp giảm spam/abuse và giới hạn dữ liệu. Firebase client config không phải mật khẩu nhưng vẫn cần xác minh đúng project và cấu hình domain/App Check phù hợp.
6. Chỉ cấp quyền đọc danh sách lead cho người quản trị đã xác thực. Không nhúng service-account key, private key hay mật khẩu vào JavaScript/GitHub Pages.
7. Hiển thị thông báo quyền riêng tư và mục đích sử dụng dữ liệu ngay cạnh biểu mẫu trước khi thu thập dữ liệu cá nhân.
8. Kiểm tra gửi thành công/thất bại, chống gửi trùng, giới hạn tần suất, xác thực dữ liệu và kiểm tra quyền bằng tài khoản không phải admin.
9. Sau khi xác nhận URL Zalo chính thức, gắn link vào các nút liên hệ và kiểm tra mở tốt trên iOS/iPadOS.

## Lưu ý kiến trúc
GitHub Pages chỉ phục vụ frontend tĩnh; không được xem mã JavaScript phía trình duyệt là nơi bảo vệ bí mật. Không bật biểu mẫu chỉ bằng cách thêm Firebase config vào trang. Cần xác minh project, quy tắc truy cập và cách ghi dữ liệu an toàn trước. Ưu tiên không thay đổi gói Firebase hiện tại nếu chưa được chủ website đồng ý.

## Điều kiện hoàn tất Phase 5
- [ ] Firebase Project ID chính xác được xác nhận từ Firebase Console.
- [ ] Firestore rules được rà soát và kiểm thử.
- [ ] Quyền admin được xác định và kiểm thử.
- [ ] Có thông báo quyền riêng tư trước khi thu thập dữ liệu.
- [ ] Form gửi/nhận lỗi đã được kiểm thử mà không làm lộ danh sách khách.
- [ ] URL Zalo chính thức được cung cấp và kiểm tra.
- [ ] Sau khi hoàn tất các điều kiện trên mới bật form.
