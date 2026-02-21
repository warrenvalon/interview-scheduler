import { NextResponse } from 'next/server';

export async function GET() {
  const API_KEY = process.env.ASHBY_API_KEY!;
  const credentials = Buffer.from(`${API_KEY}:`).toString('base64');

  const [jobsRes, candidatesRes] = await Promise.all([
    fetch('https://api.ashbyhq.com/job.list', {
      method: 'POST',
      headers: { 'Authorization': `Basic ${credentials}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'Open' }),
    }),
    fetch('https://api.ashbyhq.com/candidate.list', {
      method: 'POST',
      headers: { 'Authorization': `Basic ${credentials}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ limit: 1 }),
    }),
  ]);

  const jobs = await jobsRes.json();
  const candidates = await candidatesRes.json();

  // Return raw responses so we can see exact field names
  return NextResponse.json({
    jobs_raw: jobs,
    candidates_raw: candidates,
    first_candidate_keys: candidates?.results?.[0] ? Object.keys(candidates.results[0]) : [],
    first_job_keys: jobs?.results?.[0] ? Object.keys(jobs.results[0]) : [],
  });
}
