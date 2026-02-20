'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Settings, Plus, Trash2, X } from 'lucide-react';
import { Interviewer } from '@/lib/db/schema';
import { AshbyJob, AshbyInterviewStage } from '@/types';

interface StageConfigRow {
  id: string;
  ashbyStageId: string;
  stageName: string;
  durationMinutes: number;
  breakMinutes: number;
  interviewerCount: number;
  format: string;
}

export default function StagesPage() {
  const [jobs, setJobs] = useState<AshbyJob[]>([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [stages, setStages] = useState<AshbyInterviewStage[]>([]);
  const [interviewers, setInterviewers] = useState<Interviewer[]>([]);
  const [configs, setConfigs] = useState<StageConfigRow[]>([]);
  const [loading, setLoading] = useState(false);

  // Form state
  const [selectedStage, setSelectedStage] = useState<AshbyInterviewStage | null>(null);
  const [duration, setDuration] = useState('60');
  const [breakTime, setBreakTime] = useState('15');
  const [count, setCount] = useState('3');
  const [poolIds, setPoolIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/ashby/jobs')
      .then((r) => r.json())
      .then((d) => setJobs(d.jobs ?? []));
    fetch('/api/admin/interviewers')
      .then((r) => r.json())
      .then((d) => setInterviewers(d.interviewers ?? []));
    fetch('/api/admin/stage-configs')
      .then((r) => r.json())
      .then((d) => setConfigs(d.configs ?? []));
  }, []);

  useEffect(() => {
    if (!selectedJobId) return;
    setLoading(true);
    fetch(`/api/ashby/interview-stages?jobId=${selectedJobId}`)
      .then((r) => r.json())
      .then((d) => setStages(d.stages ?? []))
      .finally(() => setLoading(false));
  }, [selectedJobId]);

  async function saveConfig() {
    if (!selectedStage) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/stage-configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ashbyStageId: selectedStage.id,
          stageName: selectedStage.title,
          jobId: selectedJobId,
          durationMinutes: parseInt(duration),
          breakMinutes: parseInt(breakTime),
          interviewerCount: parseInt(count),
          format: 'sequential',
          interviewerIds: poolIds,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setConfigs((prev) => {
        const existing = prev.findIndex((c) => c.ashbyStageId === selectedStage.id);
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = data.config;
          return updated;
        }
        return [...prev, data.config];
      });
      toast.success('Stage configuration saved!');
      setSelectedStage(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  const configuredStageIds = new Set(configs.map((c) => c.ashbyStageId));

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Settings className="h-6 w-6" /> Stage Setup
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Configure interview panels for each stage — who&apos;s in the pool, duration, and breaks.
        </p>
      </div>

      {/* Job selector */}
      <Card className="mb-6">
        <CardContent className="pt-4">
          <Label className="text-xs mb-1">Select a Job</Label>
          <Select value={selectedJobId} onValueChange={setSelectedJobId}>
            <SelectTrigger className="w-72">
              <SelectValue placeholder="Choose a job..." />
            </SelectTrigger>
            <SelectContent>
              {jobs.map((j) => (
                <SelectItem key={j.id} value={j.id}>{j.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Stage list */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : stages.length > 0 ? (
        <div className="space-y-2 mb-8">
          {stages.map((stage) => (
            <div
              key={stage.id}
              className="flex items-center justify-between p-4 bg-white border rounded-lg"
            >
              <div>
                <p className="font-medium text-gray-900">{stage.title}</p>
                <p className="text-xs text-gray-400 uppercase tracking-wide">{stage.type}</p>
              </div>
              <div className="flex items-center gap-3">
                {configuredStageIds.has(stage.id) ? (
                  <Badge className="bg-green-50 text-green-700">Configured</Badge>
                ) : (
                  <Badge variant="outline" className="text-gray-400">Not configured</Badge>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSelectedStage(stage);
                    const existing = configs.find((c) => c.ashbyStageId === stage.id);
                    if (existing) {
                      setDuration(String(existing.durationMinutes));
                      setBreakTime(String(existing.breakMinutes));
                      setCount(String(existing.interviewerCount));
                    }
                  }}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Configure
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* Config form */}
      {selectedStage && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Configure: {selectedStage.title}</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setSelectedStage(null)}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="text-xs mb-1">Duration (min)</Label>
                <Input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs mb-1">Break (min)</Label>
                <Input type="number" value={breakTime} onChange={(e) => setBreakTime(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs mb-1"># of Interviewers</Label>
                <Input type="number" value={count} onChange={(e) => setCount(e.target.value)} />
              </div>
            </div>

            <div>
              <Label className="text-xs mb-2">Interviewer Pool</Label>
              <div className="flex flex-wrap gap-2 mb-3">
                {poolIds.map((id) => {
                  const iv = interviewers.find((i) => i.id === id);
                  return iv ? (
                    <Badge key={id} className="flex items-center gap-1 pr-1">
                      {iv.name}
                      <button onClick={() => setPoolIds((prev) => prev.filter((p) => p !== id))}>
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ) : null;
                })}
              </div>
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border rounded p-2">
                {interviewers
                  .filter((iv) => !poolIds.includes(iv.id))
                  .map((iv) => (
                    <button
                      key={iv.id}
                      onClick={() => setPoolIds((prev) => [...prev, iv.id])}
                      className="text-left px-3 py-2 text-sm rounded hover:bg-blue-50 hover:text-blue-700 transition-colors"
                    >
                      <p className="font-medium">{iv.name}</p>
                      <p className="text-xs text-gray-400">{iv.email}</p>
                    </button>
                  ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setSelectedStage(null)}>
                Cancel
              </Button>
              <Button onClick={saveConfig} disabled={saving || poolIds.length === 0}>
                {saving ? 'Saving...' : 'Save Configuration'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
