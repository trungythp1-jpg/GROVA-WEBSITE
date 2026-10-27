import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import { getFirestore, collection, doc, getDoc, getDocs, query, where, orderBy, limit, addDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const $ = (id) => document.getElementById(id);
const state = { user: null, profile: null, clockIn: null, clockOut: null, location: null, recordId: null, requests: [], sites: [], records: [] };
const fmtTime = (date) => date ? new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Ho_Chi_Minh" }).format(date) : "--:--";
const fmtDate = (date) => new Intl.DateTimeFormat("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" }).format(date);
const todayKey = () => new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
let toastTimer;
function toast(message) {
  const node = $("toast");
  node.textContent = message;
  node.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove("show"), 3000);
}
function feedback(message, error = false) {
  $("feedback").textContent = message;
  $("feedback").className = "feedback" + (error ? " error" : "");
}
function updateClock() {
  const now = new Date();
  $("clock").textContent = new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "Asia/Ho_Chi_Minh" }).format(now);
  $("today-date").textContent = fmtDate(now).toLocaleUpperCase("vi-VN");
}
function durationText() {
  if (!state.clockIn) return "--";
  const end = state.clockOut || new Date();
  const minutes = Math.max(0, Math.floor((end - state.clockIn) / 60000));
  return Math.floor(minutes / 60) + "h " + String(minutes % 60).padStart(2, "0") + "m";
}
function renderAttendance() {
  $("clock-in-value").textContent = fmtTime(state.clockIn);
  $("clock-out-value").textContent = fmtTime(state.clockOut);
  $("duration-value").textContent = durationText();
  $("clock-in").disabled = !state.user || Boolean(state.clockIn);
  $("clock-out").disabled = !state.user || !state.clockIn || Boolean(state.clockOut);
  const status = $("attendance-status");
  status.className = "status-badge " + (state.clockOut ? "good" : "pending");
  status.textContent = state.clockOut ? "Đã hoàn thành" : state.clockIn ? "Đang làm việc" : "Chưa chấm công";
  $("status-caption").textContent = state.clockOut ? "Đã ghi nhận vào ca và tan ca" : state.clockIn ? "Bạn đã bắt đầu ca làm việc" : "Bắt đầu bằng thao tác vào ca";
  $("timeline-in").classList.toggle("done", Boolean(state.clockIn));
  $("timeline-out").classList.toggle("done", Boolean(state.clockOut));
  $("timeline-in-text").textContent = state.clockIn ? "Đã ghi nhận trên hệ thống" : "Đang chờ ghi nhận";
  $("timeline-out-text").textContent = state.clockOut ? "Đã hoàn thành" : "Chưa hoàn thành";
  $("timeline-in-time").textContent = fmtTime(state.clockIn);
  $("timeline-out-time").textContent = fmtTime(state.clockOut);
  const rows = $("recent-rows");
  rows.replaceChildren();
  const row = document.createElement("tr");
  ["Hôm nay", fmtTime(state.clockIn), fmtTime(state.clockOut), state.clockOut ? "Đủ công" : state.clockIn ? "Đang làm" : "Chưa chấm"].forEach((value, index) => {
    const cell = document.createElement("td");
    if (index === 3) {
      const badge = document.createElement("span");
      badge.className = "table-status" + (state.clockOut ? " good" : "");
      badge.textContent = value;
      cell.append(badge);
    } else cell.textContent = value;
    row.append(cell);
  });
  rows.append(row);
}
function showView(name) {
  if (["overview", "sites"].includes(name) && !["admin", "manager"].includes(state.profile?.role)) {
    toast("Bạn không có quyền truy cập mục này");
    return;
  }
  document.querySelectorAll(".view").forEach((view) => view.classList.toggle("active", view.id === "view-" + name));
  document.querySelectorAll(".nav-item").forEach((button) => button.classList.toggle("active", button.dataset.view === name));
  const labels = { today: "CHẤM CÔNG", history: "LỊCH SỬ CÔNG", requests: "YÊU CẦU ĐIỀU CHỈNH", overview: "TỔNG QUAN", sites: "ĐỊA ĐIỂM CHẤM CÔNG" };
  $("page-heading").textContent = labels[name] || "CHẤM CÔNG";
  if (name === "history") renderHistory();
  if (name === "requests") loadRequests().catch(showError);
  if (name === "sites") loadSites().catch(showError);
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function showError(error) {
  const message = error?.code === "permission-denied" ? "Tài khoản chưa được cấp quyền hoặc Rules chưa được triển khai." : error?.message || "Đã xảy ra lỗi. Vui lòng thử lại.";
  feedback(message, true);
  toast(message);
}
function asDate(value) {
  return value?.toDate ? value.toDate() : value instanceof Date ? value : null;
}
async function loadToday() {
  const q = query(collection(db, "attendance_records"), where("uid", "==", state.user.uid), where("date", "==", todayKey()), limit(1));
  const snapshot = await getDocs(q);
  const item = snapshot.docs[0];
  state.recordId = item?.id || null;
  const data = item?.data();
  state.clockIn = asDate(data?.clockInAt);
  state.clockOut = asDate(data?.clockOutAt);
  renderAttendance();
}
async function loadHistory() {
  const q = query(collection(db, "attendance_records"), where("uid", "==", state.user.uid), orderBy("date", "desc"), limit(100));
  const snapshot = await getDocs(q);
  state.records = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}
function renderHistory() {
  const rows = $("history-rows");
  rows.replaceChildren();
  const from = $("from-date").value;
  const to = $("to-date").value;
  state.records.filter((item) => (!from || item.date >= from) && (!to || item.date <= to)).forEach((item) => {
    const inDate = asDate(item.clockInAt);
    const outDate = asDate(item.clockOutAt);
    const mins = inDate && outDate ? Math.floor((outDate - inDate) / 60000) : 0;
    const row = document.createElement("tr");
    [item.date || "", item.siteName || "Chưa xác định", fmtTime(inDate), fmtTime(outDate), outDate ? Math.floor(mins / 60) + "h " + String(mins % 60).padStart(2, "0") + "m" : "--", outDate ? "Đủ công" : "Đang làm"].forEach((value, index) => {
      const cell = document.createElement("td");
      if (index === 5) {
        const badge = document.createElement("span");
        badge.className = "table-status" + (outDate ? " good" : "");
        badge.textContent = value;
        cell.append(badge);
      } else cell.textContent = value;
      row.append(cell);
    });
    rows.append(row);
  });
}
async function loadRequests() {
  const q = query(collection(db, "attendance_adjustment_requests"), where("uid", "==", state.user.uid), orderBy("createdAt", "desc"), limit(50));
  const snapshot = await getDocs(q);
  state.requests = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  renderRequests();
}
function renderRequests() {
  const list = $("request-list");
  list.replaceChildren();
  if (!state.requests.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Chưa có yêu cầu điều chỉnh.";
    list.append(empty);
    return;
  }
  state.requests.forEach((request) => {
    const item = document.createElement("div");
    item.className = "request-item";
    const title = document.createElement("strong");
    title.textContent = request.date + " · " + (request.requestedClockIn || "--:--") + " / " + (request.requestedClockOut || "--:--");
    const reason = document.createElement("p");
    reason.textContent = request.reason;
    const badge = document.createElement("span");
    badge.className = "table-status";
    badge.textContent = request.status === "approved" ? "Đã duyệt" : request.status === "rejected" ? "Từ chối" : "Chờ duyệt";
    item.append(title, reason, badge);
    list.append(item);
  });
}
async function loadSites() {
  const snapshot = await getDocs(query(collection(db, "attendance_sites"), where("active", "==", true)));
  state.sites = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  const list = $("site-list");
  list.replaceChildren();
  state.sites.forEach((site) => {
    const card = document.createElement("article");
    card.className = "panel site-card";
    const symbol = document.createElement("span");
    symbol.className = "site-symbol";
    symbol.textContent = "⌖";
    const status = document.createElement("span");
    status.className = "site-state";
    status.textContent = "HOẠT ĐỘNG";
    const title = document.createElement("h2");
    title.textContent = site.name || "Địa điểm";
    const address = document.createElement("p");
    address.className = "muted";
    address.textContent = site.address || "";
    const radius = document.createElement("div");
    radius.className = "site-meta";
    radius.textContent = "Bán kính cho phép: " + (site.radiusMeters || 150) + " m";
    card.append(symbol, status, title, address, radius);
    list.append(card);
  });
}
function distanceMeters(a, b) {
  const rad = (value) => value * Math.PI / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}
function getLocation() {
  feedback("");
  if (!navigator.geolocation) {
    feedback("Thiết bị không hỗ trợ GPS.", true);
    return;
  }
  $("location-state").textContent = "Đang lấy vị trí...";
  navigator.geolocation.getCurrentPosition((position) => {
    state.location = { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy };
    $("location-state").textContent = "Đã lấy vị trí thiết bị";
    $("location-detail").textContent = "Độ chính xác khoảng " + Math.round(position.coords.accuracy) + " m";
    toast("Đã lấy vị trí GPS");
  }, (error) => {
    const messages = { 1: "Bạn chưa cấp quyền truy cập vị trí.", 2: "Không xác định được vị trí.", 3: "Yêu cầu GPS đã hết thời gian." };
    $("location-state").textContent = "Chưa lấy được vị trí";
    $("location-detail").textContent = messages[error.code] || "Vui lòng thử lại";
    feedback($("location-detail").textContent, true);
  }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
}
async function requireLocationAndSite() {
  if (!state.location) throw new Error("Hãy lấy vị trí GPS trước khi chấm công.");
  const snapshot = await getDocs(query(collection(db, "attendance_sites"), where("active", "==", true)));
  const sites = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  const site = sites.find((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude) && distanceMeters(state.location, item) <= Number(item.radiusMeters || 150));
  if (!site) throw new Error("Bạn đang ngoài bán kính địa điểm chấm công được phép.");
  return site;
}
$("clock-in").addEventListener("click", async () => {
  if (!state.user) return;
  try {
    const site = await requireLocationAndSite();
    if (state.recordId || state.clockIn) throw new Error("Bạn đã chấm công vào ca hôm nay.");
    const ref = await addDoc(collection(db, "attendance_records"), { uid: state.user.uid, date: todayKey(), siteId: site.id, siteName: site.name || "", clockInAt: serverTimestamp(), clockInLocation: state.location, clockOutAt: null, clockOutLocation: null, createdAt: serverTimestamp() });
    state.recordId = ref.id;
    await loadToday();
    feedback("Đã ghi nhận giờ vào trên hệ thống.");
    toast("Chấm công vào ca thành công");
  } catch (error) { showError(error); }
});
$("clock-out").addEventListener("click", async () => {
  if (!state.user || !state.recordId || !state.clockIn || state.clockOut) return;
  try {
    const site = await requireLocationAndSite();
    await updateDoc(doc(db, "attendance_records", state.recordId), { clockOutAt: serverTimestamp(), clockOutLocation: state.location, clockOutSiteId: site.id, clockOutSiteName: site.name || "" });
    await loadToday();
    await loadHistory();
    feedback("Đã ghi nhận giờ tan ca trên hệ thống.");
    toast("Chấm công tan ca thành công");
  } catch (error) { showError(error); }
});
$("locate").addEventListener("click", getLocation);
document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => showView(button.dataset.view)));
document.querySelectorAll("[data-go]").forEach((button) => button.addEventListener("click", () => showView(button.dataset.go)));
$("filter-history").addEventListener("click", renderHistory);
$("request-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.user) return;
  const reason = $("request-reason").value.trim();
  if (reason.length < 5) { toast("Vui lòng nhập lý do rõ ràng"); return; }
  try {
    await addDoc(collection(db, "attendance_adjustment_requests"), { uid: state.user.uid, date: $("request-date").value, requestedClockIn: $("request-in").value, requestedClockOut: $("request-out").value, reason, status: "pending", createdAt: serverTimestamp() });
    event.target.reset();
    $("request-date").value = todayKey();
    await loadRequests();
    toast("Đã gửi yêu cầu điều chỉnh");
  } catch (error) { showError(error); }
});
$("export-csv").addEventListener("click", () => {
  const rows = [["Ngày", "Địa điểm", "Giờ vào", "Giờ ra", "Tổng giờ", "Trạng thái"], ...state.records.map((item) => {
    const start = asDate(item.clockInAt);
    const end = asDate(item.clockOutAt);
    const mins = start && end ? Math.floor((end - start) / 60000) : 0;
    return [item.date, item.siteName || "", fmtTime(start), fmtTime(end), end ? Math.floor(mins / 60) + "h " + String(mins % 60).padStart(2, "0") + "m" : "", end ? "Đủ công" : "Đang làm"];
  })];
  const csv = "\ufeff" + rows.map((row) => row.map((value) => '"' + String(value ?? "").replaceAll('"', '""') + '"').join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "grova-attendance.csv";
  link.click();
  URL.revokeObjectURL(url);
});
$("employee-search").addEventListener("input", (event) => {
  const term = event.target.value.trim().toLocaleLowerCase("vi");
  document.querySelectorAll("#employee-rows tr").forEach((row) => { row.hidden = !row.textContent.toLocaleLowerCase("vi").includes(term); });
});
$("add-site").addEventListener("click", () => toast("Chỉ quản trị viên được cấu hình địa điểm qua Firebase Console."));
const login = document.createElement("div");
login.id = "attendance-login";
login.style.cssText = "position:fixed;inset:0;z-index:1000;background:#f4f7f5;display:grid;place-items:center;padding:20px";
login.innerHTML = '<form id="login-form" style="width:min(420px,100%);background:#fff;padding:28px;border:1px solid #dce4dc;border-radius:14px;box-shadow:0 18px 60px #102b2014"><img src="assets/grova_logo.png" alt="GROVA HOLDINGS" style="max-width:160px;max-height:64px;object-fit:contain;margin-bottom:20px"><h1 style="font-size:24px;margin:0 0 8px;color:#07518b">GROVA ATTENDANCE</h1><p style="font-size:13px;color:#66766c;margin-bottom:22px">Đăng nhập bằng tài khoản nhân sự được cấp.</p><label style="display:block;font-size:12px;margin:12px 0 6px">Email</label><input id="login-email" type="email" autocomplete="username" required style="box-sizing:border-box;width:100%;padding:12px;border:1px solid #dce4dc;border-radius:8px"><label style="display:block;font-size:12px;margin:14px 0 6px">Mật khẩu</label><input id="login-password" type="password" autocomplete="current-password" required style="box-sizing:border-box;width:100%;padding:12px;border:1px solid #dce4dc;border-radius:8px"><button type="submit" style="width:100%;margin-top:18px;padding:13px;border:0;border-radius:8px;background:#07518b;color:#fff;font-weight:700">Đăng nhập</button><p id="login-error" role="status" style="font-size:12px;color:#b44a42"></p></form>';
document.body.append(login);
$("login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  $("login-error").textContent = "";
  try {
    await signInWithEmailAndPassword(auth, $("login-email").value.trim(), $("login-password").value);
  } catch {
    $("login-error").textContent = "Không đăng nhập được. Kiểm tra email, mật khẩu và cấu hình Firebase Authentication.";
  }
});
onAuthStateChanged(auth, async (user) => {
  state.user = user;
  if (!user) {
    login.style.display = "grid";
    return;
  }
  try {
    const profileSnapshot = await getDoc(doc(db, "attendance_users", user.uid));
    if (!profileSnapshot.exists() || profileSnapshot.data().active !== true) {
      await signOut(auth);
      $("login-error").textContent = "Tài khoản chưa được quản trị viên kích hoạt.";
      return;
    }
    state.profile = profileSnapshot.data();
    login.style.display = "none";
    $("page-heading").textContent = "CHẤM CÔNG";
    const admin = ["admin", "manager"].includes(state.profile.role);
    document.querySelectorAll(".admin-label, [data-view='overview'], [data-view='sites']").forEach((node) => { node.style.display = admin ? "" : "none"; });
    const title = $("view-today").querySelector("h1");
    title.textContent = "Xin chào, " + (state.profile.displayName || user.displayName || user.email);
    await Promise.all([loadToday(), loadHistory()]);
    renderHistory();
    await loadRequests();
  } catch (error) {
    showError(error);
  }
});
updateClock();
setInterval(() => { updateClock(); if (state.clockIn && !state.clockOut) $("duration-value").textContent = durationText(); }, 1000);
$("request-date").value = todayKey();
