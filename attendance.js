const $ = (id) => document.getElementById(id);
const state = { clockIn: null, clockOut: null, location: null, requests: [] };
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
  $("clock-in").disabled = Boolean(state.clockIn);
  $("clock-out").disabled = !state.clockIn || Boolean(state.clockOut);
  const status = $("attendance-status");
  status.className = "status-badge " + (state.clockOut ? "good" : "pending");
  status.textContent = state.clockOut ? "Đã hoàn thành" : state.clockIn ? "Đang làm việc" : "Chưa chấm công";
  $("status-caption").textContent = state.clockOut ? "Đã ghi nhận vào ca và tan ca" : state.clockIn ? "Bạn đã bắt đầu ca làm việc" : "Bắt đầu bằng thao tác vào ca";
  $("timeline-in").classList.toggle("done", Boolean(state.clockIn));
  $("timeline-out").classList.toggle("done", Boolean(state.clockOut));
  $("timeline-in-text").textContent = state.clockIn ? "Đã ghi nhận trong phiên thử" : "Đang chờ ghi nhận";
  $("timeline-out-text").textContent = state.clockOut ? "Đã hoàn thành trong phiên thử" : "Chưa hoàn thành";
  $("timeline-in-time").textContent = fmtTime(state.clockIn);
  $("timeline-out-time").textContent = fmtTime(state.clockOut);
  const rows = $("recent-rows");
  rows.innerHTML = "";
  const today = document.createElement("tr");
  [ "Hôm nay", fmtTime(state.clockIn), fmtTime(state.clockOut), state.clockOut ? "Đủ công" : state.clockIn ? "Đang làm" : "Chưa chấm" ].forEach((value, index) => {
    const cell = document.createElement("td");
    if (index === 3) {
      const badge = document.createElement("span");
      badge.className = "table-status" + (state.clockOut ? " good" : "");
      badge.textContent = value;
      cell.append(badge);
    } else cell.textContent = value;
    today.append(cell);
  });
  rows.append(today);
  [["Thứ Hai, 26/10", "08:02", "17:34"], ["Thứ Sáu, 23/10", "07:56", "17:28"]].forEach((entry) => {
    const row = document.createElement("tr");
    [...entry, "Đủ công"].forEach((value, index) => {
      const cell = document.createElement("td");
      if (index === 3) {
        const badge = document.createElement("span");
        badge.className = "table-status good";
        badge.textContent = value;
        cell.append(badge);
      } else cell.textContent = value;
      row.append(cell);
    });
    rows.append(row);
  });
}
function showView(name) {
  document.querySelectorAll(".view").forEach((view) => view.classList.toggle("active", view.id === "view-" + name));
  document.querySelectorAll(".nav-item").forEach((button) => button.classList.toggle("active", button.dataset.view === name));
  const labels = { today: "CHẤM CÔNG", history: "LỊCH SỬ CÔNG", requests: "YÊU CẦU ĐIỀU CHỈNH", overview: "TỔNG QUAN", sites: "ĐỊA ĐIỂM CHẤM CÔNG" };
  $("page-heading").textContent = labels[name] || "CHẤM CÔNG";
  if (name === "history") renderHistory();
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function renderHistory() {
  const rows = $("history-rows");
  rows.innerHTML = "";
  const data = [{ date: todayKey(), site: state.location ? "Vị trí thiết bị" : "Chưa xác định", in: fmtTime(state.clockIn), out: fmtTime(state.clockOut), total: durationText(), status: state.clockOut ? "Đủ công" : state.clockIn ? "Đang làm" : "Chưa chấm" }, { date: "2026-10-26", site: "Văn phòng GROVA", in: "08:02", out: "17:34", total: "9h 32m", status: "Đủ công" }, { date: "2026-10-23", site: "Văn phòng GROVA", in: "07:56", out: "17:28", total: "9h 32m", status: "Đủ công" }];
  const from = $("from-date").value;
  const to = $("to-date").value;
  data.filter((item) => (!from || item.date >= from) && (!to || item.date <= to)).forEach((item) => {
    const row = document.createElement("tr");
    [item.date, item.site, item.in, item.out, item.total, item.status].forEach((value, index) => {
      const cell = document.createElement("td");
      if (index === 5) {
        const badge = document.createElement("span");
        badge.className = "table-status" + (value === "Đủ công" ? " good" : "");
        badge.textContent = value;
        cell.append(badge);
      } else cell.textContent = value;
      row.append(cell);
    });
    rows.append(row);
  });
}
function renderRequests() {
  const list = $("request-list");
  list.innerHTML = "";
  if (!state.requests.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Chưa có yêu cầu trong phiên xem trước.";
    list.append(empty);
    return;
  }
  state.requests.forEach((request) => {
    const item = document.createElement("div");
    item.className = "request-item";
    const title = document.createElement("strong");
    title.textContent = request.date + " · " + (request.in || "--:--") + " / " + (request.out || "--:--");
    const reason = document.createElement("p");
    reason.textContent = request.reason;
    const badge = document.createElement("span");
    badge.className = "table-status";
    badge.textContent = "Chờ duyệt · Mẫu";
    item.append(title, reason, badge);
    list.append(item);
  });
}
function getLocation() {
  const label = $("location-state");
  const detail = $("location-detail");
  const feedback = $("feedback");
  feedback.textContent = "";
  feedback.className = "feedback";
  if (!navigator.geolocation) {
    label.textContent = "Thiết bị không hỗ trợ GPS";
    feedback.textContent = "Không thể lấy vị trí trên trình duyệt này.";
    feedback.classList.add("error");
    return;
  }
  label.textContent = "Đang lấy vị trí...";
  detail.textContent = "Cho phép trình duyệt truy cập vị trí";
  navigator.geolocation.getCurrentPosition((position) => {
    state.location = { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy };
    label.textContent = "Đã lấy vị trí thiết bị";
    detail.textContent = "Độ chính xác khoảng " + Math.round(position.coords.accuracy) + " m · Chưa xác minh bán kính";
    feedback.textContent = "Đã lấy GPS cho bản xem trước. Chưa gửi hoặc lưu dữ liệu.";
    toast("Đã lấy vị trí trên thiết bị");
  }, (error) => {
    const messages = { 1: "Bạn chưa cấp quyền truy cập vị trí.", 2: "Không xác định được vị trí. Hãy thử lại.", 3: "Yêu cầu GPS đã hết thời gian." };
    label.textContent = "Chưa lấy được vị trí";
    detail.textContent = messages[error.code] || "Vui lòng thử lại";
    feedback.textContent = detail.textContent;
    feedback.classList.add("error");
  }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
}
$("clock-in").addEventListener("click", () => {
  if (!state.location) {
    $("feedback").textContent = "Hãy lấy vị trí GPS trước khi thử chấm công.";
    $("feedback").className = "feedback error";
    toast("Cần lấy vị trí GPS trước");
    return;
  }
  state.clockIn = new Date();
  renderAttendance();
  $("feedback").textContent = "Thao tác mô phỏng thành công. Không có dữ liệu nào được lưu.";
  toast("Đã mô phỏng thao tác vào ca");
});
$("clock-out").addEventListener("click", () => {
  if (!state.clockIn || state.clockOut) return;
  state.clockOut = new Date();
  renderAttendance();
  $("feedback").textContent = "Thao tác mô phỏng thành công. Không có dữ liệu nào được lưu.";
  toast("Đã mô phỏng thao tác tan ca");
});
$("locate").addEventListener("click", getLocation);
document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => showView(button.dataset.view)));
document.querySelectorAll("[data-go]").forEach((button) => button.addEventListener("click", () => showView(button.dataset.go)));
$("filter-history").addEventListener("click", renderHistory);
$("request-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const reason = $("request-reason").value.trim();
  if (reason.length < 5) {
    toast("Vui lòng nhập lý do rõ ràng");
    return;
  }
  state.requests.unshift({ date: $("request-date").value, in: $("request-in").value, out: $("request-out").value, reason });
  renderRequests();
  event.target.reset();
  toast("Đã thêm yêu cầu mẫu vào phiên xem trước");
});
$("export-csv").addEventListener("click", () => {
  const rows = [["Ngày", "Địa điểm", "Giờ vào", "Giờ ra", "Tổng giờ", "Trạng thái"], [todayKey(), state.location ? "Vị trí thiết bị" : "Chưa xác định", fmtTime(state.clockIn), fmtTime(state.clockOut), durationText(), state.clockOut ? "Đủ công" : state.clockIn ? "Đang làm" : "Chưa chấm"], ["2026-10-26", "Văn phòng GROVA", "08:02", "17:34", "9h 32m", "Đủ công"]];
  const csv = "\ufeff" + rows.map((row) => row.map((value) => '"' + String(value).replaceAll('"', '""') + '"').join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "grova-attendance-preview.csv";
  link.click();
  URL.revokeObjectURL(url);
  toast("Đã xuất CSV dữ liệu mẫu");
});
$("employee-search").addEventListener("input", (event) => {
  const term = event.target.value.trim().toLocaleLowerCase("vi");
  document.querySelectorAll("#employee-rows tr").forEach((row) => {
    row.hidden = !row.textContent.toLocaleLowerCase("vi").includes(term);
  });
});
$("add-site").addEventListener("click", () => toast("Cấu hình địa điểm sẽ được bật sau khi duyệt schema và quyền truy cập."));
updateClock();
setInterval(() => {
  updateClock();
  if (state.clockIn && !state.clockOut) $("duration-value").textContent = durationText();
}, 1000);
renderAttendance();
renderRequests();
$("request-date").value = todayKey();
