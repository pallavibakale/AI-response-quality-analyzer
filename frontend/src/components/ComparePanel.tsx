// components/ComparePanel.tsx
'use client';
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchExperiment } from '../lib/api';
import type { ExperimentData, ResponseRecord } from '../lib/types';

export default function ComparePanel({ experimentId }: { experimentId: string }) {
  const { data } = useQuery<ExperimentData>({
    queryKey: ['experiment', experimentId],
    queryFn: () => fetchExperiment(experimentId),
    enabled: !!experimentId,
  });
  if (!data) return null;
  const rows: ResponseRecord[] = data.responses ?? [];

  const groups: Record<string, ResponseRecord[]> = {};
  rows.forEach((r) => {
    const key = JSON.stringify(r.param_set);
    if (!groups[key]) groups[key] = [];
    groups[key].push(r);
  });

  return (
    <div className="card" style={{ marginTop: 12 }}>
      <h3 style={{ margin: 0 }}>Compare by parameter set</h3>
      <div className="compare-grid" style={{ marginTop: 10 }}>
        {Object.entries(groups).map(([k, arr]) => (
          <div key={k} className="card">
            <div className="small-muted">{k}</div>
            <div style={{ height: 8 }} />
            {arr.map((r) => (
              <div key={r.response_id} className="card" style={{ background: 'var(--accent)' }}>
                <div style={{ whiteSpace: 'pre-wrap' }}>{r.text}</div>
                <div className="small-muted">Aggregate: {r.metrics.aggregate_score}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
