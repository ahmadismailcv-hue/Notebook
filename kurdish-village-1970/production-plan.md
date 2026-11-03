# Winter Night, Kurdish Village, 1970: Production Plan

Format: 9:16 vertical, 576x1024 or larger, about 60–75 s, 18 shots of 3–5 s each. No dialogue. Ambient sound only.

## 1. What the reference video does (so we copy the method, not the content)

- 2 minutes, about 75 hard cuts, so each shot runs about 1.5–3 s. Pacing is quick.
- Hand-painted anime look: soft cel shading, warm earth palette (ochre, olive, cream), large expressive eyes, detailed lived-in interiors.
- Light sources tell the story: a kerosene lantern at night, cool blue moonlight through windows, golden dawn.
- A few small actions per shot: rolling out bedding, closing a window, turning down a lantern. Camera moves are a slow push-in or a gentle pan.
- Story beats: getting ready → lying down → small disturbance (rain) → sleep → dawn → morning routine.
- Same 4 characters in the same clothes throughout. Keeping the characters consistent is the hardest part to reproduce.

## 2. Style block (paste at the start of every image prompt)

```
Hand-painted 2D anime film still, soft cel shading, painterly watercolor backgrounds,
warm nostalgic atmosphere, gentle film grain, 1970s rural Middle East, vertical 9:16 composition,
high detail lived-in interior, no text, no logos
```

Night palette: deep indigo/blue outside, amber lantern glow inside, snow tinted pale blue.

## 3. Setting: be specific, or the model defaults to "generic desert village"

Default: a stepped mountain village in the Zagros (Hawraman-style). Flat-roofed stone-and-mud houses stack up the slope, so one family's roof is the next family's yard.

Period details (1970, no electricity in many villages):
- Flat earth roof with heavy snow, and a stone roof roller (*bangirdan*) resting on it
- Poplar-beam ceiling, mud-plastered walls, small wooden-shuttered windows
- Wood-burning stove or *tandûr*, with a kettle and a small samovar
- Kerosene hurricane lantern, plus an oil lamp in a wall niche
- Floor mattresses (*doşek*) and thick quilts (*lihêf*) stacked in a wall niche by day, spread out at night
- Hand-woven kilim rugs, copper pots, a transistor radio on a shelf (period-accurate, optional)
- Tea in small glass cups

Region check: dress and architecture differ between Iranian, Iraqi and Turkish Kurdistan. The defaults below assume Iranian/Iraqi Zagros. Adjust if your family's region differs.

## 4. Character sheet (reuse word-for-word in every shot)

- **DAD** (*Bavo*): about 40, thick black moustache, weathered face, dark wide Kurdish trousers and jacket (*şal û şapik*), patterned cloth sash, dark-patterned head wrap (*klaw/jamana*) by day and bare head at bedtime
- **MUM** (*Dayê*): about 35, kind face, long colourful dress (*kiras*) in deep red with a velvet vest, light headscarf, a few coin ornaments
- **SON** (*Kur*): about 9, short black messy hair, wool sweater over wide trousers, hand-knitted socks
- **DAUGHTER** (*Keç*): about 6, two dark braids, small floral dress over trousers, knitted cardigan

## 5. Shot list

Each shot needs an image prompt (start frame) and a motion prompt (image-to-video). Add the style block to every image prompt.

| # | Sec | Image prompt (after style block) | Motion prompt |
|---|---|---|---|
| 1 | 4 | Wide establishing shot at night, stepped Kurdish mountain village on a snowy Zagros slope, flat snow-covered roofs, a few windows glowing amber, starry sky, smoke from chimneys | Very slow push-in, light snow falling, smoke drifting |
| 2 | 3 | Close exterior of one stone-and-mud house, snow piled on flat roof, stone roller on roof, warm light in small shuttered window | Snowflakes fall, faint flicker in window |
| 3 | 4 | Interior: MUM pulls folded mattresses and quilts down from a wall niche, lantern light, kilim on floor | She lifts the stack and turns |
| 4 | 3 | MUM and DAUGHTER unroll a thick floral quilt across a mattress on the floor | Quilt unfurls, girl smooths it |
| 5 | 3 | DAD crouches at the wood stove, adding a log, orange glow on his face | Fire flares, sparks rise |
| 6 | 3 | Close-up: kettle on stove, steam, small tea glasses on a copper tray | Steam curls |
| 7 | 4 | SON stands at the small window, breath fogging the glass, snowy rooftops and moon outside | He wipes the glass with his sleeve |
| 8 | 3 | DAD steps outside the door in snow and shakes snow off a wool cloak, village roofs below in moonlight | Snow falls, breath visible |
| 9 | 3 | DAD closes and bars the wooden door from inside | Door shuts, latch drops |
| 10 | 3 | DAUGHTER, in a cardigan, slides under the quilt and pulls it to her chin | She snuggles in, eyes half closed |
| 11 | 4 | MUM unbraids her hair and folds her headscarf, sitting on the mattress, lantern beside her | Gentle hand movement, lantern flicker |
| 12 | 4 | Top-down view: four mattresses side by side on the floor, family settling in, stove glowing in the corner | Slow top-down rotate or push |
| 13 | 3 | Close-up: DAD's hand turns down the kerosene lantern wick | Flame shrinks, room darkens to blue |
| 14 | 3 | Room now lit only by the stove's glow and moonlight from the window | Embers pulse softly |
| 15 | 3 | DAD lying back, hands behind head, staring at the poplar-beam ceiling | Slow blink, slight smile |
| 16 | 3 | SON whispers to DAUGHTER under the quilt, both giggling | Small giggle, MUM's hand appears to hush them |
| 17 | 4 | Wide exterior: the house's window goes dark, snow keeps falling, whole village quiet | Slow pull-out, snow falls |
| 18 | 4 | Night sky over snowy peaks, moon, stars | Hold, gentle drift, fade to black |

Optional ending: dawn, smoke from the chimney, DAD on the roof rolling the stone roller over fresh snow. It mirrors the reference video's morning section.

## 6. Pipeline

1. **Lock the characters first.** Generate a character reference sheet for all 4 people (front, side, full body) in the style block. Every later shot uses it as a reference image. Without this, faces and clothes drift between shots.
2. **Generate start frames** for all 18 shots, using the character sheet as reference. Reject and regenerate any frame where clothing or faces drift.
3. **Animate each frame** (image-to-video, 3–5 s, low motion strength). High motion makes faces and hands melt.
4. **Edit**: cut to 2–4 s per shot, add a 0.3 s crossfade only on the time jumps (lantern off, exterior pull-out).
5. **Sound**: wind, crackling stove, kettle, snow crunch, a distant dog. Optionally a soft *tembûr* or *şimşal* (flute) motif, licensed or generated. The reference video's audio is very quiet (mean −34 dB), so ambient sound is what it relies on.
6. **Export**: 1080x1920, H.264, 30 fps.

## 7. Cost and risk

- Video generation is where most of the cost goes. 18 clips plus re-rolls (expect 1.5–2 attempts per clip) is about 30 generations.
- The most common failures are hands, the lantern flame "morphing", and text appearing on objects.
- The reference video is labelled AI-generated, and TikTok requires that label. Keep it.
