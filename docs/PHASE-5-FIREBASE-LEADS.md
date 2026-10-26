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

## Quyết định cập nhật của chủ website
- Chủ website đồng ý bỏ qua bước chống spam/App Check để tiếp tục triển khai.
- Chấp nhận rủi ro còn lại: endpoint tạo lead công khai có thể bị lạm dụng hoặc ghi dữ liệu rác. Đã không đăng ký App Check provider và không bật Enforcement.
- Rules được giới hạn chỉ cho phép tạo lead theo schema/validation; không cho đọc, liệt kê, sửa hoặc xóa lead công khai.

## Việc còn cần làm trong Firebase Console
1. Trong Firebase Console, xác nhận project ID chính xác. Tên hiển thị `GROVA-WEBSITE` không nhất thiết là Project ID; không đoán ID.
2. Kiểm tra Firestore đã bật hay chưa, khu vực dữ liệu, quota/gói thanh toán và liệu project có dữ liệu ứng dụng khác. Không thay đổi billing plan và không xóa/ghi đè dữ liệu hiện có.
3. Xác định cấu trúc collection riêng cho lead, ví dụ `website_leads`, sau khi kiểm tra không xung đột với dữ liệu hiện hữu.
4. Thiết kế quy tắc Firestore tối thiểu quyền. Không dùng rule kiểu `allow read, write: if true`; người truy cập website không được đọc danh sách lead hoặc sửa/xóa lead.
5. (Đã được chủ website miễn yêu cầu) Bỏ qua App Check/chống spam. Chấp nhận nguy cơ spam; Rules vẫn phải giới hạn schema và chặn đọc/sửa/xóa.
6. Đã thêm form client-side dùng Firebase Web SDK và collection `website_leads`.
7. Đã thêm `firestore.rules`: cho phép `create` theo trường dữ liệu hợp lệ; chặn `get`, `list`, `update`, `delete`. Chủ website chấp nhận rủi ro spam khi bỏ qua App Check.
8. Trước khi form gửi thành công, phải publish Rules trong Firebase Console và kiểm thử. Chưa có quyền admin console từ GitHub để publish Rules tự động.
9. Chỉ cấp quyền đọc danh sách lead cho người quản trị đã xác thực. Không nhúng service-account key, private key hay mật khẩu vào JavaScript/GitHub Pages.
10. Kiểm tra gửi thành công/thất bại, chống gửi trùng, giới hạn tần suất, xác thực dữ liệu và kiểm tra quyền bằng tài khoản không phải admin.
11. Sau khi xác nhận URL Zalo chính thức, gắn link vào các nút liên hệ và kiểm tra mở tốt trên iOS/iPadOS.

## Lưu ý kiến trúc
GitHub Pages chỉ phục vụ frontend tĩnh; không được xem mã JavaScript phía trình duyệt là nơi bảo vệ bí mật. Không bật biểu mẫu chỉ bằng cách thêm Firebase config vào trang. Cần xác minh project, quy tắc truy cập và cách ghi dữ liệu an toàn trước. Ưu tiên không thay đổi gói Firebase hiện tại nếu chưa được chủ website đồng ý.

## Điều kiện hoàn tất Phase 5
- [x] Firebase Project ID chính xác được xác nhận từ Firebase Console.
- [x] Form frontend và consent đã được triển khai trong mã nguồn.
- [x] Rules giới hạn tạo lead, chặn đọc/sửa/xóa công khai đã được tạo trong repository.
- [ ] Chủ website cần dán/publish Rules trong Firebase Console.
- [ ] Kiểm thử gửi lead sau khi publish Rules.
- [ ] URL Zalo chính thức được cung cấp và kiểm tra.


## Cập nhật sau khi nhận Firebase Web config
- Đã thêm `firebase-config.js` và nạp file từ `index.html`; chưa khởi tạo SDK hay ghi Firestore.
- Form vẫn vô hiệu hóa, có thông báo rõ rằng dữ liệu chưa được gửi/lưu và lưu ý quyền riêng tư trước khi kích hoạt.
- Không mở quyền Firestore trong Console. Chưa có App Check provider/site key, URL Zalo chính thức hoặc xác nhận billing plan từ màn hình Billing; do đó chưa an toàn để bật nhận lead công khai.


## Implementation status (2026-10-27)
- `firebase-config.js` exports the confirmed web app config for the modular Firebase SDK.
- `lead-form.js` submits validated, consented leads to `website_leads` with a server timestamp.
- Form fields validate name, Vietnamese phone number, optional email, and allowed interest values client-side; Firestore Rules enforce the same core constraints.
- Public visitors cannot read/list/update/delete lead documents under the supplied rules. Admin review/export has not been implemented; do not use the public website to view lead lists.
- App Check remains unregistered; no provider key was created. This follows the owner's request to skip anti-spam. Public creation may still be abused.
- Firestore Rules in the repository are not automatically published to Firebase Console. They must be reviewed and pasted/published manually before the form can save leads.
- No Zalo URL has been invented. The official Zalo link remains pending.


## Quản lý lead nội bộ
- Trang quản trị: `lead-admin.html`; JavaScript: `lead-admin.js`.
- Đăng nhập dùng Firebase Authentication Email/Password. Tài khoản phải được tạo trong Firebase Console; không tạo email hoặc thông tin xác thực thay người quản trị.
- Firestore Rules hiện dùng placeholder `ADMIN_UID_TO_CONFIGURE`. Thay bằng UID thực tế của tài khoản quản trị trước khi Publish Rules. Nếu chưa thay, không tài khoản nào có thể đọc danh sách lead.
- Quyền đọc/tra cứu chỉ cấp cho UID được cấu hình; khách công khai không thể đọc danh sách. Không cho phép sửa hoặc xóa lead qua website.
- Sau khi tạo tài khoản, lấy UID từ Firebase Authentication → Users, cập nhật rule, Publish, rồi kiểm thử trang quản trị.
