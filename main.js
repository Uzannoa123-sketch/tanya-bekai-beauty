// Clinic WhatsApp number in international format, digits only (placeholder: replace before going live).
const WHATSAPP_NUMBER = "10000000000";

document.getElementById("year").textContent = new Date().getFullYear();

document.querySelectorAll(".js-whatsapp").forEach((a) => {
  a.href = `https://wa.me/${WHATSAPP_NUMBER}`;
});

const form = document.getElementById("book");
const dateInput = document.getElementById("f-date");
const errorBox = document.getElementById("form-error");

// Earliest bookable day is tomorrow.
const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
dateInput.min = tomorrow.toISOString().slice(0, 10);

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const fields = {
    date: form.elements.date,
    time: form.elements.time,
    name: form.elements.name,
  };
  const missing = [];
  Object.entries(fields).forEach(([key, el]) => {
    const empty = !el.value.trim();
    el.setAttribute("aria-invalid", empty ? "true" : "false");
    if (empty) missing.push({ date: "a day", time: "a time", name: "your name" }[key]);
  });

  if (missing.length) {
    errorBox.textContent = `Add ${missing.join(", ").replace(/, ([^,]*)$/, " and $1")} to send your request.`;
    errorBox.hidden = false;
    form.querySelector('[aria-invalid="true"]').focus();
    return;
  }
  errorBox.hidden = true;

  const treatment = form.elements.treatment.value || "a consultation (not sure which treatment yet)";
  const day = new Date(fields.date.value + "T12:00").toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long",
  });
  const message =
    `Hi Tanya, I'd like to book ${treatment}.\n` +
    `Preferred day: ${day}, ${fields.time.value.toLowerCase()}.\n` +
    `Name: ${fields.name.value.trim()}`;

  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`, "_blank", "noopener");
});
