"use client";

import { Upload } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCsvColumns, parseCsvColumn, parseCompanyList } from "@/lib/parse-input";

export function CompanyInput({
  onCompaniesReady,
}: {
  onCompaniesReady: (companies: string[]) => void;
}) {
  const [text, setText] = useState("");
  const [csvText, setCsvText] = useState("");
  const [csvColumns, setCsvColumns] = useState<string[]>([]);
  const [selectedColumn, setSelectedColumn] = useState("");
  const [mode, setMode] = useState<"paste" | "csv">("paste");
  const fileRef = useRef<HTMLInputElement>(null);

  function handleTextSubmit() {
    const companies = parseCompanyList(text);
    if (companies.length) onCompaniesReady(companies);
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const content = reader.result as string;
      setCsvText(content);
      const cols = getCsvColumns(content);
      setCsvColumns(cols);
      if (cols.length) setSelectedColumn(cols[0]);
      setMode("csv");
    };
    reader.readAsText(file);
  }

  function handleCsvSubmit() {
    if (!selectedColumn || !csvText) return;
    const companies = parseCsvColumn(csvText, selectedColumn);
    if (companies.length) onCompaniesReady(companies);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Company list</CardTitle>
        <CardDescription>Paste company names or upload a CSV file.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button
            variant={mode === "paste" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("paste")}
          >
            Paste text
          </Button>
          <Button
            variant={mode === "csv" ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setMode("csv");
              if (!csvText) fileRef.current?.click();
            }}
          >
            <Upload size={14} className="mr-1.5" />
            Upload CSV
          </Button>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept=".csv,.txt"
          className="hidden"
          onChange={handleFileUpload}
        />

        {mode === "paste" && (
          <>
            <textarea
              className="flex min-h-[160px] w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 focus-visible:ring-offset-2"
              placeholder={"Acme Corp\nWidget Inc\nStartup Labs\n..."}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <Button onClick={handleTextSubmit} disabled={!text.trim()}>
              Use {parseCompanyList(text).length} companies
            </Button>
          </>
        )}

        {mode === "csv" && csvColumns.length > 0 && (
          <>
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-700">
                Select the column with company names
              </label>
              <select
                className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 focus-visible:ring-offset-2"
                value={selectedColumn}
                onChange={(e) => setSelectedColumn(e.target.value)}
              >
                {csvColumns.map((col) => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))}
              </select>
            </div>
            <Button onClick={handleCsvSubmit} disabled={!selectedColumn}>
              Use companies from &ldquo;{selectedColumn}&rdquo;
            </Button>
          </>
        )}

        {mode === "csv" && csvColumns.length === 0 && !csvText && (
          <p className="text-sm text-zinc-500">
            Upload a CSV file to get started.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
