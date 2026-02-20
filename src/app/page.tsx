import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Calendar, ArrowRight } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Interview Scheduler</h1>
        <p className="text-gray-500 mt-2">
          Automatically schedule interviews by matching candidate availability with your team&apos;s calendar.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link href="/candidates">
          <Card className="hover:shadow-md transition-shadow cursor-pointer border-2 hover:border-blue-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600" />
                Schedule an Interview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">
                Browse candidates from Ashby and generate optimized interview schedules in seconds.
              </p>
              <span className="text-blue-600 text-sm font-medium flex items-center gap-1">
                View candidates <ArrowRight className="h-4 w-4" />
              </span>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/interviewers">
          <Card className="hover:shadow-md transition-shadow cursor-pointer border-2 hover:border-green-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-green-600" />
                Manage Interviewers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">
                Add interviewers by email. Their Google Calendar availability is pulled automatically via your Workspace admin access.
              </p>
              <span className="text-green-600 text-sm font-medium flex items-center gap-1">
                Manage team <ArrowRight className="h-4 w-4" />
              </span>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
