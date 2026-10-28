import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import { getFirestore, collection, doc, getDoc, getDocs, query, where, orderBy, limit, addDoc, setDoc, runTransaction, updateDoc, serverTimestamp, Timestamp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const $ = (id) => document.getElementById(id);
const state = { user: null, profile: null, taskPage: 1, taskPageSize: 6, clockIn: null, clockOut: null, location: null, recordId: null, requests: [], leaveRequests: [], schedule: { startTime: "08:00", endTime: "17:30" }, sites: [], records: [], employees: [], tasks: [], systemAttendanceRecords: [], editingEmployeeId: null, taskAssignees: [], taskDelegations: [] };
const DEPARTMENTS = [{ id: "marketing", name: "Marketing" }, { id: "sales", name: "Kinh doanh" }, { id: "technical", name: "Kỹ thuật" }, { id: "finance_accounting", name: "Tài chính – Kế toán" }, { id: "administration_hr", name: "Hành chính – Nhân sự" }, { id: "legal", name: "Pháp chế" }, { id: "procurement_supply", name: "Mua hàng – Cung ứng" }];
const departmentName = (id) => DEPARTMENTS.find((item) => item.id === id)?.name || "";
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
function timeToMinutes(value) {
  const [hours, minutes] = String(value || "00:00").split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}
function currentVietnamMinutes() {
  const parts = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Ho_Chi_Minh" }).format(new Date()).split(":").map(Number);
  return parts[0] * 60 + parts[1];
}
function vietnamMinutesForDate(date) {
  const parts = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Ho_Chi_Minh" }).format(date).split(":").map(Number);
  return parts[0] * 60 + parts[1];
}
async function loadSchedule() {
  const snapshot = await getDoc(doc(db, "attendance_settings", "schedule"));
  if (snapshot.exists()) {
    const data = snapshot.data();
    if (/^([01]\d|2[0-3]):[0-5]\d$/.test(data.startTime || "") && /^([01]\d|2[0-3]):[0-5]\d$/.test(data.endTime || "") && timeToMinutes(data.endTime) > timeToMinutes(data.startTime)) {
      state.schedule = { startTime: data.startTime, endTime: data.endTime };
    }
  }
  $("schedule-start-input").value = state.schedule.startTime;
  $("schedule-end-input").value = state.schedule.endTime;
}
async function loadLeaveRequests() {
  const manager = taskRoleLevel(state.profile?.role) >= 2;
  const q = manager
    ? query(collection(db, "attendance_leave_requests"), limit(300))
    : query(collection(db, "attendance_leave_requests"), where("uid", "==", state.user.uid), limit(200));
  const snapshot = await getDocs(q);
  state.leaveRequests = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  renderLeaveBalances();
  renderLeaveRequestLists();
  renderAttendance();
}
function leaveTypeLabel(item) {
  if (item.type === "early_leave") return "Về sớm " + Number(item.minutes || 0) + " phút";
  if (item.type === "half_day") return "Nghỉ nửa ngày (" + (item.halfDayPeriod === "morning" ? "buổi sáng" : "buổi chiều") + ")";
  return "Nghỉ phép nguyên ngày";
}
function renderLeaveRequestLists() {
  const own = $("leave-own-list");
  own.replaceChildren();
  const mine = state.leaveRequests.filter((item) => item.uid === state.user?.uid).sort((a,b) => String(b.date).localeCompare(String(a.date)));
  if (!mine.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Bạn chưa có đăng ký nghỉ hoặc về sớm.";
    own.append(empty);
  } else mine.forEach((item) => {
    const row = document.createElement("div");
    row.className = "leave-review-item";
    const details = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = leaveTypeLabel(item);
    const meta = document.createElement("p");
    meta.textContent = item.date + " · " + item.reason;
    details.append(title, meta);
    const status = document.createElement("span");
    status.className = "leave-status leave-status-" + item.status;
    status.textContent = ({pending:"Chờ duyệt",approved:"Đã duyệt",rejected:"Từ chối"})[item.status] || item.status;
    row.append(details,status);
    own.append(row);
  });
  const manager = ["admin","manager"].includes(state.profile?.role);
  $("leave-review-panel").style.display = manager ? "" : "none";
  $("leave-own-panel").style.display = "";
  const review = $("leave-review-list");
  review.replaceChildren();
  const pending = state.leaveRequests.filter((item) => item.status === "pending").sort((a,b) => String(a.date).localeCompare(String(b.date)));
  if (!pending.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Không có đăng ký đang chờ duyệt.";
    review.append(empty);
  } else pending.forEach((item) => {
    const row = document.createElement("div");
    row.className = "leave-review-item";
    const details = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = leaveTypeLabel(item) + " · " + item.displayName;
    const meta = document.createElement("p");
    meta.textContent = item.date + " · " + item.reason;
    details.append(title,meta);
    row.append(details);
    if (manager) {
      const actions = document.createElement("div");
      actions.className = "leave-review-actions";
      [["approved","Duyệt"],["rejected","Từ chối"]].forEach(([status,label]) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = status === "approved" ? "solid-button" : "outline-button";
        button.textContent = label;
        button.addEventListener("click", async () => {
          button.disabled = true;
          try {
            await updateDoc(doc(db,"attendance_leave_requests",item.id),{status,reviewedAt:serverTimestamp(),reviewedBy:state.user.uid,reviewNote:""});
            await loadLeaveRequests();
            toast(status === "approved" ? "Đã duyệt đăng ký." : "Đã từ chối đăng ký.");
          } catch (error) { showError(error); }
        });
        actions.append(button);
      });
      row.append(actions);
    }
    review.append(row);
  });
}
function renderLeaveBalances() {
  const ownRequests = state.leaveRequests.filter((item) => item.uid === state.user?.uid);
  const year = Number(todayKey().slice(0,4));
  const month = todayKey().slice(0,7);
  const approvedAnnual = ownRequests.filter((item) => ["approved","pending"].includes(item.status) && item.type === "annual_leave" && Number(String(item.date).slice(0,4)) === year).length;
  const approvedHalf = ownRequests.filter((item) => ["approved","pending"].includes(item.status) && item.type === "half_day" && Number(String(item.date).slice(0,4)) === year).length;
  const approvedEarly = ownRequests.filter((item) => ["approved","pending"].includes(item.status) && item.type === "early_leave" && String(item.date).startsWith(month));
  const usedMinutes = approvedEarly.reduce((sum,item) => sum + Number(item.minutes || 0),0);
  $("leave-balance").textContent = Math.max(0,12-approvedAnnual-approvedHalf*0.5) + " ngày";
  $("early-count-balance").textContent = Math.max(0,2-approvedEarly.length) + " lượt";
  $("early-minute-balance").textContent = Math.max(0,60-usedMinutes) + " phút";
}
function renderLeaveType() {
  const type = $("leave-type").value;
  $("early-leave-fields").hidden = type !== "early_leave";
  $("half-day-fields").hidden = type !== "half_day";
}
function durationText() {
  if (!state.clockIn) return "--";
  const end = state.clockOut || new Date();
  const minutes = Math.max(0, Math.floor((end - state.clockIn) / 60000));
  return Math.floor(minutes / 60) + "h " + String(minutes % 60).padStart(2, "0") + "m";
}
function updateClockOutAvailability() {
  const endMinutes = timeToMinutes(state.schedule.endTime);
  const approvedEarlyLeave = state.leaveRequests.find((item) => item.uid === state.user?.uid && item.date === todayKey() && item.type === "early_leave" && item.status === "approved");
  const allowedAt = approvedEarlyLeave ? endMinutes - Number(approvedEarlyLeave.minutes || 0) : endMinutes;
  $("clock-out").disabled = !state.user || !state.clockIn || Boolean(state.clockOut) || currentVietnamMinutes() < allowedAt;
}
function renderAttendance() {
  const sundayOff = new Date(todayKey() + "T12:00:00+07:00").getDay() === 0;
  $("clock-in-value").textContent = fmtTime(state.clockIn);
  $("clock-out-value").textContent = fmtTime(state.clockOut);
  $("duration-value").textContent = durationText();
  const nowMinutes = currentVietnamMinutes();
  const startMinutes = timeToMinutes(state.schedule.startTime);
  const endMinutes = timeToMinutes(state.schedule.endTime);
  const late = Boolean(state.clockIn && vietnamMinutesForDate(state.clockIn) > startMinutes);
  $("clock-in").disabled = !state.user || Boolean(state.clockIn) || sundayOff;
  updateClockOutAvailability();
  $("schedule-hours").textContent = state.schedule.startTime + " – " + state.schedule.endTime;
  $("schedule-message").textContent = sundayOff ? "Hôm nay là Chủ nhật — công ty nghỉ, không cần chấm công." : late ? "Bạn đã vào ca muộn so với giờ bắt đầu " + state.schedule.startTime + "." : "Chấm công sau " + state.schedule.startTime + " sẽ được ghi nhận đi muộn.";
  const adminPanel = $("schedule-admin-panel");
  if (adminPanel) adminPanel.style.display = state.profile?.role === "admin" ? "" : "none";
  const systemPanel = $("system-attendance-panel");
  if (systemPanel) systemPanel.style.display = state.profile?.role === "admin" ? "" : "none";
  const status = $("attendance-status");
  status.className = "status-badge " + (state.clockOut ? "good" : late ? "late" : "pending");
  status.textContent = sundayOff && !state.clockIn ? "Nghỉ Chủ nhật" : state.clockOut ? "Đã hoàn thành" : late ? "Đi muộn" : state.clockIn ? "Đang làm việc" : "Chưa chấm công";
  $("status-caption").textContent = sundayOff && !state.clockIn ? "Ngày nghỉ hàng tuần của công ty" : state.clockOut ? "Đã ghi nhận vào ca và tan ca" : state.clockIn ? "Bạn đã bắt đầu ca làm việc" : "Bắt đầu bằng thao tác vào ca";
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

function dateKeyAddDays(key, amount) {
  const date = new Date(key + "T12:00:00+07:00");
  date.setDate(date.getDate() + amount);
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }).format(date);
}
function isSundayKey(key) {
  return new Date(key + "T12:00:00+07:00").getDay() === 0;
}
async function loadSystemAttendance() {
  if (state.profile?.role !== "admin") throw new Error("Chỉ Admin được xem và in bảng công toàn hệ thống.");
  const loadButton = $("load-system-attendance");
  const printButtons = [$("print-system-attendance"), $("print-system-attendance-bottom")];
  const errorNode = $("system-attendance-error");
  const emptyNode = $("system-attendance-empty");
  const tableWrap = document.querySelector(".system-attendance-table-wrap");
  errorNode.hidden = true;
  errorNode.textContent = "";
  loadButton.disabled = true;
  loadButton.textContent = "Đang tải…";
  printButtons.forEach(button => { button.disabled = true; });
  $("system-attendance-note").textContent = "Đang tải dữ liệu chấm công…";
  const from = $("system-attendance-from").value;
  const to = $("system-attendance-to").value;
  if (!from || !to || from > to) { loadButton.disabled = false; loadButton.textContent = "Xem bảng công"; throw new Error("Vui lòng chọn khoảng ngày hợp lệ."); }
  try {
  const [usersSnap, recordsSnap] = await Promise.all([
    getDocs(query(collection(db, "attendance_users"), where("active", "==", true), limit(500))),
    getDocs(query(collection(db, "attendance_records"), where("date", ">=", from), where("date", "<=", to), limit(5000)))
  ]);
  const users = usersSnap.docs.map(item => ({ id: item.id, ...item.data() })).sort((a,b) => String(a.displayName || a.email || "").localeCompare(String(b.displayName || b.email || ""), "vi"));
  const records = recordsSnap.docs.map(item => ({ id: item.id, ...item.data() }));
  const dates = [];
  for (let day = from; day <= to; day = dateKeyAddDays(day, 1)) dates.push(day);
  const byKey = new Map(records.map(record => [String(record.uid) + "_" + String(record.date), record]));
  const head = $("system-attendance-head"), body = $("system-attendance-body");
  head.replaceChildren(); body.replaceChildren();
  const headRow = document.createElement("tr");
  ["NHÂN VIÊN", "BỘ PHẬN", ...dates.map(day => isSundayKey(day) ? day.slice(8) + "/" + day.slice(5,7) + " CN" : day.slice(8) + "/" + day.slice(5,7)), "TỔNG NGÀY CÔNG"].forEach(label => {
    const th = document.createElement("th"); th.textContent = label; headRow.append(th);
  });
  head.append(headRow);
  users.forEach(user => {
    const row = document.createElement("tr");
    [user.displayName || user.email || user.id, user.department || "Chưa phân bộ phận"].forEach(value => { const td=document.createElement("td"); td.textContent=value; row.append(td); });
    let worked = 0;
    dates.forEach(day => {
      const td = document.createElement("td");
      if (isSundayKey(day)) { td.textContent = "Nghỉ"; td.className = "sunday-cell"; }
      else {
        const record = byKey.get(user.id + "_" + day);
        const start = asDate(record?.clockInAt), end = asDate(record?.clockOutAt);
        if (start && end) { td.textContent = fmtTime(start) + "–" + fmtTime(end); worked += 1; td.className = "attendance-worked"; }
        else if (start) { td.textContent = fmtTime(start) + "–…"; td.className = "attendance-open"; }
        else { td.textContent = "—"; td.className = "attendance-missing"; }
      }
      row.append(td);
    });
    const total = document.createElement("td"); total.textContent = String(worked); total.className = "attendance-total"; row.append(total);
    body.append(row);
  });
  if (!users.length) { const row=document.createElement("tr"),td=document.createElement("td"); td.colSpan=dates.length+3;td.textContent="Không có nhân sự đang hoạt động.";row.append(td);body.append(row); }
  $("system-attendance-note").textContent = "Đã tải " + users.length + " nhân sự · " + dates.length + " ngày · " + records.length + " bản ghi.";
  $("system-attendance-print-period").textContent = "Thời gian: " + from + " đến " + to + " · Chủ nhật: nghỉ hàng tuần";
  emptyNode.hidden = users.length > 0;
  tableWrap.hidden = users.length === 0;
  printButtons.forEach(button => { button.disabled = users.length === 0; });
  } catch (error) {
    errorNode.hidden = false;
    errorNode.textContent = error?.code === "permission-denied" ? "Firebase từ chối quyền đọc dữ liệu. Hãy kiểm tra tài khoản Admin và Firestore Rules." : "Không tải được bảng công: " + (error?.message || "Lỗi không xác định");
    $("system-attendance-note").textContent = "Tải bảng công thất bại.";
    emptyNode.hidden = false;
    emptyNode.querySelector("strong").textContent = "Không tải được dữ liệu";
    emptyNode.querySelector("span:last-child").textContent = "Kiểm tra thông báo lỗi phía trên rồi thử lại.";
    throw error;
  } finally {
    loadButton.disabled = false;
    loadButton.textContent = "Xem bảng công";
  }
}

function showView(name) {
  if (["overview", "sites"].includes(name) && !["admin", "manager"].includes(state.profile?.role)) {
    toast("Bạn không có quyền truy cập mục này");
    return;
  }
  if (name === "tasks") loadTasks().catch(showError);
  if (name === "employees" && state.profile?.role !== "admin") {
    toast("Chỉ Admin được quản lý nhân viên.");
    return;
  }
  document.querySelectorAll(".view").forEach((view) => view.classList.toggle("active", view.id === "view-" + name));
  document.querySelectorAll(".nav-item").forEach((button) => button.classList.toggle("active", button.dataset.view === name));
  const labels = { today: "TRANG CHỦ", tasks: "CÔNG VIỆC CỦA TÔI", history: "LỊCH SỬ CÔNG", requests: "YÊU CẦU ĐIỀU CHỈNH", overview: "TỔNG QUAN", sites: "ĐỊA ĐIỂM CHẤM CÔNG", employees: "QUẢN LÝ NHÂN VIÊN" };
  $("page-heading").textContent = labels[name] || "CHẤM CÔNG";
  if (name === "history") renderHistory();
  if (name === "requests") loadRequests().catch(showError);
  if (name === "sites") loadSites().catch(showError);
  if (name === "overview") { loadOverview().catch(showError); if (state.profile?.role === "admin") { const now=todayKey(); const first=now.slice(0,8)+"01"; $("system-attendance-from").value ||= first; $("system-attendance-to").value ||= now; loadSystemAttendance().catch(() => {}); } }
  if (name === "employees") loadEmployees().catch(showError);
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
  const q = query(collection(db, "attendance_records"), where("uid", "==", state.user.uid), limit(500));
  const snapshot = await getDocs(q);
  const item = snapshot.docs.find((record) => record.data().date === todayKey());
  state.recordId = item?.id || null;
  const data = item?.data();
  state.clockIn = asDate(data?.clockInAt);
  state.clockOut = asDate(data?.clockOutAt);
  renderAttendance();
}
async function loadHistory() {
  const q = query(collection(db, "attendance_records"), where("uid", "==", state.user.uid), limit(500));
  const snapshot = await getDocs(q);
  state.records = snapshot.docs.map((item) => ({ id: item.id, ...item.data() })).sort((a, b) => String(b.date || "").localeCompare(String(a.date || ""))).slice(0, 100);
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
  const manager = ["admin", "manager"].includes(state.profile?.role);
  const q = manager
    ? query(collection(db, "attendance_adjustment_requests"), where("status", "==", "pending"), limit(100))
    : query(collection(db, "attendance_adjustment_requests"), where("uid", "==", state.user.uid), limit(50));
  const snapshot = await getDocs(q);
  state.requests = snapshot.docs.map((item) => ({ id: item.id, ...item.data() })).sort((a, b) => {
    const left = asDate(a.createdAt)?.getTime() || 0;
    const right = asDate(b.createdAt)?.getTime() || 0;
    return right - left;
  });
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
    if (["admin", "manager"].includes(state.profile?.role) && request.status === "pending") {
      const actions = document.createElement("div");
      actions.className = "request-actions";
      const approve = document.createElement("button");
      approve.type = "button";
      approve.className = "solid-button";
      approve.textContent = "Duyệt";
      approve.addEventListener("click", () => reviewRequest(request, "approved"));
      const reject = document.createElement("button");
      reject.type = "button";
      reject.className = "outline-button";
      reject.textContent = "Từ chối";
      reject.addEventListener("click", () => reviewRequest(request, "rejected"));
      actions.append(approve, reject);
      item.append(actions);
    }
    list.append(item);
  });
}
async function reviewRequest(request, status) {
  if (!["admin", "manager"].includes(state.profile?.role) || request.status !== "pending") return;
  const reviewNote = window.prompt(status === "approved" ? "Ghi chú duyệt (có thể để trống):" : "Lý do từ chối:");
  if (reviewNote === null) return;
  if (status === "rejected" && reviewNote.trim().length < 3) { toast("Vui lòng nhập lý do từ chối."); return; }
  try {
    const requestRef = doc(db, "attendance_adjustment_requests", request.id);
    const recordRef = doc(db, "attendance_records", request.uid + "_" + request.date);
    await runTransaction(db, async (transaction) => {
      const latest = await transaction.get(requestRef);
      if (!latest.exists() || latest.data().status !== "pending") throw new Error("Phiếu đã được xử lý hoặc không còn tồn tại.");
      const data = latest.data();
      if (status === "approved") {
        const existing = await transaction.get(recordRef);
        const toTimestamp = (value) => {
          if (!value) return null;
          const parts = value.split(":").map(Number);
          if (parts.length !== 2 || parts.some((part) => !Number.isFinite(part))) throw new Error("Giờ đề nghị không hợp lệ.");
          const [year, month, day] = data.date.split("-").map(Number);
          return Timestamp.fromDate(new Date(year, month - 1, day, parts[0], parts[1], 0, 0));
        };
        const clockInAt = toTimestamp(data.requestedClockIn), clockOutAt = toTimestamp(data.requestedClockOut);
        if (!clockInAt && !clockOutAt) throw new Error("Phiếu chưa có giờ vào hoặc giờ ra đề nghị.");
        const prior = existing.exists() ? existing.data() : null;
        const audit = { adjustmentRequestId: request.id, adjustmentNote: reviewNote.trim(), adjustedBy: state.user.uid, adjustedAt: serverTimestamp(), originalClockInAt: prior?.originalClockInAt || prior?.clockInAt || null, originalClockOutAt: prior?.originalClockOutAt || prior?.clockOutAt || null };
        if (prior) {
          const changes = { ...audit };
          if (clockInAt) changes.clockInAt = clockInAt;
          if (clockOutAt) changes.clockOutAt = clockOutAt;
          transaction.update(recordRef, changes);
        } else {
          transaction.set(recordRef, { uid: data.uid, date: data.date, siteId: "admin-adjustment", siteName: "Điều chỉnh bởi quản lý", clockInAt, clockOutAt, clockInLocation: null, clockOutLocation: null, createdAt: serverTimestamp(), adminAdjusted: true, ...audit });
        }
      }
      transaction.update(requestRef, { status, reviewedAt: serverTimestamp(), reviewedBy: state.user.uid, reviewNote: reviewNote.trim(), ...(status === "approved" ? { appliedRecordId: request.uid + "_" + request.date, appliedAt: serverTimestamp() } : {}) });
    });
    await Promise.all([loadRequests(), loadToday(), loadHistory()]);
    await loadOverview();
    toast(status === "approved" ? "Đã duyệt và cập nhật bảng chấm công." : "Đã từ chối yêu cầu.");
  } catch (error) { showError(error); }
}
async function loadOverview() {
 if (!["admin","manager"].includes(state.profile?.role)) return;
 if (!$("admin-attendance-date").value) $("admin-attendance-date").value=todayKey();
 const date=$("admin-attendance-date").value||todayKey();
 const [us,rs,ps]=await Promise.all([
  getDocs(query(collection(db,"attendance_users"),where("active","==",true),limit(500))),
  getDocs(query(collection(db,"attendance_records"),where("date","==",date),limit(1000))),
  getDocs(query(collection(db,"attendance_adjustment_requests"),where("status","==","pending"),limit(500)))
 ]);
 state.employees=us.docs.map(x=>({id:x.id,...x.data()}));
 state.adminAttendanceRecords=rs.docs.map(x=>({id:x.id,...x.data()}));
 const byUid=new Map(state.adminAttendanceRecords.map(x=>[x.uid,x]));
 $("staff-count").textContent=String(state.employees.length);
 $("checked-in-count").textContent=String(state.adminAttendanceRecords.filter(x=>x.clockInAt).length);
 $("not-checked-count").textContent=String(Math.max(0,state.employees.length-byUid.size));
 $("pending-count").textContent=String(ps.size);
 $("checked-in-note").textContent=date===todayKey()?"Bản ghi hôm nay":"Bản ghi ngày đã chọn";
 const select=$("employee-department-filter"),prev=select.value,depts=[...new Set(state.employees.map(x=>x.department).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"vi"));
 select.replaceChildren(new Option("Tất cả bộ phận",""));depts.forEach(x=>select.add(new Option(x,x)));select.value=depts.includes(prev)?prev:"";
 renderAdminAttendance();await loadAdminAdjustmentRequests();
}
function renderAdminAttendance(){
 const rows=$("employee-rows");if(!rows)return;rows.replaceChildren();
 const term=$("employee-search").value.trim().toLocaleLowerCase("vi"),dept=$("employee-department-filter").value,filter=$("employee-status-filter").value;
 const map=new Map((state.adminAttendanceRecords||[]).map(x=>[x.uid,x]));
 const data=(state.employees||[]).map(user=>{const record=map.get(user.id),start=asDate(record?.clockInAt),end=asDate(record?.clockOutAt),late=!!(start&&fmtTime(start)>(state.schedule?.startTime||"08:00")),sundayOff=isSundayKey($("admin-attendance-date").value||todayKey())&&!record,status=record?.adminAdjusted?"adjusted":late?"late":end?"checked-out":start?"checked-in":sundayOff?"sunday":"missing";return{user,record,start,end,status};}).filter(x=>(!term||[x.user.displayName,x.user.email,x.user.department,x.user.id].join(" ").toLocaleLowerCase("vi").includes(term))&&(!dept||x.user.department===dept)&&(!filter||x.status===filter));
 $("employee-result-count").textContent=data.length+" nhân sự";
 if(!data.length){const row=document.createElement("tr"),cell=document.createElement("td");cell.colSpan=7;cell.className="empty-cell";cell.textContent="Không có nhân sự phù hợp bộ lọc.";row.append(cell);rows.append(row);return;}
 data.forEach(({user,record,start,end,status})=>{const row=document.createElement("tr"),nameCell=document.createElement("td"),wrap=document.createElement("div");wrap.className="admin-employee-name";const name=document.createElement("strong");name.textContent=user.displayName||user.email||user.id;const email=document.createElement("small");email.textContent=user.email||"";wrap.append(name,email);nameCell.append(wrap);row.append(nameCell);
 [user.department||"Chưa phân bộ phận",fmtTime(start),fmtTime(end),start&&end?Math.floor((end-start)/3600000)+"h "+String(Math.floor((end-start)/60000)%60).padStart(2,"0")+"m":"—"].forEach(v=>{const td=document.createElement("td");td.textContent=v;row.append(td);});
 const td=document.createElement("td"),badge=document.createElement("span");badge.className="table-status "+(status==="checked-out"?"good":status==="late"?"late":status==="adjusted"?"adjusted":status==="missing"?"muted-status":"");badge.textContent=({ "checked-out":"Đã tan ca",late:"Đi muộn",adjusted:"Đã điều chỉnh","checked-in":"Đang làm",missing:"Chưa chấm",sunday:"Nghỉ Chủ nhật"})[status];td.append(badge);row.append(td);
 const action=document.createElement("td"),btn=document.createElement("button");btn.type="button";btn.className="outline-button table-detail-button";btn.textContent="Chi tiết";btn.addEventListener("click",()=>showAttendanceDetails(user,record,start,end));action.append(btn);row.append(action);rows.append(row);
 });
}
function showAttendanceDetails(user,record,start,end){
 const pos=p=>p&&typeof p.latitude==="number"&&typeof p.longitude==="number"?p.latitude.toFixed(6)+", "+p.longitude.toFixed(6):"Không có dữ liệu GPS";
 window.alert(["Nhân viên: "+(user.displayName||user.email||user.id),"Ngày: "+$("admin-attendance-date").value,"Giờ vào: "+fmtTime(start),"Giờ ra: "+fmtTime(end),"Địa điểm: "+(record?.siteName||"Chưa xác định"),"GPS vào: "+pos(record?.clockInLocation),"GPS ra: "+pos(record?.clockOutLocation),"Nguồn: "+(record?.adminAdjusted?"Điều chỉnh bởi quản lý":"Chấm công thiết bị"),record?.adjustmentNote?"Ghi chú điều chỉnh: "+record.adjustmentNote:""].filter(Boolean).join("\n"));
}
async function loadAdminAdjustmentRequests(){
 if(!["admin","manager"].includes(state.profile?.role))return;
 const status=$("admin-request-status").value||"pending",q=status==="all"?query(collection(db,"attendance_adjustment_requests"),limit(200)):query(collection(db,"attendance_adjustment_requests"),where("status","==",status),limit(200));
 const snap=await getDocs(q);state.requests=snap.docs.map(x=>({id:x.id,...x.data()})).sort((a,b)=>(asDate(b.createdAt)?.getTime()||0)-(asDate(a.createdAt)?.getTime()||0));renderAdminAdjustmentRequests();
}
function renderAdminAdjustmentRequests(){
 const list=$("admin-adjustment-list");list.replaceChildren();
 if(!state.requests.length){const empty=document.createElement("div");empty.className="empty-state";empty.textContent="Không có phiếu ở trạng thái này.";list.append(empty);return;}
 state.requests.forEach(req=>{const item=document.createElement("article");item.className="admin-adjustment-item";const top=document.createElement("div");top.className="admin-adjustment-top";const head=document.createElement("div"),name=document.createElement("strong");name.textContent=req.displayName||req.employeeName||req.uid||"Nhân viên";const date=document.createElement("small");date.textContent=req.date||"Chưa có ngày";head.append(name,date);const badge=document.createElement("span");badge.className="table-status "+(req.status==="approved"?"good":req.status==="rejected"?"rejected":"");badge.textContent=req.status==="approved"?"Đã duyệt":req.status==="rejected"?"Đã từ chối":"Chờ duyệt";top.append(head,badge);item.append(top);
 const times=document.createElement("div");times.className="admin-adjustment-times";[["Giờ vào đề nghị",req.requestedClockIn||"—"],["Giờ ra đề nghị",req.requestedClockOut||"—"]].forEach(([label,value])=>{const box=document.createElement("div"),small=document.createElement("small"),strong=document.createElement("strong");small.textContent=label;strong.textContent=value;box.append(small,strong);times.append(box);});item.append(times);
 const reason=document.createElement("p");reason.className="admin-adjustment-reason";reason.textContent="Lý do: "+(req.reason||"Không ghi lý do");item.append(reason);
 if(req.reviewedAt){const meta=document.createElement("p");meta.className="admin-review-meta";meta.textContent=(req.status==="approved"?"Đã duyệt":"Đã từ chối")+" · "+(asDate(req.reviewedAt)?fmtDate(asDate(req.reviewedAt))+" "+fmtTime(asDate(req.reviewedAt)):"đã xử lý")+(req.reviewNote?" · "+req.reviewNote:"");item.append(meta);}
 if(req.status==="pending"){const actions=document.createElement("div");actions.className="request-actions";const yes=document.createElement("button");yes.type="button";yes.className="solid-button";yes.textContent="Duyệt và cập nhật công";yes.addEventListener("click",()=>reviewRequest(req,"approved"));const no=document.createElement("button");no.type="button";no.className="outline-button";no.textContent="Từ chối";no.addEventListener("click",()=>reviewRequest(req,"rejected"));actions.append(yes,no);item.append(actions);}list.append(item);
 });
}
function resetEmployeeForm() {
  state.editingEmployeeId = null;
  $("employee-form").reset();
  $("employee-uid").disabled = false;
  $("employee-active").checked = true;
  $("employee-role").value = "employee";
  $("employee-form-title").textContent = "Thêm hồ sơ nhân viên";
  $("employee-save").textContent = "Lưu hồ sơ";
  $("employee-feedback").textContent = "";
}
async function loadEmployees() {
  if (state.profile?.role !== "admin") {
    $("employee-form").style.display = "none";
    const delegationPanel = $("view-employees").querySelector(".delegation-panel");
    if (delegationPanel) delegationPanel.style.display = "none";
    return;
  }
  const snapshot = await getDocs(query(collection(db, "attendance_users"), limit(500)));
  state.employees = snapshot.docs.map((item) => ({ id: item.id, ...item.data() })).sort((a, b) => String(a.displayName || "").localeCompare(String(b.displayName || ""), "vi"));
  renderEmployees();
  const delegationPanel = $("view-employees").querySelector(".delegation-panel");
  if (delegationPanel) delegationPanel.style.display = "";
  await loadDelegations();
}
async function loadDelegations() {
  if (state.profile?.role !== "admin") return;
  const grantee = $("delegation-grantee");
  const previous = grantee.value;
  grantee.replaceChildren(new Option("Chọn quản lý", ""));
  state.employees.filter((employee) => employee.active === true && taskRoleLevel(employee.role) >= 2 && employee.role !== "admin").forEach((employee) => {
    grantee.add(new Option([employee.displayName || employee.email || employee.id, departmentName(employee.departmentId) || employee.department].filter(Boolean).join(" · "), employee.id));
  });
  if (state.employees.some((employee) => employee.id === previous && employee.active === true)) grantee.value = previous;
  const snapshot = await getDocs(query(collection(db, "attendance_delegations"), limit(500)));
  const list = $("delegation-list");
  list.replaceChildren();
  const delegations = snapshot.docs.map((item) => ({ id: item.id, ...item.data() })).sort((a, b) => String(b.updatedAt?.toDate?.() || "").localeCompare(String(a.updatedAt?.toDate?.() || "")));
  if (!delegations.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Chưa có quyền ủy quyền liên phòng ban.";
    list.append(empty);
    return;
  }
  delegations.forEach((delegation) => {
    const item = document.createElement("div");
    item.className = "request-item";
    const title = document.createElement("strong");
    const granteeProfile = state.employees.find((employee) => employee.id === delegation.granteeUid);
    title.textContent = (granteeProfile?.displayName || delegation.granteeUid) + " · " + (delegation.active === true ? "Đang hoạt động" : "Đã thu hồi");
    const detail = document.createElement("p");
    detail.className = "muted small";
    detail.textContent = (delegation.sourceDepartmentIds || []).map(departmentName).join(", ") + " → " + (delegation.targetDepartmentIds || []).map(departmentName).join(", ") + " · " + (delegation.reason || "Không có lý do");
    item.append(title, detail);
    if (delegation.active === true) {
      const revoke = document.createElement("button");
      revoke.type = "button";
      revoke.className = "outline-button";
      revoke.textContent = "Thu hồi quyền";
      revoke.addEventListener("click", async () => {
        if (state.profile?.role !== "admin") return;
        revoke.disabled = true;
        try {
          await updateDoc(doc(db, "attendance_delegations", delegation.id), { active: false, updatedAt: serverTimestamp() });
          await loadDelegations();
          toast("Đã thu hồi quyền ủy quyền.");
        } catch (error) {
          revoke.disabled = false;
          showError(error);
        }
      });
      item.append(revoke);
    }
    list.append(item);
  });
}
function renderEmployees() {
  const rows = $("employee-admin-rows");
  rows.replaceChildren();
  if (!state.employees.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 5;
    cell.textContent = "Chưa có hồ sơ nhân viên.";
    row.append(cell);
    rows.append(row);
    return;
  }
  state.employees.forEach((employee) => {
    const row = document.createElement("tr");
    const values = [employee.displayName || employee.email || employee.id, departmentName(employee.departmentId) || employee.department || "Chưa phân bộ phận", employee.role || "employee", employee.active === true ? "Đang hoạt động" : "Đã khóa"];
    values.forEach((value, index) => {
      const cell = document.createElement("td");
      if (index === 3) {
        const badge = document.createElement("span");
        badge.className = "table-status" + (employee.active === true ? " good" : "");
        badge.textContent = value;
        cell.append(badge);
      } else cell.textContent = value;
      row.append(cell);
    });
    const actionCell = document.createElement("td");
    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "outline-button";
    edit.textContent = "Sửa";
    edit.addEventListener("click", () => {
      state.editingEmployeeId = employee.id;
      $("employee-uid").value = employee.id;
      $("employee-uid").disabled = true;
      $("employee-name").value = employee.displayName || "";
      $("employee-email").value = employee.email || "";
      $("employee-department").value = employee.departmentId || "";
      $("employee-role").value = ["employee", "team_lead", "manager", "department_head", "executive_director", "admin"].includes(employee.role) ? employee.role : "employee";
      $("employee-active").checked = employee.active === true;
      $("employee-form-title").textContent = "Sửa hồ sơ nhân viên";
      $("employee-save").textContent = "Cập nhật hồ sơ";
      $("employee-feedback").textContent = "";
      $("employee-form").scrollIntoView({ behavior: "smooth", block: "start" });
    });
    actionCell.append(edit);
    row.append(actionCell);
    rows.append(row);
  });
  $("employee-admin-search").dispatchEvent(new Event("input"));
}
function taskRoleLevel(role) { return ({ employee: 1, team_lead: 2, manager: 3, department_head: 4, executive_director: 5, admin: 6 })[role] || 0; }
function delegationIsValid(delegation, sourceDepartmentId, targetDepartmentId) {
  const now = Date.now();
  const validFrom = delegation.validFrom?.toDate ? delegation.validFrom.toDate().getTime() : new Date(delegation.validFrom || 0).getTime();
  const validUntil = delegation.validUntil?.toDate ? delegation.validUntil.toDate().getTime() : (delegation.validUntil ? new Date(delegation.validUntil).getTime() : null);
  return delegation.active === true && validFrom <= now && (validUntil === null || validUntil > now) && Array.isArray(delegation.sourceDepartmentIds) && delegation.sourceDepartmentIds.includes(sourceDepartmentId) && Array.isArray(delegation.targetDepartmentIds) && delegation.targetDepartmentIds.includes(targetDepartmentId) && Array.isArray(delegation.permissions) && delegation.permissions.includes("task_assign");
}
function taskStatusLabel(status) {
  return ({ todo: "Mới giao", in_progress: "Đang thực hiện", done: "Hoàn thành" })[status] || "Mới giao";
}
function renderTasks() {
  const list = $("task-list");
  list.replaceChildren();
  const filter = $("task-status-filter").value || "all";
  const term = $("task-search").value.trim().toLocaleLowerCase("vi");
  const filtered = state.tasks.filter(task => {
    const status = task.status || "todo";
    const statusMatch = filter === "active" ? status !== "done" : filter === "all" || status === filter;
    const searchMatch = !term || [task.title, task.description, task.assigneeName, task.assigneeUid].join(" ").toLocaleLowerCase("vi").includes(term);
    return statusMatch && searchMatch;
  });
  $("task-total").textContent = String(state.tasks.length);
  $("task-active").textContent = String(state.tasks.filter(task => task.status === "in_progress").length);
  $("task-pending").textContent = String(state.tasks.filter(task => (task.status || "todo") !== "done").length);
  const filterSelect = $("task-status-filter");
  if (filterSelect && !filterSelect.value) filterSelect.value = "all";
  const pageCount = Math.max(1, Math.ceil(filtered.length / state.taskPageSize));
  state.taskPage = Math.min(Math.max(1, state.taskPage), pageCount);
  const start = (state.taskPage - 1) * state.taskPageSize;
  const pageItems = filtered.slice(start, start + state.taskPageSize);
  $("task-list-summary").textContent = filtered.length ? "Hiển thị " + (start + 1) + "–" + Math.min(start + pageItems.length, filtered.length) + " / " + filtered.length + " công việc" : "0 công việc phù hợp";
  $("task-page-label").textContent = "Trang " + state.taskPage + " / " + pageCount;
  $("task-prev-page").disabled = state.taskPage <= 1;
  $("task-next-page").disabled = state.taskPage >= pageCount;
  $("task-pagination").style.display = filtered.length > state.taskPageSize ? "flex" : "none";
  if (!filtered.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.className = "empty-state task-empty-state";
    const title = document.createElement("strong");
    const detail = document.createElement("span");
    const reset = document.createElement("button");
    reset.type = "button";
    reset.className = "outline-button";
    if (state.tasks.length) {
      title.textContent = "Không tìm thấy công việc phù hợp";
      detail.textContent = "Hãy đổi trạng thái lọc hoặc xóa từ khóa tìm kiếm.";
      reset.textContent = "Xóa bộ lọc";
      reset.addEventListener("click", () => { $("task-search").value = ""; $("task-status-filter").value = "all"; state.taskPage = 1; renderTasks(); });
      empty.append(title, detail, reset);
    } else {
      title.textContent = "Chưa có công việc";
      detail.textContent = "Khi có công việc được giao hoặc do bạn tạo, danh sách sẽ hiển thị tại đây.";
      empty.append(title, detail);
    }
    list.append(empty);
    return;
  }
  pageItems.forEach(task => {
    const card = document.createElement("article");
    card.className = "task-card";
    const top = document.createElement("div");
    top.className = "task-card-top";
    const titleWrap = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = task.title || "Công việc";
    const meta = document.createElement("p");
    meta.className = "muted small";
    meta.textContent = (task.assigneeName || task.assigneeUid || "Chưa rõ người nhận") + " · Hạn " + (task.dueDate || "Chưa đặt");
    titleWrap.append(title, meta);
    const badge = document.createElement("span");
    badge.className = "task-status task-status-" + (task.status || "todo");
    badge.textContent = taskStatusLabel(task.status);
    top.append(titleWrap, badge);
    const description = document.createElement("p");
    description.className = "task-description";
    description.textContent = task.description || "Không có mô tả.";
    const bottom = document.createElement("div");
    bottom.className = "task-card-bottom";
    const priority = document.createElement("span");
    priority.className = "task-priority task-priority-" + (task.priority || "normal");
    priority.textContent = ({ normal: "Ưu tiên bình thường", high: "Ưu tiên cao", urgent: "Khẩn cấp" })[task.priority] || "Ưu tiên bình thường";
    const status = document.createElement("select");
    status.setAttribute("aria-label", "Cập nhật trạng thái công việc");
    [["todo","Mới giao"],["in_progress","Đang thực hiện"],["done","Hoàn thành"]].forEach(([value,label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      status.append(option);
    });
    status.value = task.status || "todo";
    const assignedEmployee = state.taskAssignees.find(employee => employee.id === task.assigneeUid);
    const canManageTask = taskRoleLevel(state.profile?.role) > taskRoleLevel(assignedEmployee?.role || "employee");
    status.disabled = task.assigneeUid !== state.user.uid && !canManageTask;
    status.addEventListener("change", async () => {
      const previousStatus = task.status || "todo";
      status.disabled = true;
      try {
        await updateDoc(doc(db, "workspace_tasks", task.id), { status: status.value, updatedAt: serverTimestamp() });
        task.status = status.value;
        state.taskPage = 1;
        toast("Đã cập nhật trạng thái công việc.");
        renderTasks();
      } catch (error) {
        status.value = previousStatus;
        status.disabled = task.assigneeUid !== state.user.uid && !canManageTask;
        showError(error);
      }
    });
    bottom.append(priority, status);
    card.append(top, description, bottom);
    list.append(card);
  });
}
async function loadTaskAssignees() {
  if (taskRoleLevel(state.profile?.role) < 2) return;
  const select = $("task-assignee");
  const snapshot = await getDocs(query(collection(db, "attendance_users"), limit(500)));
  const isAdmin = state.profile?.role === "admin";
  const actorDepartmentId = state.profile?.departmentId || "";
  const delegationSnapshot = isAdmin ? null : await getDocs(query(collection(db, "attendance_delegations"), where("granteeUid", "==", state.user.uid), limit(200)));
  state.taskDelegations = delegationSnapshot ? delegationSnapshot.docs.map((item) => ({ id: item.id, ...item.data() })) : [];
  const employees = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
    .filter((employee) => {
      if (employee.active !== true || taskRoleLevel(state.profile?.role) <= taskRoleLevel(employee.role) || employee.id === state.user?.uid || !employee.departmentId) return false;
      if (isAdmin) return true;
      if (!actorDepartmentId) return false;
      if (employee.departmentId === actorDepartmentId) return true;
      return state.taskDelegations.some((delegation) => delegationIsValid(delegation, actorDepartmentId, employee.departmentId));
    });
  state.taskAssignees = employees;
  employees.sort((a, b) => String(a.displayName || a.email || "").localeCompare(String(b.displayName || b.email || ""), "vi"));
  select.replaceChildren();
  select.append(new Option(employees.length ? "Chọn nhân sự nhận việc" : "Chưa có nhân sự đang hoạt động", ""));
  employees.forEach((employee) => {
    const option = new Option([employee.displayName || employee.email || employee.id, departmentName(employee.departmentId) || employee.department].filter(Boolean).join(" · "), employee.id);
    select.append(option);
  });
  $("task-assignee-meta").textContent = isAdmin ? employees.length + " nhân sự đang hoạt động · Admin có thể giao việc toàn công ty." : employees.length + " nhân sự trong phạm vi phòng ban và ủy quyền đang hoạt động.";
}
async function loadTasks() {
  const manager = taskRoleLevel(state.profile?.role) >= 2;
  $("task-create-panel").style.display = manager ? "" : "none";
  state.taskAssignees = [];
  if (manager) await loadTaskAssignees();
  const taskQueries = manager
    ? [query(collection(db, "workspace_tasks"), where("createdBy", "==", state.user.uid), limit(200)), query(collection(db, "workspace_tasks"), where("assigneeUid", "==", state.user.uid), limit(200))]
    : [query(collection(db, "workspace_tasks"), where("assigneeUid", "==", state.user.uid), limit(200))];
  const snapshots = await Promise.all(taskQueries.map((taskQuery) => getDocs(taskQuery)));
  const taskMap = new Map();
  snapshots.forEach((snapshot) => snapshot.docs.forEach((item) => taskMap.set(item.id, { id: item.id, ...item.data() })));
  state.tasks = [...taskMap.values()].sort((a,b) => {
    const ad = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
    const bd = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
    return bd-ad;
  });
  state.taskPage = 1;
  renderTasks();
}
$("task-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (taskRoleLevel(state.profile?.role) < 2) return;
  const button = $("task-submit");
  button.disabled = true;
  $("task-feedback").textContent = "";
  try {
    const assigneeUid = $("task-assignee").value;
    if (!assigneeUid) throw new Error("Hãy chọn nhân sự nhận việc.");
    if (assigneeUid === state.user.uid) throw new Error("Không thể tự giao việc cho chính mình.");
    const assigneeSnapshot = await getDoc(doc(db, "attendance_users", assigneeUid));
    if (!assigneeSnapshot.exists() || assigneeSnapshot.data().active !== true) throw new Error("Không tìm thấy hồ sơ nhân viên đang hoạt động với UID này.");
    const profile = assigneeSnapshot.data();
    if (taskRoleLevel(state.profile?.role) <= taskRoleLevel(profile.role)) throw new Error("Chỉ được giao việc cho nhân sự có cấp bậc thấp hơn.");
    const targetDepartmentId = profile.departmentId || "";
    const sourceDepartmentId = state.profile?.departmentId || (state.profile?.role === "admin" ? targetDepartmentId : "");
    if (!sourceDepartmentId || !targetDepartmentId) throw new Error("Hồ sơ người giao và người nhận phải được Admin phân phòng ban trước khi giao việc.");
    let delegationId = null;
    if (state.profile?.role !== "admin" && sourceDepartmentId !== targetDepartmentId) {
      const delegation = state.taskDelegations.find((item) => delegationIsValid(item, sourceDepartmentId, targetDepartmentId));
      if (!delegation) throw new Error("Bạn chưa được Admin ủy quyền giao việc tới phòng ban này.");
      delegationId = delegation.id;
    }
    await addDoc(collection(db, "workspace_tasks"), {
      title: $("task-title").value.trim(),
      description: $("task-description").value.trim(),
      assigneeUid,
      assigneeName: profile.displayName || profile.email || assigneeUid,
      sourceDepartmentId,
      targetDepartmentId,
      delegationId,
      createdBy: state.user.uid,
      createdByName: state.profile.displayName || state.user.email || "",
      status: "todo",
      priority: $("task-priority").value,
      dueDate: $("task-due").value,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    $("task-form").reset();
    $("task-priority").value = "normal";
    $("task-feedback").textContent = "Đã giao công việc.";
    $("task-feedback").className = "feedback success";
    toast("Đã giao công việc.");
    loadTasks().catch(showError);
  } catch (error) {
    const assignee = state.taskAssignees.find((item) => item.id === $("task-assignee").value);
    const diagnostic = error?.code === "permission-denied" ? " | Người giao: " + (state.profile?.role || "không rõ") + "/" + (state.profile?.departmentId || "thiếu departmentId") + " | Người nhận: " + (assignee?.role || "không rõ") + "/" + (assignee?.departmentId || "thiếu departmentId") + " | Lỗi: " + (error.code || "không rõ") : "";
    $("task-feedback").textContent = (error.message || "Không thể tạo công việc.") + diagnostic;
    $("task-feedback").className = "feedback error";
  } finally {
    button.disabled = false;
  }
});
$("task-open-employees").addEventListener("click", () => { if (state.profile?.role === "admin") showView("employees"); else toast("Quản lý hồ sơ nhân sự chỉ dành cho Admin hệ thống."); });
$("task-status-filter").addEventListener("change", () => { state.taskPage = 1; renderTasks(); });
$("task-search").addEventListener("input", () => { state.taskPage = 1; renderTasks(); });
$("task-prev-page").addEventListener("click", () => { state.taskPage = Math.max(1, state.taskPage - 1); renderTasks(); });
$("task-next-page").addEventListener("click", () => { state.taskPage += 1; renderTasks(); });
function setTaskDueMinimum() {
  const due = $("task-due");
  const today = todayKey();
  due.min = today;
  if (due.value && due.value < today) due.value = today;
}
$("task-due").addEventListener("focus", setTaskDueMinimum);
$("task-due").addEventListener("change", setTaskDueMinimum);
setTaskDueMinimum();
$("task-refresh").addEventListener("click", () => loadTasks().catch(showError));
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
  const sites = snapshot.docs.map((item) => ({ id: item.id, ...item.data() })).filter((site) => Number.isFinite(site.latitude) && Number.isFinite(site.longitude));
  if (!sites.length) throw new Error("Chưa có địa điểm chấm công hoạt động trong Firebase. Vào mục Địa điểm chấm công để thêm Văn phòng GROVA (20.841202, 106.666418; bán kính 150 m).");
  const ranked = sites.map((site) => ({ site, distance: Math.round(distanceMeters(state.location, site)), radius: Number(site.radiusMeters || 150) })).sort((a, b) => a.distance - b.distance);
  const match = ranked.find((item) => item.distance <= item.radius);
  if (match) return match.site;
  const nearest = ranked[0];
  throw new Error("Vị trí cách địa điểm gần nhất “" + (nearest.site.name || "Địa điểm") + "” khoảng " + nearest.distance + " m; bán kính cho phép " + nearest.radius + " m. Kiểm tra tọa độ địa điểm trong mục Địa điểm chấm công.");
}
$("clock-in").addEventListener("click", async () => {
  if (!state.user) return;
  if (new Date(todayKey() + "T12:00:00+07:00").getDay() === 0) { toast("Chủ nhật là ngày nghỉ của công ty, không cần chấm công."); return; }
  try {
    const site = await requireLocationAndSite();
    if (state.recordId || state.clockIn) throw new Error("Bạn đã chấm công vào ca hôm nay.");
    if (state.location.accuracy > 100) throw new Error("GPS chưa đủ chính xác (trên 100 m). Hãy thử lại ngoài trời.");
    const recordRef = doc(db, "attendance_records", state.user.uid + "_" + todayKey());
    await setDoc(recordRef, { uid: state.user.uid, date: todayKey(), siteId: site.id, siteName: site.name || "", clockInAt: serverTimestamp(), clockInLocation: state.location, clockOutAt: null, clockOutLocation: null, createdAt: serverTimestamp() });
    state.recordId = recordRef.id;
    await loadToday();
    feedback("Đã ghi nhận giờ vào trên hệ thống.");
    toast("Chấm công vào ca thành công");
  } catch (error) { showError(error); }
});
$("clock-out").addEventListener("click", async () => {
  if (!state.user || !state.recordId || !state.clockIn || state.clockOut) return;
  if (new Date(todayKey() + "T12:00:00+07:00").getDay() === 0) { toast("Chủ nhật là ngày nghỉ của công ty."); return; }
  try {
    const site = await requireLocationAndSite();
    if (state.location.accuracy > 100) throw new Error("GPS chưa đủ chính xác (trên 100 m). Hãy thử lại ngoài trời.");
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
$("load-system-attendance").addEventListener("click", () => loadSystemAttendance().catch(showError));
$("print-system-attendance").addEventListener("click", () => { if (state.profile?.role !== "admin") { toast("Chỉ Admin được in bảng công toàn hệ thống."); return; } if ($("print-system-attendance").disabled) { toast("Hãy tải bảng công thành công trước khi in."); return; } window.print(); });
$("print-system-attendance-bottom").addEventListener("click", () => { if (!$("print-system-attendance-bottom").disabled) window.print(); });
$("schedule-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (state.profile?.role !== "admin") return;
  const startTime = $("schedule-start-input").value;
  const endTime = $("schedule-end-input").value;
  if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
    $("schedule-feedback").textContent = "Giờ kết thúc phải sau giờ bắt đầu.";
    $("schedule-feedback").className = "feedback error";
    return;
  }
  const button = $("schedule-save");
  button.disabled = true;
  try {
    await setDoc(doc(db, "attendance_settings", "schedule"), { startTime, endTime, updatedAt: serverTimestamp(), updatedBy: state.user.uid });
    state.schedule = { startTime, endTime };
    renderAttendance();
    $("schedule-feedback").textContent = "Đã lưu giờ làm việc mới.";
    $("schedule-feedback").className = "feedback";
    toast("Đã cập nhật giờ làm việc.");
  } catch (error) {
    $("schedule-feedback").textContent = error.message || "Không lưu được giờ làm việc.";
    $("schedule-feedback").className = "feedback error";
  } finally { button.disabled = false; }
});
$("leave-type").addEventListener("change", renderLeaveType);
$("leave-refresh").addEventListener("click", () => loadLeaveRequests().catch(showError));
$("leave-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.user) return;
  const type = $("leave-type").value;
  const date = $("leave-date").value;
  const reason = $("leave-reason").value.trim();
  if (reason.length < 5) {
    $("leave-feedback").textContent = "Vui lòng nhập lý do ít nhất 5 ký tự.";
    $("leave-feedback").className = "feedback error";
    return;
  }
  if (date < todayKey()) {
    $("leave-feedback").textContent = "Ngày đăng ký không được ở trong quá khứ.";
    $("leave-feedback").className = "feedback error";
    return;
  }
  const year = Number(date.slice(0,4));
  const month = date.slice(0,7);
  const yearRequests = state.leaveRequests.filter((item) => ["approved","pending"].includes(item.status) && Number(String(item.date).slice(0,4)) === year);
  const monthEarly = state.leaveRequests.filter((item) => ["approved","pending"].includes(item.status) && item.type === "early_leave" && String(item.date).startsWith(month));
  let minutes = 0;
  let halfDayPeriod = "";
  if (type === "early_leave") {
    minutes = Number($("leave-minutes").value);
    const usedMinutes = monthEarly.reduce((sum,item) => sum + Number(item.minutes || 0),0);
    if (monthEarly.length >= 2 || usedMinutes + minutes > 60) {
      $("leave-feedback").textContent = "Vượt hạn mức về sớm: tối đa 2 lượt và tổng cộng 60 phút mỗi tháng, tính cả yêu cầu đang chờ.";
      $("leave-feedback").className = "feedback error";
      return;
    }
  } else {
    const usedLeave = yearRequests.reduce((sum,item) => sum + (item.type === "annual_leave" ? 1 : item.type === "half_day" ? 0.5 : 0),0);
    const cost = type === "annual_leave" ? 1 : 0.5;
    if (usedLeave + cost > 12) {
      $("leave-feedback").textContent = "Bạn đã dùng hoặc đăng ký hết hạn mức 12 ngày phép năm.";
      $("leave-feedback").className = "feedback error";
      return;
    }
    if (type === "half_day") halfDayPeriod = $("half-day-period").value;
  }
  const button = $("leave-submit");
  button.disabled = true;
  try {
    await addDoc(collection(db, "attendance_leave_requests"), {
      uid: state.user.uid,
      displayName: state.profile.displayName || state.user.email || "",
      type,
      date,
      minutes,
      halfDayPeriod,
      reason,
      status: "pending",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    await loadLeaveRequests();
    event.target.reset();
    $("leave-date").value = todayKey();
    renderLeaveType();
    $("leave-feedback").textContent = "Đã gửi đăng ký, đang chờ quản lý xem xét.";
    $("leave-feedback").className = "feedback";
    toast("Đã gửi đăng ký.");
  } catch (error) {
    $("leave-feedback").textContent = error.message || "Không gửi được đăng ký.";
    $("leave-feedback").className = "feedback error";
  } finally { button.disabled = false; }
});
$("request-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.user) return;
  const reason = $("request-reason").value.trim();
  if (reason.length < 5) { toast("Vui lòng nhập lý do rõ ràng"); return; }
  try {
    await addDoc(collection(db, "attendance_adjustment_requests"), { uid: state.user.uid, date: $("request-date").value, requestedClockIn: $("request-in").value, requestedClockOut: $("request-out").value, reason, status: "pending", createdAt: serverTimestamp() });
    event.target.reset();
    $("request-date").value = todayKey();
$("leave-date").value = todayKey();
renderLeaveType();
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
$("admin-attendance-date").addEventListener("change",()=>loadOverview().catch(showError));
$("employee-search").addEventListener("input",renderAdminAttendance);
$("employee-department-filter").addEventListener("change",renderAdminAttendance);
$("employee-status-filter").addEventListener("change",renderAdminAttendance);
$("admin-refresh").addEventListener("click",()=>loadOverview().catch(showError));
$("admin-requests-refresh").addEventListener("click",()=>loadAdminAdjustmentRequests().catch(showError));
$("admin-request-status").addEventListener("change",()=>loadAdminAdjustmentRequests().catch(showError));
$("jump-pending").addEventListener("click",()=>{$("admin-request-status").value="pending";loadAdminAdjustmentRequests().catch(showError);$("admin-adjustment-panel").scrollIntoView({behavior:"smooth",block:"start"});});
$("employee-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (state.profile?.role !== "admin") { toast("Chỉ Admin được quản lý hồ sơ nhân viên."); return; }
  const uid = $("employee-uid").value.trim();
  const displayName = $("employee-name").value.trim();
  const email = $("employee-email").value.trim();
  const departmentId = $("employee-department").value;
  const department = departmentName(departmentId);
  const role = $("employee-role").value;
  const active = $("employee-active").checked;
  if (uid.length < 10 || !displayName || !departmentId || !DEPARTMENTS.some((item) => item.id === departmentId) || !["employee", "team_lead", "manager", "department_head", "executive_director", "admin"].includes(role)) {
    $("employee-feedback").textContent = "Kiểm tra UID, họ tên, phòng ban và vai trò.";
    $("employee-feedback").classList.add("error");
    return;
  }
  try {
    const ref = doc(db, "attendance_users", uid);
    const existing = await getDoc(ref);
    if (!existing.exists() && state.editingEmployeeId) throw new Error("Không tìm thấy hồ sơ cần cập nhật.");
    await setDoc(ref, { displayName, email, department, departmentId, role, active }, { merge: true });
    $("employee-feedback").classList.remove("error");
    $("employee-feedback").textContent = "Đã lưu hồ sơ nhân viên.";
    await loadEmployees();
    await loadOverview();
    resetEmployeeForm();
    toast("Đã lưu hồ sơ nhân viên.");
  } catch (error) {
    $("employee-feedback").classList.add("error");
    $("employee-feedback").textContent = error.code === "permission-denied" ? "Không đủ quyền ghi hồ sơ. Kiểm tra Firestore Rules đã triển khai chưa." : (error.message || "Không lưu được hồ sơ.");
    showError(error);
  }
});
$("employee-cancel").addEventListener("click", resetEmployeeForm);
$("delegation-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (state.profile?.role !== "admin") return;
  const granteeUid = $("delegation-grantee").value;
  const sourceDepartmentId = $("delegation-source").value;
  const targetDepartmentId = $("delegation-target").value;
  const reason = $("delegation-reason").value.trim();
  const validUntilValue = $("delegation-until").value;
  const grantee = state.employees.find((employee) => employee.id === granteeUid);
  const feedbackNode = $("delegation-feedback");
  try {
    if (!grantee || grantee.active !== true || taskRoleLevel(grantee.role) < 2 || grantee.role === "admin") throw new Error("Chọn một quản lý đang hoạt động.");
    if (!sourceDepartmentId || !targetDepartmentId || sourceDepartmentId === targetDepartmentId) throw new Error("Phòng ban nguồn và đích phải khác nhau.");
    if (reason.length < 5) throw new Error("Lý do ủy quyền cần ít nhất 5 ký tự.");
    const validUntil = validUntilValue ? Timestamp.fromDate(new Date(validUntilValue + "T23:59:59")) : null;
    if (validUntil && validUntil.toDate().getTime() <= Date.now()) throw new Error("Ngày hết hạn phải ở tương lai.");
    await addDoc(collection(db, "attendance_delegations"), {
      granteeUid,
      sourceDepartmentIds: [sourceDepartmentId],
      targetDepartmentIds: [targetDepartmentId],
      permissions: ["task_assign"],
      grantedByUid: state.user.uid,
      active: true,
      validFrom: serverTimestamp(),
      validUntil,
      reason,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    $("delegation-form").reset();
    feedbackNode.className = "feedback";
    feedbackNode.textContent = "Đã cấp quyền ủy quyền giao việc.";
    await loadDelegations();
    toast("Đã cấp quyền ủy quyền.");
  } catch (error) {
    feedbackNode.className = "feedback error";
    feedbackNode.textContent = error.message || "Không thể cấp quyền ủy quyền.";
  }
});
$("employee-admin-search").addEventListener("input", (event) => {
  const term = event.target.value.trim().toLocaleLowerCase("vi");
  document.querySelectorAll("#employee-admin-rows tr").forEach((row) => { row.hidden = !row.textContent.toLocaleLowerCase("vi").includes(term); });
});
$("add-site").addEventListener("click", async () => {
  if (state.profile?.role !== "admin") { toast("Chỉ quản trị viên được thêm địa điểm."); return; }
  const name = window.prompt("Tên địa điểm:");
  if (!name?.trim()) return;
  const address = window.prompt("Địa chỉ:");
  if (address === null) return;
  const latitude = Number(window.prompt("Vĩ độ (latitude):", "20.841202"));
  const longitude = Number(window.prompt("Kinh độ (longitude):", "106.666418"));
  const radiusMeters = Number(window.prompt("Bán kính cho phép (m):", "150"));
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180 || !Number.isFinite(radiusMeters) || radiusMeters < 25 || radiusMeters > 2000) {
    toast("Tọa độ hoặc bán kính không hợp lệ.");
    return;
  }
  try {
    await addDoc(collection(db, "attendance_sites"), { name: name.trim(), address: (address || "").trim(), latitude, longitude, radiusMeters, active: true, createdAt: serverTimestamp(), createdBy: state.user.uid });
    await loadSites();
    toast("Đã thêm địa điểm chấm công.");
  } catch (error) { showError(error); }
});
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
    document.querySelectorAll("[data-view='employees']").forEach((node) => { node.style.display = state.profile.role === "admin" ? "" : "none"; });
    document.querySelectorAll(".admin-workspace-shortcut").forEach((node) => { node.style.display = admin ? "" : "none"; });
    $("request-create-panel").style.display = admin ? "none" : "";
    $("task-create-panel").style.display = admin ? "" : "none";
    const title = $("view-today").querySelector("h1");
    title.textContent = "Xin chào, " + (state.profile.displayName || user.displayName || user.email);
    await Promise.all([loadSchedule(), loadLeaveRequests()]);
    await Promise.all([loadToday(), loadHistory()]);
    renderHistory();
    await loadRequests();
    if (state.profile.role === "admin") await loadEmployees();
    await loadTasks();
  } catch (error) {
    showError(error);
  }
});
updateClock();
setInterval(() => { updateClock(); updateClockOutAvailability(); if (state.clockIn && !state.clockOut) $("duration-value").textContent = durationText(); }, 1000);
$("request-date").value = todayKey();

$("logout-button").addEventListener("click", () => signOut(auth));
