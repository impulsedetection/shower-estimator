import { useMemo, useState } from "react";

/* =========================
   CONFIG / RULES
========================= */

const MATERIAL_RULES = {
  pvc: { label: "PVC Panels", waste: 0.12, adhesiveSqftPerTube: 30, siliconeLfPerTube: 25 },
  acrylic: { label: "Acrylic Panels", waste: 0.1, adhesiveSqftPerTube: 28, siliconeLfPerTube: 25 },
  solid: { label: "Solid Surface", waste: 0.08, adhesiveSqftPerTube: 35, siliconeLfPerTube: 30 },
};

const PANEL_SIZES = [
  { key: "96x36", label: "96 x 36 in", w: 36, h: 96 },
  { key: "96x48", label: "96 x 48 in", w: 48, h: 96 },
  { key: "84x36", label: "84 x 36 in", w: 36, h: 84 },
  { key: "72x36", label: "72 x 36 in", w: 36, h: 72 },
];

const TRIM_LENGTHS = [
  { key: "96", label: "96 in (8 ft)", inches: 96 },
  { key: "120", label: "120 in (10 ft)", inches: 120 },
];

const BACKER_TYPES = [
  { key: "existing_drywall", label: "Existing drywall (assumed acceptable)", requiresSheets: false },
  { key: "mr_drywall", label: "Moisture-resistant drywall (greenboard)", requiresSheets: true },
  { key: "cement", label: "Cement board", requiresSheets: true },
  { key: "foam", label: "Foam backer board", requiresSheets: true },
];

const SHEET_SIZES = [
  { key: "36x60", label: "36 x 60 in (3 x 5 ft)", w: 36, h: 60 },
  { key: "48x96", label: "48 x 96 in (4 x 8 ft)", w: 48, h: 96 },
];

const WATERPROOF_SYSTEMS = [
  { key: "none", label: "None / Not included" },
  { key: "liquid", label: "Liquid membrane (roll/brush)" },
  { key: "sheet", label: "Sheet membrane (roll + banding)" },
];

const DEFAULT_PRICES = {
  // Panels
  PANEL: 0.0,

  // Consumables
  ADH_TUBE: 6.98,
  SIL_TUBE: 9.48,

  // Trims (sticks)
  TRIM_H: 22.0,
  TRIM_IN: 22.0,
  TRIM_EDGE: 22.0,
  TRIM_TOP: 22.0,
  TRIM_BOT: 22.0,

  // Backer
  BACKER_SHEET: 16.98,
  BACKER_SCREWS: 9.98, // box
  BACKER_TAPE: 7.98, // roll

  // Waterproofing
  WP_LIQ_GAL: 54.98, // gallon
  WP_LIQ_FAB: 18.98, // roll
  WP_SHEET_SQFT: 2.25, // sqft
  WP_BAND_LF: 1.35, // lf
  WP_CORNER: 7.5, // each
};

/* =========================
   HELPERS
========================= */

function inchesToSqft(wIn, hIn) {
  return (wIn * hIn) / 144;
}
function ceilDiv(a, b) {
  if (b <= 0) return 0;
  return Math.ceil(a / b);
}
function ft(inches) {
  return inches / 12;
}
function money(n) {
  const val = Number.isFinite(n) ? n : 0;
  return val.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

// Perimeter sealing: two vertical corners + bottom + top
function calcPerimeterLf(w1, w2, w3, h) {
  const widthsFt = ft(w1 + w2 + w3);
  const heightFt = ft(h);
  const verticalCorners = 2 * heightFt;
  const bottomRun = widthsFt;
  const topRun = widthsFt;
  return Math.max(0, verticalCorners + bottomRun + topRun);
}

function calcVerticalSeams(wallsIn, panelWidthIn, heightIn) {
  const heightFt = ft(heightIn);
  const wallDetails = wallsIn.map((wallWidth) => {
    const pieces = ceilDiv(wallWidth, panelWidthIn);
    const seams = Math.max(0, pieces - 1);
    const seamLf = seams * heightFt;
    return { wallWidth, pieces, seams, seamLf };
  });
  const totalSeams = wallDetails.reduce((s, x) => s + x.seams, 0);
  const totalSeamLf = wallDetails.reduce((s, x) => s + x.seamLf, 0);
  return { wallDetails, totalSeams, totalSeamLf };
}

function calcVerticalTrimPieces(runs, heightIn, stickLenIn) {
  const totalInches = runs * heightIn;
  return ceilDiv(totalInches, stickLenIn);
}
function calcHorizontalTrimPieces(totalRunInches, stickLenIn) {
  return ceilDiv(totalRunInches, stickLenIn);
}

/* =========================
   PRINT HTML
========================= */

function buildPrintHtml({ company, customer, job, rows, total }) {
  const safe = (s) =>
    String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");

  const today = new Date().toLocaleDateString();

  const tbody = rows
    .map((r) => {
      const unitPrice = r.ext == null ? "—" : money(r.unitPrice);
      const ext = r.ext == null ? "—" : money(r.ext);
      return `
        <tr>
          <td class="item">${safe(r.name)}</td>
          <td>${safe(r.unit)}</td>
          <td class="num">${safe(r.qty)}</td>
          <td class="num">${unitPrice}</td>
          <td class="num">${ext}</td>
        </tr>
      `;
    })
    .join("");

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Estimate</title>
  <style>
    :root { --border:#e6e6ee; --muted:#666; }
    body { font-family: "Segoe UI", Arial, sans-serif; margin: 0; color:#111; }
    .page { padding: 28px; max-width: 920px; margin: 0 auto; }
    .hdr { display:flex; justify-content:space-between; gap: 16px; align-items:flex-start; }
    .brand h1 { margin:0; font-size: 20px; }
    .brand .muted { color:var(--muted); font-size: 12px; margin-top: 6px; line-height: 1.35; }
    .meta { text-align:right; font-size: 12px; color:var(--muted); line-height: 1.35; }
    .card { border:1px solid var(--border); border-radius: 14px; padding: 14px; margin-top: 14px; }
    .grid { display:grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .label { color:var(--muted); font-size: 12px; font-weight:700; }
    .value { font-size: 13px; margin-top: 3px; line-height: 1.35; }
    table { width:100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
    th, td { border-bottom:1px solid var(--border); padding: 9px; vertical-align: top; }
    th { background:#f7f7fb; text-align:left; font-size: 12px; }
    td.num, th.num { text-align:right; white-space:nowrap; }
    td.item { width: 52%; }
    .totals { display:flex; justify-content:flex-end; margin-top: 10px; }
    .totals .box { width: 320px; border:1px solid var(--border); border-radius: 14px; padding: 12px; }
    .totals .row { display:flex; justify-content:space-between; margin: 6px 0; }
    .totals .row.total { font-weight: 900; font-size: 14px; }
    .footer { margin-top: 14px; font-size: 11px; color:var(--muted); line-height: 1.35; }
    @media print {
      .no-print { display:none !important; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .page { padding: 0.5in; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="hdr">
      <div class="brand">
        <h1>${safe(company.name || "Your Company")} | Shower Estimate</h1>
        <div class="muted">
          ${safe(company.phone || "")}${company.phone && company.email ? " • " : ""}${safe(company.email || "")}
          ${company.address ? "<br/>" + safe(company.address) : ""}
        </div>
      </div>
      <div class="meta">
        <div><b>Date:</b> ${safe(today)}</div>
        <div><b>Estimate #:</b> ${safe(job.estimateNumber || "—")}</div>
      </div>
    </div>

    <div class="card grid">
      <div>
        <div class="label">Customer</div>
        <div class="value">
          <b>${safe(customer.name || "—")}</b><br/>
          ${safe(customer.phone || "")}${customer.phone && customer.email ? " • " : ""}${safe(customer.email || "")}<br/>
          ${safe(customer.address || "")}
        </div>
      </div>
      <div>
        <div class="label">Job Summary</div>
        <div class="value">
          <b>Material:</b> ${safe(job.material)}<br/>
          <b>Backer:</b> ${safe(job.backer)}<br/>
          <b>Waterproofing:</b> ${safe(job.wp)}<br/>
          <b>Walls:</b> ${safe(job.walls)}
        </div>
      </div>
    </div>

    <div class="card">
      <div class="label">Scope / Notes</div>
      <div class="value">${safe(job.notes || "—")}</div>
    </div>

    <div class="card">
      <div class="label">Line Items</div>
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Unit</th>
            <th class="num">Qty</th>
            <th class="num">Unit $</th>
            <th class="num">Ext $</th>
          </tr>
        </thead>
        <tbody>
          ${tbody}
        </tbody>
      </table>

      <div class="totals">
        <div class="box">
          <div class="row total"><span>Total</span><span>${money(total)}</span></div>
        </div>
      </div>

      <div class="footer">
        This estimate is based on provided measurements and standard estimating assumptions. Field conditions may require adjustments.
        Taxes, permits, demolition, plumbing, electrical, and unforeseen repairs are not included unless specifically noted.
      </div>
    </div>

    <div class="no-print" style="margin-top:14px; text-align:right;">
      <button onclick="window.print()" style="padding:10px 14px; border-radius:12px; border:1px solid #ccc; background:#fff; cursor:pointer;">
        Print / Save as PDF
      </button>
    </div>
  </div>
</body>
</html>`;
}

/* =========================
   UI: Vercel-safe checkbox row
   (prevents label text being hidden by global CSS)
========================= */
function CheckRow({ checked, onChange, children, disabled = false }) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginBottom: 6,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.65 : 1,
        userSelect: "none",
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
      <span style={{ color: "#111", fontSize: 14, fontWeight: 600, lineHeight: 1.2 }}>
        {children}
      </span>
    </label>
  );
}

/* =========================
   APP
========================= */

export default function App() {
  // Dimensions (defaults you requested)
  const [wall1, setWall1] = useState(32);
  const [wall2, setWall2] = useState(60);
  const [wall3, setWall3] = useState(32);
  const [height, setHeight] = useState(96);

  // System selections
  const [material, setMaterial] = useState("pvc");
  const [panelKey, setPanelKey] = useState("96x48");
  const [trimLenKey, setTrimLenKey] = useState("96");

  const [backerType, setBackerType] = useState("cement");
  const [sheetKey, setSheetKey] = useState("48x96");

  const [includeWaterproofing, setIncludeWaterproofing] = useState(true);
  const [wpSystem, setWpSystem] = useState("none");

  // WP parameters
  const [liqCoats, setLiqCoats] = useState(2);
  const [liqCoveragePerGallon, setLiqCoveragePerGallon] = useState(55);

  const [includeBanding, setIncludeBanding] = useState(true);
  const [bandingWaste, setBandingWaste] = useState(0.1);

  // Install assumptions / toggles
  const [includeAdhesive, setIncludeAdhesive] = useState(true);
  const [includeSilicone, setIncludeSilicone] = useState(true);

  const [seamsUseTrim, setSeamsUseTrim] = useState(true);

  const [includeInsideCornerTrim, setIncludeInsideCornerTrim] = useState(true);
  const [includeEdgeTrim, setIncludeEdgeTrim] = useState(true);
  const [includeTopTrim, setIncludeTopTrim] = useState(true);
  const [includeBottomTrim, setIncludeBottomTrim] = useState(true);

  // Backer include toggles
  const [includeBacker, setIncludeBacker] = useState(true);
  const [includeBackerScrews, setIncludeBackerScrews] = useState(true);
  const [includeBackerTape, setIncludeBackerTape] = useState(true);

  // Pricing
  const [prices, setPrices] = useState(DEFAULT_PRICES);
  const [includePanelPrice, setIncludePanelPrice] = useState(false);

  // View: Summary vs Detailed (DISPLAY ONLY)
  const [detailLevel, setDetailLevel] = useState("summary"); // "summary" | "detailed"

  // Customer / Company / Notes
  const [company, setCompany] = useState({
    name: "HiTecHandyman Services",
    phone: "",
    email: "",
    address: "",
  });

  const [customer, setCustomer] = useState({
    name: "Kevin",
    phone: "",
    email: "",
    address: "",
  });

  const [notes, setNotes] = useState(
    "Remove existing surround as needed, prep substrate, install new system per manufacturer instructions, seal all joints and penetrations."
  );

  // Lookups
  const rule = MATERIAL_RULES[material];
  const panel = PANEL_SIZES.find((p) => p.key === panelKey) || PANEL_SIZES[0];
  const trimLen = TRIM_LENGTHS.find((t) => t.key === trimLenKey)?.inches ?? 96;

  const backer = BACKER_TYPES.find((b) => b.key === backerType) || BACKER_TYPES[0];
  const sheet = SHEET_SIZES.find((s) => s.key === sheetKey) || SHEET_SIZES[1];
  const wp = WATERPROOF_SYSTEMS.find((w) => w.key === wpSystem) || WATERPROOF_SYSTEMS[0];

  // Full calculator model
  const model = useMemo(() => {
    const baseSqft =
      inchesToSqft(wall1, height) +
      inchesToSqft(wall2, height) +
      inchesToSqft(wall3, height);

    const totalSqft = baseSqft * (1 + rule.waste);

    // Panels
    const panelSqft = inchesToSqft(panel.w, panel.h);
    const panelsNeeded = ceilDiv(totalSqft, panelSqft);

    // Seams
    const seams = calcVerticalSeams([wall1, wall2, wall3], panel.w, height);

    // Sealant LF: perimeter + optionally vertical seams if no H-trim
    const perimeterLf = calcPerimeterLf(wall1, wall2, wall3, height);
    const seamLfForSealant = seamsUseTrim ? 0 : seams.totalSeamLf;
    const totalSealantLf = perimeterLf + seamLfForSealant;

    // Tubes
    const adhesiveTubes = includeAdhesive ? ceilDiv(totalSqft, rule.adhesiveSqftPerTube) : 0;
    const siliconeTubes = includeSilicone ? ceilDiv(totalSealantLf, rule.siliconeLfPerTube) : 0;

    // Trims (sticks)
    const hJointRuns = seams.totalSeams;
    const insideCornerRuns = 2;
    const edgeRuns = 2;

    const hJointPieces = seamsUseTrim ? calcVerticalTrimPieces(hJointRuns, height, trimLen) : 0;
    const insideCornerPieces = includeInsideCornerTrim ? calcVerticalTrimPieces(insideCornerRuns, height, trimLen) : 0;
    const edgePieces = includeEdgeTrim ? calcVerticalTrimPieces(edgeRuns, height, trimLen) : 0;

    const totalHorizontalRunIn = wall1 + wall2 + wall3;
    const topTrimPieces = includeTopTrim ? calcHorizontalTrimPieces(totalHorizontalRunIn, trimLen) : 0;
    const bottomTrimPieces = includeBottomTrim ? calcHorizontalTrimPieces(totalHorizontalRunIn, trimLen) : 0;

    // Backer sheets
    const sheetSqft = inchesToSqft(sheet.w, sheet.h);
    const backerSheets = backer.requiresSheets ? ceilDiv(totalSqft, sheetSqft) : 0;

    // Backer screws estimate (baseline)
    const screwsPerSqft = 1.7;
    const screwsTotal = backerSheets > 0 ? Math.ceil(totalSqft * screwsPerSqft) : 0;
    const screwsPerBox = 185;
    const screwBoxes = screwsTotal > 0 ? ceilDiv(screwsTotal, screwsPerBox) : 0;

    // Mesh tape estimate: corners + seams
    const meshTapeLf = backerSheets > 0 ? (2 * ft(height) + seams.totalSeamLf) : 0;
    const tapePerRollLf = 150;
    const tapeRolls = meshTapeLf > 0 ? ceilDiv(meshTapeLf, tapePerRollLf) : 0;

    // Waterproofing enabled only if included + system chosen + sheet-based backer present
    const wpEnabled = includeWaterproofing && wpSystem !== "none" && backerSheets > 0;

    // Liquid membrane: gallons = (area * coats) / coveragePerCoat
    const liquidGallons =
      wpEnabled && wpSystem === "liquid"
        ? Math.ceil((totalSqft * liqCoats) / Math.max(1, liqCoveragePerGallon))
        : 0;

    // Fabric rolls baseline
    const liquidFabricRolls = wpEnabled && wpSystem === "liquid" ? 1 : 0;

    // Sheet membrane: sqft
    const sheetMembraneSqft = wpEnabled && wpSystem === "sheet" ? Math.ceil(totalSqft) : 0;

    // Banding LF: corners + bottom run + seams (+ waste)
    const bandBaseLf = 2 * ft(height) + ft(totalHorizontalRunIn) + seams.totalSeamLf;
    const bandLf =
      wpEnabled && wpSystem === "sheet" && includeBanding
        ? Math.ceil(bandBaseLf * (1 + bandingWaste))
        : 0;

    // Preformed corners (inside): 2
    const preformedCorners = wpEnabled && wpSystem === "sheet" ? 2 : 0;

    return {
      totalSqft,
      panelsNeeded,

      seams,
      perimeterLf,
      totalSealantLf,

      adhesiveTubes,
      siliconeTubes,

      hJointPieces,
      insideCornerPieces,
      edgePieces,
      topTrimPieces,
      bottomTrimPieces,

      backerSheets,
      screwBoxes,
      tapeRolls,

      wpEnabled,
      liquidGallons,
      liquidFabricRolls,
      sheetMembraneSqft,
      bandLf,
      preformedCorners,
    };
  }, [
    wall1,
    wall2,
    wall3,
    height,
    rule,
    panel,
    sheet,
    backer,
    seamsUseTrim,
    trimLen,
    includeAdhesive,
    includeSilicone,
    includeInsideCornerTrim,
    includeEdgeTrim,
    includeTopTrim,
    includeBottomTrim,
    includeWaterproofing,
    wpSystem,
    liqCoats,
    liqCoveragePerGallon,
    includeBanding,
    bandingWaste,
  ]);

  // MASTER line items (true total for BOTH modes)
  const masterItems = useMemo(() => {
    const items = [];

    const addPriced = (key, name, unit, qty, priceKey) => {
      if (!qty || qty <= 0) return;
      const unitPrice = Number(prices[priceKey] ?? 0);
      items.push({ key, name, unit, qty, unitPrice, ext: qty * unitPrice, priceKey });
    };

    const addQtyOnly = (key, name, unit, qty, priceKey) => {
      if (!qty || qty <= 0) return;
      items.push({ key, name, unit, qty, unitPrice: null, ext: null, priceKey, qtyOnly: true });
    };

    // Panels (qty only unless includePanelPrice)
    if (includePanelPrice) addPriced("PANEL", `Wall panels (${panel.label})`, "panel", model.panelsNeeded, "PANEL");
    else addQtyOnly("PANEL_QTY", `Wall panels (${panel.label})`, "panel", model.panelsNeeded, "PANEL");

    // Adhesive / silicone
    if (includeAdhesive) addPriced("ADH", "Panel adhesive", "tube", model.adhesiveTubes, "ADH_TUBE");
    if (includeSilicone) addPriced("SIL", "100% silicone", "tube", model.siliconeTubes, "SIL_TUBE");

    // Trims
    addPriced("TRIM_H", "H-joint seam trim", "stick", model.hJointPieces, "TRIM_H");
    addPriced("TRIM_IN", "Inside corner trim", "stick", model.insideCornerPieces, "TRIM_IN");
    addPriced("TRIM_EDGE", "Edge/J-trim", "stick", model.edgePieces, "TRIM_EDGE");
    addPriced("TRIM_TOP", "Top trim (horizontal)", "stick", model.topTrimPieces, "TRIM_TOP");
    addPriced("TRIM_BOT", "Bottom trim (horizontal)", "stick", model.bottomTrimPieces, "TRIM_BOT");

    // Backer
    if (includeBacker) addPriced("BACKER", `${backer.label} (sheets)`, "sheet", model.backerSheets, "BACKER_SHEET");
    if (includeBackerScrews) addPriced("BACKER_SCREWS", "Backer screws (box)", "box", model.screwBoxes, "BACKER_SCREWS");
    if (includeBackerTape) addPriced("BACKER_TAPE", "Alkali-resistant mesh tape (roll)", "roll", model.tapeRolls, "BACKER_TAPE");

    // Waterproofing
    if (model.wpEnabled && wpSystem === "liquid") {
      addPriced("WP_LIQ", "Liquid waterproofing membrane", "gallon", model.liquidGallons, "WP_LIQ_GAL");
      addPriced("WP_LIQ_FAB", "Reinforcement fabric", "roll", model.liquidFabricRolls, "WP_LIQ_FAB");
    }

    if (model.wpEnabled && wpSystem === "sheet") {
      addPriced("WP_SHEET", "Sheet membrane", "sqft", model.sheetMembraneSqft, "WP_SHEET_SQFT");
      addPriced("WP_BAND", "Seam banding", "lf", model.bandLf, "WP_BAND_LF");
      addPriced("WP_CORNER", "Preformed inside corners", "each", model.preformedCorners, "WP_CORNER");
    }

    return items.filter((x) => x.qty && x.qty > 0);
  }, [
    prices,
    includePanelPrice,
    panel,
    model,
    includeAdhesive,
    includeSilicone,
    includeBacker,
    includeBackerScrews,
    includeBackerTape,
    backer,
    wpSystem,
  ]);

  // Total ALWAYS from masterItems (same for summary/detailed)
  const masterTotal = useMemo(() => {
    return masterItems.filter((x) => x.ext != null).reduce((sum, x) => sum + x.ext, 0);
  }, [masterItems]);

  // Display items (filter only)
  const displayItems = useMemo(() => {
    if (detailLevel === "detailed") return masterItems;

    // Summary view: show headline lines only, total still includes everything
    const keep = new Set(["PANEL", "PANEL_QTY", "BACKER", "WP_LIQ", "WP_SHEET"]);
    return masterItems.filter((it) => keep.has(it.key));
  }, [detailLevel, masterItems]);

  const printEstimate = () => {
    const html = buildPrintHtml({
      company,
      customer,
      job: {
        estimateNumber: "",
        material: rule.label,
        backer: backer.label,
        wp: wp.label,
        walls: `${wall1}" / ${wall2}" / ${wall3}" @ ${height}"`,
        notes,
      },
      rows: displayItems, // print current view
      total: masterTotal, // total always master
    });

    const w = window.open("", "_blank");
    if (!w) return alert("Popup blocked. Allow popups for this site to print.");
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  const uiCard = {
    border: "1px solid #ddd",
    borderRadius: 14,
    padding: 16,
    background: "white",
  };

  // ✅ CENTS-FORMAT HELPER FOR ALL PRICE INPUTS
  const priceStr = (k) => {
    const v = Number(prices[k]);
    return Number.isFinite(v) ? v.toFixed(2) : "0.00";
  };

  return (
    <div style={{ padding: 24, fontFamily: "Segoe UI, Arial" }}>
      <h1 style={{ marginTop: 0 }}>Shower Estimator</h1>

      <div style={{ display: "grid", gridTemplateColumns: "540px 1fr", gap: 16 }}>
        {/* LEFT: Inputs */}
        <div style={uiCard}>
          <h3 style={{ marginTop: 0 }}>Customer / Proposal</h3>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 12, color: "#666" }}>Customer Name</div>
              <input
                value={customer.name}
                onChange={(e) => setCustomer((c) => ({ ...c, name: e.target.value }))}
                style={{ width: "100%" }}
              />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 12, color: "#666" }}>Customer Phone</div>
              <input
                value={customer.phone}
                onChange={(e) => setCustomer((c) => ({ ...c, phone: e.target.value }))}
                style={{ width: "100%" }}
              />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 12, color: "#666" }}>Customer Email</div>
              <input
                value={customer.email}
                onChange={(e) => setCustomer((c) => ({ ...c, email: e.target.value }))}
                style={{ width: "100%" }}
              />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 12, color: "#666" }}>Job Address</div>
              <input
                value={customer.address}
                onChange={(e) => setCustomer((c) => ({ ...c, address: e.target.value }))}
                style={{ width: "100%" }}
              />
            </div>
          </div>

          <div style={{ marginTop: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 12, color: "#666" }}>Scope / Notes</div>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} style={{ width: "100%" }} />
          </div>

          <hr />

          <h3 style={{ marginTop: 0 }}>Estimate View</h3>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 12, color: "#666" }}>Detail Level (display only)</div>
            <select value={detailLevel} onChange={(e) => setDetailLevel(e.target.value)} style={{ width: "100%" }}>
              <option value="summary">Summary (customer-facing)</option>
              <option value="detailed">Detailed (contractor takeoff)</option>
            </select>
            <div style={{ fontSize: 12, color: "#555", marginTop: 6 }}>
              Total is always based on the full takeoff, so Summary and Detailed match.
            </div>
          </div>

          <hr />

          <h3 style={{ marginTop: 0 }}>Dimensions</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={{ fontSize: 12, color: "#666", fontWeight: 700 }}>Wall 1 (in)</label>
              <input type="number" value={wall1} onChange={(e) => setWall1(Number(e.target.value))} style={{ width: "100%" }} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "#666", fontWeight: 700 }}>Back wall (in)</label>
              <input type="number" value={wall2} onChange={(e) => setWall2(Number(e.target.value))} style={{ width: "100%" }} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "#666", fontWeight: 700 }}>Wall 3 (in)</label>
              <input type="number" value={wall3} onChange={(e) => setWall3(Number(e.target.value))} style={{ width: "100%" }} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "#666", fontWeight: 700 }}>Height (in)</label>
              <input type="number" value={height} onChange={(e) => setHeight(Number(e.target.value))} style={{ width: "100%" }} />
            </div>
          </div>

          <hr />

          <h3 style={{ marginTop: 0 }}>System</h3>

          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 12, color: "#666", fontWeight: 700 }}>Material</label>
            <select value={material} onChange={(e) => setMaterial(e.target.value)} style={{ width: "100%" }}>
              <option value="pvc">PVC Panels</option>
              <option value="acrylic">Acrylic Panels</option>
              <option value="solid">Solid Surface</option>
            </select>
            <div style={{ fontSize: 12, color: "#555", marginTop: 6 }}>
              Waste: {(rule.waste * 100).toFixed(0)}% • Adhesive: {rule.adhesiveSqftPerTube} sf/tube • Silicone:{" "}
              {rule.siliconeLfPerTube} lf/tube
            </div>
          </div>

          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 12, color: "#666", fontWeight: 700 }}>Panel Size</label>
            <select value={panelKey} onChange={(e) => setPanelKey(e.target.value)} style={{ width: "100%" }}>
              {PANEL_SIZES.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 12, color: "#666", fontWeight: 700 }}>Trim Stick Length</label>
            <select value={trimLenKey} onChange={(e) => setTrimLenKey(e.target.value)} style={{ width: "100%" }}>
              {TRIM_LENGTHS.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <hr />

          <h3 style={{ marginTop: 0 }}>Backer / Substrate</h3>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 12, color: "#666", fontWeight: 700 }}>Backer Type</label>
            <select value={backerType} onChange={(e) => setBackerType(e.target.value)} style={{ width: "100%" }}>
              {BACKER_TYPES.map((b) => (
                <option key={b.key} value={b.key}>
                  {b.label}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 12, color: "#666", fontWeight: 700 }}>Sheet Size</label>
            <select
              value={sheetKey}
              onChange={(e) => setSheetKey(e.target.value)}
              style={{ width: "100%" }}
              disabled={!backer.requiresSheets}
            >
              {SHEET_SIZES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <CheckRow checked={includeBacker} onChange={setIncludeBacker}>
            Include backer sheets
          </CheckRow>
          <CheckRow checked={includeBackerScrews} onChange={setIncludeBackerScrews}>
            Include backer screws
          </CheckRow>
          <CheckRow checked={includeBackerTape} onChange={setIncludeBackerTape}>
            Include mesh tape
          </CheckRow>

          <hr />

          <h3 style={{ marginTop: 0 }}>Waterproofing</h3>
          <CheckRow checked={includeWaterproofing} onChange={setIncludeWaterproofing}>
            Include waterproofing
          </CheckRow>

          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 12, color: "#666", fontWeight: 700 }}>System</label>
            <select
              value={wpSystem}
              onChange={(e) => setWpSystem(e.target.value)}
              style={{ width: "100%" }}
              disabled={!includeWaterproofing}
            >
              {WATERPROOF_SYSTEMS.map((w) => (
                <option key={w.key} value={w.key}>
                  {w.label}
                </option>
              ))}
            </select>
            <div style={{ fontSize: 12, color: "#555", marginTop: 6 }}>
              WP enabled: {model.wpEnabled ? "Yes" : "No"} (requires sheet-based backer)
            </div>
          </div>

          {includeWaterproofing && wpSystem === "liquid" && (
            <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 10, marginBottom: 10 }}>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>Liquid Settings</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 12, color: "#666", fontWeight: 700 }}>Coats</div>
                  <input type="number" min="1" value={liqCoats} onChange={(e) => setLiqCoats(Number(e.target.value))} style={{ width: "100%" }} />
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "#666", fontWeight: 700 }}>Coverage (sf/gal/coat)</div>
                  <input
                    type="number"
                    min="1"
                    value={liqCoveragePerGallon}
                    onChange={(e) => setLiqCoveragePerGallon(Number(e.target.value))}
                    style={{ width: "100%" }}
                  />
                </div>
              </div>
              <div style={{ fontSize: 12, color: "#555", marginTop: 6 }}>
                Est: {model.liquidGallons} gallon(s), fabric rolls: {model.liquidFabricRolls}
              </div>
            </div>
          )}

          {includeWaterproofing && wpSystem === "sheet" && (
            <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 10, marginBottom: 10 }}>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>Sheet Settings</div>

              <CheckRow checked={includeBanding} onChange={setIncludeBanding}>
                Include banding
              </CheckRow>

              <div>
                <div style={{ fontSize: 12, color: "#666", fontWeight: 700 }}>Banding Waste (fraction)</div>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={bandingWaste}
                  onChange={(e) => setBandingWaste(Number(e.target.value))}
                  style={{ width: "100%" }}
                />
              </div>
              <div style={{ fontSize: 12, color: "#555", marginTop: 6 }}>
                Est: membrane {model.sheetMembraneSqft} sf, banding {model.bandLf} lf, corners {model.preformedCorners}
              </div>
            </div>
          )}

          <hr />

          <h3 style={{ marginTop: 0 }}>Install Options</h3>
          <CheckRow checked={includeAdhesive} onChange={setIncludeAdhesive}>
            Include adhesive
          </CheckRow>
          <CheckRow checked={includeSilicone} onChange={setIncludeSilicone}>
            Include silicone
          </CheckRow>
          <CheckRow checked={seamsUseTrim} onChange={setSeamsUseTrim}>
            Seams use H-joint trim (not sealant)
          </CheckRow>

          <CheckRow checked={includeInsideCornerTrim} onChange={setIncludeInsideCornerTrim}>
            Inside corner trim
          </CheckRow>
          <CheckRow checked={includeEdgeTrim} onChange={setIncludeEdgeTrim}>
            Edge/J-trim
          </CheckRow>
          <CheckRow checked={includeTopTrim} onChange={setIncludeTopTrim}>
            Top trim
          </CheckRow>
          <CheckRow checked={includeBottomTrim} onChange={setIncludeBottomTrim}>
            Bottom trim
          </CheckRow>

          <hr />

          <h3 style={{ marginTop: 0 }}>Pricing</h3>
          <CheckRow checked={includePanelPrice} onChange={setIncludePanelPrice}>
            Include panel price in total
          </CheckRow>

          <button
            onClick={printEstimate}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #ccc",
              background: "white",
              cursor: "pointer",
              fontWeight: 900,
            }}
          >
            Print / Save as PDF
          </button>
        </div>

        {/* RIGHT: Estimate */}
        <div style={uiCard}>
          <h3 style={{ marginTop: 0 }}>Estimate</h3>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
              <div style={{ color: "#666", fontSize: 12, fontWeight: 800 }}>Area (w/ waste)</div>
              <div style={{ fontSize: 18, fontWeight: 900 }}>{model.totalSqft.toFixed(2)} sf</div>
            </div>
            <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
              <div style={{ color: "#666", fontSize: 12, fontWeight: 800 }}>Panels</div>
              <div style={{ fontSize: 18, fontWeight: 900 }}>{model.panelsNeeded}</div>
            </div>
            <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
              <div style={{ color: "#666", fontSize: 12, fontWeight: 800 }}>View</div>
              <div style={{ fontSize: 14, fontWeight: 900 }}>{detailLevel === "summary" ? "Summary" : "Detailed"}</div>
              <div style={{ fontSize: 12, color: "#666" }}>Total always uses full takeoff</div>
            </div>
            <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
              <div style={{ color: "#666", fontSize: 12, fontWeight: 800 }}>Total</div>
              <div style={{ fontSize: 18, fontWeight: 900 }}>{money(masterTotal)}</div>
            </div>
          </div>

          <div style={{ marginTop: 14, border: "1px solid #eee", borderRadius: 12, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f7f7fb" }}>
                  <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #eee" }}>Item</th>
                  <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #eee" }}>Unit</th>
                  <th style={{ textAlign: "right", padding: 10, borderBottom: "1px solid #eee" }}>Qty</th>
                  <th style={{ textAlign: "right", padding: 10, borderBottom: "1px solid #eee" }}>Unit $</th>
                  <th style={{ textAlign: "right", padding: 10, borderBottom: "1px solid #eee" }}>Ext $</th>
                </tr>
              </thead>
              <tbody>
                {displayItems.map((it) => (
                  <tr key={it.key}>
                    <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{it.name}</td>
                    <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{it.unit}</td>
                    <td style={{ padding: 10, borderBottom: "1px solid #eee", textAlign: "right" }}>{it.qty}</td>

                    {/* ✅ always show cents for every Unit $ input */}
                    <td style={{ padding: 10, borderBottom: "1px solid #eee", textAlign: "right" }}>
                      {it.ext == null ? (
                        <span style={{ color: "#777" }}>Qty only</span>
                      ) : (
                        <input
                          type="number"
                          step="0.01"
                          value={priceStr(it.priceKey)}
                          onChange={(e) =>
                            setPrices((p) => ({
                              ...p,
                              [it.priceKey]: Number(e.target.value),
                            }))
                          }
                          style={{ width: 90, textAlign: "right" }}
                        />
                      )}
                    </td>

                    <td style={{ padding: 10, borderBottom: "1px solid #eee", textAlign: "right" }}>
                      {it.ext == null ? <span style={{ color: "#777" }}>—</span> : money(it.ext)}
                    </td>
                  </tr>
                ))}

                <tr>
                  <td colSpan={4} style={{ padding: 10, textAlign: "right", fontWeight: 900 }}>
                    Total
                  </td>
                  <td style={{ padding: 10, textAlign: "right", fontWeight: 900 }}>{money(masterTotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {detailLevel === "summary" && masterItems.length !== displayItems.length && (
            <div style={{ fontSize: 12, color: "#555", marginTop: 10 }}>
              Summary hides internal takeoff lines (adhesives, trims, fasteners, accessories), but the total includes them.
              Switch to Detailed to see every component.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}






