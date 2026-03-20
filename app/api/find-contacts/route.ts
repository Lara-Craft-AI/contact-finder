import { apolloMatchPerson, apolloSearchPerson, expandTitles } from "@/lib/apollo";
import { geminiSearchContact } from "@/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 300;

interface RequestBody {
  companies: string[];
  title: string;
  apolloApiKey: string;
  geminiApiKey?: string;
}

function sseEvent(event: string, data: unknown): string {
  return `event:${event}\ndata:${JSON.stringify(data)}\n\n`;
}

export async function POST(req: Request) {
  const body = (await req.json()) as RequestBody;
  const { companies, title, apolloApiKey, geminiApiKey } = body;

  if (!companies?.length || !title || !apolloApiKey) {
    return Response.json(
      { error: "Missing required fields: companies, title, apolloApiKey" },
      { status: 400 },
    );
  }

  const titles = expandTitles(title);
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(
        encoder.encode(sseEvent("start", { total: companies.length })),
      );

      for (let i = 0; i < companies.length; i++) {
        const company = companies[i];

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
          // Step 1: Apollo search
          const apolloResult = await apolloSearchPerson(
            apolloApiKey,
            company,
            titles,
          );

          if (apolloResult) {
            // Step 2: Try to get email via match
            let email = "";
            if (apolloResult.apolloId) {
              const matchEmail = await apolloMatchPerson(
                apolloApiKey,
                apolloResult.apolloId,
              );
              if (matchEmail) email = matchEmail;
            }

            controller.enqueue(
              encoder.encode(
                sseEvent("result", {
                  company,
                  firstName: apolloResult.firstName,
                  lastName: apolloResult.lastName,
                  email,
                  website: apolloResult.website,
                  source: "apollo",
                }),
              ),
            );
            continue;
          }

          // Step 3: Gemini fallback
          if (geminiApiKey) {
            // Rate limit: 1 req/sec for Gemini free tier
            await new Promise((resolve) => setTimeout(resolve, 1000));

            const geminiResult = await geminiSearchContact(
              geminiApiKey,
              company,
              title,
            );

            if (geminiResult) {
              controller.enqueue(
                encoder.encode(
                  sseEvent("result", {
                    company,
                    firstName: geminiResult.firstName,
                    lastName: geminiResult.lastName,
                    email: "",
                    website: geminiResult.website,
                    source: "gemini",
                  }),
                ),
              );
              continue;
            }
          }

          // Not found
          controller.enqueue(
            encoder.encode(
              sseEvent("result", {
                company,
                firstName: "",
                lastName: "",
                email: "",
                website: "",
                source: "not found",
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
                source: "not found",
              }),
            ),
          );
          console.error(`Error processing ${company}:`, err);
        }
      }

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
