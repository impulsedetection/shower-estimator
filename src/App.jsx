import { useEffect, useMemo, useRef, useState } from "react";


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

/* =========================
   CONTEXT HELP (F2)
========================= */

const HELP_CONTENT = {
  // Customer / Proposal
  customer_name: {
    title: "Customer Name",
    body: "Who the estimate is for. This prints on the estimate header.",
  },
  customer_phone: {
    title: "Customer Phone",
    body: "Optional. Shown on the printout if provided.",
  },
  customer_email: {
    title: "Customer Email",
    body: "Optional. Shown on the printout if provided.",
  },
  job_address: {
    title: "Job Address",
    body: "Optional. Use the install location address. Prints on the estimate.",
  },
  notes: {
    title: "Scope / Notes",
    body: "Short scope, exclusions, and assumptions. This prints under the customer/job summary.",
  },

  // View
  detailLevel: {
    title: "Detail Level",
    body: "Summary hides internal takeoff lines but the TOTAL still includes everything. Detailed shows every component line.",
  },

  // Dimensions
  wall1: {
    title: "Wall 1 (in)",
    body: "Left return wall width in inches (from corner to front edge).",
  },
  wall2: {
    title: "Back Wall (in)",
    body: "Back wall width in inches.",
  },
  wall3: {
    title: "Wall 3 (in)",
    body: "Right return wall width in inches (from corner to front edge).",
  },
  height: {
    title: "Height (in)",
    body: "Finished panel height in inches. Typical tub surround is 60–72, full height is 84–96.",
  },

  // System
  material: {
    title: "Material",
    body: "Select the panel material. This affects waste %, adhesive coverage, and silicone usage assumptions.",
  },
  panelSize: {
    title: "Panel Size",
    body: "Select the panel dimensions you plan to use. This changes how many panels are needed.",
  },
  trimLen: {
    title: "Trim Stick Length",
    body: "Choose 8 ft or 10 ft trim sticks. Used when calculating how many sticks are required.",
  },

  // Backer
  backerType: {
    title: "Backer Type",
    body: "Substrate behind the panels. Sheet-based options will calculate board sheets, screws, and tape.",
  },
  sheetSize: {
    title: "Backer Sheet Size",
    body: "Board size used to calculate required sheet count (only when a sheet-based backer is selected).",
  },
  includeBacker: {
    title: "Include backer sheets",
    body: "Adds sheets for the selected backer type to the takeoff/total.",
  },
  includeBackerScrews: {
    title: "Include backer screws",
    body: "Adds an estimated number of screw boxes for installing the backer.",
  },
  includeBackerTape: {
    title: "Include mesh tape",
    body: "Adds alkali-resistant mesh tape rolls for seams/corners on sheet-based backers.",
  },

  // Waterproofing
  includeWaterproofing: {
    title: "Include waterproofing",
    body: "Adds waterproofing materials when a sheet-based backer is selected and a waterproofing system is chosen.",
  },
  wpSystem: {
    title: "Waterproofing System",
    body: "Choose Liquid or Sheet membrane. ‘None’ means waterproofing is not included.",
  },
  liqCoats: {
    title: "Liquid coats",
    body: "How many coats of liquid membrane to estimate. Common is 2 coats.",
  },
  liqCoveragePerGallon: {
    title: "Liquid coverage",
    body: "Coverage per gallon per coat (sq ft/gal/coat). Used to estimate gallons required.",
  },
  includeBanding: {
    title: "Include banding",
    body: "Adds seam banding for sheet membrane systems.",
  },
  bandingWaste: {
    title: "Banding waste",
    body: "Extra allowance for overlaps, cuts, and mistakes (example 0.10 = 10%).",
  },

  // Install options
  includeAdhesive: {
    title: "Include adhesive",
    body: "Adds panel adhesive tubes based on total square feet and the selected material rule.",
  },
  includeSilicone: {
    title: "Include silicone",
    body: "Adds silicone tubes based on perimeter (and seams if you’re not using H-trim).",
  },
  seamsUseTrim: {
    title: "Seams use H-joint trim",
    body: "If checked, vertical seams use H-trim (no silicone on seams). If unchecked, seams are sealed with silicone.",
  },
  includeInsideCornerTrim: {
    title: "Inside corner trim",
    body: "Adds inside corner trim sticks for the two shower corners.",
  },
  includeEdgeTrim: {
    title: "Edge/J-trim",
    body: "Adds edge/J-trim sticks for the two front edges.",
  },
  includeTopTrim: {
    title: "Top trim",
    body: "Adds horizontal top trim sticks along the combined wall width.",
  },
  includeBottomTrim: {
    title: "Bottom trim",
    body: "Adds horizontal bottom trim sticks along the combined wall width.",
  },

  // Pricing
  includePanelPrice: {
    title: "Include panel price in total",
    body: "If unchecked, panels show as Qty-only and do not affect the total. If checked, panels are priced and included.",
  },
  print: {
    title: "Print / Save as PDF",
    body: "Opens a printable estimate page in a new tab so you can print or save as PDF.",
  },
};

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

function buildPrintHtml({ logoUrl, company, customer, job, rows, total }) {
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
    :root{
      --navy:#0b2a4a;
      --red:#c1121f;
      --bg:#f6f8fc;
      --card:#ffffff;
      --border:#e4e8f2;
      --muted:#5b6472;
    }
    body { font-family: "Segoe UI", Arial, sans-serif; margin:0; color:#111; background: var(--bg); }
    .page { padding: 28px; max-width: 980px; margin: 0 auto; }
    .topbar{
      background: var(--card);
      border:1px solid var(--border);
      border-radius: 18px;
      padding: 14px 16px;
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap: 16px;
      box-shadow: 0 10px 26px rgba(11,42,74,.06);
    }
    .brandWrap{ display:flex; align-items:center; gap: 14px; }
    .logo{ width: 86px; height:auto; display:block; }
    .brand h1 { margin:0; font-size: 18px; color: var(--navy); letter-spacing: .2px; }
    .brand .muted { color:var(--muted); font-size: 12px; margin-top: 4px; line-height: 1.35; }
    .meta { text-align:right; font-size: 12px; color:var(--muted); line-height: 1.35; }
    .pill{
      display:inline-block;
      padding: 4px 10px;
      border-radius: 999px;
      border: 1px solid var(--border);
      background: #fff;
      color: var(--navy);
      font-weight: 800;
      margin-top: 6px;
    }
    .accentBar{
      height: 6px;
      border-radius: 999px;
      margin-top: 10px;
      background: linear-gradient(90deg, var(--navy), #ffffff 45%, var(--red));
      border: 1px solid var(--border);
    }

    .card { background: var(--card); border:1px solid var(--border); border-radius: 18px; padding: 14px; margin-top: 14px; }
    .grid { display:grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .label { color:var(--muted); font-size: 12px; font-weight:900; }
    .value { font-size: 13px; margin-top: 3px; line-height: 1.35; }

    table { width:100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
    th, td { border-bottom:1px solid var(--border); padding: 10px; vertical-align: top; }
    th {
      background: #eef3ff;
      text-align:left;
      font-size: 12px;
      color: var(--navy);
      border-bottom: 2px solid rgba(11,42,74,.10);
    }
    td.num, th.num { text-align:right; white-space:nowrap; }
    td.item { width: 52%; }

    .totals { display:flex; justify-content:flex-end; margin-top: 10px; }
    .totals .box { width: 320px; border:1px solid var(--border); border-radius: 18px; padding: 12px; background:#fff; }
    .totals .row { display:flex; justify-content:space-between; margin: 6px 0; }
    .totals .row.total { font-weight: 950; font-size: 14px; color: var(--navy); }
    .footer { margin-top: 12px; font-size: 11px; color:var(--muted); line-height: 1.35; }

    .btn{
      padding:10px 14px;
      border-radius:14px;
      border:1px solid var(--border);
      background:#fff;
      cursor:pointer;
      font-weight:900;
      color: var(--navy);
    }
    .btn:hover{ border-color: rgba(11,42,74,.25); }

    @media print {
      .no-print { display:none !important; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .page { padding: 0.5in; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="topbar">
      <div class="brandWrap">
        ${
          logoUrl
            ? `<img class="logo" src="${safe(logoUrl)}" alt="Logo" onerror="this.style.display='none'"/>`
            : ""
        }
        <div class="brand">
          <h1>${safe(company.name || "Your Company")} | Shower Estimate</h1>
          <div class="muted">
            ${safe(company.phone || "")}${company.phone && company.email ? " • " : ""}${safe(company.email || "")}
            ${company.address ? "<br/>" + safe(company.address) : ""}
          </div>
          <div class="pill">Red • White • Blue Estimate</div>
        </div>
      </div>
      <div class="meta">
        <div><b>Date:</b> ${safe(today)}</div>
        <div><b>Estimate #:</b> ${safe(job.estimateNumber || "—")}</div>
      </div>
    </div>

    <div class="accentBar"></div>

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
        <tbody>${tbody}</tbody>
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
      <button class="btn" onclick="window.print()">Print / Save as PDF</button>
    </div>
  </div>
</body>
</html>`;
}

/* =========================
   APP
========================= */

export default function App() {
  // ✅ Google Drive direct image URL (reliable for <img>)
  const LOGO_URL = "https://drive.google.com/uc?export=view&id=1MR7bEKHTAz1YTvMif_XvjsBxJIx-Z_eD";
  const [logoOk, setLogoOk] = useState(true);

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

  // Company / Customer / Notes
  const [company] = useState({
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

  // Context help (F2)
  const [helpOpen, setHelpOpen] = useState(false);
  const helpOpenRef = useRef(false);
  const activeHelpKeyRef = useRef(null);

  const [activeHelpKey, setActiveHelpKey] = useState(null);
  const [helpAnchor, setHelpAnchor] = useState(null);
  const firstMeasureRef = useRef(null);

  useEffect(() => {
    // Always reset help focus on first load (so it doesn't "resume" from a prior hot-reload state)
    setActiveHelpKey(null);
    // Optionally focus the first measurement so keyboard users start in the right place
    // (Small timeout avoids race with initial render/layout.)
    setTimeout(() => firstMeasureRef.current?.focus?.(), 0);

    const onKeyDown = (e) => {
      if (e.key === "F2") {
        e.preventDefault();
        setHelpOpen((v) => !v);
      }
    };

// Mobile-first help detection:
    // - Show help bubble when hovering with mouse OR touching a control
    // - Hide help bubble immediately when user clicks/taps/focuses to edit
    const showHelpForTarget = (target) => {
      if (!helpOpenRef.current) return;
      const el = target?.closest?.("[data-helpkey]");
      if (!el) return;
      const key = el.getAttribute("data-helpkey");
      if (!key) return;
      const r = el.getBoundingClientRect();
      setActiveHelpKey(key);
      setHelpAnchor({ top: r.top, left: r.left, width: r.width, height: r.height });
    };

    const hideHelp = () => {
      if (!helpOpenRef.current) return;
      setActiveHelpKey(null);
      setHelpAnchor(null);
    };

    const onPointerOver = (e) => {
      // Only treat mouse/pen hover as hover
      if (e.pointerType && e.pointerType !== "mouse" && e.pointerType !== "pen") return;
      showHelpForTarget(e.target);
    };
    const onTouchStart = (e) => {
      // Touch users don't have hover; touchstart is a "peek" at help
      showHelpForTarget(e.target);
    };

    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerover", onPointerOver, true);
    document.addEventListener("touchstart", onTouchStart, { capture: true, passive: true });
    document.addEventListener("pointerdown", hideHelp, true);
    document.addEventListener("focusin", hideHelp, true);

    // Keep position accurate while scrolling/resizing
    const onScrollOrResize = () => {
      if (!helpOpenRef.current || !activeHelpKeyRef.current) return;
      const el = document.querySelector(`[data-helpkey="${activeHelpKeyRef.current}"]`);
      if (!el) return;
      const r = el.getBoundingClientRect();
      setHelpAnchor({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize, true);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerover", onPointerOver, true);
      document.removeEventListener("touchstart", onTouchStart, true);
      document.removeEventListener("pointerdown", hideHelp, true);
      document.removeEventListener("focusin", hideHelp, true);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize, true);
    };
  }, []);

  const helpProps = (key) => ({ "data-helpkey": key });

  useEffect(() => {
    helpOpenRef.current = helpOpen;
  }, [helpOpen]);

  useEffect(() => {
    activeHelpKeyRef.current = activeHelpKey;
  }, [activeHelpKey]);


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
      logoUrl: LOGO_URL,
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

  // ✅ CENTS-FORMAT HELPER FOR ALL PRICE INPUTS
  const priceStr = (k) => {
    const v = Number(prices[k]);
    return Number.isFinite(v) ? v.toFixed(2) : "0.00";
  };

  const globalCss = `
    :root{
      --navy:#0b2a4a;
      --red:#c1121f;
      --bg:#f6f8fc;
      --card:#ffffff;
      --border:#e4e8f2;
      --muted:#5b6472;
      --shadow: 0 10px 26px rgba(11,42,74,.06);
    }
    body{ margin:0; background: var(--bg); color:#111; }
    input, select, textarea{
      border:1px solid var(--border);
      border-radius: 12px;
      padding: 10px 10px;
      font-family: "Segoe UI", Arial, sans-serif;
      outline: none;
      background: #fff;
      color:#111;
    }
    input:focus, select:focus, textarea:focus{
      border-color: rgba(11,42,74,.35);
      box-shadow: 0 0 0 3px rgba(11,42,74,.10);
    }
    hr{ border:none; border-top:1px solid var(--border); margin: 14px 0; }
    .btn{
      width:100%;
      padding: 12px 12px;
      border-radius: 14px;
      border:1px solid var(--border);
      background:#fff;
      cursor:pointer;
      font-weight: 900;
      color: var(--navy);
    }
    .btn:hover{ border-color: rgba(11,42,74,.25); }
    .checkboxRow{
      display:flex;
      align-items:center;
      gap: 10px;
      margin-bottom: 8px;
      color:#111;
      font-weight: 700;
      font-size: 13px;
      user-select:none;
    }
    .checkboxRow input{ width: 16px; height: 16px; }
  `;

  const uiCard = {
    border: "1px solid var(--border)",
    borderRadius: 18,
    padding: 16,
    background: "var(--card)",
    boxShadow: "var(--shadow)",
  };

  const smallLabel = { fontWeight: 800, fontSize: 12, color: "var(--muted)" };

  const activeHelp = HELP_CONTENT[activeHelpKey] || null;

  return (
    <div
      style={{
        padding: 24,
        fontFamily: "Segoe UI, Arial",
        paddingRight: 24,
        transition: "padding-right 160ms ease",
      }}
    >
      <style>{globalCss}</style>

      {/* Header with logo + title */}
      <div
        style={{
          ...uiCard,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          padding: 14,
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {logoOk ? (
            <img
              src={LOGO_URL}
              alt="Shower Estimator Logo"
              style={{ width: 88, height: "auto" }}
              onError={() => setLogoOk(false)}
            />
          ) : (
            <div style={{ width: 88, fontWeight: 950, color: "var(--navy)", fontSize: 12, lineHeight: 1.1 }}>
              LOGO
            </div>
          )}
          <div>
            <div style={{ fontSize: 22, fontWeight: 950, color: "var(--navy)", letterSpacing: 0.2 }}>
              Shower Estimator
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 700 }}>
              Red • White • Blue worksheet and printout theme
            </div>
          </div>
        </div>

        <div
          style={{
            height: 8,
            width: 220,
            borderRadius: 999,
            border: "1px solid var(--border)",
            background: "linear-gradient(90deg, var(--navy), #ffffff 45%, var(--red))",
          }}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "540px 1fr", gap: 16 }}>
        {/* LEFT: Inputs */}
        <div style={uiCard}>
          
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 12,
              fontWeight: 900,
              color: "#0b5ed7",
              cursor: "pointer",
              userSelect: "none",
            }}
          >
            <input
              type="checkbox"
              checked={helpOpen}
              onChange={(e) => setHelpOpen(e.target.checked)}
              style={{ width: 16, height: 16 }}
            />
            <span>Help System On</span>
          </label>

          <h3 style={{ marginTop: 0, color: "var(--navy)" }}>Customer / Proposal</h3>


          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <div style={smallLabel}>Customer Name</div>
              <input {...helpProps("customer_name")} value={customer.name} onChange={(e) => setCustomer((c) => ({ ...c, name: e.target.value }))} style={{ width: "100%" }} />
            </div>
            <div>
              <div style={smallLabel}>Customer Phone</div>
              <input {...helpProps("customer_phone")} value={customer.phone} onChange={(e) => setCustomer((c) => ({ ...c, phone: e.target.value }))} style={{ width: "100%" }} />
            </div>
            <div>
              <div style={smallLabel}>Customer Email</div>
              <input {...helpProps("customer_email")} value={customer.email} onChange={(e) => setCustomer((c) => ({ ...c, email: e.target.value }))} style={{ width: "100%" }} />
            </div>
            <div>
              <div style={smallLabel}>Job Address</div>
              <input {...helpProps("job_address")} value={customer.address} onChange={(e) => setCustomer((c) => ({ ...c, address: e.target.value }))} style={{ width: "100%" }} />
            </div>
          </div>

          <div style={{ marginTop: 10 }}>
            <div style={smallLabel}>Scope / Notes</div>
            <textarea {...helpProps("notes")} value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} style={{ width: "100%" }} />
          </div>

          <hr />

          <h3 style={{ marginTop: 0, color: "var(--navy)" }}>Estimate View</h3>
          <div style={{ marginBottom: 10 }}>
            <div style={smallLabel}>Detail Level (display only)</div>
            <select {...helpProps("detailLevel")}
              value={detailLevel}
              onChange={(e) => setDetailLevel(e.target.value)}
              style={{ width: "100%" }}
            >
              <option value="summary">Summary (customer-facing)</option>
              <option value="detailed">Detailed (contractor takeoff)</option>
            </select>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6, fontWeight: 700 }}>
              Total is always based on the full takeoff, so Summary and Detailed match.
            </div>
          </div>

          <hr />

          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
            <h3 style={{ marginTop: 0, color: "var(--navy)" }}>Dimensions</h3>
            <div style={{ fontSize: 12, fontWeight: 900, color: "var(--red)" }}>FOR HELP HIT F2</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <div style={smallLabel}>Wall 1 (in)</div>
              <input {...helpProps("wall1")}
                type="number"
                ref={firstMeasureRef}
                value={wall1}
                onChange={(e) => setWall1(Number(e.target.value))}
                style={{ width: "100%" }}
              />
            </div>
            <div>
              <div style={smallLabel}>Back wall (in)</div>
              <input {...helpProps("wall2")}
                type="number"
                value={wall2}
                onChange={(e) => setWall2(Number(e.target.value))}
                style={{ width: "100%" }}
              />
            </div>
            <div>
              <div style={smallLabel}>Wall 3 (in)</div>
              <input {...helpProps("wall3")}
                type="number"
                value={wall3}
                onChange={(e) => setWall3(Number(e.target.value))}
                style={{ width: "100%" }}
              />
            </div>
            <div>
              <div style={smallLabel}>Height (in)</div>
              <input {...helpProps("height")}
                type="number"
                value={height}
                onChange={(e) => setHeight(Number(e.target.value))}
                style={{ width: "100%" }}
              />
            </div>
          </div>

          <hr />

          <h3 style={{ marginTop: 0, color: "var(--navy)" }}>System</h3>

          <div style={{ marginBottom: 10 }}>
            <div style={smallLabel}>Material</div>
            <select {...helpProps("material")}
              value={material}
              onChange={(e) => setMaterial(e.target.value)}
              style={{ width: "100%" }}
            >
              <option value="pvc">PVC Panels</option>
              <option value="acrylic">Acrylic Panels</option>
              <option value="solid">Solid Surface</option>
            </select>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6, fontWeight: 700 }}>
              Waste: {(rule.waste * 100).toFixed(0)}% • Adhesive: {rule.adhesiveSqftPerTube} sf/tube • Silicone: {rule.siliconeLfPerTube} lf/tube
            </div>
          </div>

          <div style={{ marginBottom: 10 }}>
            <div style={smallLabel}>Panel Size</div>
            <select {...helpProps("panelSize")}
              value={panelKey}
              onChange={(e) => setPanelKey(e.target.value)}
              style={{ width: "100%" }}
            >
              {PANEL_SIZES.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 10 }}>
            <div style={smallLabel}>Trim Stick Length</div>
            <select {...helpProps("trimLen")}
              value={trimLenKey}
              onChange={(e) => setTrimLenKey(e.target.value)}
              style={{ width: "100%" }}
            >
              {TRIM_LENGTHS.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <hr />

          <h3 style={{ marginTop: 0, color: "var(--navy)" }}>Backer / Substrate</h3>
          <div style={{ marginBottom: 10 }}>
            <div style={smallLabel}>Backer Type</div>
            <select {...helpProps("backerType")} value={backerType} onChange={(e) => setBackerType(e.target.value)} style={{ width: "100%" }}>
              {BACKER_TYPES.map((b) => (
                <option key={b.key} value={b.key}>
                  {b.label}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 10 }}>
            <div style={smallLabel}>Sheet Size</div>
            <select {...helpProps("sheetSize")} value={sheetKey} onChange={(e) => setSheetKey(e.target.value)} style={{ width: "100%" }} disabled={!backer.requiresSheets}>
              {SHEET_SIZES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <label className="checkboxRow" {...helpProps("includeBacker")}>
            <input {...helpProps("includeBacker")} type="checkbox" checked={includeBacker} onChange={(e) => setIncludeBacker(e.target.checked)} />
            <span>Include backer sheets</span>
          </label>
          <label className="checkboxRow" {...helpProps("includeBackerScrews")}>
            <input {...helpProps("includeBackerScrews")} type="checkbox" checked={includeBackerScrews} onChange={(e) => setIncludeBackerScrews(e.target.checked)} />
            <span>Include backer screws</span>
          </label>
          <label className="checkboxRow" {...helpProps("includeBackerTape")}>
            <input {...helpProps("includeBackerTape")} type="checkbox" checked={includeBackerTape} onChange={(e) => setIncludeBackerTape(e.target.checked)} />
            <span>Include mesh tape</span>
          </label>

          <hr />

          <h3 style={{ marginTop: 0, color: "var(--navy)" }}>Waterproofing</h3>
          <label className="checkboxRow" {...helpProps("includeWaterproofing")}>
            <input {...helpProps("includeWaterproofing")} type="checkbox" checked={includeWaterproofing} onChange={(e) => setIncludeWaterproofing(e.target.checked)} />
            <span>Include waterproofing</span>
          </label>

          <div style={{ marginBottom: 10 }}>
            <div style={smallLabel}>System</div>
            <select {...helpProps("wpSystem")} value={wpSystem} onChange={(e) => setWpSystem(e.target.value)} style={{ width: "100%" }} disabled={!includeWaterproofing}>
              {WATERPROOF_SYSTEMS.map((w) => (
                <option key={w.key} value={w.key}>
                  {w.label}
                </option>
              ))}
            </select>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6, fontWeight: 700 }}>
              WP enabled: {model.wpEnabled ? "Yes" : "No"} (requires sheet-based backer)
            </div>
          </div>

          {includeWaterproofing && wpSystem === "liquid" && (
            <div style={{ border: "1px solid var(--border)", borderRadius: 14, padding: 10, marginBottom: 10, background: "#fff" }}>
              <div style={{ fontWeight: 950, marginBottom: 6, color: "var(--navy)" }}>Liquid Settings</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <div style={smallLabel}>Coats</div>
                  <input {...helpProps("liqCoats")} type="number" min="1" value={liqCoats} onChange={(e) => setLiqCoats(Number(e.target.value))} style={{ width: "100%" }} />
                </div>
                <div>
                  <div style={smallLabel}>Coverage (sf/gal/coat)</div>
                  <input {...helpProps("liqCoveragePerGallon")} type="number" min="1" value={liqCoveragePerGallon} onChange={(e) => setLiqCoveragePerGallon(Number(e.target.value))} style={{ width: "100%" }} />
                </div>
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6, fontWeight: 700 }}>
                Est: {model.liquidGallons} gallon(s), fabric rolls: {model.liquidFabricRolls}
              </div>
            </div>
          )}

          {includeWaterproofing && wpSystem === "sheet" && (
            <div style={{ border: "1px solid var(--border)", borderRadius: 14, padding: 10, marginBottom: 10, background: "#fff" }}>
              <div style={{ fontWeight: 950, marginBottom: 6, color: "var(--navy)" }}>Sheet Settings</div>
              <label className="checkboxRow" {...helpProps("includeBanding")}>
            <input {...helpProps("includeBanding")} type="checkbox" checked={includeBanding} onChange={(e) => setIncludeBanding(e.target.checked)} />
                <span>Include banding</span>
              </label>
              <div>
                <div style={smallLabel}>Banding Waste (fraction)</div>
                <input {...helpProps("bandingWaste")} type="number" step="0.01" min="0" value={bandingWaste} onChange={(e) => setBandingWaste(Number(e.target.value))} style={{ width: "100%" }} />
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6, fontWeight: 700 }}>
                Est: membrane {model.sheetMembraneSqft} sf, banding {model.bandLf} lf, corners {model.preformedCorners}
              </div>
            </div>
          )}

          <hr />

          <h3 style={{ marginTop: 0, color: "var(--navy)" }}>Install Options</h3>
          <label className="checkboxRow" {...helpProps("includeAdhesive")}>
            <input {...helpProps("includeAdhesive")} type="checkbox" checked={includeAdhesive} onChange={(e) => setIncludeAdhesive(e.target.checked)} />
            <span>Include adhesive</span>
          </label>
          <label className="checkboxRow" {...helpProps("includeSilicone")}>
            <input {...helpProps("includeSilicone")} type="checkbox" checked={includeSilicone} onChange={(e) => setIncludeSilicone(e.target.checked)} />
            <span>Include silicone</span>
          </label>
          <label className="checkboxRow" {...helpProps("seamsUseTrim")}>
            <input {...helpProps("seamsUseTrim")} type="checkbox" checked={seamsUseTrim} onChange={(e) => setSeamsUseTrim(e.target.checked)} />
            <span>Seams use H-joint trim (not sealant)</span>
          </label>

          <label className="checkboxRow" {...helpProps("includeInsideCornerTrim")}>
            <input {...helpProps("includeInsideCornerTrim")} type="checkbox" checked={includeInsideCornerTrim} onChange={(e) => setIncludeInsideCornerTrim(e.target.checked)} />
            <span>Inside corner trim</span>
          </label>
          <label className="checkboxRow" {...helpProps("includeEdgeTrim")}>
            <input {...helpProps("includeEdgeTrim")} type="checkbox" checked={includeEdgeTrim} onChange={(e) => setIncludeEdgeTrim(e.target.checked)} />
            <span>Edge/J-trim</span>
          </label>
          <label className="checkboxRow" {...helpProps("includeTopTrim")}>
            <input {...helpProps("includeTopTrim")} type="checkbox" checked={includeTopTrim} onChange={(e) => setIncludeTopTrim(e.target.checked)} />
            <span>Top trim</span>
          </label>
          <label className="checkboxRow" {...helpProps("includeBottomTrim")}>
            <input {...helpProps("includeBottomTrim")} type="checkbox" checked={includeBottomTrim} onChange={(e) => setIncludeBottomTrim(e.target.checked)} />
            <span>Bottom trim</span>
          </label>

          <hr />

          <h3 style={{ marginTop: 0, color: "var(--navy)" }}>Pricing</h3>
          <label className="checkboxRow" {...helpProps("includePanelPrice")}>
            <input {...helpProps("includePanelPrice")} type="checkbox" checked={includePanelPrice} onChange={(e) => setIncludePanelPrice(e.target.checked)} />
            <span>Include panel price in total</span>
          </label>

          <button {...helpProps("print")} onClick={printEstimate} className="btn">
            Print / Save as PDF
          </button>
        </div>

        {/* RIGHT: Estimate */}
        <div style={uiCard}>
          <h3 style={{ marginTop: 0, color: "var(--navy)" }}>Estimate</h3>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            <div style={{ border: "1px solid var(--border)", borderRadius: 14, padding: 12, background: "#fff" }}>
              <div style={{ color: "var(--muted)", fontSize: 12, fontWeight: 900 }}>Area (w/ waste)</div>
              <div style={{ fontSize: 18, fontWeight: 950, color: "var(--navy)" }}>{model.totalSqft.toFixed(2)} sf</div>
            </div>
            <div style={{ border: "1px solid var(--border)", borderRadius: 14, padding: 12, background: "#fff" }}>
              <div style={{ color: "var(--muted)", fontSize: 12, fontWeight: 900 }}>Panels</div>
              <div style={{ fontSize: 18, fontWeight: 950, color: "var(--navy)" }}>{model.panelsNeeded}</div>
            </div>
            <div style={{ border: "1px solid var(--border)", borderRadius: 14, padding: 12, background: "#fff" }}>
              <div style={{ color: "var(--muted)", fontSize: 12, fontWeight: 900 }}>View</div>
              <div style={{ fontSize: 14, fontWeight: 950, color: "var(--navy)" }}>{detailLevel === "summary" ? "Summary" : "Detailed"}</div>
              <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 700 }}>Total always uses full takeoff</div>
            </div>
            <div style={{ border: "1px solid var(--border)", borderRadius: 14, padding: 12, background: "#fff" }}>
              <div style={{ color: "var(--muted)", fontSize: 12, fontWeight: 900 }}>Total</div>
              <div style={{ fontSize: 18, fontWeight: 950, color: "var(--navy)" }}>{money(masterTotal)}</div>
            </div>
          </div>

          <div style={{ marginTop: 14, border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden", background: "#fff" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#eef3ff" }}>
                  <th style={{ textAlign: "left", padding: 10, borderBottom: "2px solid rgba(11,42,74,.10)", color: "var(--navy)" }}>Item</th>
                  <th style={{ textAlign: "left", padding: 10, borderBottom: "2px solid rgba(11,42,74,.10)", color: "var(--navy)" }}>Unit</th>
                  <th style={{ textAlign: "right", padding: 10, borderBottom: "2px solid rgba(11,42,74,.10)", color: "var(--navy)" }}>Qty</th>
                  <th style={{ textAlign: "right", padding: 10, borderBottom: "2px solid rgba(11,42,74,.10)", color: "var(--navy)" }}>Unit $</th>
                  <th style={{ textAlign: "right", padding: 10, borderBottom: "2px solid rgba(11,42,74,.10)", color: "var(--navy)" }}>Ext $</th>
                </tr>
              </thead>
              <tbody>
                {displayItems.map((it) => (
                  <tr key={it.key}>
                    <td style={{ padding: 10, borderBottom: "1px solid var(--border)" }}>{it.name}</td>
                    <td style={{ padding: 10, borderBottom: "1px solid var(--border)" }}>{it.unit}</td>
                    <td style={{ padding: 10, borderBottom: "1px solid var(--border)", textAlign: "right" }}>{it.qty}</td>

                    <td style={{ padding: 10, borderBottom: "1px solid var(--border)", textAlign: "right" }}>
                      {it.ext == null ? (
                        <span style={{ color: "var(--muted)", fontWeight: 800 }}>Qty only</span>
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
                          style={{ width: 98, textAlign: "right" }}
                        />
                      )}
                    </td>

                    <td style={{ padding: 10, borderBottom: "1px solid var(--border)", textAlign: "right" }}>
                      {it.ext == null ? <span style={{ color: "var(--muted)", fontWeight: 800 }}>—</span> : money(it.ext)}
                    </td>
                  </tr>
                ))}

                <tr>
                  <td colSpan={4} style={{ padding: 10, textAlign: "right", fontWeight: 950, color: "var(--navy)" }}>
                    Total
                  </td>
                  <td style={{ padding: 10, textAlign: "right", fontWeight: 950, color: "var(--navy)" }}>
                    {money(masterTotal)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {detailLevel === "summary" && masterItems.length !== displayItems.length && (
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 10, fontWeight: 700 }}>
              Summary hides internal takeoff lines (adhesives, trims, fasteners, accessories), but the total includes them.
              Switch to Detailed to see every component.
            </div>
          )}
        </div>
      </div>

      {/* Context help panel (toggle with F2). Space is reserved via paddingRight so it never covers form data. */}
      {/* Inline help bubble (shows above hovered/touched control; hides on tap/click/focus) */}
      {helpOpen && activeHelp && helpAnchor && (
        <div
          style={{
            position: "fixed",
            left: Math.max(12, Math.min(window.innerWidth - 372, helpAnchor.left)),
            top: Math.max(12, helpAnchor.top - 10),
            transform: "translateY(-100%)",
            width: 360,
            zIndex: 80,
            background: "#ffffff",
            border: "1px solid var(--border)",
            borderRadius: 14,
            boxShadow: "0 12px 30px rgba(0,0,0,0.12)",
            padding: 12,
            pointerEvents: "none",
          }}
        >
          <div style={{ fontWeight: 950, color: "var(--red)", marginBottom: 6 }}>{activeHelp.title}</div>
          <div style={{ fontSize: 13, lineHeight: 1.35, color: "#111" }}>{activeHelp.body}</div>
        </div>
      )}

    </div>
  );
}
