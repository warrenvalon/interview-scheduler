'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { UserPlus, Trash2, Users } from 'lucide-react';
import { Interviewer } from '@/lib/db/schema';

export default function InterviewersPage() {
  const [interviewers, setInterviewers] = useState<Interviewer[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    loadInterviewers();
  }, []);

  async function loadInterviewers() {
    const res = await fetch('/api/admin/interviewers');
    const data = await res.json();
    setInterviewers(data.interviewers ?? []);
    setLoading(false);
  }

  async function addInterviewer() {
    if (!email || !name) return;
    setAdding(true);
    try {
      const res = await fetch('/api/admin/interviewers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setInterviewers((prev) => [...prev, data.interviewer]);
      setEmail('');
      setName('');
      toast.success(`${name} added successfully`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to add interviewer');
    } finally {
      setAdding(false);
    }
  }

  async function removeInterviewer(id: string, name: string) {
    if (!confirm(`Remove ${name} from the system?`)) return;
    const res = await fetch(`/api/admin/interviewers?id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      setInterviewers((prev) => prev.filter((iv) => iv.id !== id));
      toast.success(`${name} removed`);
    }
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Users className="h-6 w-6" /> Interviewers
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Add team members by email. Their Google Calendar availability is read automatically via Google Workspace admin access — no sign-in required.
        </p>
      </div>

      {/* Add form */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-base">Add Interviewer</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <div className="flex-1">
              <Label htmlFor="name" className="text-xs mb-1">Name</Label>
              <Input
                id="name"
                placeholder="Jane Smith"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <Label htmlFor="email" className="text-xs mb-1">Work Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="jane@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addInterviewer()}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={addInterviewer} disabled={adding || !email || !name}>
                <UserPlus className="h-4 w-4 mr-2" />
                {adding ? 'Adding...' : 'Add'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : interviewers.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Users className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p>No interviewers yet. Add your first one above.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {interviewers.map((iv) => (
            <div
              key={iv.id}
              className="flex items-center justify-between p-4 bg-white border rounded-lg"
            >
              <div>
                <p className="font-medium text-gray-900">{iv.name}</p>
                <p className="text-sm text-gray-500">{iv.email}</p>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="text-green-700 bg-green-50">
                  Calendar connected
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeInterviewer(iv.id, iv.name)}
                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
