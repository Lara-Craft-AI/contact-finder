import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/gemini", () => ({
  geminiSearchContact: vi.fn(),
}));

import { POST } from "@/app/api/find-contacts/route";
import { geminiSearchContact } from "@/lib/gemini";

const mockedGemini = vi.mocked(geminiSearchContact);

async function readSSEStream(response: Response): Promise<string[]> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  const events: string[] = [];
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop()!;
    for (const part of parts) {
      if (part.trim()) events.push(part);
    }
  }
  if (buffer.trim()) events.push(buffer);
  return events;
}

function parseSSEEvent(raw: string): { event: string; data: unknown } {
  const eventMatch = raw.match(/^event:(\w+)/);
  const dataMatch = raw.match(/data:(.*)/);
  return {
    event: eventMatch?.[1] ?? "",
    data: dataMatch ? JSON.parse(dataMatch[1]) : null,
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/find-contacts", () => {
  it("returns 400 when geminiApiKey is missing", async () => {
    const req = new Request("http://localhost/api/find-contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companies: ["Acme"], title: "CEO" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 400 when companies array is empty", async () => {
    const req = new Request("http://localhost/api/find-contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companies: [], title: "CEO", geminiApiKey: "key" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns SSE stream with found contact", async () => {
    mockedGemini.mockResolvedValueOnce({
      firstName: "John",
      lastName: "Smith",
      jobTitle: "CEO",
      website: "acme.com",
      confidence: 0.95,
    });

    const req = new Request("http://localhost/api/find-contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companies: ["Acme Corp"],
        title: "CEO",
        geminiApiKey: "fake-key",
      }),
    });

    const res = await POST(req);
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");

    const events = await readSSEStream(res);
    const parsed = events.map(parseSSEEvent);

    const startEvent = parsed.find((e) => e.event === "start");
    expect(startEvent).toBeDefined();
    expect((startEvent!.data as { total: number }).total).toBe(1);

    const resultEvent = parsed.find((e) => e.event === "result");
    expect(resultEvent).toBeDefined();
    const resultData = resultEvent!.data as Record<string, string>;
    expect(resultData.firstName).toBe("John");
    expect(resultData.lastName).toBe("Smith");
    expect(resultData.company).toBe("Acme Corp");
    expect(resultData.source).toBe("gemini");

    const completeEvent = parsed.find((e) => e.event === "complete");
    expect(completeEvent).toBeDefined();
  });

  it("returns empty fields for not-found company", async () => {
    mockedGemini.mockResolvedValueOnce(null);

    const req = new Request("http://localhost/api/find-contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companies: ["Unknown Corp"],
        title: "CEO",
        geminiApiKey: "fake-key",
      }),
    });

    const res = await POST(req);
    const events = await readSSEStream(res);
    const parsed = events.map(parseSSEEvent);

    const resultEvent = parsed.find((e) => e.event === "result");
    expect(resultEvent).toBeDefined();
    const resultData = resultEvent!.data as Record<string, string>;
    expect(resultData.firstName).toBe("");
    expect(resultData.lastName).toBe("");
    expect(resultData.source).toBe("not found");
  });

  it("handles multiple companies in stream", async () => {
    mockedGemini
      .mockResolvedValueOnce({
        firstName: "John",
        lastName: "Smith",
        jobTitle: "CEO",
        website: "acme.com",
        confidence: 0.95,
      })
      .mockResolvedValueOnce(null);

    const req = new Request("http://localhost/api/find-contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companies: ["Acme Corp", "Unknown Corp"],
        title: "CEO",
        geminiApiKey: "fake-key",
      }),
    });

    const res = await POST(req);
    const events = await readSSEStream(res);
    const parsed = events.map(parseSSEEvent);

    const results = parsed.filter((e) => e.event === "result");
    expect(results).toHaveLength(2);
  });
});
