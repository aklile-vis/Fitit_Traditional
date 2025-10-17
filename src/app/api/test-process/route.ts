import { NextRequest, NextResponse } from 'next/server'
import { processCadFile } from '@/lib/cadProcessor'

export async function POST(request: NextRequest) {
  try {
    const { filePath } = await request.json()

    if (!filePath) {
      return NextResponse.json(
        { error: 'File path is required' },
        { status: 400 }
      )
    }

    console.log('Test processing file:', filePath)

    // Process the CAD file using our Python backend
    const result = await processCadFile(filePath, 'test-user')

    return NextResponse.json({
      message: 'File processed successfully',
      result
    })
  } catch (error: unknown) {
    console.error('Test process error:', error)
    const details = error instanceof Error ? error.message : undefined
    return NextResponse.json(
      { error: 'Internal server error', details },
      { status: 500 }
    )
  }
}
