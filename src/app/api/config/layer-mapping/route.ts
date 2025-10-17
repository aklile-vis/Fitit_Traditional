import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

const DATA_PATH = join(process.cwd(), 'data', 'layer-mapping.json')
const TEMPLATE_PATH = join(process.cwd(), 'src', 'services', 'config', 'layer-mapping.template.json')

export async function GET() {
  try {
    // Prefer editable data file, fallback to template
    const path = existsSync(DATA_PATH) ? DATA_PATH : TEMPLATE_PATH
    const configContent = readFileSync(path, 'utf8');
    const config = JSON.parse(configContent);
    
    return NextResponse.json(config);
  } catch (error) {
    console.error('Error loading layer mapping config:', error);
    return NextResponse.json(
      { error: 'Failed to load layer mapping configuration' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    // Basic shape check: must be an object with aliases/fallback/tolerances possibly
    if (typeof body !== 'object' || body === null) {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }
    const dir = dirname(DATA_PATH)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    writeFileSync(DATA_PATH, JSON.stringify(body, null, 2), 'utf8')
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error saving layer mapping config:', error)
    return NextResponse.json({ error: error?.message || 'Failed to save config' }, { status: 500 })
  }
}
