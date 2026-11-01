(() => {
  const C = window.SITE_CONFIG;
  const B = C.business;
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];

  /* ---------- Business details from config ---------- */
  const waBase = `https://wa.me/${B.whatsapp}`;
  $$(".js-whatsapp, .js-whatsapp-prefilled").forEach((a) => {
    a.href = `${waBase}?text=${encodeURIComponent(B.whatsappMessage)}`;
  });
  $$(".js-instagram").forEach((a) => (a.href = B.instagramUrl));
  $$(".js-phone").forEach((a) => { a.href = `tel:${B.phoneTel}`; a.textContent = B.phoneDisplay; });
  $$(".js-address").forEach((el) => (el.textContent = B.address));
  $$(".js-hours").forEach((el) => (el.textContent = B.hoursText));
  $("#year").textContent = new Date().getFullYear();

  /* ---------- Mobile menu ---------- */
  const header = $("#site-header");
  const toggle = $("#menu-toggle");
  const setMenu = (open) => {
    header.classList.toggle("menu-open", open);
    toggle.setAttribute("aria-expanded", String(open));
  };
  toggle.addEventListener("click", () => setMenu(!header.classList.contains("menu-open")));
  $$("#site-nav a").forEach((a) => a.addEventListener("click", () => setMenu(false)));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") setMenu(false); });

  /* ---------- Dialogs: close on backdrop click and ✕ button ---------- */
  $$("dialog").forEach((d) => {
    d.addEventListener("click", (e) => {
      if (e.target === d || e.target.closest("[data-close]")) d.close();
    });
  });

  /* ---------- Treatment details ---------- */
  const details = $("#details-modal");
  $$("[data-details]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.details;
      const card = btn.closest(".card");
      $("#details-title").textContent = $("h3", card).textContent;
      const body = $("#details-body");
      body.replaceChildren(
        $(`template[data-details-for="${key}"]`, card).content.cloneNode(true)
      );
      const forLine = $(".card-for", card).cloneNode(true);
      body.append(forLine);
      $("#details-book").dataset.book = key;
      details.showModal();
    });
  });
  $("#details-book").addEventListener("click", () => details.close());

  /* ---------- "Book a consultation" buttons pre-select the topic ---------- */
  document.addEventListener("click", (e) => {
    const link = e.target.closest("[data-book]");
    if (link) document.dispatchEvent(new CustomEvent("booking:topic", { detail: link.dataset.book }));
  });

  /* ---------- Image lightbox ---------- */
  const lb = $("#lightbox");
  const lbImg = $("#lightbox-img");
  const lbCap = $("#lightbox-caption");
  let group = [];
  let index = 0;
  const show = (i) => {
    index = (i + group.length) % group.length;
    const btn = group[index];
    const fig = btn.closest("figure");
    lbImg.src = btn.dataset.full;
    lbImg.alt = $("img", btn).alt;
    lbCap.textContent = $("figcaption", fig)?.textContent || "";
    $(".lightbox-nav", lb).hidden = group.length < 2;
  };
  $$("[data-lightbox]").forEach((btn) => {
    btn.addEventListener("click", () => {
      group = $$(`[data-lightbox="${btn.dataset.lightbox}"]`);
      show(group.indexOf(btn));
      lb.showModal();
    });
  });
  $("#lightbox-prev").addEventListener("click", () => show(index - 1));
  $("#lightbox-next").addEventListener("click", () => show(index + 1));
  lb.addEventListener("keydown", (e) => {
    // RTL: right arrow = previous, left arrow = next
    if (e.key === "ArrowRight") show(index - 1);
    if (e.key === "ArrowLeft") show(index + 1);
  });
  lb.addEventListener("close", () => { lbImg.src = ""; });

  /* ---------- Testimonials (real ones only, from config) ---------- */
  const list = $("#testimonial-list");
  if (C.testimonials.length) {
    $("#testimonial-empty").hidden = true;
    C.testimonials.forEach((t) => {
      const fig = document.createElement("figure");
      fig.className = "testimonial";
      const q = document.createElement("blockquote");
      q.textContent = `״${t.text}״`;
      const cap = document.createElement("figcaption");
      cap.textContent = [t.name, t.treatment].filter(Boolean).join(", ");
      fig.append(q, cap);
      list.append(fig);
    });
  }
})();
