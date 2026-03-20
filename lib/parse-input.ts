import Papa from "papaparse";

export function parseCompanyList(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function parseCsvColumn(
  csvText: string,
  columnName: string,
): string[] {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  return result.data
    .map((row) => (row[columnName] ?? "").trim())
    .filter(Boolean);
}

export function getCsvColumns(csvText: string): string[] {
  const result = Papa.parse(csvText, {
    header: true,
    preview: 1,
  });

  return result.meta.fields ?? [];
}
