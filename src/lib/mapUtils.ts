// Shared utilities for map components

// Dynamically import Leaflet only on client side
let L: any = null
if (typeof window !== 'undefined') {
  L = require('leaflet')
  
  // Fix for default markers in Next.js
  delete (L.Icon.Default.prototype as any)._getIconUrl
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  })
}

// Distinctive property pin (teardrop with home glyph) – theme-aware to match upload/details
// Uses CSS var --accent-500 when available; falls back to provided color
export const createPropertyPinIcon = (color: string = '#7c3aed') => {
  if (!L) return null
  return L.divIcon({
    className: 'custom-property-pin',
    html: `
      <div aria-label="Property location" style="
        position: relative;
        width: 34px;
        height: 34px;
        transform: rotate(-45deg);
        border-radius: 50% 50% 50% 0;
        background: var(--accent-500, ${color});
        border: 3px solid #ffffff;
        box-shadow: 0 0 0 3px rgba(17,24,39,0.45), 0 6px 14px rgba(0,0,0,0.25);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        pointer-events: auto;
      ">
        <span class="animate-ping" style="
          position: absolute;
          left: 50%;
          top: 50%;
          width: 38px;
          height: 38px;
          transform: translate(-50%, -50%) rotate(45deg);
          border-radius: 9999px;
          background: var(--accent-500, ${color});
          opacity: 0.28;
          pointer-events: none;
          z-index: 0;
        "></span>
        <div style="
          transform: rotate(45deg);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          position: relative;
          z-index: 1;
        ">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M3 10l9-7 9 7v10a2 2 0 0 1-2 2h-5v-6h-4v6H5a2 2 0 0 1-2-2V10z"></path>
          </svg>
        </div>
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 30],
  })
}

