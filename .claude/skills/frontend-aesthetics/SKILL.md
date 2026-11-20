---
name: frontend-aesthetics
description: Push frontend work away from generic "AI slop" design toward distinctive, context-specific choices in typography, colour, motion and backgrounds. Use when building or restyling any web page, app screen or UI component, or when Ahmad asks for a design to look less generic, more polished or more distinctive.
---

# Frontend aesthetics

Source: Anthropic's "Frontend Aesthetics: A Prompting Guide" in the claude-cookbooks repository (coding/prompting_for_frontend_aesthetics.ipynb). The distilled prompt is reproduced below, followed by notes for using it on Ahmad's projects.

## The guidance

You tend to converge toward generic, "on distribution" outputs. In frontend design, this creates what users call the "AI slop" aesthetic. Avoid this: make creative, distinctive frontends that surprise and delight. Focus on:

- **Typography:** Choose fonts that are beautiful, unique, and interesting. Avoid generic fonts like Arial and Inter; opt instead for distinctive choices that elevate the frontend's aesthetics.
- **Colour and theme:** Commit to a cohesive aesthetic. Use CSS variables for consistency. Dominant colours with sharp accents outperform timid, evenly distributed palettes. Draw from IDE themes and cultural aesthetics for inspiration.
- **Motion:** Use animations for effects and micro-interactions. Prioritise CSS-only solutions for HTML. Focus on high-impact moments: one well-orchestrated page load with staggered reveals (animation-delay) creates more delight than scattered micro-interactions.
- **Backgrounds:** Create atmosphere and depth rather than defaulting to solid colours. Layer CSS gradients, use geometric patterns, or add contextual effects that match the overall aesthetic.

Avoid generic AI-generated aesthetics:
- Overused font families (Inter, Roboto, Arial, system fonts)
- Cliched colour schemes (particularly purple gradients on white backgrounds)
- Predictable layouts and component patterns
- Cookie-cutter design that lacks context-specific character

Interpret creatively and make unexpected choices that feel designed for the context. Vary between light and dark themes, different fonts, different aesthetics. Avoid converging on common choices (Space Grotesk, for example) across generations.

### Typography detail (from the guide's isolated prompt)

- Never use: Inter, Roboto, Open Sans, Lato, default system fonts.
- Pairing principle: high contrast is interesting. Display plus monospace, serif plus geometric sans, a variable font across weights.
- Use extremes: 200 weight against 800, not 400 against 600. Size jumps of 3x or more, not 1.5x.
- Pick one distinctive font and use it decisively. State the choice before coding.

## How to apply it

1. Before writing code, name the subject, the audience and the page's single job. State the type pairing, the palette (4 to 6 named CSS variables) and the one motion moment.
2. Ground every choice in the subject's own world: its materials, documents and vocabulary.
3. Distinctive never overrides usability or the brief. When the audience needs plain, accessible pages (public services, older or less confident users), keep text large, contrast at WCAG AA or better, touch targets at least 44px, and motion behind `prefers-reduced-motion`. Put the character into type, colour and one or two details, not into clever navigation.
4. Respect an existing design system or an approved look. If the project has one, apply this guidance only where it leaves gaps, or ask before replacing it.
5. Check the result once in a browser at desktop and phone width before calling it done.
