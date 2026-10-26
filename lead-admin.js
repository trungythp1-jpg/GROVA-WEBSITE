import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { getFirestore, collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const loginPanel = document.getElementById("admin-login-panel");
const leadsPanel = document.getElementById("admin-leads-panel");
const loginForm = document.getElementById("admin-login-form");
const loginStatus = document.getElementById("admin-login-status");
const dataStatus = document.getElementById("admin-data-status");
const leadsBody = document.getElementById("admin-leads-body");
const mobileLeads = document.getElementById("admin-mobile-leads");
const countLabel = document.getElementById("admin-count");
const searchInput = document.getElementById("admin-search");
const needFilter = document.getElementById("admin-need-filter");
const loginButton = document.getElementById("admin-login-submit");
let allLeads = [];

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const safeText = value => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
})[char]);

const formatDate = value => {
  if (!value || typeof value.toDate !== "function") return "—";
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(value.toDate());
};

const setLoginStatus = message => {
  loginStatus.textContent = message;
  loginStatus.className = "lead-status error";
};

const setDataStatus = (message, kind = "") => {
  dataStatus.textContent = message;
  dataStatus.className = ("lead-status " + kind).trim();
};

const renderLeads = () => {
  const term = searchInput.value.trim().toLocaleLowerCase("vi");
  const need = needFilter.value;
  const filtered = allLeads.filter(lead => {
    const text = [lead.name, lead.phone, lead.email, lead.need].join(" ").toLocaleLowerCase("vi");
    return (!term || text.includes(term)) && (!need || lead.need === need);
  });
  countLabel.textContent = filtered.length + " khách hàng";
  if (!filtered.length) {
    leadsBody.innerHTML = '<tr><td colspan="5">Không có dữ liệu phù hợp.</td></tr>';
    mobileLeads.innerHTML = '<p class="admin-empty">Không có dữ liệu phù hợp.</p>';
    return;
  }
  leadsBody.innerHTML = filtered.map(lead => `<tr><td>${safeText(formatDate(lead.createdAt))}</td><td>${safeText(lead.name)}</td><td><a href="tel:${safeText(lead.phone)}">${safeText(lead.phone)}</a></td><td>${safeText(lead.email || "—")}</td><td>${safeText(lead.need)}</td></tr>`).join("");
  mobileLeads.innerHTML = filtered.map(lead => `<article class="admin-lead-card"><small>${safeText(formatDate(lead.createdAt))}</small><h3>${safeText(lead.name)}</h3><p><b>Điện thoại:</b> <a href="tel:${safeText(lead.phone)}">${safeText(lead.phone)}</a></p><p><b>Email:</b> ${safeText(lead.email || "—")}</p><p><b>Nhu cầu:</b> ${safeText(lead.need)}</p></article>`).join("");
};

const loadLeads = async () => {
  setDataStatus("Đang tải danh sách khách hàng…");
  try {
    const result = await Promise.race([
      getDocs(query(collection(db, "website_leads"), orderBy("createdAt", "desc"))),
      new Promise((_, reject) => setTimeout(() => reject(Object.assign(new Error("Request timed out"), { code: "grova/timeout" })), 12000))
    ]);
    allLeads = result.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderLeads();
    setDataStatus(allLeads.length ? "" : "Chưa có khách hàng nào được lưu trong Firestore.", allLeads.length ? "" : "");
  } catch (error) {
    allLeads = [];
    renderLeads();
    if (error?.code === "permission-denied" || error?.code === "firestore/permission-denied") {
      setDataStatus("Tài khoản chưa có quyền đọc. Hãy Publish Firestore Rules mới và kiểm tra UID đăng nhập.", "error");
    } else if (error?.code === "grova/timeout") {
      setDataStatus("Firestore không phản hồi sau 12 giây. Kiểm tra mạng, project Firebase và Rules đã Publish.", "error");
    } else {
      setDataStatus("Không tải được dữ liệu (" + (error?.code || "lỗi không xác định") + "). Kiểm tra kết nối, Firebase Authentication và Firestore Rules.", "error");
    }
  }
};

loginForm.addEventListener("submit", async event => {
  event.preventDefault();
  loginButton.disabled = true;
  loginStatus.textContent = "Đang đăng nhập…";
  loginStatus.className = "lead-status";
  try {
    await signInWithEmailAndPassword(auth, document.getElementById("admin-email").value.trim(), document.getElementById("admin-password").value);
  } catch (error) {
    setLoginStatus(error?.code === "auth/invalid-credential" ? "Email hoặc mật khẩu không đúng." : "Không đăng nhập được. Kiểm tra Firebase Authentication đã bật Email/Password và tài khoản quản trị đã được tạo.");
  } finally {
    loginButton.disabled = false;
  }
});

document.getElementById("admin-logout").addEventListener("click", () => signOut(auth));
document.getElementById("admin-refresh").addEventListener("click", loadLeads);
searchInput.addEventListener("input", renderLeads);
needFilter.addEventListener("change", renderLeads);

onAuthStateChanged(auth, async user => {
  loginPanel.hidden = Boolean(user);
  leadsPanel.hidden = !user;
  if (user) {
    loginStatus.textContent = "";
    await loadLeads();
  } else {
    allLeads = [];
    leadsBody.innerHTML = '<tr><td colspan="5">Đăng nhập để xem danh sách.</td></tr>';
    mobileLeads.innerHTML = "";
    countLabel.textContent = "";
  }
});
