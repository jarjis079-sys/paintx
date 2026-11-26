// PaintX calculation logic (mirrors the "Calculator" sheet in PaintX_fixed_.xlsx)
const SETTINGS = { interiorMult: 3.5, deduction: 0.15, sides: 4, drum: 18, gallon: 3.64 };
const r6 = (x) => Math.round(x * 1e6) / 1e6;
const num = (v) => (v === "" || v === null || v === undefined || isNaN(Number(v)) ? null : Number(v));

function coverageFor(p, basis, override) {
  if (num(override) !== null) return num(override);
  if (!p || num(p.min) === null) return null;
  if (basis === "Minimum") return p.min;
  if (basis === "Maximum") return p.max;
  return (p.min + p.max) / 2;
}

function calculate(side, i, s = SETTINGS) {
  const p = PRODUCTS.find((x) => x.name === i.product);
  const cov = coverageFor(p, i.basis, i.override);
  const out = { cov, product: p, ok: false };
  let area = null;
  const floor = num(i.floor);
  if (side === "interior") {
    if (floor !== null) area = floor * s.interiorMult * (1 - s.deduction);
  } else if (floor !== null && num(i.height) !== null && num(i.parapet) !== null) {
    area = Math.sqrt(floor) * s.sides * (num(i.height) + num(i.parapet));
  }
  out.area = area;
  if (cov === null || area === null || num(i.coats) === null) return out;
  out.ok = true;
  out.needed = (area / cov) * num(i.coats);
  out.rounded = Math.ceil(r6(out.needed));
  out.isKg = p.unit === "SFT/Kg";
  const price = num(i.price);
  if (out.isKg) {
    if (price !== null) out.cost = out.rounded * price;
    return out;
  }
  out.drums = Math.floor(r6(out.needed / s.drum));
  const rem = r6(out.needed - out.drums * s.drum);
  out.gallons = Math.floor(r6(rem / s.gallon));
  const rem2 = r6(rem - out.gallons * s.gallon);
  if (Math.ceil(rem2) > s.gallon) { out.gallons += 1; out.loose = 0; } else out.loose = Math.ceil(rem2);
  out.bought = out.drums * s.drum + out.gallons * s.gallon + out.loose;
  out.left = out.bought - out.needed;
  if (price !== null) out.cost = out.bought * price;
  return out;
}

if (typeof module !== "undefined") module.exports = { calculate, coverageFor };

// ---------- UI (browser only) ----------
if (typeof document !== "undefined") {
  const $ = (id) => document.getElementById(id);
  const f = (v, d = 2) => Number(v).toLocaleString("en-US", { maximumFractionDigits: d });
  const sides = ["interior", "exterior"];

  function fillSelects() {
    sides.forEach((s) => {
      $(s + "-product").innerHTML = PRODUCTS.map((p) => `<option>${p.name}</option>`).join("");
    });
    $("interior-product").value = "Robb. Acrylic Plastic Emulsion";
    $("exterior-product").value = "WeatherCoat Exterior Sealer";
  }

  function read(s) {
    const g = (k) => $(`${s}-${k}`)?.value ?? "";
    return { product: g("product"), floor: g("floor"), height: g("height"), parapet: g("parapet"),
             basis: g("basis"), override: g("override"), coats: g("coats"), price: g("price") };
  }

  function render(s) {
    const r = calculate(s, read(s));
    const box = $(s + "-result");
    const unit = r.product && r.product.unit === "SFT/Kg" ? "Kg" : "Litres";
    $(s + "-info").textContent = r.product
      ? `Coverage (TDS): ${r.product.coverage}. ${r.product.note}` : "";
    if (!r.ok) {
      box.innerHTML = `<p class="warn">${r.cov === null ? "Coverage not given in TDS – enter a manual coverage above." : "Fill in all the inputs to see the result."}</p>`;
      return;
    }
    const row = (k, v) => `<tr><td>${k}</td><td>${v}</td></tr>`;
    let h = row("Painting area", f(r.area, 0) + " sq ft") + row("Coverage used", f(r.cov) + " sq ft per " + (r.isKg ? "Kg" : "Ltr")) +
            row(`Paint needed`, f(r.needed) + " " + unit) + row("Rounded up", r.rounded + " " + unit);
    if (r.isKg) h += `<tr><td colspan=2 class="warn">Sold by weight – drums/gallons not applicable.</td></tr>`;
    else h += row("Drums (18 L)", `<b>${r.drums}</b>`) + row("Gallons (3.64 L)", `<b>${r.gallons}</b>`) + row("Loose litres", `<b>${r.loose}</b>`) +
              row("Total bought", f(r.bought) + " L") + row("Left over", f(r.left) + " L");
    h += row("Estimated cost", r.cost === undefined ? "– enter price" : "<b>" + f(r.cost, 0) + "</b>");
    box.innerHTML = `<table>${h}</table>`;
  }

  function renderList() {
    const q = $("search").value.trim().toLowerCase();
    const rows = PRODUCTS.filter((p) => !q || (p.name + " " + p.coverage + " " + p.unit).toLowerCase().includes(q));
    $("count").textContent = `${rows.length} of ${PRODUCTS.length} products`;
    $("plist").innerHTML = rows.map((p) => `<tr><td>${p.name}</td><td>${p.coverage}</td><td>${p.unit}</td>
      <td><button data-s="interior" data-n="${p.name.replace(/"/g, "&quot;")}">Interior</button>
      <button data-s="exterior" data-n="${p.name.replace(/"/g, "&quot;")}">Exterior</button></td></tr>`).join("");
  }

  document.addEventListener("DOMContentLoaded", () => {
    fillSelects(); renderList();
    document.addEventListener("input", () => { sides.forEach(render); });
    $("search").addEventListener("input", renderList);
    $("plist").addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      $(b.dataset.s + "-product").value = b.dataset.n; sides.forEach(render);
      $(b.dataset.s + "-card").scrollIntoView({ behavior: "smooth", block: "center" });
    });
    sides.forEach(render);
  });
}
