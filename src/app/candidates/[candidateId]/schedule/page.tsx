'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { AshbyCandidate, AshbyInterviewStage, ScheduleProposal, ScheduleBlock } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Calendar, Clock, RefreshCw, Check, User } from 'lucide-react';

export default function SchedulePage() {
  const { candidateId } = useParams<{ candidateId: string }>();
  const [candidate, setCandidate] = useState<AshbyCandidate | null>(null);
  const [stages, setStages] = useState<AshbyInterviewStage[]>([]);
  const [selectedStageId, setSelectedStageId] = useState('');
  const [proposals, setProposals] = useState<ScheduleProposal[]>([]);
  const [selectedProposalIndex, setSelectedProposalIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    fetch(`/api/ashby/candidates/${candidateId}`)
      .then((r) => r.json())
      .then((data) => {
        const c = data.candidate as AshbyCandidate;
        if (c) {
          setCandidate(c);
          if (c.jobId) {
            fetch(`/api/ashby/interview-stages?jobId=${c.jobId}`)
              .then((r) => r.json())
              .then((d) => setStages(d.stages ?? []));
          }
        }
      });
  }, [candidateId]);

  async function generateProposals() {
    if (!selectedStageId || !candidate) return;
    setLoading(true);
    setProposals([]);
    setSelectedProposalIndex(0);
    setConfirmed(false);

    try {
      const res = await fetch('/api/schedule/propose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateId,
          applicationId: candidate.applicationId,
          ashbyStageId: selectedStageId,
          lookAheadDays: 14,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setProposals(data.proposals ?? []);
      if (!data.proposals?.length) {
        toast.error('No available slots found in the next 14 days.');
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate proposals');
    } finally {
      setLoading(false);
    }
  }

  async function confirmSchedule() {
    if (!proposals[selectedProposalIndex] || !candidate) return;
    setConfirming(true);
    try {
      const res = await fetch('/api/calendar/create-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposal: proposals[selectedProposalIndex],
          candidateName: candidate.name,
          candidateEmail: candidate.email,
          createdBy: 'admin',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setConfirmed(true);
      toast.success('Calendar invites sent to all interviewers and candidate!');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create events');
    } finally {
      setConfirming(false);
    }
  }

  const proposal = proposals[selectedProposalIndex];

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Schedule Interview</h1>
        {candidate && (
          <p className="text-gray-500 mt-1">
            {candidate.name} · {candidate.email}
            {candidate.jobTitle && <span className="ml-2 text-blue-600">{candidate.jobTitle}</span>}
          </p>
        )}
      </div>

      {/* Stage selection */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">1. Select Interview Stage</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-3">
          <Select value={selectedStageId} onValueChange={setSelectedStageId}>
            <SelectTrigger className="w-72">
              <SelectValue placeholder="Choose a stage..." />
            </SelectTrigger>
            <SelectContent>
              {stages.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={generateProposals}
            disabled={!selectedStageId || loading}
          >
            {loading ? (
              <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Finding times...</>
            ) : (
              <><Calendar className="h-4 w-4 mr-2" /> Find Best Times</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-40 w-full rounded-lg" />
          ))}
        </div>
      )}

      {/* Proposals */}
      {!loading && proposals.length > 0 && (
        <>
          <div className="mb-4">
            <h2 className="font-semibold text-gray-700 mb-2">2. Choose a Schedule</h2>
            <div className="flex gap-2">
              {proposals.map((_, i) => (
                <button
                  key={i}
                  onClick={() => { setSelectedProposalIndex(i); setConfirmed(false); }}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    selectedProposalIndex === i
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Option {i + 1}
                </button>
              ))}
            </div>
          </div>

          {proposal && (
            <Card className="mb-6">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-blue-600" />
                  {format(new Date(proposal.startTime), 'EEEE, MMMM d, yyyy')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {proposal.blocks.map((block: ScheduleBlock, i: number) => (
                    <div key={i}>
                      {block.type === 'break' ? (
                        <div className="flex items-center gap-3 py-1 px-3 bg-gray-50 rounded text-sm text-gray-400 italic">
                          <Clock className="h-3.5 w-3.5" />
                          {block.durationMinutes}-min break
                          <span className="ml-auto text-xs">
                            {format(new Date(block.startTime), 'h:mm a')} – {format(new Date(block.endTime), 'h:mm a')}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                          <div className="h-8 w-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                            {block.interviewerName?.charAt(0)}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-gray-900 flex items-center gap-2">
                              <User className="h-3.5 w-3.5 text-gray-400" />
                              {block.interviewerName}
                            </p>
                            <p className="text-xs text-gray-500">{block.interviewerEmail}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-gray-700">
                              {format(new Date(block.startTime), 'h:mm a')}
                            </p>
                            <p className="text-xs text-gray-400">
                              {block.durationMinutes} min
                            </p>
                          </div>
                          {/* Alternate interviewers */}
                          {proposal.alternateInterviewers[i] && proposal.alternateInterviewers[i].length > 0 && (
                            <div className="ml-2">
                              <p className="text-xs text-gray-400 mb-1">Alternates:</p>
                              <div className="flex gap-1 flex-wrap">
                                {proposal.alternateInterviewers[i].slice(0, 2).map((alt) => (
                                  <Badge key={alt.id} variant="outline" className="text-xs">
                                    {alt.name}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <Separator className="my-4" />

                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500">
                    Total: {format(new Date(proposal.startTime), 'h:mm a')} – {format(new Date(proposal.endTime), 'h:mm a')}
                  </p>
                  {confirmed ? (
                    <div className="flex items-center gap-2 text-green-600 font-medium">
                      <Check className="h-4 w-4" /> Invites sent!
                    </div>
                  ) : (
                    <Button onClick={confirmSchedule} disabled={confirming} className="bg-green-600 hover:bg-green-700">
                      {confirming ? (
                        <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Sending invites...</>
                      ) : (
                        <><Check className="h-4 w-4 mr-2" /> Confirm & Send Invites</>
                      )}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
