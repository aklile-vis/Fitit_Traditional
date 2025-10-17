import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { filePath, outputDir = 'output' } = await request.json();

    if (!filePath) {
      return NextResponse.json({ error: 'No file path provided' }, { status: 400 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Test API working',
      filePath,
      outputDir
    });
  } catch (error) {
    console.error('Test API error:', error);
    return NextResponse.json({ error: 'Test API failed' }, { status: 500 });
  }
}
