"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface ContactResult {
  company: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  website: string;
}

const PAGE_SIZE = 10;

function escapeCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

export function ResultsTable({ results }: { results: ContactResult[] }) {
  const [page, setPage] = useState(1);

  const foundCount = results.filter((r) => r.firstName).length;
  const totalPages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageResults = results.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  function downloadCsv() {
    const header = ["company", "firstName", "lastName", "jobTitle", "website"]
      .map(escapeCell)
      .join(",");
    const rows = results.map((r) =>
      [r.company, r.firstName, r.lastName, r.jobTitle, r.website]
        .map(escapeCell)
        .join(","),
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = "contact-finder-results.csv";
    link.click();
    URL.revokeObjectURL(href);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Results</CardTitle>
        <CardDescription>
          {foundCount} of {results.length} companies matched a contact.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-end">
          <Button variant="default" onClick={downloadCsv} disabled={!results.length}>
            Download CSV
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead>First</TableHead>
              <TableHead>Last</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Website</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageResults.map((row) => (
              <TableRow key={row.company}>
                <TableCell className="font-medium text-zinc-900">{row.company}</TableCell>
                <TableCell>{row.firstName || "—"}</TableCell>
                <TableCell>{row.lastName || "—"}</TableCell>
                <TableCell className="text-sm">{row.jobTitle || "—"}</TableCell>
                <TableCell className="text-sm text-zinc-500">{row.website || "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-4">
            <Button
              variant="outline"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <p className="text-sm text-zinc-500">
              Page {currentPage} of {totalPages}
            </p>
            <Button
              variant="outline"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
