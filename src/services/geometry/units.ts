// units.ts — heuristics to infer DXF drawing units and scale to meters
export type Units = 'm' | 'mm' | 'cm' | 'in' | 'ft';

export interface UnitInference {
  units: Units;
  scaleToMeters: number; // multiply by this
  confidence: number; // 0..1
  reasons: string[];
}

export function inferUnits({
  headerUnits, // from DXF $INSUNITS or similar
  bbox, // { width: number, height: number } in DXF coords
  knownDoorWidths = [0.8, 0.9, 1.0, 1.2], // meters
}: {
  headerUnits?: number;
  bbox: { width: number; height: number };
  knownDoorWidths?: number[];
}): UnitInference {
  const reasons: string[] = [];
  // 1) Map INSUNITS if present
  const map: Record<number, Units> = { 0: 'unitless', 1: 'in', 2: 'ft', 4: 'mm', 5: 'cm', 6: 'm' } as any;
  if (headerUnits && map[headerUnits as number]) {
    const u = map[headerUnits as number] as Units;
    reasons.push(`DXF header $INSUNITS suggests ${u}`);
    return { units: u, scaleToMeters: toMeters(u), confidence: 0.9, reasons };
  }
  // 2) Size heuristics: assume residential floor ~ 30–500 m²
  void knownDoorWidths; // reserved for future heuristics
  const candidates: Units[] = ['m','cm','mm','ft','in'];
  let best: {u: Units, score: number} = {u: 'm', score: -1};
  for (const u of candidates) {
    const sx = toMeters(u);
    const a = (bbox.width * sx) * (bbox.height * sx);
    const score = within(a, 30, 500) ? 1 : within(a, 10, 2000) ? 0.6 : 0.1;
    if (score > best.score) best = {u, score};
  }
  reasons.push(`BBox heuristic picked ${best.u}`);
  return { units: best.u, scaleToMeters: toMeters(best.u), confidence: best.score, reasons };
}

function toMeters(u: Units): number {
  switch (u) {
    case 'm': return 1;
    case 'cm': return 0.01;
    case 'mm': return 0.001;
    case 'in': return 0.0254;
    case 'ft': return 0.3048;
  }
}

function within(x: number, lo: number, hi: number) { return x >= lo && x <= hi; }
