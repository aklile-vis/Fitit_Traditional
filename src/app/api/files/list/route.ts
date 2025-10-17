import { NextRequest, NextResponse } from 'next/server'
import { readdir, stat } from 'fs/promises'
import { resolve, join, sep } from 'path'

import { requireAgent } from '@/lib/serverAuth'

const roots = {
  status: resolve(process.cwd(), 'file_storage', 'status'),
  processed: resolve(process.cwd(), 'file_storage', 'processed'),
  models: resolve(process.cwd(), 'file_storage', 'models'),
  uploads: resolve(process.cwd(), 'file_storage', 'uploads'),
  output: resolve(process.cwd(), 'output'),
}

function withinAllowed(targetPath: string) {
  const tp = resolve(targetPath)
  return Object.values(roots).some(root => tp === root || tp.startsWith(root + sep))
}

export async function GET(request: NextRequest) {
  try {
    const auth = requireAgent(request, { allowQueryToken: true })
    if (!auth.ok) return auth.response

    const { searchParams } = new URL(request.url)
    const rootKey = searchParams.get('root') as keyof typeof roots | null
    const dirParam = searchParams.get('dir')

    let dir: string
    if (dirParam) {
      dir = resolve(dirParam)
      if (!withinAllowed(dir)) {
        return NextResponse.json({ error: 'Path not allowed' }, { status: 403 })
      }
    } else if (rootKey && roots[rootKey]) {
      dir = roots[rootKey]
    } else {
      // default to models
      dir = roots.models
    }

    const entries = await readdir(dir, { withFileTypes: true })
    const items = await Promise.all(entries.map(async (e) => {
      const p = join(dir, e.name)
      const s = await stat(p)
      return {
        name: e.name,
        path: p,
        isDir: e.isDirectory(),
        size: s.size,
        mtime: s.mtimeMs,
      }
    }))
    return NextResponse.json({ dir, items })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to list' }, { status: 500 })
  }
}
