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

const DEFAULT_PRICES = {
  PANEL: 0.0,
  ADH_TUBE: 6.98,
  SIL_TUBE: 9.48,
  TRIM_H: 22.0,
  TRIM_IN: 22.0,
  TRIM_EDGE: 22.0,
  TRIM_TOP: 22.0,
  TRIM_BOT: 22.0,
};

const cbRow = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  marginBottom: 6,
  color: "#111",
  fontSize: 14,
  fontWeight: 600,
  lineHeight: 1.2,
};

/* =========================
   CHECKBOX COMPONENT (CSS-PROOF)
========================= */

function CheckRow({ checked, onChange, children }) {
  return (
    <div style={cbRow}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <div style={{ color: "#111", fontSize: 14, fontWeight: 600 }}>{children}</div>
    </div>
  );
}

/* =========================
   HELPERS
========================= */

const money = (n) =>
  Number(n || 0).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
  });

const sqft = (w, h) => (w * h) / 144;
const ceil = (a, b) => Math.ceil(a / b);

function priceToFixed(prices, key) {
  const v = Number(prices[key] ?? 0);
  return Number.isFinite(v) ? v.toFixed(2) : "0.00";
}

/* =========================
   APP
========================= */

export default function App() {
  // Dimensions
  const [wall1, setWall1] = useState(32);
  const [wall2, setWall2] = useState(60);
  const [wall3, setWall3] = useState(32);
  const [height, setHeight] = useState(96);

  const [material, setMaterial] = useState("pvc");
  const [panelKey, setPanelKey] = useState("96x48");

  const [includeAdhesive, setIncludeAdhesive] = useState(true);
  const [includeSilicone, setIncludeSilicone] = useState(true);
  const [includePanelPrice, setIncludePanelPrice] = useState(false);

  const [detailLevel, setDetailLevel] = useState("summary");
  const [prices, setPrices] = useState(DEFAULT_PRICES);

  const rule = MATERIAL_RULES[material];
  const panel = PANEL_SIZES.find((p) => p.key === panelKey) || PANEL_SIZES[0];

  const model = useMemo(() => {
    const area = sqft(wall1, height) + sqft(wall2, height) + sqft(wall3, height);

    const totalSqft = area * (1 + rule.waste);
    const panelSqft = sqft(panel.w, panel.h);
    const panelsNeeded = ceil(totalSqft, panelSqft);

    const adhesiveTubes = includeAdhesive ? ceil(totalSqft, rule.adhesiveSqftPerTube) : 0;

    // Placeholder for now (you said we'd calculate this later)
    const siliconeTubes = includeSilicone ? 2 : 0;

    return { totalSqft, panelsNeeded, adhesiveTubes, siliconeTubes };
  }, [wall1, wall2, wall3, height, rule, panel, includeAdhesive, includeSilicone]);

  const lineItems = useMemo(() => {
    const items = [];

    if (includePanelPrice)
      items.push({
        key: "PANEL",
        name: "PVC Wall Panels",
        unit: "panel",
        qty: model.panelsNeeded,
        unitPrice: Number(prices.PANEL ?? 0),
        ext: Number(prices.PANEL ?? 0) * model.panelsNeeded,
        priceKey: "PANEL",
      });
    else
      items.push({
        key: "PANEL_QTY",
        name: "PVC Wall Panels",
        unit: "panel",
        qty: model.panelsNeeded,
        unitPrice: null,
        ext: null,
      });

    if (includeAdhesive)
      items.push({
        key: "ADH",
        name: "Panel adhesive",
        unit: "tube",
        qty: model.adhesiveTubes,
        unitPrice: Number(prices.ADH_TUBE ?? 0),
        ext: Number(prices.ADH_TUBE ?? 0) * model.adhesiveTubes,
        priceKey: "ADH_TUBE",
      });

    if (includeSilicone)
      items.push({
        key: "SIL",
        name: "100% silicone",
        unit: "tube",
        qty: model.siliconeTubes,
        unitPrice: Number(prices.SIL_TUBE ?? 0),
        ext: Number(prices.SIL_TUBE ?? 0) * model.siliconeTubes,
        priceKey: "SIL_TUBE",
      });

    return items;
  }, [model, prices, includePanelPrice, includeAdhesive, includeSilicone]);

  const total = useMemo(
    () => lineItems.filter((i) => i.ext != null).reduce((s, i) => s + i.ext, 0),
    [lineItems]
  );

  return (
    <div style={{ padding: 24, fontFamily: "Segoe UI, Arial" }}>
      <h1>Shower Estimator</h1>

      <div style={{ marginBottom: 12 }}>
        <label style={{ fontWeight: 700 }}>
          View:&nbsp;
          <select value={detailLevel} onChange={(e) => setDetailLevel(e.target.value)}>
            <option value="summary">Summary</option>
            <option value="detailed">Detailed</option>
          </select>
        </label>
      </div>

      <h3>Install Options</h3>

      {/* ✅ FIXED: checkbox text is now inside a div, not label text, so it can't be hidden by label CSS */}
      <CheckRow checked={includeAdhesive} onChange={setIncludeAdhesive}>
        Include panel adhesive
      </CheckRow>

      <CheckRow checked={includeSilicone} onChange={setIncludeSilicone}>
        Include silicone sealant
      </CheckRow>

      <CheckRow checked={includePanelPrice} onChange={setIncludePanelPrice}>
        Include panel price in total
      </CheckRow>

      <table width="100%" cellPadding={8} style={{ borderCollapse: "collapse", marginTop: 20 }}>
        <thead>
          <tr style={{ background: "#f4f4f4" }}>
            <th align="left">Item</th>
            <th align="left">Unit</th>
            <th align="right">Qty</th>
            <th align="right">Unit $</th>
            <th align="right">Ext $</th>
          </tr>
        </thead>
        <tbody>
          {lineItems.map((it) => (
            <tr key={it.key}>
              <td>{it.name}</td>
              <td>{it.unit}</td>
              <td align="right">{it.qty}</td>
              <td align="right">
                {it.unitPrice == null ? (
                  <span style={{ color: "#777" }}>Qty only</span>
                ) : (
                  <input
                    type="number"
                    step="0.01"
                    value={priceToFixed(prices, it.priceKey)}
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
              <td align="right">{it.ext == null ? "—" : money(it.ext)}</td>
            </tr>
          ))}
          <tr>
            <td colSpan={4} align="right" style={{ fontWeight: 900 }}>
              Total
            </td>
            <td align="right" style={{ fontWeight: 900 }}>
              {money(total)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}







