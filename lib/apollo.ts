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
}

export async function apolloSearchPerson(
  apiKey: string,
  companyName: string,
  titles: string[],
): Promise<ApolloSearchResult | null> {
  const res = await fetch("https://api.apollo.io/v1/people/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
    },
    body: JSON.stringify({
      api_key: apiKey,
      person_titles: titles,
      organization_name: companyName,
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
      last_name?: string;
      title?: string;
      organization?: { website_url?: string };
    }>;
  };

  const person = data.people?.[0];
  if (!person) return null;

  return {
    firstName: person.first_name ?? "",
    lastName: person.last_name ?? "",
    website: person.organization?.website_url ?? "",
    apolloId: person.id ?? "",
    title: person.title ?? "",
  };
}

export async function apolloMatchPerson(
  apiKey: string,
  apolloId: string,
): Promise<string | null> {
  const url = `https://api.apollo.io/v1/people/match?id=${encodeURIComponent(apolloId)}&api_key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, {
    headers: { "Cache-Control": "no-cache" },
  });

  if (!res.ok) return null;

  const data = (await res.json()) as {
    person?: { email?: string };
  };

  return data.person?.email ?? null;
}
