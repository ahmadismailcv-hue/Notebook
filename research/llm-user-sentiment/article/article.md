# We Use It More and Like It Less: Four Years of How People Actually Feel About AI Chatbots

*What 112,000 Reddit posts and a stack of surveys say about the public's relationship with large language models, from ChatGPT's launch to today.*

On 30 November 2022, OpenAI released ChatGPT as a "research preview". Within days, r/writing had a thread titled "Despair about AI". On r/Teachers, someone posted: "TIL a computer can write a better essay than my high school students… in 10 seconds." On r/ChatGPT, the mood was closer to a fairground: people got it to write offensive jokes and rap battles, and tried to jailbreak it into saying things it wasn't supposed to.

Nearly four years later, about half of American adults have used an AI chatbot. And by most measures, the public is more uneasy about the technology than it was when almost nobody used it.

That's the central paradox of the LLM era, and I wanted to understand it properly. Opinion polls only tell you *what* people say. They don't tell you *why*, or how different groups have moved over time. So I did two things:

1. **I collected about 112,000 Reddit posts** from 19 communities between December 2022 and September 2026. They range from AI fan forums (r/ChatGPT, r/singularity) to teachers, programmers, artists, workers and people who have AI companions. I scored each post for sentiment and tagged it for recurring themes.
2. **I set that against published data** from Pew Research, Gallup, Stack Overflow, KPMG and the University of Melbourne, Ipsos, METR and several academic studies of Reddit.

The short version: **there isn't one public opinion about AI. There are at least eight, and they diverge for predictable reasons.**

---

## How to read the numbers (the honest caveats first)

Before any findings, a word on method, because this kind of analysis is easy to oversell.

- **Reddit is not the public.** It skews young, male, English-speaking and very online. Every subreddit is a self-selected community, and some are openly partisan. r/ArtistHate is anti-AI by design. r/singularity leans strongly towards acceleration. Treat each one as a *voice*, not a representative sample.
- **Automated sentiment scoring is crude.** I used VADER, a standard lexicon-based tool. It misses sarcasm, and it's skewed by writing style. A long, polite career-advice post can score "positive" even when the writer is anxious. So the meaningful signals are **changes within a group over time** and **which topics come up**, not whether one group's average is higher than another's.
- **Sampling windows can hit big events.** I sampled one week every other month. The August 2025 window happened to land in the week of GPT-5's launch. That amplifies spikes, though it doesn't invent them.
- **Post titles are evidence of what people discussed**, not proof that the events they describe happened.

Where survey data exists, I lean on it for population-level claims, and I use Reddit for texture and for timing.

---

## The arc: five phases in four years

Taken together, the data falls into five broad phases.

**1. Wonder (Dec 2022 to mid 2023).** Astonishment and play. The most-upvoted posts were screenshots of clever outputs and jailbreaks. A developer's post titled "As a Dev, I am astounded" drew over a thousand comments. Even sceptics were mostly arguing about how big the change would be, not whether it was real.

**2. First disillusion (mid 2023 to 2024).** Users began to notice the model *changing under them*. In July 2023, Stanford and Berkeley researchers published a paper reporting that GPT-4's accuracy on some tasks had dropped sharply between March and June. "So, they finally accepted the fact that GPT-4 got dumber lol!" was one of r/ChatGPT's top posts that summer. By late 2023, OpenAI said it was investigating complaints that ChatGPT had become "lazy". Hallucinations went from a curiosity to a reputational problem.

**3. Normalisation and polarisation (2024 to mid 2025).** Daily use spread, and so did the backlash. The word "slop" entered common use for low-effort AI-generated content. Copyright fights escalated. Developers adopted AI tools en masse while trusting them less.

**4. Attachment and its costs (2025).** The relationship itself became the story. In April 2025, OpenAI rolled back a ChatGPT update after users showed it praising almost anything, including one person's decision to stop taking their medication. OpenAI admitted it had "focused too much on short-term feedback". In August 2025, GPT-5 replaced GPT-4o. The backlash was immediate and emotional enough that OpenAI brought the old model back within days. Lawsuits followed, alleging that chatbot conversations had contributed to suicides and delusional episodes.

**5. Political economy (late 2025 to 2026).** The conversation shifted from *what the model does* to *who it serves*: jobs, electricity bills, data centers, copyright, and the people running AI companies. By May 2026, a Gallup poll found that **71% of Americans would oppose an AI data center being built in their area**.

---

## The paradox in numbers: more use, more worry

If you remember one chart from this piece, make it this one.

| | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 |
|---|---|---|---|---|---|---|
| US adults who have used ChatGPT | – | – | 18% | 23% | 34% | 44% |
| US adults "more concerned than excited" about AI | 37% | 38% | 52% | 51% | 50% | 52% |
| …among 18 to 29 year olds | 31% | 29% | 42% | 39% | 47% | **55%** |

*Source: Pew Research Center.*

Concern jumped the year ChatGPT arrived and has never come down, even as usage more than doubled. The developer world shows the same pattern. In Stack Overflow's 2025 survey, **84% of developers** used or planned to use AI tools, up from 76%. Over the same year, the share who *distrust* the accuracy of AI output rose from **31% to 46%**.

People aren't rejecting the tool. They're using it while resenting the terms on which they use it. That relationship looks less like the one people have with a beloved gadget and more like the one they have with a bank, an airline or a social network: dependent, but not loyal.

---

## Eight publics: how different groups feel, and why

### 1. The enthusiasts: loyal opposition

*r/ChatGPT, r/singularity, r/OpenAI, r/ClaudeAI*

You'd expect the fan communities to be the happiest, and in many ways they are. But their mood has changed character. In 2023, the share of posts about AGI, superintelligence and existential risk was around 4 to 5%. By 2026 it had fallen to about 1%. Over the same period, posts about **productivity** roughly quadrupled, and posts about **pricing and usage limits** doubled.

In other words, this community moved from *speculating about the future* to *managing a tool and a bill*.

Their negativity is consumer negativity. The recurring flashpoints were all **changes imposed without consent**: models getting "nerfed", new refusals, usage caps, and above all the GPT-5 transition. During the launch week, two of the most-upvoted posts in my sample were "OpenAI just pulled the biggest bait-and-switch in AI history and I'm done" and "Deleted my subscription after two years." Sam Altman later conceded the company had "underestimated how much certain aspects of GPT-4o matter" to users.

The same episode split the community. Some users were openly grieving a model that had felt like a friend. Others mocked them: "When GPT-5 acts like an AI assistant and not my personal therapist/anime waifu roleplayer…"

**Reading:** this group complains *because* it's invested. Its anger is a churn signal, not a rejection of the technology.

### 2. The tinkerers: enthusiasm as control

*r/LocalLLaMA*

The single most consistently positive community in the dataset is the one that runs open-weight models on its own hardware. Between 53% and 70% of its posts scored positive, and only 9 to 20% negative.

The enthusiasm isn't about AI in general. It's about **ownership**: no rate limits, no surprise model swaps, no refusals, no data leaving the machine. One popular post mocked a closed model "so safe it won't answer 'What is 2+2'". Another declared, "LocalLLaMA is the last sane place to discuss LLMs on this site, I swear." For this community, every controversy at a big lab is an argument for running your own model.

There's a geopolitical twist. By 2025, a highly upvoted post observed that "the top open models are now all by Chinese companies". Much of the hobbyist excitement now runs on Qwen and DeepSeek models. The community is aware of censorship baked into those models, but sees self-hosting and fine-tuning as the fix.

**Reading:** think early Linux, or the home-brew computer clubs of the 1970s. Satisfaction tracks **control**, not capability.

### 3. Software developers: useful, untrustworthy, oversold

*r/programming, r/ExperiencedDevs, r/cscareerquestions*

Developers are arguably the best-calibrated group in this story. They use LLM output every day, and unlike most users, they find out quickly when it's wrong.

Their mood splits by career stage:

- **Senior developers are sceptical of the tools and of management's enthusiasm.** Representative posts: "How do I convince our CEO we can't replace our dev team with AI?" (2024), "Anyone sick of hearing 'vibe coding'?" (2025), and, with some dark humour, "Thanks to all the AI coders out there, I'm busier than I've been in years" (2025).
- **Junior developers are anxious about the job market.** "Why No One Wants Junior Engineers" (2024). "The computer science dream has become a nightmare" (2025). Not everyone agreed: "No, AI Isn't The Reason You Can't Find A Job" was also highly upvoted.

The share of developers' AI-related posts that mention jobs or layoffs climbed from about 20% in early 2023 to **33% in early 2026 and 41% in the second half of the year**. Negative posts more than tripled as a share.

The research backs up the scepticism. In Stack Overflow's 2025 survey, the most common frustration (66%) was AI output that is "almost right, but not quite". The most striking evidence is a small randomised trial by METR in 2025. Experienced open-source developers were **19% slower** on real tasks when allowed to use AI tools, yet afterwards *believed* they had been about 20% faster. It's one study with 16 participants, and METR now describes it as historical given how fast tools have changed. But it shows something important: **how productive AI feels and how productive it measurably is can point in opposite directions.**

### 4. Teachers and professors: carrying the cost

*r/Teachers, r/Professors*

No group's conversation is as dominated by a single theme. In 2023 and 2024, **between 22% and 27%** of educators' AI-related posts were about cheating and academic integrity.

The emotional peak in my sample came in early 2024, from a post bluntly titled "AI is making children dumb as fuck." It drew over 10,000 upvotes and 1,800 comments. Others: "60% of my son's 6th grade class used ChatGPT on their final essay" (2023). "This semester I learned that my students can't write and that I'm an evil bastard" (2024).

But the story doesn't end in despair. By 2025, adaptation stories were rising. One professor wrote that they were "back to actually enjoying and believing in teaching again after transforming my classes — and AI usage is now a non-concern." Others swapped tactics, such as hiding "AI Trojan horse" instructions in assignments to catch copy-pasted prompts.

In 2026 a new grievance emerged: institutions pushing AI onto *staff*. "I am SO F###ing sick of my university forcing AI down my throat" was among the year's top posts.

Survey data fills in the picture. Pew found the share of US teens using ChatGPT for schoolwork doubled from 13% to 26% between 2023 and 2024, yet only 18% of teens thought using it to write essays was acceptable. Carnegie Learning's 2025 report found the share of educators who had dealt with AI cheating rose from 53% to 61%.

**Reading:** teachers bear the *costs* of a tool whose *benefits* go mainly to students trying to get grades with less effort. That incentive mismatch, not technophobia, explains their mood.

### 5. Artists and writers: a moral injury

*r/ArtistHate, r/writing, and the debate forum r/aiwars*

For creative communities, the core objection isn't quality. It's **consent**. Copyright and "theft" themes appear in 7 to 9% of posts in every period I sampled. This was the first group whose average sentiment turned net-negative, in the second half of 2024.

Over time the argument has widened. In 2023 it was mainly "you trained on my work without asking". By 2026, the word "slop" had grown from essentially zero to about 6% of posts, and the complaint had become "you're polluting the commons". One 2026 post captured it: someone searching for a photo of an unfamiliar animal found the top result was AI-generated, and wrong.

r/aiwars, where pro- and anti-AI camps argue, tells its own story. Its sampled volume grew roughly ninefold between 2023 and 2026, and its share of negative posts rose from 27% to 40%. **The argument is growing, not resolving.**

The broader public largely sides with the creatives. In a 2023 survey, 70% of US adults said artists should be compensated if their work is used to train AI.

**Reading:** the historical parallel is the Luddites, properly understood. They were skilled textile workers protesting the collapse of their wages, not people who hated machines. The creative backlash is fundamentally about **who captures the value** of the work these systems were trained on. Calling it fear of technology misreads it.

### 6. The general tech-news public: from product to power

*r/technology, r/Futurology*

This is where the decline is clearest. Average sentiment in these communities fell steadily from +0.13 in late 2023 to slightly *below zero* by 2026. The share of negative posts rose from about 21% to 35%.

What's striking is how the *topics* rotated:

- **2023: misinformation.** "Stop treating ChatGPT like it knows anything." Noam Chomsky calling it "basically high-tech plagiarism."
- **2024: corporate misuse.** Reports of insurers using AI to deny medical claims.
- **2025: copyright and bubbles.** Court records showing Meta downloaded about 82 TB of pirated books for training. Analysts warning about an AI bubble bigger than the dot-com era.
- **2026: energy and data centers.** This theme went from essentially absent to about 7% of AI posts, with headlines about gigawatt-scale power plants and communities being bypassed on planning decisions.

**Reading:** this group reacts to *institutions*, not models. Its trajectory tracks AI's transformation from a product story into a power story: whose electricity, whose books, whose jobs.

### 7. Workers: AI as the boss's tool

*r/antiwork*

In workers' communities, between 40% and 52% of AI-related posts concern jobs. The framing is consistent: the problem isn't what the model can do, but **who decides how it's used, and who keeps the gains**.

The posts that resonated most were about AI as an instrument of management: automated rejection letters ("Got an AI rejection letter for… being born on the wrong date", 2023), being asked to train one's own replacement, and companies that automated staff away and then quietly rehired them. By 2026 the headlines shared there described active resistance. Examples: "Gen Z workers are so fearful AI will take their job they're intentionally sabotaging their company's AI rollout", and a story about a tech executive angry that employees wanted time off because AI had made them more efficient.

The samples here are small, so treat the percentages loosely. But the surveys point the same way. Pew found the share of Americans expecting AI to mean *fewer* jobs over the next 20 years rose from 64% to 71% between 2024 and 2026, and from 61% to 73% among 18 to 29 year olds. The KPMG/Melbourne global study reported that more than half of workers who use AI hide it from their employers.

### 8. Companion users: attachment, repeatedly broken

*r/CharacterAI, r/replika, r/MyBoyfriendIsAI*

The most emotionally intense conversations in the dataset come from people who use AI for companionship and roleplay. Here, negativity rose from about 20% of posts in 2022 to 38% in 2026. Most of it isn't aimed at the companion itself. It's aimed at **the company behind it**.

The pattern repeats: a platform makes a sudden change to who the companion *is*, and users experience it as a loss.

- **February 2023:** Replika removed erotic roleplay. Its subreddit's activity surged, filled with distress.
- **2024:** Character.AI's filter wars, e.g. "17+ yet kissing is filtered?"
- **August 2025:** GPT-4o's removal hit ChatGPT users who'd built relationships with it. Mentions of companionship and attachment peaked at that point in my data.
- **2026:** Character.AI's age verification locked some users out. "Uhh they asked me my age and they kicked me??"

Meanwhile r/MyBoyfriendIsAI, a community for people in AI relationships, is among the most *positive* spaces in the dataset. It's a supportive in-group whose members often feel judged by outsiders.

The research is genuinely mixed:

- **Some evidence of benefit.** In a survey of over 1,000 student Replika users, 3% said the app had halted suicidal thoughts. A four-week trial found small reductions in loneliness.
- **Evidence of harm.** Researchers have also documented dependency, and the 2025 lawsuits allege far worse. "AI psychosis" isn't a clinical diagnosis, and the label is contested.

**Reading:** this is where a product's incentives and a user's long-term wellbeing can diverge most directly. A model optimised to be warm, agreeable and engaging can be exactly the wrong thing for a lonely or vulnerable person. OpenAI's sycophancy rollback was, in effect, a public admission of that tension.

---

## What the surveys add

Reddit shows intensity. Surveys show breadth. A few findings stand out:

- **The age reversal.** In 2021 and 2022, young Americans were *less* worried about AI than average. By 2026 they are the *most* worried: 55% of 18 to 29 year olds are more concerned than excited, against 52% overall. Pew attributes this mainly to job fears. Gallup's 2026 youth survey found excitement about AI among 14 to 29 year olds had fallen to 22%, while anger had risen to 31%. The heaviest users are now the most anxious. That isn't a contradiction. It's a rational response from people entering a labour market the technology may reshape.
- **The expert-public gap.** In Pew's 2024 fieldwork, **47% of AI experts** said they were more excited than concerned about AI. Only **11% of the public** said the same. Experts were three times as likely to expect AI to improve how people work (73% vs 23%). When the people building a technology and the people living with it diverge this sharply, history suggests regulation and organised backlash tend to follow. Nuclear power in the 1970s and GM crops in the 1990s are the obvious precedents.
- **Modest perceived benefits.** Asked whether chatbots help or hurt, Americans in 2026 said they help productivity (30% vs 5%) and staying informed (28% vs 5%). On relationships the answer was a wash (6% vs 7%).
- **The world isn't uniform.** Ipsos and KPMG data show people in Asia, Latin America and emerging economies are markedly more optimistic than people in Europe and North America. The KPMG/Melbourne study put trust in AI at 57% in emerging economies against 39% in advanced ones. Much of the gloom in this piece is a rich-country phenomenon.

---

## Six patterns underneath it all

**1. Using it doesn't mean liking it.** Students, workers and developers often adopt AI because of competitive pressure, not enthusiasm. Low switching costs plus high dependence produce a brittle kind of loyalty. People stay until something better or cheaper arrives, and resent it while they stay.

**2. The complaints moved from the model to the institutions.** In 2023, people complained about *outputs*: hallucinations, refusals, "getting dumber". In 2026 they complain about *power*: jobs, data centers, copyright, executives, mandates. Better models can fix the first set of complaints. They do nothing for the second.

**3. Breaking the relationship hurts more than bad answers.** The loudest backlashes weren't about wrong answers. They were about **sudden, unilateral changes to something people had adapted to**: Replika in 2023, the "lazy" GPT-4 period, the sycophancy rollback, GPT-5 replacing GPT-4o, Character.AI's age gate. Users experience a model swap the way people experience a forced software migration at work, or a friend whose personality suddenly changes.

**4. Each group judges AI by who bears the cost.**

- Developers bear the cost of *checking* output, so they're sceptical of quality.
- Teachers bear the cost of *integrity*, so they're alarmed.
- Artists bear the cost of *appropriation*, so they're morally outraged.
- Workers bear the *displacement risk*, so they're hostile to management.
- Hobbyists running their own models bear almost none of these costs and gain control, so they're enthusiastic.

Sentiment maps closely onto where each group sits in that cost-benefit distribution. It says less about the technology itself than you might think.

**5. "Slop" marked a cultural turning point.** A shared pejorative turns private irritation into a public norm. "Spam" and "clickbait" did the same in earlier eras, and both eventually changed how platforms and publishers behaved. Expect "human-made" to become a marketing claim, and AI labelling to become an expectation.

**6. Feeling isn't the same as value.** METR showed that perceived productivity can diverge from measured productivity. The sycophancy episode showed that *liking* a model can diverge from it being *good for you*. Both are reminders that sentiment, including everything in this article, isn't a direct measure of whether AI is actually helping.

---

## What this means

For **AI companies**, the lesson is uncomfortable. Capability improvements don't buy goodwill on their own. The fastest ways to lose users have been unilateral changes, opaque limits and products tuned for engagement over wellbeing. Meanwhile the fastest-growing grievances (jobs, energy, copyright, concentrated power) aren't product problems at all.

For **employers and institutions**, top-down AI mandates are now a source of resentment in their own right. Teachers, developers and office workers all describe tools being pushed on them faster than trust can form. Ignoring that invites quiet non-compliance, which some of the 2026 posts suggest is already happening.

For **everyone else**, the useful question isn't "is AI good or bad?" It's **"who carries the costs, who captures the benefits, and who gets to decide?"** Groups' feelings about AI track their answers to that question remarkably closely.

---

## What this analysis can't tell you

In the spirit of honesty:

- It can't see the many satisfied users who never post online, or people outside the English-speaking internet.
- I analysed posts, not comment threads, which often carry the more nuanced arguments.
- It doesn't cover X/Twitter, TikTok or Hacker News directly.
- It shows that sentiment moved *alongside* events. It doesn't prove the events *caused* the shifts.

---

## Methodology and sources

**Reddit data:** about 112,000 posts collected through the Arctic Shift Reddit archive. Sampling: one six-day window every other month per subreddit, December 2022 to August 2026, from 19 communities: r/ChatGPT, r/singularity, r/OpenAI, r/ClaudeAI, r/LocalLLaMA, r/programming, r/ExperiencedDevs, r/cscareerquestions, r/Teachers, r/Professors, r/ArtistHate, r/writing, r/aiwars, r/technology, r/Futurology, r/antiwork, r/CharacterAI, r/replika and r/MyBoyfriendIsAI. Posts in subreddits not focused on AI were included only if they mentioned AI. Sentiment was scored with VADER, and themes were tagged with keyword lexicons.

**Surveys and studies:**

- Pew Research Center: [Americans and AI 2026](https://www.pewresearch.org/internet/2026/06/17/americans-and-ai-2026-chatbots-smart-devices-and-views-on-impact/); [Young US adults are increasingly wary of AI](https://www.pewresearch.org/short-reads/2026/08/18/young-adults-in-the-us-are-increasingly-wary-of-ai-concerned-it-will-take-jobs/); [Young adults around the world have mixed feelings about AI](https://www.pewresearch.org/global/2026/09/17/what-do-young-people-around-the-world-think-about-ai/); [teens and ChatGPT for schoolwork](https://www.pewresearch.org/short-reads/2023/11/16/about-1-in-5-us-teens-whove-heard-of-chatgpt-have-used-it-for-schoolwork/); experts vs public, via [eWeek](https://www.eweek.com/news/ai-optimism-fear-regulation-pew-research-center/)
- [Stack Overflow 2025 Developer Survey](https://stackoverflow.co/company/press/archive/stack-overflow-2025-developer-survey/)
- METR developer productivity study, via [DX](https://newsletter.getdx.com/p/unpacking-metr-findings-does-ai-slow-developers-down)
- [KPMG / University of Melbourne, Trust in AI 2025](https://mbs.edu/faculty-and-research/trust-and-ai)
- [Ipsos AI Monitor 2026](https://www.ipsos.com/en-ca/global-attitudes-ai-2026-wonder-vs-worry-divide-deepens)
- Gallup data-center and youth polling, compiled by [The Algorithmic Bridge](https://www.thealgorithmicbridge.com/p/how-america-turned-against-ai-according); [Axios on data-center backlash](https://www.axios.com/2026/08/19/data-centers-ai-political-opinion)
- [Carnegie Learning, 2025 State of AI in Education](https://discover.carnegielearning.com/hubfs/PDFs/Whitepaper%20and%20Guide%20PDFs/2025-AI-in-Ed-Report.pdf)
- [CNN on the ChatGPT sycophancy rollback](https://edition.cnn.com/2025/05/02/tech/sycophantic-chatgpt-intl-scli)
- [Coverage of the GPT-5 / GPT-4o backlash](https://www.theneuron.ai/newsletter/the-gpt-5-fallout-explained/)
- [Tech Justice Law Project on the 2025 lawsuits](https://techjusticelaw.org/2025/12/03/seven-ai-delusional-disorder-cases-shamblin-irwin-fox-enneking-madden-brooks-and-lacey-v-openai-et-al)
- Academic Reddit studies: [PLOS ONE (2024)](https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0302502); [Data Intelligence (2024)](https://direct.mit.edu/dint/article/6/2/344/120373/Public-Opinions-on-ChatGPT-An-Analysis-of-Reddit); [arXiv 2311.15800](https://arxiv.org/pdf/2311.15800); [arXiv 2502.18513](https://arxiv.org/abs/2502.18513)
