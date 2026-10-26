import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const form = document.getElementById("lead-form");
if (form) {
  const status = document.getElementById("lead-status");
  const submit = form.querySelector('button[type="submit"]');
  let sending = false;

  const setStatus = (message, kind = "") => {
    status.textContent = message;
    status.className = ("lead-status " + kind).trim();
  };

  try {
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (sending || !form.reportValidity()) return;

      const name = document.getElementById("lead-name").value.trim();
      const phone = document.getElementById("lead-phone").value.trim().replace(/[\s().-]/g, "");
      const email = document.getElementById("lead-email").value.trim().toLowerCase();
      const need = document.getElementById("lead-need").value;
      const consent = document.getElementById("lead-consent").checked;

      if (name.length < 2 || name.length > 100) {
        setStatus("Vui lòng nhập họ tên từ 2 đến 100 ký tự.", "error");
        return;
      }
      if (!/^0[0-9]{9,10}$/.test(phone)) {
        setStatus("Vui lòng kiểm tra số điện thoại Việt Nam (bắt đầu bằng 0, gồm 10–11 chữ số).", "error");
        return;
      }
      if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
        setStatus("Vui lòng kiểm tra địa chỉ email.", "error");
        return;
      }
      if (!["GROVA ELEVATOR", "GROVA ELEVATOR INTERIORS", "GROVA LAW", "GROVA EDUCATION", "Hợp tác khác"].includes(need)) {
        setStatus("Vui lòng chọn lĩnh vực cần tư vấn.", "error");
        return;
      }
      if (!consent) {
        setStatus("Vui lòng xác nhận đồng ý để GROVA liên hệ tư vấn.", "error");
        return;
      }

      sending = true;
      submit.disabled = true;
      submit.textContent = "Đang gửi…";
      setStatus("Đang gửi thông tin…");

      try {
        await addDoc(collection(db, "website_leads"), {
          name,
          phone,
          email,
          need,
          consent: true,
          source: "grova-website",
          createdAt: serverTimestamp()
        });
        form.reset();
        setStatus("Đã gửi nhu cầu tư vấn. GROVA sẽ liên hệ khi có thể.", "success");
      } catch (error) {
        console.error("GROVA lead submission failed:", error?.code || "unknown");
        if (error?.code === "permission-denied" || error?.code === "firestore/permission-denied") {
          setStatus("Chưa gửi được: quyền Firestore chưa được cấu hình. Vui lòng gọi GROVA theo số điện thoại trên trang.", "error");
        } else {
          setStatus("Chưa gửi được do lỗi kết nối. Vui lòng thử lại hoặc gọi GROVA theo số điện thoại trên trang.", "error");
        }
      } finally {
        sending = false;
        submit.disabled = false;
        submit.textContent = "Gửi nhu cầu tư vấn";
      }
    });
  } catch (error) {
    console.error("GROVA Firebase initialization failed:", error?.code || "unknown");
    setStatus("Biểu mẫu hiện chưa kết nối được. Vui lòng gọi GROVA theo số điện thoại trên trang.", "error");
    submit.disabled = true;
  }
}
