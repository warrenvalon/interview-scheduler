import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { db } from '@/lib/db';
import { interviewers } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';

function getAdminClient() {
  const key = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY!);
  const auth = new google.auth.GoogleAuth({
    credentials: key,
    scopes: ['https://www.googleapis.com/auth/admin.directory.user.readonly'],
    clientOptions: {
      subject: process.env.GOOGLE_ADMIN_EMAIL!,
    },
  });
  return google.admin({ version: 'directory_v1', auth });
}

export async function POST() {
  try {
    const admin = getAdminClient();
    const domain = process.env.GOOGLE_WORKSPACE_DOMAIN!;

    // Fetch all active users in the org
    const allUsers: Array<{ email: string; name: string }> = [];
    let pageToken: string | undefined;

    do {
      const res = await admin.users.list({
        domain,
        maxResults: 500,
        orderBy: 'givenName',
        pageToken,
        projection: 'basic',
        query: 'isSuspended=false',
      });

      const users = res.data.users ?? [];
      for (const user of users) {
        const email = user.primaryEmail;
        const name = user.name?.fullName;
        if (email && name) {
          allUsers.push({ email, name });
        }
      }

      pageToken = res.data.nextPageToken ?? undefined;
    } while (pageToken);

    if (allUsers.length === 0) {
      return NextResponse.json({ error: 'No users found in domain' }, { status: 404 });
    }

    // Upsert all users — insert new ones, skip existing
    await db
      .insert(interviewers)
      .values(allUsers.map((u) => ({ email: u.email, name: u.name, isActive: true })))
      .onConflictDoUpdate({
        target: interviewers.email,
        set: { name: sql`excluded.name`, isActive: true },
      });

    return NextResponse.json({ synced: allUsers.length });
  } catch (err) {
    console.error('Sync error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Sync failed' },
      { status: 500 }
    );
  }
}
