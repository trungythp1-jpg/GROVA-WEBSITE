import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import { getFirestore, collection, doc, getDoc, getDocs, query, where, orderBy, limit, addDoc, setDoc, runTransaction, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const $ = (id) => document.getElementById(id);
const state = { user: null, profile: null, clockIn: null, clockOut: null, location: null, recordId: null, requests: [], leaveRequests: [], schedule: { startTime: "08:00", endTime: "17:30" }, sites: [], records: [], employees: [], tasks: [], editingEmployeeId: null };
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
    if (/^([01]\\d|2[0-3]):[0-5]\\d$/.test(data.startTime || "") && /^([01]\\d|2[0-3]):[0-5]\\d$/.test(data.endTime || "") && timeToMinutes(data.endTime) > timeToMinutes(data.startTime)) {
      state.schedule = { startTime: data.startTime, endTime: data.endTime };
    }
  }
  $("schedule-start-input").value = state.schedule.startTime;
  $("schedule-end-input").value = state.schedule.endTime;
}
async function loadLeaveRequests() {
  const manager = ["admin","manager"].includes(state.profile?.role);
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
function renderAttendance() {
  $("clock-in-value").textContent = fmtTime(state.clockIn);
  $("clock-out-value").textContent = fmtTime(state.clockOut);
  $("duration-value").textContent = durationText();
  const nowMinutes = currentVietnamMinutes();
  const startMinutes = timeToMinutes(state.schedule.startTime);
  const endMinutes = timeToMinutes(state.schedule.endTime);
  const late = Boolean(state.clockIn && vietnamMinutesForDate(state.clockIn) > startMinutes);
  $("clock-in").disabled = !state.user || Boolean(state.clockIn);
  const approvedEarlyLeave = state.leaveRequests.some((item) => item.uid === state.user?.uid && item.date === todayKey() && item.type === "early_leave" && item.status === "approved");
  $("clock-out").disabled = !state.user || !state.clockIn || Boolean(state.clockOut) || (nowMinutes < endMinutes && !approvedEarlyLeave);
  $("schedule-hours").textContent = state.schedule.startTime + " – " + state.schedule.endTime;
  $("schedule-message").textContent = late ? "Bạn đã vào ca muộn so với giờ bắt đầu " + state.schedule.startTime + "." : "Chấm công sau " + state.schedule.startTime + " sẽ được ghi nhận đi muộn.";
  $("attendance-status").classList.toggle("late", late && !state.clockOut);
  if (late && !state.clockOut) $("attendance-status").textContent = "Đi muộn";
  const adminPanel = $("schedule-admin-panel");
  if (adminPanel) adminPanel.style.display = state.profile?.role === "admin" ? "" : "none";
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
  if (name === "overview") loadOverview().catch(showError);
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
  const reviewNote = window.prompt(status === "approved" ? "Ghi chú duyệt (có thể để trống):" : "Lý do từ chối:");
  if (reviewNote === null) return;
  if (status === "rejected" && reviewNote.trim().length < 3) {
    toast("Vui lòng nhập lý do từ chối.");
    return;
  }
  try {
    await updateDoc(doc(db, "attendance_adjustment_requests", request.id), {
      status,
      reviewedAt: serverTimestamp(),
      reviewedBy: state.user.uid,
      reviewNote: reviewNote.trim()
    });
    await loadRequests();
    toast(status === "approved" ? "Đã duyệt yêu cầu." : "Đã từ chối yêu cầu.");
  } catch (error) { showError(error); }
}
async function loadOverview() {
  if (!["admin", "manager"].includes(state.profile?.role)) return;
  const today = todayKey();
  const [usersSnapshot, recordsSnapshot, requestsSnapshot] = await Promise.all([
    getDocs(query(collection(db, "attendance_users"), where("active", "==", true), limit(500))),
    getDocs(query(collection(db, "attendance_records"), where("date", "==", today), limit(1000))),
    getDocs(query(collection(db, "attendance_adjustment_requests"), where("status", "==", "pending"), limit(500)))
  ]);
  const users = usersSnapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  const records = recordsSnapshot.docs.map((item) => item.data());
  const byUid = new Map(records.map((item) => [item.uid, item]));
  $("staff-count").textContent = String(users.length);
  $("checked-in-count").textContent = String(records.length);
  $("not-checked-count").textContent = String(Math.max(0, users.length - records.length));
  $("pending-count").textContent = String(requestsSnapshot.size);
  const rows = $("employee-rows");
  rows.replaceChildren();
  users.forEach((user) => {
    const record = byUid.get(user.id);
    const start = asDate(record?.clockInAt);
    const end = asDate(record?.clockOutAt);
    const row = document.createElement("tr");
    [user.displayName || user.email || user.id, user.department || "Chưa phân bộ phận", fmtTime(start), fmtTime(end), end ? "Đã tan ca" : start ? "Đã vào ca" : "Chưa chấm"].forEach((value, index) => {
      const cell = document.createElement("td");
      if (index === 4) {
        const badge = document.createElement("span");
        badge.className = "table-status" + (end ? " good" : "");
        badge.textContent = value;
        cell.append(badge);
      } else cell.textContent = value;
      row.append(cell);
    });
    rows.append(row);
  });
  $("employee-search").dispatchEvent(new Event("input"));
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
    return;
  }
  const snapshot = await getDocs(query(collection(db, "attendance_users"), limit(500)));
  state.employees = snapshot.docs.map((item) => ({ id: item.id, ...item.data() })).sort((a, b) => String(a.displayName || "").localeCompare(String(b.displayName || ""), "vi"));
  renderEmployees();
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
    const values = [employee.displayName || employee.email || employee.id, employee.department || "Chưa phân bộ phận", employee.role || "employee", employee.active === true ? "Đang hoạt động" : "Đã khóa"];
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
      $("employee-department").value = employee.department || "";
      $("employee-role").value = ["employee", "manager", "admin"].includes(employee.role) ? employee.role : "employee";
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
function taskStatusLabel(status) {
  return ({ todo: "Mới giao", in_progress: "Đang thực hiện", done: "Hoàn thành" })[status] || "Mới giao";
}
function renderTasks() {
  const list = $("task-list");
  list.replaceChildren();
  const filter = $("task-status-filter").value;
  const visible = state.tasks.filter((task) => filter === "all" || task.status === filter);
  $("task-total").textContent = String(state.tasks.length);
  $("task-active").textContent = String(state.tasks.filter((task) => task.status === "in_progress").length);
  $("task-pending").textContent = String(state.tasks.filter((task) => task.status !== "done").length);
  if (!visible.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = state.tasks.length ? "Không có công việc phù hợp bộ lọc." : "Chưa có công việc. Khi được giao nhiệm vụ, công việc sẽ hiển thị tại đây.";
    list.append(empty);
    return;
  }
  visible.forEach((task) => {
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
    status.disabled = task.assigneeUid !== state.user.uid && !["admin","manager"].includes(state.profile?.role);
    status.addEventListener("change", async () => {
      status.disabled = true;
      try {
        await updateDoc(doc(db, "workspace_tasks", task.id), { status: status.value, updatedAt: serverTimestamp() });
        task.status = status.value;
        toast("Đã cập nhật trạng thái công việc.");
        renderTasks();
      } catch (error) {
        status.value = task.status || "todo";
        showError(error);
      }
    });
    bottom.append(priority, status);
    card.append(top, description, bottom);
    list.append(card);
  });
}
async function loadTasks() {
  const manager = ["admin","manager"].includes(state.profile?.role);
  $("task-create-panel").style.display = manager ? "" : "none";
  const taskQuery = manager
    ? query(collection(db, "workspace_tasks"), orderBy("createdAt", "desc"), limit(200))
    : query(collection(db, "workspace_tasks"), where("assigneeUid", "==", state.user.uid), limit(200));
  const snapshot = await getDocs(taskQuery);
  state.tasks = snapshot.docs.map((item) => ({ id: item.id, ...item.data() })).sort((a,b) => {
    const ad = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
    const bd = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
    return bd-ad;
  });
  renderTasks();
}
$("task-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!["admin","manager"].includes(state.profile?.role)) return;
  const button = $("task-submit");
  button.disabled = true;
  $("task-feedback").textContent = "";
  try {
    const assigneeUid = $("task-assignee").value.trim();
    const assigneeSnapshot = await getDoc(doc(db, "attendance_users", assigneeUid));
    if (!assigneeSnapshot.exists() || assigneeSnapshot.data().active !== true) throw new Error("Không tìm thấy hồ sơ nhân viên đang hoạt động với UID này.");
    const profile = assigneeSnapshot.data();
    await addDoc(collection(db, "workspace_tasks"), {
      title: $("task-title").value.trim(),
      description: $("task-description").value.trim(),
      assigneeUid,
      assigneeName: profile.displayName || profile.email || assigneeUid,
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
    toast("Đã giao công việc.");
    await loadTasks();
  } catch (error) {
    $("task-feedback").textContent = error.message || "Không thể tạo công việc.";
    $("task-feedback").className = "feedback error";
  } finally {
    button.disabled = false;
  }
});
$("task-status-filter").addEventListener("change", renderTasks);
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
$("employee-search").addEventListener("input", (event) => {
  const term = event.target.value.trim().toLocaleLowerCase("vi");
  document.querySelectorAll("#employee-rows tr").forEach((row) => { row.hidden = !row.textContent.toLocaleLowerCase("vi").includes(term); });
});
$("employee-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (state.profile?.role !== "admin") { toast("Chỉ Admin được quản lý hồ sơ nhân viên."); return; }
  const uid = $("employee-uid").value.trim();
  const displayName = $("employee-name").value.trim();
  const email = $("employee-email").value.trim();
  const department = $("employee-department").value.trim();
  const role = $("employee-role").value;
  const active = $("employee-active").checked;
  if (uid.length < 10 || !displayName || !["employee", "manager", "admin"].includes(role)) {
    $("employee-feedback").textContent = "Kiểm tra UID, họ tên và vai trò.";
    $("employee-feedback").classList.add("error");
    return;
  }
  try {
    const ref = doc(db, "attendance_users", uid);
    const existing = await getDoc(ref);
    if (!existing.exists() && state.editingEmployeeId) throw new Error("Không tìm thấy hồ sơ cần cập nhật.");
    await setDoc(ref, { displayName, email, department, role, active }, { merge: true });
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
setInterval(() => { updateClock(); if (state.clockIn && !state.clockOut) $("duration-value").textContent = durationText(); }, 1000);
$("request-date").value = todayKey();

$("logout-button").addEventListener("click", () => signOut(auth));
