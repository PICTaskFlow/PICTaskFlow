document.addEventListener("DOMContentLoaded", () => {
  // --- SUPABASE CONFIGURATION ---
  const SUPABASE_URL = "https://slrbadmvdghqmvtahmrz.supabase.co";
  const SUPABASE_KEY = "sb_publishable_eBeZ_oSpSiph2S8zdCY6rA_FQEdPpFW";
  const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  // --- LOGIN CONFIGURATION ---
  const APP_PASSWORD = "03241954";
  const AUTH_SESSION_KEY = "pic_taskflow_unlocked";

  const loginScreen = document.getElementById("login-screen");
  const appContainer = document.getElementById("app-container");
  const loginForm = document.getElementById("login-form");
  const loginPasswordInput = document.getElementById("login-password");
  const loginError = document.getElementById("login-error");
  const logoutBtn = document.getElementById("logout-btn");

  // --- THEME TOGGLE (Applies to both Login & App) ---
  const themeToggle = document.getElementById("theme-toggle");
  if (localStorage.getItem("theme") === "dark") {
    document.body.classList.add("dark-mode");
    themeToggle.textContent = "☀️ Light Mode";
  }

  themeToggle.addEventListener("click", () => {
    document.body.classList.toggle("dark-mode");
    const isDark = document.body.classList.contains("dark-mode");
    localStorage.setItem("theme", isDark ? "dark" : "light");
    themeToggle.textContent = isDark ? "☀️ Light Mode" : "🌙 Dark Mode";
  });

  // --- STATE MANAGEMENT ---
  let todos = [];
  let reminders = [];
  let currentFilter = "all";
  let currentRemFilter = "all";
  let selectedMonth = "all";
  let selectedYear = "all";
  let selectedRemMonth = "all";
  let selectedRemYear = "all";
  let isAppInitialized = false;

  const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const STATUS_OPTIONS = [
    "-",
    "Completed",
    "In Progress",
    "Under Observation",
    "Cancelled",
  ];

  const PRIORITY_OPTIONS = ["Low", "Medium", "High"];

  const RECURRENCE_OPTIONS = [
    "Once",
    "Hourly",
    "Daily",
    "Weekly",
    "Monthly",
    "Quarterly",
    "Yearly",
  ];

  const REMINDER_STATUS_OPTIONS = [
    "Active",
    "Inactive",
    "Completed",
  ];

  // --- AUTH FLOW ---
  async function unlockApp() {
    loginScreen.classList.add("hidden");
    appContainer.classList.remove("hidden");
    if (!isAppInitialized) {
      isAppInitialized = true;
      await loadDataFromSupabase();
    }
  }

  function lockApp() {
    sessionStorage.removeItem(AUTH_SESSION_KEY);
    loginPasswordInput.value = "";
    loginError.textContent = "";
    appContainer.classList.add("hidden");
    loginScreen.classList.remove("hidden");
    loginPasswordInput.focus();
  }

  if (sessionStorage.getItem(AUTH_SESSION_KEY) === "true") {
    unlockApp();
  } else {
    loginPasswordInput.focus();
  }

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (loginPasswordInput.value === APP_PASSWORD) {
      sessionStorage.setItem(AUTH_SESSION_KEY, "true");
      loginError.textContent = "";
      await unlockApp();
    } else {
      loginError.textContent = "Incorrect password. Please try again.";
      loginPasswordInput.value = "";
      loginPasswordInput.focus();
    }
  });

  logoutBtn.addEventListener("click", lockApp);

  // --- SUPABASE DATA SYNC ---
  async function loadDataFromSupabase() {
    const [todoRes, remRes] = await Promise.all([
      db.from("todos").select("*").order("id", { ascending: true }),
      db.from("reminders").select("*").order("id", { ascending: true }),
    ]);

    if (todoRes.error) {
      console.error("Error loading todos:", todoRes.error.message);
    } else {
      todos = (todoRes.data || []).map((row) => ({
        id: row.id,
        task: row.task || "",
        dateLogged: row.date_logged || "",
        details: row.details || "",
        priority: row.priority || "Low",
        status: row.status || "In Progress",
        dateCompleted: row.date_completed || "",
        notes: row.notes || "",
      }));
    }

    if (remRes.error) {
      console.error("Error loading reminders:", remRes.error.message);
    } else {
      reminders = (remRes.data || []).map((row) => ({
        id: row.id,
        type: row.type || "",
        recurrence: row.recurrence || "Daily",
        time: row.time || "",
        priority: row.priority || "Low",
        remarks: row.remarks || "",
        status: row.status || "Active",
        createdAt: row.created_at || new Date().toISOString(),
        lastTriggeredMinute: row.last_triggered_minute || "",
      }));
    }

    renderTodos();
    renderReminders();
  }

  async function upsertTodo(todo) {
    const { error } = await db.from("todos").upsert({
      id: todo.id,
      task: todo.task,
      date_logged: todo.dateLogged,
      details: todo.details,
      priority: todo.priority,
      status: todo.status,
      date_completed: todo.dateCompleted,
      notes: todo.notes,
    });
    if (error) console.error("Error saving todo:", error.message);
  }

  async function deleteTodoFromDB(id) {
    const { error } = await db.from("todos").delete().eq("id", id);
    if (error) console.error("Error deleting todo:", error.message);
  }

  async function upsertReminder(rem) {
    const { error } = await db.from("reminders").upsert({
      id: rem.id,
      type: rem.type,
      recurrence: rem.recurrence,
      time: rem.time,
      priority: rem.priority,
      remarks: rem.remarks,
      status: rem.status,
      created_at: rem.createdAt,
      last_triggered_minute: rem.lastTriggeredMinute,
    });
    if (error) console.error("Error saving reminder:", error.message);
  }

  async function deleteReminderFromDB(id) {
    const { error } = await db.from("reminders").delete().eq("id", id);
    if (error) console.error("Error deleting reminder:", error.message);
  }

  // Helper: Format current date & time as "November 11, 2026 9:20 AM"
  function getFormattedNow() {
    const now = new Date();
    const month = MONTHS[now.getMonth()];
    const day = now.getDate();
    const year = now.getFullYear();

    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12;

    return `${month} ${day}, ${year} ${hours}:${minutes} ${ampm}`;
  }

  // Helper: Extract Month & Year from a Date Logged string
  function parseDateLoggedParts(dateStr) {
    if (!dateStr) return { month: "", year: "" };
    const foundMonth = MONTHS.find((m) =>
      dateStr.toLowerCase().includes(m.toLowerCase())
    ) || "";
    const yearMatch = dateStr.match(/\b(19|20)\d{2}\b/);
    const foundYear = yearMatch ? yearMatch[0] : "";
    return { month: foundMonth, year: foundYear };
  }

  // Helper: Extract Month & Year from an ISO timestamp
  function parseISODateParts(isoStr) {
    if (!isoStr) return { month: "", year: "" };
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return { month: "", year: "" };
    return {
      month: MONTHS[d.getMonth()] || "",
      year: String(d.getFullYear()),
    };
  }

  // Helper: Auto-resize textarea height based on --row-height CSS variable
  function autoResizeTextarea(el) {
    const baseHeight =
      parseInt(getComputedStyle(document.documentElement).getPropertyValue("--row-height"), 10) || 24;
    el.style.height = baseHeight + "px";
    el.style.height = Math.max(baseHeight, el.scrollHeight) + "px";
  }

  // --- NOTIFICATION PERMISSION ---
  const notifyPermBtn = document.getElementById("notify-perm-btn");
  function updateNotifyButton() {
    if (!("Notification" in window)) {
      notifyPermBtn.style.display = "none";
      return;
    }
    if (Notification.permission === "granted") {
      notifyPermBtn.textContent = "🔔 Notifications On";
    } else if (Notification.permission === "denied") {
      notifyPermBtn.textContent = "🔕 Notifications Blocked";
    }
  }
  updateNotifyButton();

  notifyPermBtn.addEventListener("click", () => {
    if ("Notification" in window && Notification.permission !== "granted") {
      Notification.requestPermission().then(updateNotifyButton);
    }
  });

  // --- TAB NAVIGATION ---
  const tabBtns = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");

  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabBtns.forEach((b) => b.classList.remove("active"));
      tabContents.forEach((c) => c.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(btn.dataset.tab).classList.add("active");
    });
  });

  // --- TO-DO TABLE LOGIC ---
  const todoTbody = document.getElementById("todo-tbody");
  const todoFilterBtns = document.querySelectorAll("#todos-tab .filter-btn");
  const filterMonthSelect = document.getElementById("filter-month");
  const filterYearSelect = document.getElementById("filter-year");

  function populateYearFilter() {
    const currentYear = new Date().getFullYear();
    const yearsSet = new Set();

    for (let yr = currentYear - 2; yr <= currentYear + 2; yr++) {
      yearsSet.add(String(yr));
    }

    todos.forEach((t) => {
      const { year } = parseDateLoggedParts(t.dateLogged);
      if (year) yearsSet.add(year);
    });

    const sortedYears = Array.from(yearsSet).sort((a, b) => Number(a) - Number(b));
    filterYearSelect.innerHTML = `<option value="all">All</option>`;
    sortedYears.forEach((yr) => {
      const opt = document.createElement("option");
      opt.value = yr;
      opt.textContent = yr;
      filterYearSelect.appendChild(opt);
    });

    if (selectedYear !== "all" && !yearsSet.has(selectedYear)) {
      selectedYear = "all";
    }
    filterYearSelect.value = selectedYear;
  }

  function renderTodos(focusTarget = null) {
    populateYearFilter();
    todoTbody.innerHTML = "";

    const filtered = todos.filter((t) => {
      if (currentFilter === "active" && t.status === "Completed") return false;
      if (currentFilter === "completed" && t.status !== "Completed") return false;

      const { month, year } = parseDateLoggedParts(t.dateLogged);
      if (selectedMonth !== "all" && month.toLowerCase() !== selectedMonth.toLowerCase()) {
        return false;
      }
      if (selectedYear !== "all" && year !== selectedYear) {
        return false;
      }

      return true;
    });

    filtered.forEach((todo, index) => {
      const tr = document.createElement("tr");
      tr.dataset.id = todo.id;
      if (todo.status === "Completed") tr.classList.add("row-completed");
      if (todo.status === "-") tr.classList.add("row-dash");

      const priorityOptsHTML = PRIORITY_OPTIONS.map(
        (p) => `<option value="${p}" ${todo.priority === p ? "selected" : ""}>${p}</option>`
      ).join("");

      const statusOptsHTML = STATUS_OPTIONS.map(
        (s) => `<option value="${s}" ${todo.status === s ? "selected" : ""}>${s}</option>`
      ).join("");

      const statusClassSuffix = todo.status === "-" ? "Dash" : todo.status.replace(/\s+/g, "");

      tr.innerHTML = `
        <td class="cell-no">${index + 1}</td>
        <td><input type="text" class="cell-input task-input" value="${escapeAttr(todo.task)}"></td>
        <td><input type="text" class="cell-input date-logged-input" value="${escapeAttr(todo.dateLogged || "")}"></td>
        <td><textarea class="cell-textarea details-input" rows="1">${escapeHTML(todo.details || "")}</textarea></td>
        <td>
          <select class="cell-select priority-select priority-${todo.priority.toLowerCase()}">
            ${priorityOptsHTML}
          </select>
        </td>
        <td class="td-status">
          <select class="cell-select status-select status-${statusClassSuffix}">
            ${statusOptsHTML}
          </select>
        </td>
        <td><input type="text" class="cell-input date-completed-input" value="${escapeAttr(todo.dateCompleted || "")}"></td>
        <td><textarea class="cell-textarea notes-input" rows="1">${escapeHTML(todo.notes || "")}</textarea></td>
        <td class="td-action"><button class="row-delete-btn" title="Delete Row">✕</button></td>
      `;

      const taskInput = tr.querySelector(".task-input");
      taskInput.addEventListener("change", () => {
        const val = taskInput.value.trim();
        if (!val) {
          todos = todos.filter((t) => t.id !== todo.id);
          deleteTodoFromDB(todo.id);
          renderTodos();
        } else {
          todo.task = val;
          upsertTodo(todo);
        }
      });

      const dateLoggedInput = tr.querySelector(".date-logged-input");
      dateLoggedInput.addEventListener("change", () => {
        todo.dateLogged = dateLoggedInput.value.trim();
        upsertTodo(todo);
        renderTodos();
      });

      const detailsInput = tr.querySelector(".details-input");
      detailsInput.addEventListener("input", () => {
        autoResizeTextarea(detailsInput);
        todo.details = detailsInput.value;
      });
      detailsInput.addEventListener("change", () => {
        upsertTodo(todo);
      });
      detailsInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          detailsInput.blur();
        }
      });

      const prioritySelect = tr.querySelector(".priority-select");
      prioritySelect.addEventListener("change", () => {
        todo.priority = prioritySelect.value;
        prioritySelect.className = `cell-select priority-select priority-${todo.priority.toLowerCase()}`;
        upsertTodo(todo);
      });

      const statusSelect = tr.querySelector(".status-select");
      const dateCompletedInput = tr.querySelector(".date-completed-input");
      statusSelect.addEventListener("change", () => {
        todo.status = statusSelect.value;

        if (todo.status === "Completed") {
          if (!todo.dateCompleted) {
            todo.dateCompleted = getFormattedNow();
          }
        } else {
          todo.dateCompleted = "";
        }
        upsertTodo(todo);
        renderTodos();
      });

      dateCompletedInput.addEventListener("change", () => {
        todo.dateCompleted = dateCompletedInput.value.trim();
        upsertTodo(todo);
      });

      const notesInput = tr.querySelector(".notes-input");
      notesInput.addEventListener("input", () => {
        autoResizeTextarea(notesInput);
        todo.notes = notesInput.value;
      });
      notesInput.addEventListener("change", () => {
        upsertTodo(todo);
      });
      notesInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          notesInput.blur();
        }
      });

      tr.querySelector(".row-delete-btn").addEventListener("click", () => {
        todos = todos.filter((t) => t.id !== todo.id);
        deleteTodoFromDB(todo.id);
        renderTodos();
      });

      todoTbody.appendChild(tr);

      autoResizeTextarea(detailsInput);
      autoResizeTextarea(notesInput);

      if (focusTarget && focusTarget.type === "dateLogged" && focusTarget.id === todo.id) {
        dateLoggedInput.focus();
      }
    });

    // --- BLANK ENTRY ROW ---
    if (currentFilter === "all" || currentFilter === "active") {
      const nextSeqNo = filtered.length + 1;
      const blankTr = document.createElement("tr");
      blankTr.className = "blank-entry-row";

      blankTr.innerHTML = `
        <td class="cell-no">${nextSeqNo}</td>
        <td><input type="text" class="cell-input new-task-input"></td>
        <td><input type="text" class="cell-input new-date-logged" disabled></td>
        <td><input type="text" class="cell-input new-details" disabled></td>
        <td><input type="text" class="cell-input new-priority" disabled></td>
        <td><input type="text" class="cell-input new-status" disabled></td>
        <td><input type="text" class="cell-input new-date-completed" disabled></td>
        <td><input type="text" class="cell-input new-notes" disabled></td>
        <td></td>
      `;

      const newTaskInput = blankTr.querySelector(".new-task-input");
      let isCommitting = false;

      function commitNewTask(nextFocusMode = "none") {
        if (isCommitting) return;
        const taskText = newTaskInput.value.trim();
        if (!taskText) return;

        isCommitting = true;
        const newTodo = {
          id: Date.now(),
          task: taskText,
          dateLogged: getFormattedNow(),
          details: "",
          priority: "Low",
          status: "In Progress",
          dateCompleted: "",
          notes: "",
        };

        todos.push(newTodo);
        upsertTodo(newTodo);

        if (nextFocusMode === "dateLogged") {
          renderTodos({ type: "dateLogged", id: newTodo.id });
        } else if (nextFocusMode === "newRow") {
          renderTodos({ type: "newRow" });
        } else {
          renderTodos(null);
        }
      }

      newTaskInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commitNewTask("newRow");
        } else if (e.key === "Tab" && !e.shiftKey) {
          const taskText = newTaskInput.value.trim();
          if (taskText) {
            e.preventDefault();
            commitNewTask("dateLogged");
          }
        }
      });

      newTaskInput.addEventListener("blur", () => {
        commitNewTask("none");
      });

      todoTbody.appendChild(blankTr);

      if (focusTarget && focusTarget.type === "newRow") {
        newTaskInput.focus();
      }
    }
  }

  todoFilterBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      todoFilterBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentFilter = btn.dataset.filter;
      renderTodos();
    });
  });

  filterMonthSelect.addEventListener("change", () => {
    selectedMonth = filterMonthSelect.value;
    renderTodos();
  });

  filterYearSelect.addEventListener("change", () => {
    selectedYear = filterYearSelect.value;
    renderTodos();
  });

  // --- DAILY REMINDERS TABLE LOGIC ---
  const reminderTbody = document.getElementById("reminder-tbody");
  const remFilterBtns = document.querySelectorAll(".rem-filter-btn");
  const remFilterMonthSelect = document.getElementById("rem-filter-month");
  const remFilterYearSelect = document.getElementById("rem-filter-year");

  function populateRemYearFilter() {
    const currentYear = new Date().getFullYear();
    const yearsSet = new Set();

    for (let yr = currentYear - 2; yr <= currentYear + 2; yr++) {
      yearsSet.add(String(yr));
    }

    reminders.forEach((r) => {
      const { year } = parseISODateParts(r.createdAt);
      if (year) yearsSet.add(year);
    });

    const sortedYears = Array.from(yearsSet).sort((a, b) => Number(a) - Number(b));
    remFilterYearSelect.innerHTML = `<option value="all">All</option>`;
    sortedYears.forEach((yr) => {
      const opt = document.createElement("option");
      opt.value = yr;
      opt.textContent = yr;
      remFilterYearSelect.appendChild(opt);
    });

    if (selectedRemYear !== "all" && !yearsSet.has(selectedRemYear)) {
      selectedRemYear = "all";
    }
    remFilterYearSelect.value = selectedRemYear;
  }

  function attachSmartTimeMask(inputEl, onCommit) {
    inputEl.addEventListener("input", (e) => {
      if (e.inputType && e.inputType.startsWith("delete")) return;

      const raw = inputEl.value.toUpperCase();
      const digits = raw.replace(/\D/g, "").slice(0, 4);
      const meridiemMatch = raw.match(/[AP]/);
      const meridiem = meridiemMatch ? (meridiemMatch[0] === "A" ? "AM" : "PM") : "";

      let formatted = "";

      if (digits.length === 0) {
        formatted = "";
      } else if (digits.length === 1) {
        if (Number(digits[0]) >= 2) {
          formatted = `0${digits[0]}:`;
        } else {
          formatted = digits;
        }
      } else if (digits.length === 2) {
        let hh = Math.min(Math.max(Number(digits), 1), 12);
        formatted = `${String(hh).padStart(2, "0")}:`;
      } else if (digits.length === 3) {
        let hh = Math.min(Math.max(Number(digits.slice(0, 2)), 1), 12);
        formatted = `${String(hh).padStart(2, "0")}:${digits[2]}`;
      } else {
        let hh = Math.min(Math.max(Number(digits.slice(0, 2)), 1), 12);
        let mm = Math.min(Number(digits.slice(2, 4)), 59);
        formatted = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")} `;
      }

      if (meridiem && digits.length >= 3) {
        const hh = String(Math.min(Math.max(Number(digits.slice(0, 2)), 1), 12)).padStart(2, "0");
        const mm = digits.length === 4
          ? String(Math.min(Number(digits.slice(2, 4)), 59)).padStart(2, "0")
          : `${digits[2]}0`;
        formatted = `${hh}:${mm} ${meridiem}`;
      }

      inputEl.value = formatted;
    });

    inputEl.addEventListener("blur", () => {
      const val = inputEl.value.trim().toUpperCase();
      const match = val.match(/^(\d{1,2}):(\d{2})\s*(A|AM|P|PM)?$/);
      if (match) {
        const hh = String(Math.min(Math.max(Number(match[1]), 1), 12)).padStart(2, "0");
        const mm = String(Math.min(Number(match[2]), 59)).padStart(2, "0");
        const ampm = match[3] && match[3].startsWith("P") ? "PM" : "AM";
        inputEl.value = `${hh}:${mm} ${ampm}`;
      }
      if (onCommit) onCommit(inputEl.value.trim());
    });

    inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        inputEl.blur();
      }
    });
  }

  function renderReminders(focusTarget = null) {
    populateRemYearFilter();
    reminderTbody.innerHTML = "";

    const filteredReminders = reminders.filter((rem) => {
      const statusVal = rem.status === "Finish" ? "Completed" : rem.status;
      if (currentRemFilter === "active" && statusVal === "Completed") return false;
      if (currentRemFilter === "completed" && statusVal !== "Completed") return false;

      const { month, year } = parseISODateParts(rem.createdAt);
      if (selectedRemMonth !== "all" && month.toLowerCase() !== selectedRemMonth.toLowerCase()) {
        return false;
      }
      if (selectedRemYear !== "all" && year !== selectedRemYear) {
        return false;
      }

      return true;
    });

    filteredReminders.forEach((rem, index) => {
      if (rem.status === "Finish") rem.status = "Completed";
      const currentStatus = REMINDER_STATUS_OPTIONS.includes(rem.status)
        ? rem.status
        : "Active";

      const currentPriority = PRIORITY_OPTIONS.includes(rem.priority)
        ? rem.priority
        : "Low";

      const tr = document.createElement("tr");
      tr.dataset.id = rem.id;

      const recurrenceOptsHTML = RECURRENCE_OPTIONS.map(
        (r) => `<option value="${r}" ${rem.recurrence === r ? "selected" : ""}>${r}</option>`
      ).join("");

      const priorityOptsHTML = PRIORITY_OPTIONS.map(
        (p) => `<option value="${p}" ${currentPriority === p ? "selected" : ""}>${p}</option>`
      ).join("");

      const statusOptsHTML = REMINDER_STATUS_OPTIONS.map(
        (s) => `<option value="${s}" ${currentStatus === s ? "selected" : ""}>${s}</option>`
      ).join("");

      tr.innerHTML = `
        <td class="cell-no">${index + 1}</td>
        <td><input type="text" class="cell-input rem-type-input" value="${escapeAttr(rem.type)}"></td>
        <td>
          <select class="cell-select recurrence-select">
            ${recurrenceOptsHTML}
          </select>
        </td>
        <td><input type="text" class="cell-input time-input" maxlength="8" value="${escapeAttr(rem.time || "")}"></td>
        <td>
          <select class="cell-select priority-select priority-${currentPriority.toLowerCase()}">
            ${priorityOptsHTML}
          </select>
        </td>
        <td><textarea class="cell-textarea rem-remarks-input" rows="1">${escapeHTML(rem.remarks || "")}</textarea></td>
        <td class="td-status">
          <select class="cell-select rem-status-select rem-status-${currentStatus}">
            ${statusOptsHTML}
          </select>
        </td>
        <td class="td-action"><button class="row-delete-btn" title="Delete Row">✕</button></td>
      `;

      const typeInput = tr.querySelector(".rem-type-input");
      typeInput.addEventListener("change", () => {
        const val = typeInput.value.trim();
        if (!val) {
          reminders = reminders.filter((r) => r.id !== rem.id);
          deleteReminderFromDB(rem.id);
          renderReminders();
        } else {
          rem.type = val;
          upsertReminder(rem);
        }
      });

      const recurrenceSelect = tr.querySelector(".recurrence-select");
      recurrenceSelect.addEventListener("change", () => {
        rem.recurrence = recurrenceSelect.value;
        upsertReminder(rem);
      });

      const timeInput = tr.querySelector(".time-input");
      attachSmartTimeMask(timeInput, (finalTime) => {
        rem.time = finalTime;
        upsertReminder(rem);
      });

      const prioritySelect = tr.querySelector(".priority-select");
      prioritySelect.addEventListener("change", () => {
        rem.priority = prioritySelect.value;
        prioritySelect.className = `cell-select priority-select priority-${rem.priority.toLowerCase()}`;
        upsertReminder(rem);
      });

      const remarksInput = tr.querySelector(".rem-remarks-input");
      remarksInput.addEventListener("input", () => {
        autoResizeTextarea(remarksInput);
        rem.remarks = remarksInput.value;
      });
      remarksInput.addEventListener("change", () => {
        upsertReminder(rem);
      });
      remarksInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          remarksInput.blur();
        }
      });

      const statusSelect = tr.querySelector(".rem-status-select");
      statusSelect.addEventListener("change", () => {
        rem.status = statusSelect.value;
        upsertReminder(rem);
        renderReminders();
      });

      tr.querySelector(".row-delete-btn").addEventListener("click", () => {
        reminders = reminders.filter((r) => r.id !== rem.id);
        deleteReminderFromDB(rem.id);
        renderReminders();
      });

      reminderTbody.appendChild(tr);
      autoResizeTextarea(remarksInput);

      if (focusTarget && focusTarget.type === "recurrence" && focusTarget.id === rem.id) {
        recurrenceSelect.focus();
      }
    });

    // --- BLANK ENTRY ROW ---
    if (currentRemFilter === "all" || currentRemFilter === "active") {
      const blankTr = document.createElement("tr");
      blankTr.className = "blank-entry-row";
      blankTr.innerHTML = `
        <td class="cell-no">${filteredReminders.length + 1}</td>
        <td><input type="text" class="cell-input new-rem-type-input"></td>
        <td><input type="text" class="cell-input" disabled></td>
        <td><input type="text" class="cell-input" disabled></td>
        <td><input type="text" class="cell-input" disabled></td>
        <td><input type="text" class="cell-input" disabled></td>
        <td><input type="text" class="cell-input" disabled></td>
        <td></td>
      `;

      const newTypeInput = blankTr.querySelector(".new-rem-type-input");
      let isCommitting = false;

      function commitNewReminder(nextFocusMode = "none") {
        if (isCommitting) return;
        const typeText = newTypeInput.value.trim();
        if (!typeText) return;

        isCommitting = true;
        const newRem = {
          id: Date.now(),
          type: typeText,
          recurrence: "Daily",
          time: "",
          priority: "Low",
          remarks: "",
          status: "Active",
          createdAt: new Date().toISOString(),
          lastTriggeredMinute: "",
        };

        reminders.push(newRem);
        upsertReminder(newRem);

        if (nextFocusMode === "recurrence") {
          renderReminders({ type: "recurrence", id: newRem.id });
        } else if (nextFocusMode === "newRow") {
          renderReminders({ type: "newRow" });
        } else {
          renderReminders(null);
        }
      }

      newTypeInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commitNewReminder("newRow");
        } else if (e.key === "Tab" && !e.shiftKey) {
          if (newTypeInput.value.trim()) {
            e.preventDefault();
            commitNewReminder("recurrence");
          }
        }
      });

      newTypeInput.addEventListener("blur", () => {
        commitNewReminder("none");
      });

      reminderTbody.appendChild(blankTr);

      if (focusTarget && focusTarget.type === "newRow") {
        newTypeInput.focus();
      }
    }
  }

  remFilterBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      remFilterBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentRemFilter = btn.dataset.filter;
      renderReminders();
    });
  });

  remFilterMonthSelect.addEventListener("change", () => {
    selectedRemMonth = remFilterMonthSelect.value;
    renderReminders();
  });

  remFilterYearSelect.addEventListener("change", () => {
    selectedRemYear = remFilterYearSelect.value;
    renderReminders();
  });

  // Helper: Parse "07:30 AM" -> { hours24: 7, minutes: 30 }
  function parse12HourTime(timeStr) {
    if (!timeStr) return null;
    const match = timeStr.trim().toUpperCase().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
    if (!match) return null;
    let hours = Number(match[1]);
    const minutes = Number(match[2]);
    const ampm = match[3];
    if (ampm === "PM" && hours !== 12) hours += 12;
    if (ampm === "AM" && hours === 12) hours = 0;
    return { hours24: hours, minutes };
  }

  // Background Alert Checker (Only runs when unlocked)
  setInterval(() => {
    if (sessionStorage.getItem(AUTH_SESSION_KEY) !== "true") return;

    const now = new Date();
    const curHour = now.getHours();
    const curMin = now.getMinutes();
    const curDayOfWeek = now.getDay();
    const curDay = now.getDate();
    const curMonth = now.getMonth();
    const minuteStamp = `${now.getFullYear()}-${curMonth}-${curDay}-${curHour}:${curMin}`;

    let updated = false;

    reminders.forEach((rem) => {
      if (rem.status !== "Active") return;
      if (rem.lastTriggeredMinute === minuteStamp) return;

      const parsed = parse12HourTime(rem.time);
      if (!parsed) return;

      const created = rem.createdAt ? new Date(rem.createdAt) : now;
      let shouldTrigger = false;

      switch (rem.recurrence) {
        case "Once":
        case "Daily":
          shouldTrigger = curHour === parsed.hours24 && curMin === parsed.minutes;
          break;
        case "Hourly":
          shouldTrigger = curMin === parsed.minutes;
          break;
        case "Weekly":
          shouldTrigger =
            curDayOfWeek === created.getDay() &&
            curHour === parsed.hours24 &&
            curMin === parsed.minutes;
          break;
        case "Monthly":
          shouldTrigger =
            curDay === created.getDate() &&
            curHour === parsed.hours24 &&
            curMin === parsed.minutes;
          break;
        case "Quarterly": {
          const monthDiff =
            (now.getFullYear() - created.getFullYear()) * 12 +
            (curMonth - created.getMonth());
          shouldTrigger =
            monthDiff >= 0 &&
            monthDiff % 3 === 0 &&
            curDay === created.getDate() &&
            curHour === parsed.hours24 &&
            curMin === parsed.minutes;
          break;
        }
        case "Yearly":
          shouldTrigger =
            curMonth === created.getMonth() &&
            curDay === created.getDate() &&
            curHour === parsed.hours24 &&
            curMin === parsed.minutes;
          break;
      }

      if (shouldTrigger) {
        const alertText = `${rem.type} — ${rem.time}`;
        if ("Notification" in window && Notification.permission === "granted") {
          const notif = new Notification("PIC Task-Flow", {
            body: alertText,
            requireInteraction: true,
          });
          notif.onclick = () => {
            window.focus();
            notif.close();
          };
        } else {
          alert(`⏰ ${alertText}`);
        }

        rem.lastTriggeredMinute = minuteStamp;
        if (rem.recurrence === "Once") {
          rem.status = "Completed";
        }
        upsertReminder(rem);
        updated = true;
      }
    });

    if (updated) renderReminders();
  }, 5000);

  // --- UTILITIES ---
  function escapeHTML(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function escapeAttr(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
});