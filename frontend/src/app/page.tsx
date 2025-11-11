"use client";
import React, { useState } from "react";
import "./globals.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import PromptForm from "../components/PromptForm";
import ThemeToggle from "../components/ThemeToggle";
import ResponsesTable from "../components/ResponsesTable";
import ExperimentHistory from "../components/ExperimentHistory";

const qc = new QueryClient();

function Header({ onExport }: { onExport: () => void }) {
  return (
    <header className="hdr">
      <div className="brand">
        <div className="logo">✦</div>
        <div>
          <div className="title">LLM Lab</div>
          <div className="sub">Response Quality Analyzer</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <ThemeToggle />
        <button className="btn ghost" onClick={onExport}>
          Export
        </button>
      </div>
    </header>
  );
}

function Shell() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  // ExperimentHistory handles fetching and filtering; q and setQ are passed down

  const exportActive = () => {
    if (!activeId) return;
    window.open(
      `${
        process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000"
      }/experiments/${activeId}/export/json`,
      "_blank"
    );
    window.open(
      `${
        process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000"
      }/experiments/${activeId}/export/csv`,
      "_blank"
    );
  };

  return (
    <div className="wrap">
      <Header onExport={exportActive} />
      <main className="grid">
        <ExperimentHistory
          activeId={activeId}
          setActiveId={setActiveId}
          q={q}
          setQ={setQ}
        />

        <section className="main card">
          <PromptForm onCreated={setActiveId} />
          {activeId ? (
            <ResponsesTable experimentId={activeId} />
          ) : (
            <div className="center muted" style={{ marginTop: 24 }}>
              Create your first experiment using the form.
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default function Page() {
  return (
    <QueryClientProvider client={qc}>
      <Shell />
    </QueryClientProvider>
  );
}
