import { NextResponse } from 'next/server';
import { listJobs } from '@/lib/ashby/client';

export async function GET() {
  try {
    const jobs = await listJobs();
    // Filter out closed jobs — keep Open, Draft, and any other active statuses
    const activeJobs = jobs.filter((j) => j.status !== 'Closed');
    return NextResponse.json({ jobs: activeJobs });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 });
  }
}
