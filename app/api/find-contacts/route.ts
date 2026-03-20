import { apolloSearchPerson, expandTitles } from "@/lib/apollo";
import { geminiSearchContact } from "@/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 300;

interface RequestBody {
  companies: string[];
  title: string;
  apolloApiKey?: string;
  geminiApiKey?: string;
}

function sseEvent(event: string, data: unknown): string {
  return `event:${event}\ndata:${JSON.stringify(data)}\n\n`;
}

async function withConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T, i: number) => Promise<void>,
): Promise<void> {
  const queue = [...items.entries()];
  const workers = Array(Math.min(limit, items.length))
    .fill(null)
    .map(async () => {
      while (queue.length > 0) {
        const entry = queue.shift();
        if (entry) await fn(entry[1], entry[0]);
      }
    });
  await Promise.all(workers);
}

export async function POST(req: Request) {
  const body = (await req.json()) as RequestBody;
  const { companies, title, apolloApiKey, geminiApiKey } = body;

  if (!companies?.length || !title || (!geminiApiKey && !apolloApiKey)) {
    return Response.json(
      { error: "Missing required fields: companies, title, and at least one API key" },
      { status: 400 },
    );
  }

  const titles = expandTitles(title);
  const encoder = new TextEncoder();
  let completed = 0;

  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(
        encoder.encode(sseEvent("start", { total: companies.length })),
      );

      await withConcurrency(companies, 8, async (company, i) => {
        controller.enqueue(
          encoder.encode(
            sseEvent("progress", {
              current: i + 1,
              total: companies.length,
              company,
            }),
          ),
        );

        try {
          let firstName = "";
          let lastName = "";
          let website = "";
          let hasEmail = false;
          let source: string = "not found";

          // Run Apollo and Gemini in parallel — they are independent
          const [geminiResult, apolloResult] = await Promise.all([
            geminiApiKey
              ? geminiSearchContact(geminiApiKey, company, title)
              : Promise.resolve(null),
            apolloApiKey
              ? apolloSearchPerson(apolloApiKey, company, titles)
              : Promise.resolve(null),
          ]);

          if (geminiResult) {
            firstName = geminiResult.firstName;
            lastName = geminiResult.lastName;
            website = geminiResult.website;
            source = "gemini";
          }

          if (apolloResult) {
            hasEmail = apolloResult.hasEmail;

            if (source === "gemini") {
              source = "apollo+gemini";
            } else {
              firstName = apolloResult.firstName;
              lastName = apolloResult.lastName;
              website = apolloResult.website;
              source = "apollo (partial)";
            }
          }

          controller.enqueue(
            encoder.encode(
              sseEvent("result", {
                company,
                firstName,
                lastName,
                email: "",
                website,
                hasEmail,
                source,
              }),
            ),
          );
        } catch (err) {
          controller.enqueue(
            encoder.encode(
              sseEvent("result", {
                company,
                firstName: "",
                lastName: "",
                email: "",
                website: "",
                hasEmail: false,
                source: "not found",
              }),
            ),
          );
          console.error(`Error processing ${company}:`, err);
        }

        completed++;
      });

      controller.enqueue(encoder.encode(sseEvent("complete", {})));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
