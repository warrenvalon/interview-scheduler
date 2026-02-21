'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AshbyCandidate } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Search, Calendar } from 'lucide-react';

export default function CandidatesPage() {
  const [candidates, setCandidates] = useState<AshbyCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/ashby/candidates')
      .then((r) => r.json())
      .then((data) => {
        setCandidates(data.candidates ?? []);
        setLoading(false);

        // After list is shown, enrich each candidate with job/stage info in the background
        const raw: AshbyCandidate[] = data.candidates ?? [];
        enrichCandidates(raw, setCandidates);
      });
  }, []);

  const filtered = candidates.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase()) ||
      (c.jobTitle ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (c.currentStage ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="h-6 w-6" /> Candidates
          </h1>
          <p className="text-gray-500 text-sm mt-1">Select a candidate to schedule their interview</p>
        </div>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search by name, email, role, or stage..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>No candidates found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((candidate) => (
            <Link key={candidate.id} href={`/candidates/${candidate.id}/schedule`}>
              <Card className="hover:shadow-md hover:border-blue-400 transition-all cursor-pointer">
                <CardContent className="flex items-center justify-between py-4 px-5">
                  <div>
                    <p className="font-semibold text-gray-900">{candidate.name}</p>
                    <p className="text-sm text-gray-500">{candidate.email}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {candidate.jobTitle && (
                      <Badge variant="secondary">{candidate.jobTitle}</Badge>
                    )}
                    {candidate.currentStage && (
                      <Badge variant="outline" className="text-blue-600 border-blue-300">
                        {candidate.currentStage}
                      </Badge>
                    )}
                    <Calendar className="h-4 w-4 text-gray-400" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// Enrich candidates with job/stage in background batches — doesn't block the list
async function enrichCandidates(
  candidates: AshbyCandidate[],
  setCandidates: React.Dispatch<React.SetStateAction<AshbyCandidate[]>>
) {
  const BATCH = 10;
  for (let i = 0; i < candidates.length; i += BATCH) {
    const batch = candidates.slice(i, i + BATCH);
    const enriched = await Promise.all(
      batch.map(async (c) => {
        if (!c.applicationId) return c;
        try {
          const res = await fetch(`/api/ashby/candidates/${c.id}`);
          const data = await res.json();
          return data.candidate ?? c;
        } catch {
          return c;
        }
      })
    );
    // Merge enriched data back into state
    setCandidates((prev) => {
      const map = new Map(prev.map((p) => [p.id, p]));
      for (const e of enriched) map.set(e.id, e);
      return Array.from(map.values());
    });
  }
}
