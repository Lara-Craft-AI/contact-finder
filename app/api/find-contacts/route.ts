import { geminiSearchContact } from "@/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 300;

interface RequestBody {
  companies: string[];
  title: string;
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
  const { companies, title, geminiApiKey } = body;

  if (!companies?.length || !title || !geminiApiKey) {
    return Response.json(
      { error: "Missing required fields: companies, title, and geminiApiKey" },
      { status: 400 },
    );
  }
  const encoder = new TextEncoder();

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
          let jobTitle = "";
          let website = "";
          let source: string = "not found";

          const geminiResult = await geminiSearchContact(geminiApiKey, company, title);

          if (geminiResult) {
            firstName = geminiResult.firstName;
            lastName = geminiResult.lastName;
            jobTitle = geminiResult.jobTitle;
            website = geminiResult.website;
            source = "gemini";
          }

          controller.enqueue(
            encoder.encode(
              sseEvent("result", {
                company,
                firstName,
                lastName,
                jobTitle,
                website,
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
                jobTitle: "",
                website: "",
                source: "not found",
              }),
            ),
          );
          console.error(`Error processing ${company}:`, err);
        }
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
