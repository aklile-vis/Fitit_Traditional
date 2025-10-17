import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { extname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';

import { requireAgent } from '@/lib/serverAuth';

export async function POST(request: NextRequest) {
  try {
    const auth = requireAgent(request);
    if (!auth.ok) return auth.response;
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const allowedExtensions = new Set([
      '.ifc',
      '.glb',
      '.gltf',
      '.usd',
      '.usdz',
      '.obj',
      '.fbx',
      '.skp',
      '.blend',
    ]);
    const extension = extname(file.name || '').toLowerCase();
    if (!allowedExtensions.has(extension)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${extension || 'unknown'}` },
        { status: 400 }
      );
    }

    // Create uploads directory
    const uploadsDir = join(process.cwd(), 'file_storage', 'uploads');
    await mkdir(uploadsDir, { recursive: true });

    // Generate unique filename
    const fileId = uuidv4();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fileName = `${timestamp}_${fileId}_${file.name}`;
    const filePath = join(uploadsDir, fileName);

    // Save file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    return NextResponse.json({
      success: true,
      filePath: filePath,
      fileName: fileName
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    );
  }
}
