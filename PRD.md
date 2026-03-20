# PRD: Contact Finder — v2 (Battle-Tested)

## Goal
Given a list of company names + a target title (CEO, VP Growth, etc.), return verified contacts with first name, last name, job title, company website. Fast, accurate, no bullshit.

## Current State (broken things)
1. **Accuracy** — Gemini sometimes returns company name as person name (e.g. "Pylon" as firstName). Fix: stricter prompt + validation layer before emitting result.
2. **Download CSV button** — needs to be dark/black (primary action color), currently too light.
3. **Speed** — Concurrency is 8 already, but verify step doubles API calls. Remove verify step OR merge verify into a single smarter prompt.
4. **Apollo removed** — already done in latest version, keep it gone.

## Required Fixes (in priority order)

### 1. Accuracy — CRITICAL
The Gemini prompt must be bulletproof against returning company names as person names.

**Validation rules (code-level, not just prompt):**
- If `firstName` or `lastName` matches `companyName` (case-insensitive, partial) → reject, emit "not found"
- If `firstName` length < 2 OR `lastName` length < 2 → reject
- If `firstName` contains digits or looks like an acronym (all caps > 3 chars) → reject
- If `confidence` < 0.7 → emit "not found" instead of bad data

**Improved prompt:**
```
You are a research assistant. Find the current [TITLE] of the company "[COMPANY]".

Rules:
- Return a REAL HUMAN PERSON. Never return the company name as a name.
- firstName + lastName must be a real individual human (e.g. "John Smith", not "Pylon" or "N/A")
- jobTitle should be their exact title (e.g. "CEO", "Co-Founder & CEO", "VP of Sales")
- website: the company's primary domain (e.g. "pylon.com") — no https://, no trailing slash
- confidence: 0.0 to 1.0. Use 0 if you cannot find a verified real person.
- If unsure, return confidence: 0 and empty strings — do NOT guess.

Return ONLY valid JSON (no markdown, no explanation):
{"firstName":"","lastName":"","jobTitle":"","website":"","confidence":0.0}
```

### 2. Remove verification step — SPEED
The current 2-call flow (search + verify) doubles latency for no good reason.
Replace with: single smarter prompt that does its own internal verification.
The prompt should say "Search and verify before responding. Only return if you are highly confident."

### 3. Dark Download CSV button
In `ResultsTable.tsx`, the Download CSV button should use `variant="default"` (dark/black fill) not outline.

### 4. Error handling
If Gemini returns 429 (rate limit), show user-friendly message: "Gemini rate limit hit — reduce batch size or wait 60s"
Already has retry logic, keep it.

## Success Criteria
- Run 20 companies → 0 company names returned as person names
- Run 20 companies → completes in < 30 seconds
- Download CSV button is dark/black
- Results that can't be found show cleanly as "Not found" (not empty strings)

## Stack
- Next.js App Router + Tailwind v4
- Gemini 2.5 Flash (BYOK Gemini API key)
- SSE streaming (keep as-is)
- Vercel deploy

## Workflow
1. Fix `lib/gemini.ts` — improve prompt, add validation, remove verify step
2. Fix `components/ResultsTable.tsx` — dark Download CSV button
3. Run `npm run build` — must pass
4. Deploy to Vercel: `cd /data/projects/contact-finder && npx vercel --prod --yes --token $VERCEL_TOKEN`
5. Test live with these companies: Pylon, Clay, Chainguard, Regal, PermitFlow, Supabase, Vercel, Stripe, Linear, Notion
6. If any company name returned as person name → fix and redeploy
7. Only mark DONE when 0 accuracy issues

## Ralph Loop
After fixing, re-run the test companies. If any issue found, fix and redeploy. Keep looping until perfect.
