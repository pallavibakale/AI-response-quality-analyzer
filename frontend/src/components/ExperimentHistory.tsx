"use client";
import React from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchExperiments } from "../lib/api";
import type { ExperimentSummary } from "../lib/types";

type Props = {
  activeId: string | null;
  setActiveId: (id: string | null) => void;
  q: string;
  setQ: (v: string) => void;
};

export default function ExperimentHistory({
  activeId,
  setActiveId,
  q,
  setQ,
}: Props) {
  const { data } = useQuery({
    queryKey: ["experiments"],
    queryFn: fetchExperiments,
  });

  const list: ExperimentSummary[] = data?.experiments || [];
  const filtered = list.filter(
    (e) =>
      (e.title || "").toLowerCase().includes(q.toLowerCase()) ||
      (e.prompt || "").toLowerCase().includes(q.toLowerCase())
  );

  return (
    <aside className="side card">
      <label htmlFor="searchExp">Experiment History</label>
      <input
        className="input"
        placeholder="Search experiment…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        id="searchExp"
        style={{ padding: "10px" }}
        name="search-exp"
      />
      <div className="side-list">
        {filtered.length ? (
          filtered.map((e) => (
            <button
              key={e.id}
              className="side-item"
              onClick={() => setActiveId(e.id)}
            >
              <div className="si-title">{e.title || "untitled"}</div>
              <div className="si-sub">{e.prompt?.slice(0, 80)}</div>
            </button>
          ))
        ) : (
          <div className="muted center">No experiments yet</div>
        )}
      </div>
    </aside>
  );
}
