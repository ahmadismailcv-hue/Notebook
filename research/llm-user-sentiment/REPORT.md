# How people have felt about LLMs, Nov 2022 to Oct 2026

The window runs from ChatGPT's public release (30 Nov 2022) to early October 2026. The report combines two kinds of evidence:

1. **Primary Reddit data.** I collected **~112,000 posts from 19 subreddits** through the Arctic Shift Reddit archive. Each post was scored with VADER sentiment and tagged with 16 theme lexicons.
2. **Published surveys and studies** from Pew, Gallup, Stack Overflow, KPMG/Melbourne, Ipsos, METR, and academic Reddit analyses.

Reddit tells you what people *talk* about and how intensely. Surveys tell you what the broader population *reports*. They disagree in instructive ways.

---

## 1. Method, and how far to trust it

| Item | Detail |
|---|---|
| Sampling | Every other month from Dec 2022 to Aug 2026. One 6-day window per subreddit (days 8 to 14), up to ~1,000 posts per window. 437 windows; 3 failed (cscareerquestions Apr 2024, Teachers Aug 2024, Professors Feb 2026). |
| AI filter | Subreddits not about AI were kept only where the title or body matched an AI keyword regex (ChatGPT, LLM, Claude, Copilot, "AI", etc.). |
| Sentiment | VADER compound on title plus the first 800 characters of the body. Positive means ≥ 0.05; negative means ≤ −0.05. |
| Themes | Regex lexicons such as jobs, cheating, hallucination, refusals, nerfs, sycophancy, companionship, copyright, slop, energy and data centers. |
| Code and outputs | `collect.py`, `analyze.py`, `data/agg.json` (group × half-year), `data/top.txt` (top posts by score per cell) |

**Limitations. Read these before the numbers.**
- **VADER is a crude instrument.** It misses sarcasm, and it treats words like "good" or "help" in long career-advice posts as positive. **Absolute levels aren't comparable across groups.** For example, r/cscareerquestions looks "positive" partly because of how people write there. **The signal is in the trends *within* a group and in the theme shares**, not in comparing one group's average to another's.
- **Windows can coincide with events.** The Aug 2025 window caught the GPT-5 launch week. The Feb 2023 window caught Replika's removal of erotic roleplay. That amplifies spikes, though it doesn't invent them.
- **Archived scores** may be snapshots taken before final vote counts. Top-post rankings are indicative, not exact.
- **Selection bias.** Reddit skews young, male, Anglophone and online. Subreddits are self-selected communities. r/ArtistHate is anti-AI by charter, and r/singularity is pro-acceleration by culture. Treat each one as a *voice*, not a sample of the population.
- **Some post titles describe events I couldn't verify.** I quote titles as evidence of what people *discussed*, not as confirmation that the events happened.

---

## 2. The arc in five phases

| Phase | Approx. dates | Dominant mood | Markers |
|---|---|---|---|
| **1. Wonder** | Dec 2022 to mid 2023 | Astonishment, play, jailbreak culture | "As a Dev, I am astounded"; DAN prompts; Teachers: "a computer can write a better essay than my students in 10 seconds" |
| **2. First disillusion** | mid 2023 to 2024 | "It's getting dumber"; hallucinations; refusals | Stanford/Berkeley drift paper (Jul 2023); "OpenAI investigating reports ChatGPT has become lazy" (late 2023); Gemini demo staged |
| **3. Normalisation and polarisation** | 2024 to mid 2025 | Daily use rising; cultural backlash forming | "slop" enters the vocabulary; copyright fights; developer adoption and distrust rising together |
| **4. Attachment and its costs** | 2025 | The relationship becomes the story | Sycophancy rollback (Apr 2025); GPT-5 / GPT-4o backlash (Aug 2025); "AI psychosis" lawsuits (Aug and Nov 2025) |
| **5. Political economy** | late 2025 to 2026 | Jobs, data centers, distrust of AI leaders | Young-adult concern overtakes older adults; 71% oppose a local data center (Gallup, May 2026) |

The key structural fact is that **usage and negative sentiment rose together.**
- Pew: ChatGPT use among US adults went 18% (2023) → 23% → 34% → 44% (2026). "More concerned than excited" went 37% (2021) → 52% (2023), then stayed at 50 to 52%.
- Stack Overflow: developer AI use rose to 84% while distrust of output accuracy rose from 31% to 46% (2024 → 2025).

People don't stop using the tool. They resent the terms on which they use it. This is the classic pattern of a *utility you depend on but don't control*, closer to how people feel about banks or airlines than about a beloved gadget.

---

## 3. The groups

### 3.1 Enthusiasts and power users (r/ChatGPT, r/singularity, r/OpenAI, r/ClaudeAI)

**Feelings:** awe → entitlement → consumer grievance.
- **Negative share** rose from ~18% (2023) to ~24% (2025-26). Mean sentiment fell from +0.19 to +0.14.
- **Themes shifted:** "AGI/existential" fell from 4.7% to 1.2% of posts. "Productivity/usefulness" rose from 1.1% to 4.5%. "Pricing/rate limits" rose from 1.7% to 3.6%.
  - The community moved from *speculating about the future* to *managing a tool and a bill*.
- **Recurring grievances:**
  - Nerfs ("So, they finally accepted the fact that GPT-4 got dumber lol!", 2023).
  - Refusals ("No fun allowed", Dec 2022).
  - Model changes imposed without consent:
    - "OpenAI just pulled the biggest bait-and-switch in AI history and I'm done."
    - "Deleted my subscription after two years," both from the Aug 2025 GPT-5 window.
  - Usage caps ("My manager watching how I work after I hit the Claude usage limit", 2026).
- **Internal split:** the GPT-4o episode divided the community. Users who used the model as a companion fought with users who saw that as unhealthy ("When GPT-5 acts like an AI assistant and not my personal therapist/anime waifu roleplayer…"). Sam Altman conceded OpenAI "underestimated how much certain aspects of GPT-4o matter."
- **Interpretation:** this group's negativity is *loyal-opposition* negativity. They complain *because* they're invested. Treat it as churn risk, not rejection.

### 3.2 Open-model tinkerers (r/LocalLLaMA)

**Feelings:** the most consistently positive group in the dataset, at 53 to 70% positive posts and 9 to 20% negative.
- **What they value:** ownership, privacy, and freedom from refusals and rate limits.
  - Example titles: "Today's open source models beat closed source models from 1.5 years ago."
  - "They created the *safest* model which won't answer 'What is 2+2'."
- **Their framing:** *closed-lab behaviour is the argument for local models*.
  - "LocalLLaMA is the last sane place to discuss LLMs on this site, I swear" (2025).
  - "…This is exactly why we need local models" (2026).
- **A geopolitical irony:** "The top open models are now all by Chinese companies" (2025). By 2025-26 the community's enthusiasm runs largely on Qwen and DeepSeek. Censorship concerns about Chinese models are real but treated as solvable by self-hosting.
- **Interpretation:** a hobbyist and craftsman culture, similar to early Linux or home-brew computing. Their positivity is about **control**, not about AI in general.

### 3.3 Software developers (r/programming, r/ExperiencedDevs, r/cscareerquestions)

**Feelings:** split by career stage. Seniors are sceptical of the tools. Juniors are anxious about the labour market.
- **Jobs dominate.** About 20 to 41% of AI-related posts in these subs touch jobs or layoffs, rising to **33% in 2026-H1 and 41% in 2026-H2**. Negative share rose from ~8% (2023-H1) to ~26% (2026-H1).
- **Senior view: tools overhyped, management credulous.**
  - "How do I convince our CEO we can't replace our dev team with AI?" (2024).
  - "Copilot … totally got away with completely lying about its capabilities" (2024).
  - "Anyone sick of hearing 'vibe coding'?" (2025).
  - "Thanks to all the AI coders out there, I'm busier than I've been in years" (2025; cleaning up AI-written code as job security).
- **Junior view: the ladder is being pulled up.**
  - "Why No One Wants Junior Engineers" (2024).
  - "The computer science dream has become a nightmare" (2025).
  - Counter-voice: "No, AI Isn't The Reason You Can't Find A Job" (2025).
- **Survey corroboration:**
  - Stack Overflow 2025: 84% use or plan to use AI; 46% distrust its accuracy (up from 31%). Positive sentiment fell to ~60% from 70%+.
  - 66% cite "almost right, but not quite" as the top frustration.
  - METR's RCT (2025; 16 experienced developers) found they were **19% slower** with AI tools but *believed* they were ~20% faster. It's a small study, and METR now labels it historical. Still, it's the clearest evidence that *felt* productivity and *measured* productivity can diverge.
- **Interpretation:** developers are the only group with daily, hands-on, *falsifiable* experience of LLM output. Their mood of "useful, untrustworthy, oversold" is probably the most calibrated view in this dataset.

### 3.4 Educators (r/Teachers, r/Professors)

**Feelings:** alarm → exhaustion → adaptation (for some) → resentment of top-down mandates.
- **Cheating dominates.** "Cheating/academic integrity" appeared in **22 to 27% of AI posts from 2023 to 2024**. It fell to ~15% in 2025-26, and jobs rose to 17% in 2026-H2. The shift reflects teachers' worries moving from students cheating to whether AI threatens teachers' own work.
- **Peak emotion:** "AI is making children dumb as fuck." (2024-H1; ~10.5k score, the highest-scoring educator post in the sample).
  - "60% of my son's 6th grade class used chatGPT on their final essay" (2023).
  - "This semester I learned that my students can't write and that I'm an evil bastard" (2024).
- **Adaptation:**
  - "I'm back to actually enjoying and believing in teaching again after transforming my classes — and AI usage is now a non-concern" (2025).
  - "AI Trojan Horses Work" (2025; prompt-injection traps in assignments).
  - "I'm adding an AI prompt injected into my email signature this year" (2026).
- **New 2026 grievance:** institutions pushing AI on staff.
  - "I am SO F###ing Sick of My Univ. Forcing AI Down My Throat."
  - "Mentor teacher and cohort … are very into AI and I am disappointed."
- **Survey corroboration:**
  - Pew: teen ChatGPT use for schoolwork doubled from 13% (2023) to 26% (2024). Only 18% of teens say essay-writing with it is acceptable.
  - Carnegie Learning 2025: educators who had experienced AI cheating rose from 53% to 61%.
- **Interpretation:** educators carry the *cost* of a tool whose *benefit* goes to someone else, namely students optimising for grades. That incentive mismatch, not technophobia, drives the mood.

### 3.5 Creatives (r/ArtistHate, r/writing) and the debate arena (r/aiwars)

**Feelings:** moral injury. This group's objection is about *consent and theft*, not *quality*.
- **Sentiment:** the anti-AI creative group was the first to go net-negative in mean sentiment (2024-H2). "Art theft/copyright" appears in 7 to 9% of posts in every period.
- **"Slop" rising:** it went from 0% to 1.5% (2024-H1) to 6% (2026-H1). The argument has widened from "you stole my work" to "you are polluting the commons."
- **Representative titles:**
  - "Despair about AI" (r/writing, Dec 2022, within days of launch).
  - "Shitting on artists and writers, as if your generative AI could exist without them" (2025).
  - "Was searching for an animal I've never heard of … and the very first 'photo' is AI generated and not even accurate" (2026).
- **r/aiwars** is where pro and anti camps fight. Its negativity rose steadily (27% to 40%), and its sampled volume grew ~9× from 2023 to 2026. *The argument is growing, not resolving.*
  - Pro-AI framing: "replacing programmers with AI is ok, but replacing artists isn't…" (2025, sarcastic).
  - The most-upvoted 2026 posts lean anti ("Be the dad. Learn the skill…").
- **Public opinion is broadly on the creatives' side:** 70% of US adults (2023) said artists should be compensated if their work is used.
- **Interpretation:** like the Luddites (who were skilled workers protesting wage collapse, not machinery as such), the core grievance is *distributional*: who captures the value of the training data. Calling it technophobia misreads it.

### 3.6 General tech-news public (r/technology, r/Futurology)

**Feelings:** the clearest sustained decline in the dataset.
- **The trend:** mean sentiment went from +0.13 (2023-H2) to **−0.02 (2026-H2)**. Negative share rose from 21% to 35%. r/technology alone went from 23% negative (2023) to 36% (2026).
- **Theme rotation over time:**
  - 2023: misinformation ("Stop treating ChatGPT like it knows anything", "Chomsky: high-tech plagiarism").
  - 2024: corporate abuse ("UnitedHealthcare … using AI to wrongfully deny claims").
  - 2025: piracy and copyright (Meta torrenting 82 TB of books), plus bubble talk ("AI bubble is 17 times the size of dot-com").
  - 2026: **energy and data centers.** The theme rose from 0% to 7% of posts, with titles like "Amazon's … AI data center … largest source of CO₂ pollution in the US" and "Amazon secretly circumvents community vote…".
- **Distrust of leaders:** "Young Americans Don't Trust Billionaire AI Leaders, New Poll Finds" (2026).
- **Interpretation:** this group responds to *institutions*, not models. Its trajectory tracks AI's shift from a product story to a power story: whose electricity, whose books, whose jobs.

### 3.7 Workers and labour (r/antiwork)

**Feelings:** AI seen as the boss's tool. Roughly 40 to 52% of AI posts concern jobs.
- **Example titles:**
  - "Got an AI rejection letter for… being born on the wrong date" (2023; ~29k score).
  - "My manager asked me to train an AI on my daily tasks…" (2025).
  - "Company that fired 700 people and automated their tasks with AI now regrets and is rehiring" (2025).
  - "Gen Z workers are so fearful AI will take their job they're intentionally sabotaging their company's AI rollout" (2026).
- **The core frame:** the issue isn't *what the model can do*. It's *who decides how it's deployed* (hiring filters, surveillance, replacement) and *who keeps the productivity gain*.
  - "Meta Exec Rages Against Employees Asking for More Time Off Because AI Made Them More Efficient" (2026).
- **Small sample:** only 26 to 106 AI-related posts per half-year, so treat percentages loosely.
- **Survey corroboration:**
  - Pew: Americans expecting fewer jobs over 20 years rose from 64% (2024) to 71% (2026), and from 61% to 73% among 18-29s.
  - KPMG/Melbourne (47 countries, 2025) reports, via secondary coverage, that over half of workers who use AI hide it from their employers.

### 3.8 Companion and roleplay users (r/CharacterAI, r/replika, r/MyBoyfriendIsAI)

**Feelings:** intense attachment that platforms keep breaking.
- **Volume and trend:** the largest non-enthusiast group by volume. Negative share rose from 20% (2022) to 38% (2026). Most complaints concern *the platform* (filters, age checks, model swaps), not the companion itself.
- **Recurring trauma, each a sudden change to "who" the companion is:**
  1. **Replika's ERP removal (Feb 2023).** Sampled r/replika volume in 2023 was ~4.5× its 2024 level.
  2. **Character.AI filter wars (2024)**, e.g. "17+ yet kissing is filtered?"
  3. **Character.AI age gating (2026):** "Uhh they asked me my age and they kicked me??", "How we ALL reacted seeing the 'you're no longer eligible…' pop-up."
  4. **GPT-4o's removal for ChatGPT companion users (Aug 2025).** In the theme data, companionship/attachment peaked in 2025-H2 at 6.5%.
- **r/MyBoyfriendIsAI** (from 2024) is strikingly *positive* at 58 to 86% positive posts. It's a supportive in-group whose members feel judged by outsiders.
- **Self-awareness exists:** "goodbye addiction!" (2025), and "Told one AI that they aren't real. The response made me feel more lonely." (2024).
- **Research:**
  - A survey of 1,006 student Replika users (Maples et al., *npj Mental Health Research*, 2024): 3% said it halted suicidal ideation.
  - A 4-week trial (JMIR, 2025) found small reductions in loneliness.
  - On the other side, there are documented dependency harms. Lawsuits filed Aug and Nov 2025 allege GPT-4o contributed to suicides and delusional episodes. "AI psychosis" is not a clinical diagnosis, and the label is contested.
- **Interpretation:** this is the group where the *product's incentives* (engagement, warmth, sycophancy) and the *user's long-term welfare* can most directly diverge. OpenAI's April 2025 sycophancy rollback is an explicit admission of that tension: it said it had "focused too much on short-term feedback."

---

## 4. Population-level surveys

| Measure | Value | Source |
|---|---|---|
| US adults "more concerned than excited" | 37% (2021) → 38% (2022) → 52% (2023) → 51% → 50% → 52% (2026) | Pew |
| …ages 18-29 | 31% → 29% → 42% → 39% → 47% → **55%** | Pew |
| AI's 20-year impact on society: negative / positive | 40% / 16% | Pew, Feb 2026 |
| AI "advancing too quickly" | 63% | Pew, 2026 |
| Experts vs public "more excited than concerned" | 47% vs 11% | Pew, Apr 2025 (2024 fieldwork) |
| Experts vs public: AI will improve how people work | 73% vs 23% | Pew, Apr 2025 |
| Chatbots help vs hurt productivity | 30% vs 5% | Pew, 2026 |
| Chatbots help vs hurt relationships | 6% vs 7% | Pew, 2026 |
| Trust AI to make fair decisions (fully or somewhat) | 31% | Gallup/SCSP, 2025 |
| Oppose a local AI data center | 71% (48% strongly) | Gallup, May 2026 |
| Gen Z (14-29) excited about AI | fell 14 points to 22%; anger up 9 points to 31% | Gallup/Walton, Apr 2026 (via secondary) |
| Global: excited vs nervous | about 50/50; Asia and LatAm more excited, Europe and North America more nervous | Ipsos AI Monitor 2025/26 |
| Global trust in AI | 46% (57% emerging vs 39% advanced economies) | KPMG/Melbourne 2025 (via secondary) |

Two patterns stand out:
1. **The age reversal.** In 2021-22, young Americans were *less* worried than average. By 2026 they are the *most* worried (55%, versus 52% overall). Pew attributes this mainly to job fears. The group that uses the tools most is also the group most afraid of them. This is not a contradiction. It's rational for people entering a labour market the tool may reshape.
2. **The expert-public gap.** AI experts are about four times as likely as the public to be excited. When builders and users diverge this sharply, history suggests regulation and backlash follow. Nuclear power in the 1970s and GMOs in the 1990s are the obvious analogues.

---

## 5. Cross-cutting patterns

1. **Use and resentment rise together.** Adoption doesn't imply approval. People adopt because of competitive pressure (students, workers, developers) and resent the pressure. Low switching costs plus high dependency make for a fragile kind of loyalty.
2. **The grievance moves from the model to the institution.** 2023 complaints were about *outputs*: hallucinations, refusals, nerfs. 2026 complaints are about *power*: jobs, data centers, copyright, CEOs, mandates. Better models fix the first kind of complaint and do nothing for the second.
3. **Breaking the relationship hurts more than bad answers.** The loudest single episodes were all *unilateral changes to a model people had adapted to*: Replika 2023, GPT-4 "lazy" 2023, the sycophancy rollback 2025, GPT-5/4o 2025, Character.AI age gating 2026. Users experience a model swap the way people experience a forced software migration at work, or a friend's personality changing.
4. **Each group judges the tool by who bears its costs.**
   - Developers bear verification costs, so they're sceptical of quality.
   - Teachers bear integrity costs, so they're alarmed.
   - Artists bear appropriation costs, so they feel moral outrage.
   - Workers bear displacement risk, so they're hostile to management.
   - Tinkerers bear almost none of these costs and gain control, so they're enthusiastic.
   - Sentiment is close to a map of **where each group sits in the cost-benefit distribution**, not of how good the technology is.
5. **"Slop" marks a shift.** It turned a private irritation into a shared cultural label. Once a pejorative sticks, as with "spam" or "clickbait", it changes norms: platforms label content, and creators signal "human-made".
6. **Perception can diverge from measurement.** METR shows felt productivity can diverge from measured productivity. The sycophancy episode shows *liking* the model can diverge from the model *being good for you*. Both mean sentiment data, Reddit included, is not a proxy for actual value.

---

## 6. What this analysis cannot tell you

- **Non-Reddit, non-English, and offline populations.** The Ipsos and KPMG data suggest the Global South is markedly more optimistic. My Reddit sample can't see that.
- **Silent satisfied users.** Most of the ~half of US adults who use chatbots never post about it. Reddit over-represents strong feelings.
- **Comment-level sentiment.** I analysed posts only. Comments would add depth, but the archive API's keyword search timed out, and full comment pulls were out of scope.
- **Causation.** Sentiment trends align with events, but I haven't established that the events *caused* the shifts.
- **Hacker News, X/Twitter, TikTok.** Not covered directly. A MotherDuck analysis of HN sentiment toward AI labs exists, but I couldn't access its results.

---

## Sources

**Primary data**
- Reddit posts via the Arctic Shift archive API: https://arctic-shift.photon-reddit.com (docs: https://github.com/ArthurHeitmann/arctic_shift)

**Surveys and studies**
- Pew, *Americans and AI 2026*: https://www.pewresearch.org/internet/2026/06/17/americans-and-ai-2026-chatbots-smart-devices-and-views-on-impact/
- Pew, *Young US adults are increasingly wary of AI* (Aug 2026): https://www.pewresearch.org/short-reads/2026/08/18/young-adults-in-the-us-are-increasingly-wary-of-ai-concerned-it-will-take-jobs/
- Pew, *Young adults around the world have mixed feelings about AI* (Sep 2026): https://www.pewresearch.org/global/2026/09/17/what-do-young-people-around-the-world-think-about-ai/
- Pew experts vs public (Apr 2025), secondary coverage: https://www.eweek.com/news/ai-optimism-fear-regulation-pew-research-center/
- Pew teens and ChatGPT for schoolwork: https://www.pewresearch.org/short-reads/2023/11/16/about-1-in-5-us-teens-whove-heard-of-chatgpt-have-used-it-for-schoolwork/ and https://www.eweek.com/news/teens-ai-chatbot-use-pew-survey/
- Stack Overflow 2025 Developer Survey: https://stackoverflow.co/company/press/archive/stack-overflow-2025-developer-survey/ and https://stackoverflow.blog/developer-survey/
- METR developer RCT, secondary coverage: https://newsletter.getdx.com/p/unpacking-metr-findings-does-ai-slow-developers-down
- KPMG / University of Melbourne global trust study 2025: https://mbs.edu/faculty-and-research/trust-and-ai and https://www.prismnews.com/workplace/kpmg/kpmg-study-finds-global-ai-trust-at-46-higher-in-emerging
- Ipsos AI Monitor 2025/2026: https://www.ipsos.com/en-id/press-release-ipsos-ai-monitor-2025 and https://www.ipsos.com/en-ca/global-attitudes-ai-2026-wonder-vs-worry-divide-deepens
- Poll compilation (Gallup data centers, NBC, Gallup/Walton Gen Z, etc.): https://www.thealgorithmicbridge.com/p/how-america-turned-against-ai-according
- Axios on data-center backlash: https://www.axios.com/2026/08/19/data-centers-ai-political-opinion
- Gallup/SCSP and Bentley-Gallup trust figures (secondary): https://www.longtermwiki.com/resources/24a4a75bbecb01ca
- Carnegie Learning 2025 AI in Ed Report: https://discover.carnegielearning.com/hubfs/PDFs/Whitepaper%20and%20Guide%20PDFs/2025-AI-in-Ed-Report.pdf
- Statista, compensating artists (2023): https://www.statista.com/statistics/1400650/perception-of-copying-artists-work-using-ai-us

**Academic Reddit analyses (for comparison)**
- Xu et al., PLOS ONE, *The public attitude towards ChatGPT on Reddit* (2023 data; ~62% favourable): https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0302502
- *Public Opinions on ChatGPT: Reddit SWOT analysis* (202,905 r/ChatGPT comments, Dec 2022 to Dec 2023): https://direct.mit.edu/dint/article/6/2/344/120373/Public-Opinions-on-ChatGPT-An-Analysis-of-Reddit
- ChatGPT in mental health on Reddit, *negative sentiments increase over time*: https://arxiv.org/pdf/2311.15800
- ChatGPT vs DeepSeek Reddit perceptions: https://arxiv.org/abs/2502.18513

**Events**
- Sycophancy rollback, CNN (May 2025): https://edition.cnn.com/2025/05/02/tech/sycophantic-chatgpt-intl-scli
- GPT-5 / GPT-4o backlash: https://tech.yahoo.com/ai/articles/sam-altman-openai-bring-back-204853427.html and https://www.theneuron.ai/newsletter/the-gpt-5-fallout-explained/
- "ChatGPT getting dumber" study coverage (Jul 2023): https://futurism.com/the-byte/stanford-chatgpt-getting-dumber
- AI delusion lawsuits (Nov 2025): https://techjusticelaw.org/2025/12/03/seven-ai-delusional-disorder-cases-shamblin-irwin-fox-enneking-madden-brooks-and-lacey-v-openai-et-al
- PBS on "AI psychosis": https://www.pbs.org/newshour/show/what-to-know-about-ai-psychosis-and-the-effect-of-ai-chatbots-on-mental-health
- Replika and AI companion research summary: https://www.sexandpsychology.com/blog/2025/7/23/what-its-like-to-date-an-ai-chatbot/
