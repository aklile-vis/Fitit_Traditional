import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { headerUnits, bbox } = await request.json();
    
    // Import the units inference function
    const { inferUnits } = await import('../../../../services/geometry/units');
    
    // Test units inference
    const result = inferUnits({
      headerUnits,
      bbox
    });
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Units inference test error:', error);
    return NextResponse.json(
      { error: 'Failed to test units inference' },
      { status: 500 }
    );
  }
}
