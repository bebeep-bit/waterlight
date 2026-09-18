# The Last Color Agent

Wordless, watercolour-style short films made by conversation. Write one line,
the agent paints an 8-second silent film, then you keep talking to it until the
film is right.

Built for the Livepeer Agent Hackathon.

## Running it

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

## Where things live

```
src/
  app/
    layout.tsx              fonts + document shell
    globals.css             the whole design system (see below)
    page.tsx                renders <Studio />
    api/render/route.ts     POST — accepts a prompt, returns a jobId
    api/render/[jobId]/     GET  — poll for progress, then the film
    api/download/route.ts   streams a cross-origin film as an attachment
  components/
    studio.tsx              client root; owns the two page states
    prompt-composer.tsx     the textarea, in hero and compact sizes
    example-prompts.tsx     the six opening briefs
    film-stage.tsx          16:9 frame, progress wash, download
    refinement-panel.tsx    the conversation with the agent
  lib/
    types.ts                shared vocabulary, mirrors the agent's shapes
    style-contract.ts       wraps every prompt in the watercolour rules
    example-prompts.ts
    use-session.ts          conversation state + the polling loop
    agent/engine.ts         THE SEAM — mock today, Livepeer Agent next
references/
  *.jpg                     the official style references
  analyse.py                re-derives the palette numbers from them
```

## The visual language

The six frames in `references/` are the authority on how this should look.
`references/analyse.py` re-derives the numbers below if those frames change.

| Reference says | What we do about it |
| --- | --- |
| Median saturation 0.20–0.46, but p99 reaches 0.76–0.99 | The vivid colour is stated as a proportion — ~1% of the frame — not as a mood |
| Dominant hues are twilight indigo, slate teal, warm clay, cream paper | "Desaturated" means dusk, not ash; `--color-twilight` / `--color-slate` / `--color-clay` |
| Median value 0.45–0.69 | Frames are mid-to-dark; the empty film stage is twilight, not cream |
| Visible hand-inked linework over every wash | Named explicitly in the prompt — without it models return smooth digital gradients |
| Audible paper grain throughout | The `paper-grain` utility, worn by the page and the film frame alike |
| All 16:9, subject small in deep space | Wide cinematic framing is part of the contract |

The single biggest failure mode is a model quietly returning a clean digital
illustration. Most of the negative prompt exists to prevent exactly that.

### Decisions worth knowing

**The style contract is not the user's problem.** Everything typed into the app
is wrapped by `src/lib/style-contract.ts` before it reaches the agent: the
medium, the palette discipline, the motion, the atmosphere, and a hard no-text
rule. A three-word wish still comes back in the language of THE LAST COLOR.
Keeping it in one file means the whole aesthetic is tunable from one place.

**Refinements restate the medium.** Models drift toward smooth digital
rendering a little with every edit, so each follow-up re-sends the medium and
palette clauses. Without that the look degrades across a conversation.

**Refinements are amendments, not new prompts.** A follow-up like "make the bud
brighter" is sent alongside the original brief and a `threadId`, so the agent
keeps the same scene, gardener and palette rather than starting over.

**One seam to the agent.** `src/lib/agent/engine.ts` is the only file that knows
how films get made. It already speaks the async accept-then-poll contract that
Livepeer Agent's `create_media` / `get_create_media` use, so swapping the mock
for the real MCP client touches nothing else.

**Design system lives in CSS, not components.** `globals.css` defines the paper
palette, the two drifting watercolour blooms, and the paper grain — the grain is
an inline SVG fractal, so the app ships no image assets. Components only
reference tokens like `bg-paper` and `text-bud`.

**The wait is part of the piece.** Progress is a pale bud that breathes and a
colour wash that seeps across the page, with phase notes in the app's own voice
("Laying the first grey wash") instead of a percentage.

## Current status

The UI is complete and runs end to end against a mock engine that walks through
the real phases and returns a placeholder clip
(`public/placeholder-film.mp4`, CC0, vendored so the demo can never fail on a
dead CDN). Films are marked `placeholder render` in the UI while the mock is in
use.

### Next: wire up Livepeer Agent

Everything below happens inside `src/lib/agent/engine.ts`.

1. Copy `.env.example` to `.env.local`. Leave `LIVEPEER_AGENT_KEY` empty to use
   the keyless demo credit, or add a `sk_…` key from app.daydream.live.
2. Add an MCP client that connects to `https://agent.livepeer.org/api/mcp` with
   the `X-Livepeer Agent-Tool-Profile: lean` header.
3. Replace `startRender` with a `create_media` call using the composed prompt
   and `NEGATIVE_PROMPT`, and `readRender` with `get_create_media`.
4. Map the agent's `human_summary` onto `RenderProgress.note` — the UI is built
   to show the agent's own words, never raw JSON.
5. Carry `model_note` through to `Film.modelNote`; the agent may legitimately
   serve a different capability than the one requested.
