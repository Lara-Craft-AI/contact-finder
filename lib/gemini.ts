export interface GeminiContactResult {
  firstName: string;
  lastName: string;
  website: string;
  confidence: number;
}

async function fetchGeminiWithRetry(
  url: string,
  options: RequestInit,
  retries: number[] = [2000, 5000],
): Promise<Response> {
  const res = await fetch(url, options);
  if (res.status === 429 && retries.length > 0) {
    const delay = retries[0];
    await new Promise((resolve) => setTimeout(resolve, delay));
    return fetchGeminiWithRetry(url, options, retries.slice(1));
  }
  return res;
}

export async function geminiSearchContact(
  apiKey: string,
  companyName: string,
  title: string,
): Promise<GeminiContactResult | null> {
  const prompt = `Find the current ${title} of ${companyName}.
Return only valid JSON — no markdown, no explanation:
{
  "firstName": "...",
  "lastName": "...",
  "website": "company.com",
  "confidence": 0.0
}`;

  let res: Response;
  try {
    res = await fetchGeminiWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          tools: [{ google_search: {} }],
        }),
      },
    );
  } catch {
    return null;
  }

  if (!res.ok) return null;

  const data = (await res.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    const parsed = JSON.parse(jsonMatch[0]) as {
      firstName?: string;
      lastName?: string;
      website?: string;
      confidence?: number;
    };

    if (!parsed.firstName && !parsed.lastName) return null;

    return {
      firstName: parsed.firstName ?? "",
      lastName: parsed.lastName ?? "",
      website: parsed.website ?? "",
      confidence: parsed.confidence ?? 0,
    };
  } catch {
    return null;
  }
}
