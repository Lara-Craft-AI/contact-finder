const TITLE_MAP: Record<string, string[]> = {
  CEO: ["CEO", "Chief Executive Officer"],
  Founder: ["Founder", "Co-Founder", "Founding CEO"],
  CTO: ["CTO", "Chief Technology Officer"],
  "VP Sales": ["VP Sales", "VP of Sales", "Vice President Sales"],
  CFO: ["CFO", "Chief Financial Officer"],
};

export function expandTitles(title: string): string[] {
  return TITLE_MAP[title] ?? [title];
}

export interface ApolloSearchResult {
  firstName: string;
  lastName: string;
  website: string;
  apolloId: string;
  title: string;
  hasEmail: boolean;
}

// Uses /v1/mixed_people/api_search — free endpoint, no credits consumed.
// Returns obfuscated last name (e.g. "He***e"); use apolloMatchPerson to resolve if credits available.
export async function apolloSearchPerson(
  apiKey: string,
  companyName: string,
  titles: string[],
): Promise<ApolloSearchResult | null> {
  const res = await fetch("https://api.apollo.io/v1/mixed_people/api_search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      person_titles: titles,
      q_organization_name: companyName,
      page: 1,
      per_page: 1,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Apollo search failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as {
    people?: Array<{
      id?: string;
      first_name?: string;
      last_name_obfuscated?: string;
      title?: string;
      has_email?: boolean;
      organization?: { name?: string; website_url?: string };
    }>;
  };

  const person = data.people?.[0];
  if (!person) return null;

  return {
    firstName: person.first_name ?? "",
    lastName: person.last_name_obfuscated ?? "",
    website: person.organization?.website_url ?? "",
    apolloId: person.id ?? "",
    title: person.title ?? "",
    hasEmail: person.has_email ?? false,
  };
}

// Attempts to resolve full last name + email via people/match (may require credits).
// Returns null gracefully if credits are insufficient.
export async function apolloMatchPerson(
  apiKey: string,
  apolloId: string,
): Promise<{ email: string; lastName: string } | null> {
  const res = await fetch("https://api.apollo.io/v1/people/match", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({ id: apolloId }),
  });

  if (!res.ok) return null;

  const data = (await res.json()) as {
    person?: { email?: string; last_name?: string };
    error?: string;
  };

  if (data.error) return null;

  return {
    email: data.person?.email ?? "",
    lastName: data.person?.last_name ?? "",
  };
}
