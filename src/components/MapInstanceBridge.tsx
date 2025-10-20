'use client'

import { useEffect } from 'react'
import { useMap } from 'react-leaflet'

type Props = {
  onReady?: (map: any) => void
  onClick?: (e: any) => void
}

export default function MapInstanceBridge({ onReady, onClick }: Props) {
  const map = useMap()

  useEffect(() => {
    if (onReady) onReady(map)
    if (onClick && map && typeof map.on === 'function') {
      map.on('click', onClick)
      return () => {
        try { map.off('click', onClick) } catch {}
      }
    }
  }, [map, onReady, onClick])

  return null
}

