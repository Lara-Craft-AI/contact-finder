export interface GeminiContactResult {
  firstName: string;
  lastName: string;
  jobTitle: string;
  website: string;
  confidence: number;
}

function normalizeNamePart(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isLikelyAcronym(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length > 3 && trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed);
}

function isInvalidContactResult(
  companyName: string,
  result: Pick<GeminiContactResult, "firstName" | "lastName" | "confidence">,
): boolean {
  const firstName = result.firstName.trim();
  const lastName = result.lastName.trim();
  const normalizedCompany = normalizeNamePart(companyName);
  const normalizedFirst = normalizeNamePart(firstName);
  const normalizedLast = normalizeNamePart(lastName);

  if (!firstName || !lastName) return true;
  if (firstName.length < 2 || lastName.length < 2) return true;
  if (result.confidence < 0.7) return true;
  if (/\d/.test(firstName) || /\d/.test(lastName)) return true;
  if (isLikelyAcronym(firstName) || isLikelyAcronym(lastName)) return true;
  if (normalizedCompany && (normalizedFirst === normalizedCompany || normalizedLast === normalizedCompany)) {
    return true;
  }
  if (normalizedCompany && (normalizedFirst.includes(normalizedCompany) || normalizedLast.includes(normalizedCompany))) {
    return true;
  }

  return false;
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

function geminiUrl(apiKey: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
}

async function callGemini(apiKey: string, prompt: string): Promise<string | null> {
  let res: Response;
  try {
    res = await fetchGeminiWithRetry(geminiUrl(apiKey), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ google_search: {} }],
      }),
    });
  } catch {
    return null;
  }

  if (!res.ok) return null;

  const data = (await res.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };

  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
}

export async function geminiSearchContact(
  apiKey: string,
  companyName: string,
  title: string,
): Promise<GeminiContactResult | null> {
  const prompt = `You are a research assistant. Find the current ${title} of the company "${companyName}".

CRITICAL RULES:
- Search and verify before responding. Only return if you are highly confident.
- Return a REAL HUMAN PERSON.
- Never return the company name as a person name.
- firstName + lastName must identify a real individual human, not a brand, company, acronym, team, placeholder, or role.
- Never put the company name in firstName or lastName.
- jobTitle must be the person's exact current title (e.g. "CEO", "Co-Founder & CEO", "VP of Growth").
- website must be the company's primary domain only (e.g. "company.com"), with no protocol, path, or trailing slash.
- confidence must be a number from 0.0 to 1.0.
- If you cannot find a verified real person with high confidence, return confidence: 0 and empty strings.
- Do not guess.

Return only valid JSON, no markdown:
{"firstName":"...","lastName":"...","jobTitle":"...","website":"company.com","confidence":0.0}`;

  const text = await callGemini(apiKey, prompt);
  if (!text) return null;

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    const parsed = JSON.parse(jsonMatch[0]) as {
      firstName?: string;
      lastName?: string;
      jobTitle?: string;
      website?: string;
      confidence?: number;
    };

    const result = {
      firstName: parsed.firstName ?? "",
      lastName: parsed.lastName ?? "",
      jobTitle: parsed.jobTitle ?? "",
      website: parsed.website ?? "",
      confidence: parsed.confidence ?? 0,
    };

    if (isInvalidContactResult(companyName, result)) return null;

    return result;
  } catch {
    return null;
  }
}
