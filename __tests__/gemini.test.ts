import { describe, it, expect, vi, beforeEach } from "vitest";
import { geminiSearchContact } from "@/lib/gemini";

function geminiResponse(json: object): Response {
  return new Response(
    JSON.stringify({
      candidates: [
        {
          content: {
            parts: [{ text: JSON.stringify(json) }],
          },
        },
      ],
    }),
    { status: 200 },
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("geminiSearchContact", () => {
  it("returns a valid contact result", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      geminiResponse({
        firstName: "John",
        lastName: "Smith",
        jobTitle: "CEO",
        website: "acme.com",
        confidence: 0.95,
      }),
    );

    const result = await geminiSearchContact("fake-key", "Acme Corp", "CEO");
    expect(result).toEqual({
      firstName: "John",
      lastName: "Smith",
      jobTitle: "CEO",
      website: "acme.com",
      confidence: 0.95,
    });
  });

  it("returns null when confidence is below 0.7", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      geminiResponse({
        firstName: "John",
        lastName: "Smith",
        jobTitle: "CEO",
        website: "acme.com",
        confidence: 0.5,
      }),
    );

    const result = await geminiSearchContact("fake-key", "Acme Corp", "CEO");
    expect(result).toBeNull();
  });

  it("rejects when company name is used as person name", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      geminiResponse({
        firstName: "Acme",
        lastName: "Corp",
        jobTitle: "CEO",
        website: "acme.com",
        confidence: 0.95,
      }),
    );

    const result = await geminiSearchContact("fake-key", "Acme", "CEO");
    expect(result).toBeNull();
  });

  it("rejects custom title when keyword is not in jobTitle", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      geminiResponse({
        firstName: "Jane",
        lastName: "Doe",
        jobTitle: "VP of Engineering",
        website: "acme.com",
        confidence: 0.9,
      }),
    );

    // "Marketing" is a custom title (not in PRESET_TITLES), and "VP of Engineering" doesn't contain "marketing"
    const result = await geminiSearchContact("fake-key", "Acme Corp", "Marketing");
    expect(result).toBeNull();
  });

  it("retries on 429 rate limit then succeeds", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    fetchSpy
      .mockResolvedValueOnce(new Response("", { status: 429 }))
      .mockResolvedValueOnce(
        geminiResponse({
          firstName: "Jane",
          lastName: "Doe",
          jobTitle: "CTO",
          website: "globex.com",
          confidence: 0.9,
        }),
      );

    // Speed up the retry delay
    vi.spyOn(globalThis, "setTimeout").mockImplementation(((fn: () => void) => {
      fn();
      return 0;
    }) as typeof setTimeout);

    const result = await geminiSearchContact("fake-key", "Globex Inc", "CTO");
    expect(result).not.toBeNull();
    expect(result!.firstName).toBe("Jane");
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("returns null for malformed JSON from Gemini", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ text: "This is not JSON at all {{{broken" }],
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const result = await geminiSearchContact("fake-key", "Acme Corp", "CEO");
    expect(result).toBeNull();
  });

  it("rejects names containing numbers", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      geminiResponse({
        firstName: "John123",
        lastName: "Smith",
        jobTitle: "CEO",
        website: "acme.com",
        confidence: 0.95,
      }),
    );

    const result = await geminiSearchContact("fake-key", "Acme Corp", "CEO");
    expect(result).toBeNull();
  });

  it("rejects empty first or last name", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      geminiResponse({
        firstName: "",
        lastName: "Smith",
        jobTitle: "CEO",
        website: "acme.com",
        confidence: 0.95,
      }),
    );

    const result = await geminiSearchContact("fake-key", "Acme Corp", "CEO");
    expect(result).toBeNull();
  });

  it("returns null when fetch throws a network error", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Network error"));

    const result = await geminiSearchContact("fake-key", "Acme Corp", "CEO");
    expect(result).toBeNull();
  });

  it("returns null when Gemini returns non-200 status", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("Internal Server Error", { status: 500 }),
    );

    const result = await geminiSearchContact("fake-key", "Acme Corp", "CEO");
    expect(result).toBeNull();
  });

  it("accepts custom title when keyword is present in jobTitle", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      geminiResponse({
        firstName: "Jane",
        lastName: "Doe",
        jobTitle: "VP of Marketing",
        website: "acme.com",
        confidence: 0.9,
      }),
    );

    const result = await geminiSearchContact("fake-key", "Acme Corp", "Marketing");
    expect(result).not.toBeNull();
    expect(result!.jobTitle).toBe("VP of Marketing");
  });
});
