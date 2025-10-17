import { NextRequest, NextResponse } from 'next/server';
import { readFile, stat } from 'fs/promises';
import { resolve } from 'path';
import { verifyToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    // Require authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const token = authHeader.substring(7);
    const user = verifyToken(token);
    if (!user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const filePath = searchParams.get('path');
    
    if (!filePath) {
      return NextResponse.json({ error: 'No file path provided' }, { status: 400 });
    }

    // Whitelist directories
    const allowedRoots = [
      resolve(process.cwd(), 'file_storage/status'),
      resolve(process.cwd(), 'file_storage/processed'),
      resolve(process.cwd(), 'file_storage/models'),
      resolve(process.cwd(), 'processed'),
      resolve(process.cwd(), 'models'),
    ];
    const targetPath = resolve(filePath);
    const withinAllowed = allowedRoots.some(root => targetPath.startsWith(root + '/')) || allowedRoots.includes(targetPath);
    if (!withinAllowed) {
      return NextResponse.json({ error: 'Access to this path is not allowed' }, { status: 403 });
    }

    // Ensure file exists and is a file
    await stat(targetPath);
    const content = await readFile(targetPath, 'utf-8');
    
    return new NextResponse(content, {
      headers: {
        'Content-Type': 'text/plain',
      },
    });

  } catch (error) {
    console.error('File read error:', error);
    return NextResponse.json(
      { error: 'Failed to read file' },
      { status: 500 }
    );
  }
}
