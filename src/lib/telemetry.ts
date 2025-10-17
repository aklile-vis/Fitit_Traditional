import { appendFile } from 'fs/promises'
import { resolve } from 'path'

interface TelemetryEvent {
  name: string
  timestamp: string
  payload?: Record<string, unknown>
}

// Placeholder telemetry hook — replace with real analytics sink when available.
export function recordTelemetry(event: TelemetryEvent) {
  if (process.env.NODE_ENV !== 'production') {
    console.warn('[telemetry]', event.name, event)
  }
  const logPath = resolve(process.cwd(), 'file_storage', 'telemetry.log')
  appendFile(logPath, `${JSON.stringify(event)}\n`).catch((err) => {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[telemetry] failed to append log', err)
    }
  })
}

export function recordExportTelemetry(unitId: string, userEmail: string, artifactCount: number) {
  recordTelemetry({
    name: 'export.bundle.downloaded',
    timestamp: new Date().toISOString(),
    payload: { unitId, userEmail, artifactCount },
  })
}
