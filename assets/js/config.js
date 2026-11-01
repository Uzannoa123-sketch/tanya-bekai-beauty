/*
 * Site configuration: all business details live here, in one place.
 * Fields marked TODO are still missing from the clinic and need to be filled in.
 */
window.SITE_CONFIG = {
  business: {
    name: "TB Cosmetology",
    owner: "טניה בקאי",
    phoneDisplay: "054-682-4499",
    phoneTel: "+972546824499",
    whatsapp: "972546824499",
    whatsappMessage:
      "היי טניה, הגעתי דרך האתר שלך ואשמח לקבל פרטים על הטיפולים ולקבוע פגישת ייעוץ.",
    address: "שדרות האגמים 11, נתניה",
    instagramHandle: "@tb.cosmetology",
    instagramUrl: "https://www.instagram.com/tb.cosmetology/",
    // TODO: opening hours (until they arrive, the site says "by appointment").
    hoursText: "בתיאום מראש",
  },

  // Consultation topics. The keys must match api/_lib/topics.js.
  topics: [
    { key: "consult", label: "ייעוץ ואבחון עור – עוד לא בטוחה מה מתאים לי" },
    { key: "acne", label: "טיפול באקנה" },
    { key: "post-acne", label: "טיפול בפוסט אקנה" },
    { key: "pigmentation", label: "טיפול בפיגמנטציה" },
    { key: "anti-aging", label: "טיפולי אנטי אייג'ינג" },
    { key: "facial", label: "טיפולי פנים וקוסמטיקה מתקדמת" },
  ],

  booking: {
    // Booking-request server endpoint. If it is unavailable (for example on static hosting),
    // the request is sent to Tanya on WhatsApp instead.
    api: "/api/booking",
    // Real availability – only after connecting Google Calendar (see docs/SETUP.md).
    availabilityApi: "/api/availability",
    daysAhead: 21,
    // TODO: confirm working days with Tanya. 0 = Sunday … 6 = Saturday.
    workDays: [0, 1, 2, 3, 4, 5],
    // Until a calendar is connected, no specific hours are shown – only a preferred part of the day.
    timePreferences: [
      { key: "morning", label: "בוקר" },
      { key: "noon", label: "צהריים" },
      { key: "evening", label: "אחר הצהריים / ערב" },
    ],
  },

  /*
   * Client testimonials – add only real testimonials, with the client's consent.
   * Example: { text: "…", name: "ש.", treatment: "טיפול באקנה" }
   */
  testimonials: [],
};
