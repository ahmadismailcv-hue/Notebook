---
name: wrap-up
description: Send Ahmad a one-page PDF progress report for the current project or session, with a headline, what has been done, what is left, and a progress bar showing the percentage done. Use when Ahmad types /wrap-up or asks for a wrap-up, a progress PDF or a progress report as a document. Do not use for a chat-only summary or an end-of-session memory sweep (that is close-out).
---

# Wrap-up

Produce a short PDF and send it to Ahmad. One page where possible.

## 1. Work out the content

Use what this conversation established, plus the project's own records where they exist (CLAUDE.md open items, README, recent `git log`). Never invent progress.

- **Headline:** the project name and one plain line on where it stands. Example: "Townhall: built and tested, not yet live".
- **Done:** finished, verified items only. Short bullets, one line each, most important first. 5 to 12 bullets.
- **Left:** everything still open, most important first. Mark who owns it when that matters, for example "(you)" for jobs only Ahmad can do. 5 to 12 bullets.
- **Percentage:** if Ahmad gives one, use it. Otherwise compute `done / (done + left)` from the bullets, rounded to the nearest whole number, and set `basis` to "Based on the number of items, not the effort each takes." Never claim a precise figure you cannot support.

Writing rules: British English, plain words, short bullets, no em dashes, no hype, no filler.

## 2. Make the PDF

Write a JSON file, then run the script in this folder:

```json
{
  "title": "Townhall: built and tested, not yet live",
  "subtitle": "Wrap-up, 19 November 2026",
  "percent": 60,
  "basis": "Based on the number of items, not the effort each takes.",
  "done": ["Item", "Item"],
  "left": ["Item", "Item"]
}
```

```
node .claude/skills/wrap-up/make_pdf.cjs <input.json> <output.pdf>
```

Paths are relative to the repository root. Put both files in the session's scratchpad directory if one is listed, otherwise in the working directory, and name the PDF `wrap-up-YYYY-MM-DD.pdf`. The script needs Node with Playwright, which cloud sessions have. If it fails, say so and give the content in chat instead.

## 3. Send it

Send the PDF with the SendUserFile tool, `display: "render"`, and a one-line caption with the headline and the percentage. Add nothing else in chat beyond one sentence on how the percentage was worked out.
