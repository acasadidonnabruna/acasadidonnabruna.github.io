// ===============================
// CONFIG: https://www.airbnb.it/rooms/24334371?source_impression_id=p3_1768905098_P3lBJiEU7UDi2rDl
// ===============================

// 1) Link annuncio Airbnb (prenotazione)
const AIRBNB_LISTING_URL = "https://www.airbnb.com/rooms/INSERISCI_IL_TUO_ID";

// 2) Link iCal esportato da Airbnb (finisce in .ics)
const AIRBNB_ICAL_URL = "https://www.airbnb.com/calendar/ical/INSERISCI_IL_TUO_CALENDARIO.ics";

// 3) Link Google Maps (facoltativo)
const GOOGLE_MAPS_URL = "https://maps.google.com/?q=San+Vito+Taranto";

// ===============================

const $ = (id) => document.getElementById(id);

function setLinks() {
  ["airbnbCtaTop", "airbnbCtaHero", "airbnbCtaBottom", "airbnbLinkInline"].forEach((id) => {
    const el = $(id);
    if (el) el.href = AIRBNB_LISTING_URL;
  });
  const maps = $("mapsLink");
  if (maps) maps.href = GOOGLE_MAPS_URL;
  $("year").textContent = new Date().getFullYear();
}

// iCal fetch note:
// - Airbnb iCal spesso non permette CORS dal browser.
// - Per questo usiamo un proxy gratuito di sola lettura (AllOrigins).
// - È comunque "gratuito", ma dipende da un servizio terzo.
//   Se vuoi 100% senza terze parti, si può fare con una Cloudflare Worker free.
const ALLORIGINS = "https://api.allorigins.win/raw?url=";

function parseICalBusyDates(icsText) {
  // Estrae DTSTART/DTEND da eventi; molti calendari Airbnb segnano blocchi giornalieri.
  const lines = icsText.split(/\r?\n/);
  const events = [];
  let current = null;

  for (const line of lines) {
    if (line.startsWith("BEGIN:VEVENT")) current = {};
    if (current && line.startsWith("DTSTART")) current.dtstart = line.split(":").slice(1).join(":").trim();
    if (current && line.startsWith("DTEND")) current.dtend = line.split(":").slice(1).join(":").trim();
    if (line.startsWith("END:VEVENT") && current) {
      if (current.dtstart && current.dtend) events.push(current);
      current = null;
    }
  }

  const busy = new Set();

  for (const ev of events) {
    const start = parseIcsDate(ev.dtstart);
    const end = parseIcsDate(ev.dtend);

    if (!start || !end) continue;

    // Airbnb spesso usa eventi "all-day": end è il giorno successivo non incluso.
    // Marchiamo ogni giorno tra start (incluso) ed end (escluso).
    const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
    const e = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));

    while (d < e) {
      busy.add(toKey(d));
      d.setUTCDate(d.getUTCDate() + 1);
    }
  }

  return busy;
}

function parseIcsDate(s) {
  // Supporta formati tipici: YYYYMMDD oppure YYYYMMDDTHHMMSSZ
  // Gestiamo almeno YYYYMMDD.
  if (!s || s.length < 8) return null;
  const y = Number(s.slice(0, 4));
  const m = Number(s.slice(4, 6)) - 1;
  const d = Number(s.slice(6, 8));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  return new Date(Date.UTC(y, m, d));
}

function toKey(dateUtc) {
  const y = dateUtc.getUTCFullYear();
  const m = String(dateUtc.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dateUtc.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const DOW_IT = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

let viewYear;
let viewMonth; // 0-11
let busySet = new Set();

function buildCalendar(year, month) {
  const cal = $("calendar");
  cal.innerHTML = "";

  // header giorni settimana
  for (const dow of DOW_IT) {
    const el = document.createElement("div");
    el.className = "dow";
    el.textContent = dow;
    cal.appendChild(el);
  }

  const first = new Date(Date.UTC(year, month, 1));
  // JS: 0=Dom..6=Sab, noi vogliamo Lun..Dom
  const jsDay = first.getUTCDay(); // 0 dom
  const offset = (jsDay === 0 ? 6 : jsDay - 1); // lun=0

  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const daysInPrev = new Date(Date.UTC(year, month, 0)).getUTCDate();

  // celle del mese precedente per allineamento
  for (let i = 0; i < offset; i++) {
    const dayNum = daysInPrev - offset + 1 + i;
    cal.appendChild(dayCell(year, month - 1, dayNum, true));
  }

  // celle mese corrente
  for (let d = 1; d <= daysInMonth; d++) {
    cal.appendChild(dayCell(year, month, d, false));
  }

  // riempi fino a multiplo di 7
  const totalCells = 7 + offset + daysInMonth; // +7 per DOW row già inserita
  const remainder = totalCells % 7;
  const toAdd = remainder === 0 ? 0 : (7 - remainder);
  for (let i = 1; i <= toAdd; i++) {
    cal.appendChild(dayCell(year, month + 1, i, true));
  }

  const monthTitle = new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(year, month, 1)));
  $("monthTitle").textContent = monthTitle.charAt(0).toUpperCase() + monthTitle.slice(1);
}

function dayCell(year, month, dayNum, muted) {
  // normalizza anno/mese quando month è fuori range
  const dt = new Date(Date.UTC(year, month, dayNum));
  const key = toKey(dt);
  const isBusy = busySet.has(key);

  const el = document.createElement("div");
  el.className = "day " + (muted ? "muted" : "") + " " + (isBusy ? "busy" : "free");

  const n = document.createElement("div");
  n.className = "num";
  n.textContent = String(dt.getUTCDate());

  el.appendChild(n);
  return el;
}

async function loadICal() {
  const notice = $("calendarNotice");
  notice.textContent = "Caricamento disponibilità…";

  if (!AIRBNB_ICAL_URL.includes(".ics") || AIRBNB_ICAL_URL.includes("INSERISCI_")) {
    notice.textContent = "Inserisci il link iCal Airbnb (.ics) in app.js per mostrare la disponibilità.";
    return;
  }

  try {
    const url = ALLORIGINS + encodeURIComponent(AIRBNB_ICAL_URL);
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("Fetch non riuscito");
    const ics = await res.text();

    busySet = parseICalBusyDates(ics);
    notice.textContent = "Disponibilità aggiornata dal calendario Airbnb.";
  } catch (e) {
    notice.textContent =
      "Non riesco a leggere il calendario (limitazioni tecniche del browser). Se succede, posso indicarti un’alternativa 100% gratuita con Cloudflare Worker.";
  }
}

function wireControls() {
  $("prevMonth").addEventListener("click", () => {
    const dt = new Date(Date.UTC(viewYear, viewMonth - 1, 1));
    viewYear = dt.getUTCFullYear();
    viewMonth = dt.getUTCMonth();
    buildCalendar(viewYear, viewMonth);
  });

  $("nextMonth").addEventListener("click", () => {
    const dt = new Date(Date.UTC(viewYear, viewMonth + 1, 1));
    viewYear = dt.getUTCFullYear();
    viewMonth = dt.getUTCMonth();
    buildCalendar(viewYear, viewMonth);
  });
}

(async function init() {
  setLinks();

  const now = new Date();
  viewYear = now.getUTCFullYear();
  viewMonth = now.getUTCMonth();

  wireControls();
  await loadICal();
  buildCalendar(viewYear, viewMonth);
})();
