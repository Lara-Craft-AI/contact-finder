import { describe, it, expect } from "vitest";
import { parseCompanyList, parseCsvColumn, getCsvColumns } from "@/lib/parse-input";

describe("parseCompanyList", () => {
  it("returns empty array for empty string", () => {
    expect(parseCompanyList("")).toEqual([]);
  });

  it("parses a single company", () => {
    expect(parseCompanyList("Acme Corp")).toEqual(["Acme Corp"]);
  });

  it("parses multiple companies on separate lines", () => {
    const input = "Acme Corp\nGlobex Inc\nInitech";
    expect(parseCompanyList(input)).toEqual(["Acme Corp", "Globex Inc", "Initech"]);
  });

  it("trims whitespace from each line", () => {
    const input = "  Acme Corp  \n  Globex Inc  ";
    expect(parseCompanyList(input)).toEqual(["Acme Corp", "Globex Inc"]);
  });

  it("filters out blank lines", () => {
    const input = "Acme Corp\n\n\nGlobex Inc\n\n";
    expect(parseCompanyList(input)).toEqual(["Acme Corp", "Globex Inc"]);
  });

  it("filters out whitespace-only lines", () => {
    const input = "Acme Corp\n   \n  \t  \nGlobex Inc";
    expect(parseCompanyList(input)).toEqual(["Acme Corp", "Globex Inc"]);
  });
});

describe("parseCsvColumn", () => {
  it("extracts values from a valid CSV column", () => {
    const csv = "Company,Revenue\nAcme,100\nGlobex,200";
    expect(parseCsvColumn(csv, "Company")).toEqual(["Acme", "Globex"]);
  });

  it("returns empty array when column does not exist", () => {
    const csv = "Company,Revenue\nAcme,100";
    expect(parseCsvColumn(csv, "NonExistent")).toEqual([]);
  });

  it("returns empty array for empty CSV", () => {
    expect(parseCsvColumn("", "Company")).toEqual([]);
  });

  it("trims whitespace from extracted values", () => {
    const csv = "Company\n  Acme  \n  Globex  ";
    expect(parseCsvColumn(csv, "Company")).toEqual(["Acme", "Globex"]);
  });

  it("filters out empty values in the column", () => {
    const csv = "Company,Revenue\nAcme,100\n,200\nGlobex,300";
    expect(parseCsvColumn(csv, "Company")).toEqual(["Acme", "Globex"]);
  });
});

describe("getCsvColumns", () => {
  it("extracts column headers from CSV", () => {
    const csv = "Company,Revenue,Employees\nAcme,100,50";
    expect(getCsvColumns(csv)).toEqual(["Company", "Revenue", "Employees"]);
  });

  it("returns empty array for empty string", () => {
    expect(getCsvColumns("")).toEqual([]);
  });

  it("returns headers even with no data rows", () => {
    const csv = "Company,Revenue";
    expect(getCsvColumns(csv)).toEqual(["Company", "Revenue"]);
  });
});
