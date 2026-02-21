'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { RefreshCw, Trash2, Users, Search } from 'lucide-react';
import { Interviewer } from '@/lib/db/schema';

export default function InterviewersPage() {
  const [interviewers, setInterviewers] = useState<Interviewer[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadInterviewers();
  }, []);

  async function loadInterviewers() {
    const res = await fetch('/api/admin/interviewers');
    const data = await res.json();
    setInterviewers(data.interviewers ?? []);
    setLoading(false);
  }

  async function syncFromWorkspace() {
    setSyncing(true);
    try {
      const res = await fetch('/api/admin/sync-users', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Synced ${data.synced} users from Google Workspace`);
      await loadInterviewers();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }

  async function removeInterviewer(id: string, name: string) {
    if (!confirm(`Remove ${name}?`)) return;
    const res = await fetch(`/api/admin/interviewers?id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      setInterviewers((prev) => prev.filter((iv) => iv.id !== id));
      toast.success(`${name} removed`);
    }
  }

  const filtered = interviewers.filter(
    (iv) =>
      iv.name.toLowerCase().includes(search.toLowerCase()) ||
      iv.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="h-6 w-6" /> Interviewers
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            All active users from your Google Workspace — calendar availability is read automatically.
          </p>
        </div>
        <Button onClick={syncFromWorkspace} disabled={syncing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? `Syncing...` : 'Sync from Google Workspace'}
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search by name or email..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : interviewers.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No interviewers yet</p>
          <p className="text-sm mt-1">Click &quot;Sync from Google Workspace&quot; to import your entire org automatically.</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-gray-400 mb-3">{filtered.length} of {interviewers.length} users</p>
          <div className="space-y-2">
            {filtered.map((iv) => (
              <div key={iv.id} className="flex items-center justify-between p-4 bg-white border rounded-lg">
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
        </>
      )}
    </div>
  );
}
