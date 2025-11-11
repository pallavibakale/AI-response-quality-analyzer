"use client";
import React, { useState } from "react";
import "./globals.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import PromptForm from "../components/PromptForm";
import ThemeToggle from "../components/ThemeToggle";
import ResponsesTable from "../components/ResponsesTable";
import ExperimentHistory from "../components/ExperimentHistory";

const qc = new QueryClient();

function Header() {
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
      </div>
    </header>
  );
}

function Shell() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [q, setQ] = useState("");

  return (
    <div className="wrap">
      <Header />
      <main className="grid">
        <ExperimentHistory
          activeId={activeId}
          setActiveId={setActiveId}
          q={q}
          setQ={setQ}
        />

        <section className="main card">
          <div
            className="muted small"
            style={{ marginBottom: 12, fontSize: 13, lineHeight: "1.2" }}
          >
            Enter a prompt, set temperature and top-p ranges; the app generates
            and compares outputs across combinations — export your best results
            for deeper analysis.
          </div>

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
