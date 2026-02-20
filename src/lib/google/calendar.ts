import { google } from 'googleapis';
import { TimeWindow } from '@/types';

function getServiceAccountClient(impersonateEmail: string) {
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY!;
  const key = JSON.parse(keyJson);

  const auth = new google.auth.GoogleAuth({
    credentials: key,
    scopes: [
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/calendar.events',
    ],
    clientOptions: {
      subject: impersonateEmail,
    },
  });

  return google.calendar({ version: 'v3', auth });
}

export async function getFreeBusy(params: {
  emails: string[];
  timeMin: Date;
  timeMax: Date;
  calendarOwner?: string; // admin email to make the request as
}): Promise<Record<string, TimeWindow[]>> {
  const ownerEmail =
    params.calendarOwner ?? process.env.GOOGLE_ADMIN_EMAIL ?? params.emails[0];
  const calendar = getServiceAccountClient(ownerEmail);

  const res = await calendar.freebusy.query({
    requestBody: {
      timeMin: params.timeMin.toISOString(),
      timeMax: params.timeMax.toISOString(),
      timeZone: 'UTC',
      items: params.emails.map((email) => ({ id: email })),
    },
  });

  const busyMap: Record<string, TimeWindow[]> = {};
  const calendars = res.data.calendars ?? {};

  for (const email of params.emails) {
    const busy = calendars[email]?.busy ?? [];
    busyMap[email] = busy.map((slot) => ({
      start: new Date(slot.start!),
      end: new Date(slot.end!),
    }));
  }

  return busyMap;
}

export async function createCalendarEvent(params: {
  organizerEmail: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  attendeeEmails: string[];
  location?: string;
}): Promise<string> {
  const calendar = getServiceAccountClient(params.organizerEmail);

  const event = await calendar.events.insert({
    calendarId: 'primary',
    sendUpdates: 'all',
    requestBody: {
      summary: params.title,
      description: params.description,
      location: params.location,
      start: {
        dateTime: params.startTime.toISOString(),
        timeZone: 'UTC',
      },
      end: {
        dateTime: params.endTime.toISOString(),
        timeZone: 'UTC',
      },
      attendees: params.attendeeEmails.map((email) => ({ email })),
    },
  });

  return event.data.id!;
}
