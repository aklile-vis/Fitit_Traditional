// stitch.ts — make continuous walls from DXF linework
export interface Pt { x:number; y:number }
export interface Seg { a:Pt; b:Pt; layer:string }

export function stitchSegments(segments: Seg[], _eps = 0.01): Seg[] {
  // Merge collinear adjacent segments with small gaps/overlaps
  // This is a simple placeholder; replace with robust graph-based merging.
  const out: Seg[] = [];
  for (const s of segments) {
    out.push(s);
  }
  return out;
}
