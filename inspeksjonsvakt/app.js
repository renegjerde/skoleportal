const FAVORITE_KEY = "inspeksjonsvakt-favorite-v12";
const DAY_NAMES = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag"];
const AREAS = [
  "Paradis øvre", "Paradis nedre", "Bakplass", "Fana øvre", "Fana nedre",
  "Lekeplass", "Bingen", "Fotballbanen", "S1", "C1", "L1", "M1",
  "A2", "B2", "A3", "L3", "F5", "OM6", "FLYT1", "FLYT2"
];
const AREA_CENTERS = [107.88,146.53,176.98,203.84,236.00,269.73,300.05,335.27,371.75,403.20,434.77,466.33,497.89,527.95,556.52,583.96,608.80,638.86,674.80,708.23];
const MERGED_CENTERS = [
  {center:126.25, area:"Paradis øvre + Paradis nedre"},
  {center:221.20, area:"Fana øvre + Fana nedre"}
];
let plan = null;
let selectedPdf = null;
let weekOffset = 0;

const $ = id => document.getElementById(id);
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));

function localDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
}
function parseLocalDate(value) {
  const [year,month,day] = value.split("-").map(Number);
  return new Date(year,month-1,day,0,0,0,0);
}
function mondayOf(date) {
  const result = new Date(date.getFullYear(),date.getMonth(),date.getDate());
  result.setDate(result.getDate() - ((result.getDay()+6)%7));
  return result;
}
function isoWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  return Math.ceil((((d-yearStart)/86400000)+1)/7);
}
function dateAtTime(date,time) {
  const [hours,minutes] = time.split(":").map(Number);
  return new Date(date.getFullYear(),date.getMonth(),date.getDate(),hours,minutes,0,0);
}
function getActiveCode(entry, date) {
  if (!entry.codes?.length) return "";
  if (entry.codes.length === 1) return entry.codes[0];
  const evenWeek = isoWeekNumber(date) % 2 === 0;
  return evenWeek ? entry.codes[0] : entry.codes[1];
}
function assignmentsForDate(date) {
  const day = (date.getDay()+6)%7;
  const key = localDateKey(date);
  if (plan.startDate && key < plan.startDate) return [];
  return (plan.entries || []).filter(entry => entry.day === day).map(entry => ({...entry, code:getActiveCode(entry,date)}));
}
function areaLabel(entry) {
  if (entry.area === "FLYT1") return "FLYT1 · Fotballbanen/Fana";
  if (entry.area === "FLYT2") return "FLYT2 · Fana/Paradis";
  return entry.area;
}
function nameFor(code) {
  return plan.staff?.[code] || `Ukjent kode: ${code}`;
}
function sortItems(items) {
  return items.sort((a,b) => a.start.localeCompare(b.start) || a.area.localeCompare(b.area,"no"));
}
function getStaffCodes() {
  return Object.keys(plan?.staff || {}).sort((a,b) => plan.staff[a].localeCompare(plan.staff[b],"no"));
}
function getUnknownCodes() {
  return [...new Set((plan?.entries || []).flatMap(e => e.codes || []))].filter(code => !plan.staff?.[code]).sort();
}
function renderMeta() {
  const updated = plan.updatedOn ? parseLocalDate(plan.updatedOn).toLocaleDateString("no-NO") : "ukjent dato";
  const effective = plan.startDate ? parseLocalDate(plan.startDate).toLocaleDateString("no-NO") : "ikke angitt";
  $("planMeta").textContent = `Plan oppdatert ${updated} · gjelder fra ${effective}`;
  $("startDateInput").value = plan.startDate || "2026-10-19";
}
function renderPersonSelect() {
  const select = $("personSelect");
  const current = select.value || localStorage.getItem(FAVORITE_KEY) || "";
  const codes = getStaffCodes();
  select.innerHTML = '<option value="">Velg navnet ditt …</option>' + codes.map(code =>
    `<option value="${escapeHtml(code)}">${escapeHtml(plan.staff[code])}</option>`
  ).join("");
  if (codes.includes(current)) select.value = current;
  $("favoriteBtn").textContent = select.value && select.value === localStorage.getItem(FAVORITE_KEY) ? "★" : "☆";
}
function renderUnknownCodes() {
  const unknown = getUnknownCodes();
  $("unknownNotice").classList.toggle("hidden",unknown.length===0);
  $("unknownText").textContent = unknown.length
    ? `${unknown.join(", ")} finnes i inspeksjonstabellen, men ikke i navneoversikten nederst i PDF-en. De vises som uavklarte til navnet er lagt inn i administrasjonen.`
    : "Alle ansattkodene i planen har et navneoppslag.";
  $("unknownEditor").innerHTML = unknown.map(code => `
    <div class="unknown-field"><label for="map-${escapeHtml(code)}">${escapeHtml(code)}</label>
      <input id="map-${escapeHtml(code)}" data-code="${escapeHtml(code)}" type="text" placeholder="Etternavn, Fornavn – f.eks. Lie, Tore" value="">
    </div>`).join("") || '<p class="small-note">Ingen ukjente koder.</p>';
}
function personEntriesForDate(date, code) {
  return sortItems(assignmentsForDate(date).filter(item => item.code === code));
}
function findNextInspection(code) {
  if (!code) return null;
  const now = new Date();
  const start = parseLocalDate(plan.startDate || "2000-01-01");
  const firstDate = new Date(Math.max(now.getTime(),start.getTime()));
  for (let offset=0; offset<370; offset++) {
    const day = new Date(firstDate.getFullYear(),firstDate.getMonth(),firstDate.getDate()+offset);
    for (const item of personEntriesForDate(day,code)) {
      const startTime = dateAtTime(day,item.start);
      const endTime = dateAtTime(day,item.end || item.start);
      if (endTime >= now) return {date:day,item,startTime,endTime,isOngoing:startTime<=now && endTime>=now};
    }
  }
  return null;
}
function renderNext(code) {
  const next = findNextInspection(code);
  if (!next) {
    $("nextDate").textContent = "Ingen kommende inspeksjon";
    $("nextTime").textContent = "—";
    $("nextArea").textContent = "Ingen inspeksjon registrert";
    $("countdown").textContent = "Det er ingen flere kommende inspeksjoner i planen.";
    return;
  }
  $("nextDate").textContent = next.date.toLocaleDateString("no-NO",{weekday:"long",day:"numeric",month:"long"});
  $("nextTime").textContent = `${next.item.start}–${next.item.end || next.item.start}`;
  $("nextArea").textContent = areaLabel(next.item);
  if (next.isOngoing) {
    $("countdown").textContent = "Inspeksjonen pågår nå.";
  } else {
    const minutes = Math.max(0,Math.round((next.startTime-new Date())/60000));
    $("countdown").textContent = minutes < 1 ? "Starter nå" : minutes < 60 ? `Starter om ${minutes} min` : `Starter om ${Math.floor(minutes/60)} t ${minutes%60} min`;
  }
}
function renderWeek(code) {
  const base = mondayOf(new Date());
  base.setDate(base.getDate()+weekOffset*7);
  const finish = new Date(base); finish.setDate(finish.getDate()+4);
  const formatShort = date => date.toLocaleDateString("no-NO",{day:"numeric",month:"short"});
  $("weekTitle").textContent = weekOffset === 0 ? "Denne uken" : `${formatShort(base)} – ${formatShort(finish)}`;
  $("weekGrid").innerHTML = DAY_NAMES.map((dayName,index) => {
    const date = new Date(base); date.setDate(base.getDate()+index);
    const entries = personEntriesForDate(date,code);
    const isToday = localDateKey(date) === localDateKey(new Date());
    const insidePlan = !plan.startDate || localDateKey(date) >= plan.startDate;
    const inner = !insidePlan ? "Planen har ikke startet" : entries.length ? entries.map(item =>
      `<div class="week-event"><b>${escapeHtml(item.start)}–${escapeHtml(item.end || "")}</b><span>${escapeHtml(areaLabel(item))}</span></div>`
    ).join("") : '<div class="week-empty">Ingen inspeksjon</div>';
    return `<div class="week-day ${isToday?"is-today":""}"><div class="week-day-head"><span>${dayName}</span><strong>${date.getDate()}</strong></div>${inner}</div>`;
  }).join("");
}
function renderUpcoming(code) {
  const items = [];
  const now = new Date();
  for (let offset=0; offset<45 && items.length<8; offset++) {
    const day = new Date(now.getFullYear(),now.getMonth(),now.getDate()+offset);
    for (const item of personEntriesForDate(day,code)) {
      const endTime = dateAtTime(day,item.end || item.start);
      if (endTime >= now) items.push({date:day,item});
    }
  }
  $("upcomingList").innerHTML = items.length ? items.map(({date,item}) => `
    <div class="upcoming-item"><div class="upcoming-date">${date.toLocaleDateString("no-NO",{weekday:"short",day:"numeric",month:"short"})}</div>
      <div><div class="upcoming-time">${escapeHtml(item.start)}–${escapeHtml(item.end || "")}</div><div class="upcoming-area">${escapeHtml(areaLabel(item))}</div></div>
    </div>`).join("") : '<p class="small-note">Ingen kommende inspeksjoner er registrert.</p>';
}
function renderDashboard() {
  const code = $("personSelect").value;
  $("dashboard").classList.toggle("hidden",!code);
  if (!code) return;
  renderNext(code);
  renderWeek(code);
  renderUpcoming(code);
}
function renderAll() {
  renderMeta();
  renderPersonSelect();
  renderUnknownCodes();
  renderDashboard();
}

async function loadPlan() {
  const response = await fetch("./plan.json",{cache:"no-store"});
  if (!response.ok) throw new Error(`Kunne ikke hente plan.json (HTTP ${response.status}).`);
  const data = await response.json();
  validatePlan(data);
  return data;
}
function validatePlan(data) {
  if (!data || !Array.isArray(data.entries) || !data.staff || !data.startDate) {
    throw new Error("plan.json mangler nødvendige data (entries, staff eller startDate). ");
  }
  if (!data.entries.length) throw new Error("Inspeksjonsplanen inneholder ingen inspeksjoner.");
}

$("personSelect").addEventListener("change",() => {
  $("favoriteBtn").textContent = $("personSelect").value === localStorage.getItem(FAVORITE_KEY) ? "★" : "☆";
  renderDashboard();
});
$("favoriteBtn").addEventListener("click",() => {
  const code = $("personSelect").value;
  if (!code) return;
  localStorage.setItem(FAVORITE_KEY,code);
  $("favoriteBtn").textContent = "★";
});
$("prevWeek").addEventListener("click",() => { weekOffset--; renderDashboard(); });
$("nextWeek").addEventListener("click",() => { weekOffset++; renderDashboard(); });
$("currentWeek").addEventListener("click",() => { weekOffset=0; renderDashboard(); });

$("pdfInput").addEventListener("change",event => {
  selectedPdf = event.target.files?.[0] || null;
  $("pdfFileName").textContent = selectedPdf?.name || "Ingen fil valgt";
  $("parsePdfBtn").disabled = !selectedPdf;
  $("parseStatus").textContent = "";
});

function textCenter(item, pageWidth) {
  const x = item.transform?.[4] ?? 0;
  const width = item.width ?? 0;
  return ((x + width/2) / pageWidth) * 792;
}
function classifyArea(center) {
  for (const merged of MERGED_CENTERS) {
    if (Math.abs(center-merged.center)<3.3) return merged.area;
  }
  const idx = AREA_CENTERS.reduce((best,value,index) => Math.abs(value-center)<Math.abs(AREA_CENTERS[best]-center) ? index : best,0);
  return AREAS[idx];
}
function normalizedTime(value) { return value.replaceAll(".",":"); }
async function readPdfSchedule(file) {
  const pdfjs = await import("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs";
  const pdf = await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({scale:1});
  const textContent = await page.getTextContent();
  const items = textContent.items.filter(item => typeof item.str === "string" && item.str.trim());
  const dayTokens = new Set(DAY_NAMES);
  const timeTokens = items.filter(item => /^\d{2}[.:]\d{2}-\d{2}[.:]\d{2}$/.test(item.str.trim()));
  if (!timeTokens.length) throw new Error("Fant ingen klokkeslett-rader. PDF-en kan være skannet som bilde eller ha et annet tabelloppsett.");
  const parsed = [];
  for (const timeItem of timeTokens) {
    const y = timeItem.transform?.[5] ?? 0;
    const timeX = timeItem.transform?.[4] ?? 0;
    const dayItem = items.filter(item => dayTokens.has(item.str.trim()) && (item.transform?.[4] ?? 999) < timeX && Math.abs((item.transform?.[5] ?? 9999)-y)<3.5)
      .sort((a,b)=>Math.abs((a.transform?.[5]??0)-y)-Math.abs((b.transform?.[5]??0)-y))[0];
    if (!dayItem) continue;
    const timeParts = timeItem.str.trim().split("-").map(normalizedTime);
    const codesOnRow = items.filter(item => {
      const str = item.str.trim();
      const x = textCenter(item,viewport.width);
      const rowY = item.transform?.[5] ?? 0;
      return x>88 && x<726 && Math.abs(rowY-y)<2.4 && /^[A-ZÆØÅ0-9]{3,8}(?:\/[A-ZÆØÅ0-9]{3,8})?$/.test(str);
    });
    const assignments = codesOnRow.map(item => {
      const raw = item.str.trim();
      const codes = raw.split("/");
      return {day:DAY_NAMES.indexOf(dayItem.str.trim()),start:timeParts[0],end:timeParts[1],area:classifyArea(textCenter(item,viewport.width)),codes,alternating:codes.length===2};
    });
    if (assignments.length) parsed.push(...assignments);
  }
  if (!parsed.length) throw new Error("Fant klokkeslett, men klarte ikke å koble dem til inspeksjonskoder. Kontroller at PDF-en bruker samme tabellmal.");
  const updatedToken = items.find(item => /^\d{1,2}\.\d{1,2}\.\d{4}$/.test(item.str.trim()));
  const updatedOn = updatedToken ? (() => { const [d,m,y]=updatedToken.str.trim().split("."); return `${y}-${m.padStart(2,"0")}-${d.padStart(2,"0")}`; })() : plan.updatedOn;
  return {entries:parsed,updatedOn,pageCount:pdf.numPages};
}

$("parsePdfBtn").addEventListener("click",async () => {
  if (!selectedPdf) return;
  const startDate = $("startDateInput").value;
  if (!startDate) { $("parseStatus").textContent = "Velg datoen planen gjelder fra."; return; }
  if (parseLocalDate(startDate).getDay() !== 1) { $("parseStatus").textContent = "Startdatoen må være en mandag."; return; }
  const button = $("parsePdfBtn");
  button.disabled = true; button.textContent = "Leser PDF …";
  try {
    const result = await readPdfSchedule(selectedPdf);
    plan = {...plan,entries:result.entries,startDate,updatedOn:result.updatedOn || plan.updatedOn,source:selectedPdf.name,version:"1.2.2"};
    renderAll();
    const unknown = getUnknownCodes();
    $("parseStatus").textContent = `Leste ${result.entries.length} inspeksjonsoppføringer fra ${result.pageCount} side(r). ${unknown.length ? `Uavklarte koder: ${unknown.join(", ")}.` : "Alle koder har navneoppslag."}\nKontroller ukeplanen, korriger eventuelle navnekoder og last ned plan.json når den er klar.`;
  } catch (error) {
    $("parseStatus").textContent = error.message || "Kunne ikke lese PDF-filen.";
  } finally {
    button.disabled = false; button.textContent = "Les PDF og erstatt plan";
  }
});

$("saveNamesBtn").addEventListener("click",() => {
  const inputs = [...$("unknownEditor").querySelectorAll("input[data-code]")];
  let count = 0;
  for (const input of inputs) {
    const name = input.value.trim();
    if (name) { plan.staff[input.dataset.code] = name; count++; }
  }
  renderAll();
  $("parseStatus").textContent = count ? `Lagret ${count} navneoppslag. Husk å laste ned plan.json for å publisere endringene.` : "Ingen nye navneoppslag ble lagt inn.";
});

$("exportPlanBtn").addEventListener("click",() => {
  const blob = new Blob([JSON.stringify(plan,null,2)],{type:"application/json;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a"); link.href=url; link.download="plan.json"; link.click();
  URL.revokeObjectURL(url);
  $("parseStatus").textContent = "plan.json er lastet ned. Erstatt den gamle plan.json-filen i GitHub og publiser endringen.";
});
$("restorePlanBtn").addEventListener("click",async () => {
  if (!confirm("Forkaste endringene i denne økten og hente plan.json fra GitHub på nytt?")) return;
  try { plan=await loadPlan(); weekOffset=0; renderAll(); $("parseStatus").textContent="Planen fra GitHub er lastet inn på nytt."; }
  catch(error) { $("parseStatus").textContent=error.message; }
});

try {
  plan = await loadPlan();
  renderAll();
} catch (error) {
  $("planMeta").textContent = "Kunne ikke laste plan.json. Publiser både index.html, app.js, styles.css og plan.json i samme GitHub-mappe.";
  $("parseStatus").textContent = error.message;
}
