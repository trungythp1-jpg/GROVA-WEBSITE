# Phase 5 — Tiếp nhận khách hàng và Firebase

## Quyết định đã chốt
- Kênh liên hệ ưu tiên: Zalo chính thức của GROVA (đường dẫn chưa được cung cấp; không tự tạo link).
- Nơi lưu lead: Firebase project hiện có, tên hiển thị `GROVA-WEBSITE`, Project ID đã xác nhận từ Console: `grova-website`.
- Web App đã đăng ký: App ID `1:636250248853:web:ba1bd2e9e237b2ca5bad9c`.
- Cấu hình public web app được lưu tại `firebase-config.js` và được nạp từ `index.html`.
- Không tự tạo tài khoản, email, Firebase project, credential hoặc liên kết Zalo.
- Không bật form nhận dữ liệu thật cho đến khi xác minh đúng Firebase project và kiểm tra bảo mật.

## Trạng thái trong mã nguồn
- Đã thêm khung biểu mẫu: họ tên, số điện thoại, email tùy chọn và lĩnh vực cần tư vấn.
- Đã thêm `firebase-config.js` với cấu hình web app do chủ website cung cấp. Các giá trị Firebase Web config là thông tin định danh phía client, không phải service-account credential.
- Các trường và nút gửi đang bị vô hiệu hóa có chủ đích. Biểu mẫu không gửi dữ liệu đi đâu và không lưu dữ liệu ở trình duyệt.
- Số điện thoại công khai đã được chủ website xác nhận trước đó vẫn có thể gọi trực tiếp.
- Chưa có nút/link Zalo vì chưa được cung cấp URL OA/tài khoản chính thức.

## Việc cần làm trước khi kích hoạt
1. Trong Firebase Console, xác nhận project ID chính xác. Tên hiển thị `GROVA-WEBSITE` không nhất thiết là Project ID; không đoán ID.
2. Kiểm tra Firestore đã bật hay chưa, khu vực dữ liệu, quota/gói thanh toán và liệu project có dữ liệu ứng dụng khác. Không thay đổi billing plan và không xóa/ghi đè dữ liệu hiện có.
3. Xác định cấu trúc collection riêng cho lead, ví dụ `website_leads`, sau khi kiểm tra không xung đột với dữ liệu hiện hữu.
4. Thiết kế quy tắc Firestore tối thiểu quyền. Không dùng rule kiểu `allow read, write: if true`; người truy cập website không được đọc danh sách lead hoặc sửa/xóa lead.
5. Trước khi mở ghi công khai, phải có biện pháp giảm spam/abuse và giới hạn dữ liệu. Firebase client config không phải mật khẩu nhưng vẫn cần xác minh đúng project và cấu hình domain/App Check phù hợp.
6. Vì website chạy tĩnh trên GitHub Pages, không có server riêng để giữ bí mật. Cần đánh giá Firebase App Check cho Web (reCAPTCHA v3 hoặc nhà cung cấp phù hợp), đăng ký đúng domain GitHub Pages và kiểm tra chi phí/khả năng sử dụng trên gói Spark trước khi buộc token cho Firestore.
7. Nếu không thể triển khai biện pháp chống lạm dụng phù hợp trên gói miễn phí, giữ form vô hiệu hóa và dùng kênh gọi điện/Zalo đã xác minh thay vì mở ghi công khai.
8. Chuẩn bị thông báo quyền riêng tư và consent trước khi thu thập dữ liệu cá nhân.
9. Chỉ cấp quyền đọc danh sách lead cho người quản trị đã xác thực. Không nhúng service-account key, private key hay mật khẩu vào JavaScript/GitHub Pages.
10. Kiểm tra gửi thành công/thất bại, chống gửi trùng, giới hạn tần suất, xác thực dữ liệu và kiểm tra quyền bằng tài khoản không phải admin.
11. Sau khi xác nhận URL Zalo chính thức, gắn link vào các nút liên hệ và kiểm tra mở tốt trên iOS/iPadOS.

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


## Cập nhật sau khi nhận Firebase Web config
- Đã thêm `firebase-config.js` và nạp file từ `index.html`; chưa khởi tạo SDK hay ghi Firestore.
- Form vẫn vô hiệu hóa, có thông báo rõ rằng dữ liệu chưa được gửi/lưu và lưu ý quyền riêng tư trước khi kích hoạt.
- Không mở quyền Firestore trong Console. Chưa có App Check provider/site key, URL Zalo chính thức hoặc xác nhận billing plan từ màn hình Billing; do đó chưa an toàn để bật nhận lead công khai.
