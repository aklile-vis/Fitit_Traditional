import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const db = getDatabase();
    const { searchParams } = new URL(request.url);
    
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const activeOnly = searchParams.get('active') === 'true';
    
    const jobs = activeOnly 
      ? db.getActiveProcessingJobs()
      : db.getAllProcessingJobs(limit, offset);
    
    return NextResponse.json({ jobs });
  } catch (error) {
    console.error('Error fetching jobs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch jobs' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = getDatabase();
    const data = await request.json();
    
    const job = db.createProcessingJob({
      id: data.id,
      fileName: data.fileName,
      originalPath: data.originalPath,
      status: data.status || 'pending',
      progress: data.progress || 0,
      message: data.message || '',
      error: data.error
    });
    
    return NextResponse.json(job);
  } catch (error) {
    console.error('Error creating job:', error);
    return NextResponse.json(
      { error: 'Failed to create job' },
      { status: 500 }
    );
  }
}
