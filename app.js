// PaintX – calculation + UI. Formulas follow the Excel "Calculator" sheet.
const CFG = { interiorMult: 3.5, deduction: 0.15, sides: 4, drum: 18, gallon: 3.64, currency: "৳", slots: 3 };
const r6 = (x) => Math.round(x * 1e6) / 1e6;
const num = (v) => (v === "" || v == null || isNaN(Number(v)) ? null : Number(v));
const byName = (n) => PRODUCTS.find((p) => p.name.toLowerCase() === String(n).trim().toLowerCase());
const avg = (p) => (num(p.min) === null ? null : (p.min + p.max) / 2);
const cov = (p, basis) => (num(p.min) === null ? null : basis === "min" ? p.min : basis === "max" ? p.max : avg(p));

function split(needed) {                       // litres -> drums / gallons / loose litres
  const drums = Math.floor(r6(needed / CFG.drum));
  const rem = r6(needed - drums * CFG.drum);
  let gallons = Math.floor(r6(rem / CFG.gallon));
  const rem2 = r6(rem - gallons * CFG.gallon);
  let loose = Math.ceil(rem2);
  if (loose > CFG.gallon) { gallons++; loose = 0; }
  return { drums, gallons, loose };
}
function price(r, drumP, galP) {               // null unless every needed price is entered
  const perL = galP !== null ? galP / CFG.gallon : drumP !== null ? drumP / CFG.drum : null;
  if ((r.drums && drumP === null) || (r.gallons && galP === null) || (r.loose && perL === null)) return null;
  return r.drums * (drumP || 0) + r.gallons * (galP || 0) + r.loose * (perL || 0);
}
function calcRow(p, area, coats, basis, drumP, galP) {
  const c = cov(p, basis);
  if (c === null) return { msg: "No coverage data in TDS" };
  if (area === null || coats === null) return { msg: "Enter measurements & coats" };
  const needed = (area / c) * coats;
  if (p.unit === "SFT/Kg") return { needed, kg: Math.ceil(r6(needed)), msg: "Sold by weight" };
  const r = split(needed);
  return { needed, ...r, cost: price(r, drumP, galP) };
}
if (typeof module !== "undefined") module.exports = { calcRow, split, cov };

if (typeof document !== "undefined") {
  const $ = (id) => document.getElementById(id);
  const f = (v, d = 1) => Number(v).toLocaleString("en-US", { maximumFractionDigits: d });
  const money = (v) => CFG.currency + " " + f(v, 0);
  const SIDES = ["interior", "exterior"];

  function areas() {
    const fi = num($("int-floor").value), fe = num($("ext-floor").value), h = num($("ext-height").value);
    return {
      interior: fi === null ? null : fi * CFG.interiorMult * (1 - CFG.deduction),
      exterior: fe === null || h === null ? null : Math.sqrt(fe) * CFG.sides * h,
    };
  }

  function buildRows() {
    SIDES.forEach((s) => {
      let h = "";
      for (let i = 0; i < CFG.slots; i++) h += `<div class="prow">
        <span class="num">${i + 1}</span>
        <label class="fprod">Product<input id="${s}-p${i}" list="plist" placeholder="Type to search…" autocomplete="off"></label>
        <label>Coats<input id="${s}-c${i}" type="number" min="1" placeholder="2"></label>
        <label>Drum price<input id="${s}-d${i}" type="number" min="0" placeholder="18 L"></label>
        <label>Gallon price<input id="${s}-g${i}" type="number" min="0" placeholder="3.64 L"></label></div>`;
      $(s + "-rows").innerHTML = h;
    });
    $("plist").innerHTML = PRODUCTS.map((p) => `<option value="${p.name.replace(/"/g, "&quot;")}">`).join("");
  }

  function renderReq() {
    const A = areas(), basis = document.querySelector("input[name=basis]:checked").value;
    let grand = 0, grandOk = false;
    SIDES.forEach((s) => {
      let rows = "", total = 0, any = false, missing = false;
      for (let i = 0; i < CFG.slots; i++) {
        const name = $(`${s}-p${i}`).value, p = byName(name);
        $(`${s}-p${i}`).classList.toggle("bad", name.trim() !== "" && !p);
        if (!p) continue;
        const r = calcRow(p, A[s], num($(`${s}-c${i}`).value), basis, num($(`${s}-d${i}`).value), num($(`${s}-g${i}`).value));
        if (r.drums === undefined) {
          rows += `<tr><td>${p.name}</td>${r.kg ? `<td colspan="3">${r.kg} Kg required <em>(${r.msg})</em></td>` : `<td colspan="3"><em>${r.msg}</em></td>`}<td>–</td></tr>`;
          continue;
        }
        any = true;
        if (r.cost === null) missing = true; else total += r.cost;
        rows += `<tr><td>${p.name}<small>${f(r.needed)} L needed</small></td><td><b>${r.drums}</b></td><td><b>${r.gallons}</b></td><td>${r.loose} L</td><td>${r.cost === null ? "–" : money(r.cost)}</td></tr>`;
      }
      $(s + "-req").innerHTML = rows || `<tr><td colspan="5" class="empty">Select a product above to see the requirement.</td></tr>`;
      $(s + "-total").textContent = any && !missing ? money(total) : "–";
      if (any && !missing) { grand += total; grandOk = true; }
    });
    $("grand").textContent = grandOk ? money(grand) : "–";
    $("int-area").textContent = A.interior === null ? "–" : f(A.interior, 0) + " sq ft";
    $("ext-area").textContent = A.exterior === null ? "–" : f(A.exterior, 0) + " sq ft";
  }

  function renderList() {
    const q = $("search").value.trim().toLowerCase();
    const rows = PRODUCTS.filter((p) => p.name.toLowerCase().includes(q));
    $("count").textContent = `${rows.length} of ${PRODUCTS.length} products`;
    const c = (v) => (v == null ? "–" : f(v, 1));
    $("ptable").innerHTML = rows.map((p) => `<tr><td>${p.name}${p.note ? `<small>${p.note}</small>` : ""}</td>
      <td>${c(p.min)}</td><td>${c(p.max)}</td><td>${c(avg(p))}</td><td>${p.unit.replace("SFT/", "sq ft / ")}</td>
      <td class="act"><button data-s="interior" data-n="${p.name}">+ Interior</button><button data-s="exterior" data-n="${p.name}">+ Exterior</button></td></tr>`).join("")
      || `<tr><td colspan="6" class="empty">No product found.</td></tr>`;
  }

  document.addEventListener("DOMContentLoaded", () => {
    buildRows(); renderList(); renderReq();
    document.addEventListener("input", renderReq);
    $("search").addEventListener("input", renderList);
    $("ptable").addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      const slot = [...Array(CFG.slots).keys()].find((i) => !$(`${b.dataset.s}-p${i}`).value) ?? CFG.slots - 1;
      $(`${b.dataset.s}-p${slot}`).value = b.dataset.n; renderReq();
      $(b.dataset.s).scrollIntoView({ behavior: "smooth" });
    });
    document.querySelectorAll("[data-clear]").forEach((b) => b.addEventListener("click", () => {
      document.querySelectorAll(b.dataset.clear + " input:not([type=radio])").forEach((i) => (i.value = "")); renderReq();
    }));
  });
}
