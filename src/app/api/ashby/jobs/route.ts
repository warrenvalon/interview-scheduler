import { NextResponse } from 'next/server';
import { listJobs } from '@/lib/ashby/client';

export async function GET() {
  try {
    const jobs = await listJobs();
    // Only show open jobs in the UI
    const openJobs = jobs.filter((j) => j.status === 'Open');
    return NextResponse.json({ jobs: openJobs });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 });
  }
}
