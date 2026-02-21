'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Users, Search, ArrowRight, AlertCircle } from 'lucide-react';

export default function CandidatesPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/ashby/find-candidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Candidate not found. Check the email and try again.');
        return;
      }

      router.push(`/candidates/${data.candidateId}/schedule`);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Users className="h-6 w-6" /> Schedule Interview
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Enter the candidate&apos;s email address to pull their info from Ashby and schedule their next interview.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSearch} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Candidate Email or Ashby URL
              </label>
              <div className="flex gap-3">
                <Input
                  type="text"
                  placeholder="candidate@email.com or paste Ashby profile URL"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1"
                  autoFocus
                />
                <Button type="submit" disabled={loading || !email.trim()}>
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <Search className="h-4 w-4 animate-pulse" /> Searching...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      Find <ArrowRight className="h-4 w-4" />
                    </span>
                  )}
                </Button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      <p className="text-xs text-gray-400 mt-4 text-center">
        Candidate data is pulled live from Ashby HQ
      </p>
    </div>
  );
}
