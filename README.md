# GROVA WEBSITE

Website tập đoàn GROVA HOLDINGS, xây dựng bằng HTML, CSS và JavaScript thuần, triển khai qua GitHub Pages.

## Cấu trúc chính
- `index.html` — trang chủ tiếng Việt
- `styles.css` — giao diện responsive và màu thương hiệu
- `script.js` — menu di động, hiệu ứng GSAP/ScrollTrigger và năm bản quyền
- `assets/grova_logo.png` — logo GROVA đã được cung cấp
- `.github/workflows/pages.yml` — tự động triển khai GitHub Pages
- `docs/BRAND-GUIDELINES.md` — quy chuẩn nhận diện thương hiệu
- `docs/COMPANY-CONTENT.md` — nội dung và thông tin cần xác nhận trước khi công bố

## Hệ sinh thái đã được xác nhận
1. GROVA ELEVATOR
2. GROVA ELEVATOR INTERIORS — thiết kế, trang trí và thi công nội thất cabin thang máy
3. GROVA LAW
4. GROVA EDUCATION

GROVA DOCUMENT không còn là đơn vị hiển thị trên trang chủ tập đoàn; hệ thống GROVA DOCUMENT độc lập không thuộc phạm vi repo website này và không được sửa đổi.

## Triển khai
Workflow nằm tại `.github/workflows/pages.yml`, kích hoạt khi có thay đổi trên nhánh `main` hoặc chạy thủ công. Kiểm tra kết quả triển khai trong tab Actions và trạng thái Pages trong Settings → Pages.

URL GitHub Pages dự kiến: https://trungythp1-jpg.github.io/GROVA-WEBSITE/

## Trước khi công bố chính thức
- Xác nhận tên pháp lý, mã số doanh nghiệp (nếu cần công bố), địa chỉ, số điện thoại và email.
- Xác nhận nội dung mô tả từng đơn vị và quyền sử dụng hình ảnh/dự án.
- Kiểm tra website trên máy tính, iPad và điện thoại.
- Không cấu hình DNS cho `grova.com` trước khi kiểm tra DNS hiện tại và các dịch vụ email liên quan.
