"use client";

import { useMemo, useState } from "react";
import { Lock } from "lucide-react";

import { CompanyInput } from "@/components/CompanyInput";
import { TitleSelect } from "@/components/TitleSelect";
import { ProgressStep } from "@/components/ProgressStep";
import { ResultsTable } from "@/components/ResultsTable";
import type { ContactResult } from "@/components/ResultsTable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

type StreamEvent =
  | { type: "start"; total: number }
  | { type: "progress"; current: number; total: number; company: string }
  | { type: "result"; company: string; firstName: string; lastName: string; jobTitle: string; website: string }
  | { type: "complete" }
  | { type: "error"; message: string };

function parseSseChunk(chunk: string) {
  const messages = chunk.split("\n\n");
  const parsed: StreamEvent[] = [];
  for (const message of messages) {
    const lines = message.split("\n").filter(Boolean);
    if (!lines.length) continue;
    const eventLine = lines.find((l) => l.startsWith("event:"));
    const dataLine = lines.find((l) => l.startsWith("data:"));
    if (!eventLine || !dataLine) continue;
    const type = eventLine.replace("event:", "").trim();
    const payload = JSON.parse(dataLine.replace("data:", "").trim()) as Omit<StreamEvent, "type">;
    parsed.push({ type, ...payload } as StreamEvent);
  }
  return parsed;
}

export default function Home() {
  const [companies, setCompanies] = useState<string[]>([]);
  const [title, setTitle] = useState("CEO");
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [results, setResults] = useState<ContactResult[]>([]);
  const [current, setCurrent] = useState(0);
  const [total, setTotal] = useState(0);
  const [activeCompany, setActiveCompany] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState("");

  const stepState = useMemo(
    () => ({
      upload: companies.length > 0,
      config: geminiApiKey.trim().length > 0 && title.length > 0,
      run: isRunning,
      results: results.length > 0,
    }),
    [companies.length, geminiApiKey, title, isRunning, results.length],
  );

  async function runFinder() {
    setIsRunning(true);
    setError("");
    setResults([]);
    setCurrent(0);
    setTotal(companies.length);
    setActiveCompany("");

    try {
      const response = await fetch("/api/find-contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companies,
          title,
          geminiApiKey: geminiApiKey.trim() || undefined,
        }),
      });

      if (!response.ok || !response.body) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Failed to start contact finder.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const boundary = buffer.lastIndexOf("\n\n");
        if (boundary === -1) continue;

        const complete = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);

        for (const event of parseSseChunk(complete)) {
          if (event.type === "start") {
            setTotal(event.total);
          }
          if (event.type === "progress") {
            setCurrent(event.current);
            setTotal(event.total);
            setActiveCompany(event.company);
          }
          if (event.type === "result") {
            setResults((prev) => [
              ...prev,
              {
                company: event.company,
                firstName: event.firstName,
                lastName: event.lastName,
                jobTitle: event.jobTitle,
                website: event.website,
              },
            ]);
          }
          if (event.type === "error") {
            throw new Error(event.message);
          }
        }
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unexpected error.");
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <main className="min-h-screen bg-white px-6 py-12">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
        {/* Hero */}
        <section className="space-y-6">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
              Contact Finder
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-zinc-900">
              Find contacts for any company list — <span className="text-zinc-900">for $0.</span>
            </h1>
            <p className="text-base leading-7 text-zinc-500">
              Paste a list of company names, choose a target title (CEO, CTO, Founder…), and get
              back first name, last name, and website. Powered by Gemini.
            </p>
          </div>
        </section>

        {/* Flow Steps */}
        <Card>
          <CardHeader>
            <CardTitle>Flow</CardTitle>
            <CardDescription>Upload, configure, run, and download in one page.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 text-sm sm:grid-cols-4">
              {[
                { label: "1. Companies", complete: stepState.upload },
                { label: "2. Configure", complete: stepState.config },
                { label: "3. Run", complete: stepState.run },
                { label: "4. Results", complete: stepState.results },
              ].map(({ label, complete }) => (
                <div
                  key={label}
                  className={`rounded-md border px-3 py-2 ${
                    complete
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-200 text-zinc-500"
                  }`}
                >
                  {label}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Step 1: Company Input */}
        <CompanyInput onCompaniesReady={setCompanies} />

        {/* Step 2: Title + API Keys */}
        <TitleSelect value={title} onChange={setTitle} />

        <Card>
          <CardHeader>
            <CardTitle>API keys</CardTitle>
            <CardDescription className="flex items-center gap-1.5">
              <Lock size={13} className="text-zinc-400" />
              Keys are sent over HTTPS, used once per request, and never stored.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-700">
                Gemini API key <span className="text-zinc-400">(required)</span>
              </label>
              <Input
                placeholder="Paste your Gemini API key"
                value={geminiApiKey}
                onChange={(e) => setGeminiApiKey(e.target.value)}
              />
            </div>
            <p className="text-xs text-zinc-400">
              Gemini finds full name + website.
            </p>
            <Separator />
            <div className="flex items-center justify-between gap-4 text-sm text-zinc-600">
              <span>{companies.length} companies ready · {title || "no title"}</span>
              <Button
                disabled={!companies.length || !geminiApiKey.trim() || !title || isRunning}
                onClick={() => void runFinder()}
              >
                {isRunning ? "Running..." : "Find contacts"}
              </Button>
            </div>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
          </CardContent>
        </Card>

        {/* Step 3: Progress */}
        {(isRunning || current > 0) && (
          <ProgressStep current={current} total={total} company={activeCompany} />
        )}

        {/* Step 4: Results */}
        {results.length > 0 && <ResultsTable results={results} />}
      </div>
    </main>
  );
}
