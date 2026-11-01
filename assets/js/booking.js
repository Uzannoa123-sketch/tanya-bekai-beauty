(() => {
  const C = window.SITE_CONFIG;
  const cfg = C.booking;
  const $ = (s) => document.querySelector(s);

  const form = $("#booking-form");
  const errorBox = $("#form-error");
  const submitBtn = $("#submit-btn");
  const done = $("#booking-done");
  const loadedAt = Date.now();

  const state = { topic: "consult", date: "", time: "", timeMode: "preference" };

  /* ---------- Helpers ---------- */
  const pad = (n) => String(n).padStart(2, "0");
  const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const dateFromIso = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d, 12); };
  const fmtLong = (s) => dateFromIso(s).toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" });

  // Israeli mobile: 05XXXXXXXX, +9725XXXXXXXX or 9725XXXXXXXX
  function normalizePhone(raw) {
    let d = String(raw || "").replace(/\D/g, "");
    if (d.startsWith("972")) d = "0" + d.slice(3);
    return /^05\d{8}$/.test(d) ? d : null;
  }

  function topicLabel(key) { return (C.topics.find((t) => t.key === key) || {}).label || ""; }
  function timeLabel() {
    if (!state.time) return "";
    if (state.timeMode === "slot") return state.time;
    return (cfg.timePreferences.find((p) => p.key === state.time) || {}).label || state.time;
  }

  function choice(name, value, label, checked) {
    const wrap = document.createElement("label");
    wrap.className = "choice";
    const input = document.createElement("input");
    input.type = "radio"; input.name = name; input.value = value; input.checked = !!checked;
    const span = document.createElement("span");
    span.textContent = label;
    wrap.append(input, span);
    return wrap;
  }

  /* ---------- Step 1: topic ---------- */
  const topicBox = $("#topic-choices");
  C.topics.forEach((t) => topicBox.append(choice("topic", t.key, t.label, t.key === state.topic)));
  topicBox.addEventListener("change", (e) => { state.topic = e.target.value; });
  document.addEventListener("booking:topic", (e) => {
    const input = topicBox.querySelector(`input[value="${e.detail}"]`);
    if (input) { input.checked = true; state.topic = e.detail; }
  });

  /* ---------- Step 2: day ---------- */
  const dateBox = $("#date-choices");
  const today = new Date();
  for (let i = 1; i <= cfg.daysAhead; i++) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i, 12);
    if (!cfg.workDays.includes(d.getDay())) continue;
    const b = document.createElement("button");
    b.type = "button";
    b.className = "date-btn";
    b.setAttribute("role", "radio");
    b.setAttribute("aria-checked", "false");
    b.dataset.date = isoDate(d);
    b.setAttribute("aria-label", d.toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" }));
    b.innerHTML =
      `<span class="dw">${d.toLocaleDateString("he-IL", { weekday: "short" })}</span>` +
      `<span class="dd">${d.getDate()}</span>` +
      `<span class="dm">${d.toLocaleDateString("he-IL", { month: "short" })}</span>`;
    dateBox.append(b);
  }
  dateBox.addEventListener("click", (e) => {
    const b = e.target.closest(".date-btn");
    if (!b) return;
    dateBox.querySelectorAll(".date-btn").forEach((x) => x.setAttribute("aria-checked", String(x === b)));
    state.date = b.dataset.date;
    loadTimes(state.date);
  });

  /* ---------- Step 3: time ---------- */
  const timeBox = $("#time-choices");
  const timeHint = $("#time-hint");
  const timeLegend = $("#time-legend");

  function renderPreferences() {
    state.timeMode = "preference";
    timeLegend.textContent = "באיזה חלק של היום נוח לך?";
    timeHint.textContent = "השעה המדויקת תיקבע מול טניה כשהיא מאשרת את התור.";
    timeBox.replaceChildren(...cfg.timePreferences.map((p) => choice("time", p.key, p.label)));
  }

  function renderSlots(slots) {
    state.timeMode = "slot";
    timeLegend.textContent = "שעות פנויות";
    if (!slots.length) {
      timeHint.textContent = "אין שעות פנויות ביום הזה. בחרי יום אחר.";
      timeBox.replaceChildren();
      return;
    }
    timeHint.textContent = "השעות מתעדכנות לפי היומן של טניה. התור נקבע סופית אחרי האישור שלה.";
    timeBox.replaceChildren(...slots.map((s) => choice("time", s, s)));
  }

  async function loadTimes(date) {
    state.time = "";
    if (!cfg.availabilityApi) return renderPreferences();
    timeHint.textContent = "בודקת זמינות…";
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 5000);
      const res = await fetch(`${cfg.availabilityApi}?date=${date}`, { signal: ctrl.signal });
      clearTimeout(timer);
      const data = res.ok ? await res.json() : null;
      if (date !== state.date) return; // the user already chose another day
      if (data && data.mode === "calendar" && Array.isArray(data.slots)) renderSlots(data.slots);
      else renderPreferences();
    } catch {
      if (date === state.date) renderPreferences();
    }
  }
  timeBox.addEventListener("change", (e) => { state.time = e.target.value; });

  /* ---------- Validation ---------- */
  function showError(msg, focusEl) {
    errorBox.textContent = msg;
    errorBox.hidden = false;
    if (focusEl) focusEl.focus({ preventScroll: false });
  }

  function validate() {
    const name = form.elements.fullName;
    const phone = form.elements.phone;
    const consent = form.elements.consent;
    [name, phone].forEach((el) => el.removeAttribute("aria-invalid"));

    if (!state.date) return showError("בחרי יום לפגישה.", dateBox.querySelector(".date-btn")), false;
    if (!state.time) return showError("בחרי שעה או חלק ביום שנוח לך.", timeBox.querySelector("input") || dateBox), false;
    if (name.value.trim().length < 2) {
      name.setAttribute("aria-invalid", "true");
      return showError("כתבי שם מלא.", name), false;
    }
    if (!normalizePhone(phone.value)) {
      phone.setAttribute("aria-invalid", "true");
      return showError("מספר הטלפון לא תקין. כתבי מספר נייד ישראלי, למשל 050-123-4567.", phone), false;
    }
    if (!consent.checked) return showError("כדי לשלוח את הבקשה צריך לאשר את שמירת הפרטים.", consent), false;
    errorBox.hidden = true;
    return true;
  }

  /* ---------- Submit ---------- */
  function payload() {
    return {
      topic: state.topic,
      date: state.date,
      time: state.time,
      timeMode: state.timeMode,
      fullName: form.elements.fullName.value.trim(),
      phone: normalizePhone(form.elements.phone.value),
      note: form.elements.note.value.trim(),
      consent: form.elements.consent.checked,
      website: form.elements.website.value, // honeypot
      elapsedMs: Date.now() - loadedAt,
    };
  }

  function whatsappRequestLink(p) {
    const lines = [
      "היי טניה, הגעתי דרך האתר ואשמח לקבוע פגישת ייעוץ.",
      `נושא: ${topicLabel(p.topic)}`,
      `יום מבוקש: ${fmtLong(p.date)}`,
      `שעה מבוקשת: ${timeLabel()}`,
      `שם: ${p.fullName}`,
      `טלפון: ${p.phone}`,
    ];
    if (p.note) lines.push(`הערה: ${p.note}`);
    return `https://wa.me/${C.business.whatsapp}?text=${encodeURIComponent(lines.join("\n"))}`;
  }

  function showDone(p, mode, clientNotified = false, ownerNotified = true) {
    const summary = $("#done-summary");
    const rows = [
      ["נושא", topicLabel(p.topic)],
      ["יום מבוקש", fmtLong(p.date)],
      ["שעה מבוקשת", timeLabel()],
      ["שם", p.fullName],
      ["טלפון", p.phone],
    ];
    summary.replaceChildren(...rows.map(([k, v]) => {
      const div = document.createElement("div");
      const dt = document.createElement("dt"); dt.textContent = k;
      const dd = document.createElement("dd"); dd.textContent = v;
      div.append(dt, dd);
      return div;
    }));

    const waBtn = $("#done-whatsapp");
    if (mode === "server") {
      $("#done-status").textContent = "ממתין לאישור";
      $("#done-title").textContent = "הבקשה התקבלה";
      $("#done-text").textContent =
        (clientNotified ? "שלחנו לך הודעה בוואטסאפ שהבקשה התקבלה. " : "") +
        "טניה תבדוק את היומן ותחזור אלייך בוואטסאפ עם אישור. התור נקבע סופית רק אחרי האישור שלה.";
      // If the notification to Tanya failed, offer to send the request to her directly too
      waBtn.href = whatsappRequestLink(p);
      waBtn.hidden = ownerNotified;
    } else {
      // No server connected: the request is not stored – the user must send it on WhatsApp.
      $("#done-status").textContent = "עוד שלב אחד";
      $("#done-title").textContent = "שלחי את הבקשה לטניה";
      $("#done-text").textContent =
        "לחצי על הכפתור כדי לשלוח את פרטי הבקשה לטניה בוואטסאפ. התור נקבע סופית רק אחרי שטניה מאשרת אותו.";
      waBtn.href = whatsappRequestLink(p);
      waBtn.hidden = false;
    }
    form.hidden = true;
    done.hidden = false;
    done.focus();
    done.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!validate()) return;
    const p = payload();

    submitBtn.disabled = true;
    submitBtn.textContent = "שולחת…";
    try {
      if (!cfg.api) return showDone(p, "whatsapp");
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 10000);
      const res = await fetch(cfg.api, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(p),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      const data = await res.json().catch(() => null);

      if (res.ok && data && data.ok) return showDone(p, "server", data.clientNotified, data.ownerNotified !== false);
      if (res.status === 400 || res.status === 429) {
        return showError((data && data.message) || "לא הצלחנו לשלוח את הבקשה. בדקי את הפרטים ונסי שוב.");
      }
      // Server not connected or unavailable: fall back to sending on WhatsApp
      showDone(p, "whatsapp");
    } catch {
      showDone(p, "whatsapp");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "שליחת בקשה לתור";
    }
  });

  $("#done-again").addEventListener("click", () => {
    form.reset();
    Object.assign(state, { topic: "consult", date: "", time: "", timeMode: "preference" });
    topicBox.querySelector('input[value="consult"]').checked = true;
    dateBox.querySelectorAll(".date-btn").forEach((x) => x.setAttribute("aria-checked", "false"));
    timeBox.replaceChildren();
    timeHint.textContent = "בחרי קודם יום.";
    done.hidden = true;
    form.hidden = false;
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  });
})();
