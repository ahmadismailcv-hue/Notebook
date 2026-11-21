# Writes sql/seed_examples_more.sql: example tips so each category has 20 (with seed_examples.sql).
# Every row is is_sample with a made-up display name, shown with an "Example" label.
# Based on common real-world uses reported on forums, council and ombudsman guidance, and news. Not anyone's real post.
# Run: python3 sql/gen_examples_more.py
import random, pathlib
random.seed(21)
TOOL = {"chatgpt": "ChatGPT", "copilot": "Microsoft Copilot", "gemini": "Google Gemini", "claude": "Claude", "other": "Meta AI"}
P = []
def t(board, author, tool, title, task, body, prompt, checks, before, after, tags):
    P.append((board, author, tool, title, task, body, prompt, checks, before, after, tags))

# ---------------- money (18 more; 2 already) ----------------
B = "money"
t(B,"rach_w","chatgpt","Finding the direct debits I'd forgotten about","Spot regular payments I no longer use",
  "I typed out my direct debits and card subscriptions from my banking app, just the company names and amounts. ChatGPT grouped them and flagged anything that looked like a duplicate or a free trial that had rolled over. It found two streaming services and a phone insurance I'd forgotten. I cancelled them myself in the apps.",
  "Here is a list of my regular payments, company name and monthly amount only. Group them by type, total each group, and flag any that look like duplicates or things people often forget to cancel. [list of payments]",
  "I checked each one in my banking app before cancelling.","Money going out I couldn't account for","Cancelled three payments I didn't need","{subscriptions,budget}")
t(B,"gary_t","copilot","Asking my energy supplier to lower my direct debit","Ask my supplier to review a direct debit that went up",
  "My monthly payment jumped even though my account was in credit. Copilot helped me write a short message asking them to recalculate it from my actual meter readings. I sent it through their online account with photos of the meters. They lowered it the following week.",
  "Write a short, polite message to my energy supplier. My direct debit went up from [old amount] to [new amount], but my account is in credit by [amount]. Ask them to review it using my latest meter readings, which I have attached.",
  "I read Ofgem's page on direct debits first.","Direct debit raised while in credit","Payment reduced after one message","{energy,direct-debit}")
t(B,"nadia_s","claude","Understanding my Universal Credit statement","Work out why my Universal Credit payment was lower",
  "The statement listed deductions I didn't recognise. I typed out the headings and amounts, with no reference numbers, and asked Claude to explain each one. It explained that an advance was being paid back and how earnings are taken off. I then asked my work coach in my journal and they confirmed it.",
  "Explain this Universal Credit statement in plain English. What is each deduction for, and what questions should I ask my work coach? [type the headings and amounts only]",
  "My work coach confirmed it in my journal.","A lower payment and no idea why","Knew what each deduction was for","{universal-credit,benefits}")
t(B,"bev_m","chatgpt","A script for ringing a company I owed money to","Agree an affordable repayment on a catalogue debt",
  "I was dreading the call. I asked ChatGPT for a short script covering what I could afford and what to ask for. Having it written down kept me calm on the phone and they agreed a lower monthly amount. I spoke to a free debt charity first as well.",
  "Help me plan a phone call to a company I owe money to. I can afford [amount] a month. Give me a short script: what to say first, what to ask for, and what to say if they say no. Keep it calm and simple.",
  "I got free advice from StepChange before calling.","Too anxious to pick up the phone","Agreed a payment I can manage","{debt,phone-calls}")
t(B,"owen_p","gemini","Comparing two broadband deals over the whole contract","Compare two broadband offers properly",
  "Two deals looked almost the same, but one had a price rise part way through. I pasted the details of both and asked Gemini to work out the total over the full contract. The cheaper-looking one actually cost more over two years.",
  "Compare these two broadband deals. Work out the total cost over the full contract, including set-up fees and any price rises. Show the working. [paste the details of each deal]",
  "I checked the sums with a calculator.","Two deals that looked the same","Picked the one that's cheaper overall","{broadband,comparing}")
t(B,"sue_h","copilot","Finding out about the council tax discount for living alone","Understand the single person discount",
  "My partner moved out and I wasn't sure what to do about council tax. Copilot explained the single person discount in general terms and listed what the council would probably ask for. I then applied on my council's website.",
  "I now live alone in England. Explain in plain English how the council tax single person discount works and what information councils usually ask for. Tell me what to look for on my council's website.",
  "I read my council's own page before applying.","Paying full council tax while living alone","Applied for the discount online","{council-tax,discounts}")
t(B,"jas_k","chatgpt","Making sense of my first payslip","Understand the deductions on my payslip",
  "First job with a proper payslip and I didn't know what the tax code or NI meant. I typed the headings and figures, without my National Insurance number, and asked for a plain explanation. It also told me how to check my tax code on GOV.UK, which I did.",
  "Explain each line of this payslip in plain English, as if I've never had a job before. What is a tax code and how can I check mine is right? [type the headings and amounts only]",
  "I checked my tax code in my personal tax account on GOV.UK.","A payslip full of codes","Understood every line","{payslip,tax}")
t(B,"mo_ahmed","gemini","Planning a week of meals on a tight budget","Plan a week of meals for a set amount",
  "I had a fixed amount for the week. Gemini planned meals around cheap basics and reused ingredients, then gave me a shopping list grouped by type. Some of its prices were out, so I checked them in the supermarket app before going.",
  "Plan 7 days of simple evening meals for [number] people for about [amount] in total. Use cheap basics and reuse ingredients. Give me a shopping list grouped by type.",
  "I checked the prices in the supermarket app.","Overspending on the weekly shop","A meal plan that fitted the budget","{food,budget}")
t(B,"pat_d","claude","Claiming money back for a cancelled train","Claim a refund for a cancelled train",
  "My train was cancelled and I didn't think I could claim. Claude explained how delay and cancellation refunds usually work and helped me write the short notes for the claim form. I submitted it on the train company's website and the refund arrived.",
  "My train from [station] to [station] on [date] was cancelled. Explain in plain English how train delay and cancellation refunds usually work in Great Britain, and help me write short notes for the claim form.",
  "I read the train company's own Delay Repay page.","Didn't think I could claim","Refund paid to my card","{trains,refunds}")
t(B,"lin_c","chatgpt","Working out which bills to pay first","Decide which bills come first when money is short",
  "I couldn't pay everything one month. ChatGPT explained the difference between priority bills, like rent and council tax, and the rest. I used that to put my list in order, then checked it against Citizens Advice, which said the same.",
  "I can't pay all my bills this month. Explain which kinds of bills are usually treated as priority debts in the UK and why. Then help me put my list in order. [list bills and amounts]",
  "I checked the Citizens Advice page on priority debts.","Didn't know what to pay first","A clear order to pay in","{debt,bills}")
t(B,"frank_o","copilot","Understanding a tax letter about my pension","Understand an HMRC Simple Assessment letter",
  "I got a letter saying I owed tax on my pension and panicked. Copilot explained what a Simple Assessment is and which figures to check. I compared them with my pension statement, they matched, and I paid it online before the deadline.",
  "Explain this HMRC letter in plain English. What is it asking for, which figures should I check, and what is the deadline? [type the letter without your name, address or reference numbers]",
  "I checked the figures against my pension statement.","A tax bill I didn't expect","Checked the figures and paid on time","{hmrc,pension}")
t(B,"kerry_b","gemini","Checking if I was missing out on benefits as a carer","Find out what support carers often miss",
  "Gemini listed benefits that carers often don't claim and pointed me to the free benefits calculators. I used one of the calculators listed on GOV.UK and found I could claim Carer's Allowance. I applied the same week.",
  "I'm [age] and care for [who] for about [hours] hours a week. What UK benefits do people in my situation often miss? Don't tell me I definitely qualify. Point me to official calculators.",
  "I used an independent benefits calculator listed on GOV.UK.","Not claiming anything as a carer","Applied for Carer's Allowance","{carers,benefits}")
t(B,"dee_r","chatgpt","Splitting bills fairly between flatmates","Split household bills between three of us",
  "We kept arguing about who owed what. I gave ChatGPT the bills and who was away which months, and it made a table with the working. We all agreed it was fair and now update it every three months.",
  "Split these household bills fairly between [number] flatmates. [name] was away for [weeks]. Show a table of who owes what, with the working. [list bills and amounts]",
  "We all checked the table together.","Arguments over bills","A table everyone agreed on","{flatmates,bills}")
t(B,"ian_g","claude","What to ask the bank about a payment I didn't make","Prepare for a call about an unknown card payment",
  "I saw a card payment I didn't recognise. I asked Claude only what questions to ask, then rang the number on the back of my card straight away. They blocked the card and refunded the money.",
  "There's a card payment on my statement I don't recognise. What should I say and ask when I call my bank? Keep it short.",
  "I only used the number on the back of my card.","A payment I didn't make","Card blocked and money refunded","{banking,fraud}")
t(B,"hana_y","copilot","A simple plan to save for Christmas","Work out how much to save each week",
  "Copilot worked out the weekly amount from now until December and suggested setting up a separate savings pot so it happens automatically. Simple maths, but it got me to actually start.",
  "I want to save [amount] by [date]. How much is that per week and per month? Suggest simple ways to make it automatic.",
  "I checked the maths myself.","Christmas always went on the credit card","Saving a set amount every Friday","{saving,christmas}")
t(B,"al_moore","chatgpt","Appealing a parking charge for parking I'd paid for","Appeal a private parking charge",
  "The machine took my money but didn't register it. ChatGPT helped me write a short appeal with the facts, and I attached my bank statement. I made sure it didn't add any legal claims I couldn't back up. The company cancelled the charge.",
  "Write a short appeal to a private parking company. On [date] I paid for parking at [car park] but received a charge. I have a bank statement showing the payment. Stick to the facts and don't invent any laws.",
  "I read the parking appeals advice on Citizens Advice.","A charge for parking I'd paid for","Charge cancelled","{parking,appeals}")
t(B,"rosa_v","gemini","Understanding the jargon in my pension statement","Understand my yearly pension statement",
  "Lots of terms like projected value and transfer value. Gemini explained each one in plain words. I wrote down two questions and asked the pension provider on the phone.",
  "Explain these terms from my pension statement in plain English: [list the terms]. What questions should I ask my provider?",
  "The pension provider answered my questions on the phone.","A statement I used to file without reading","Knew what my pension might be worth","{pension,jargon}")
t(B,"tom_f","other","Comparing the running costs of two washing machines","Compare yearly running costs before buying",
  "I asked Meta AI in WhatsApp to compare the yearly running cost of two machines using the figures on the energy labels. It showed the sums. The dearer machine would pay for itself in about four years.",
  "Compare the yearly running cost of two washing machines. Machine A uses [kWh] a year, machine B uses [kWh]. My electricity costs [price] per kWh. Show the working.",
  "I checked the energy label figures in the shop.","Going for the cheapest price tag","Bought the one that's cheaper to run","{appliances,energy}")

# ---------------- home (19) ----------------
B = "home"
t(B,"chloe_n","chatgpt","Reporting damp and mould to my housing association in writing","Report damp and mould in writing",
  "I'd mentioned the mould on the phone twice. ChatGPT helped me write a dated email listing the rooms affected, when I first reported it, and asking for an inspection date. I attached photos. They booked an inspection within a fortnight.",
  "Write a clear, polite email to my housing association reporting damp and mould in [rooms]. I first reported it by phone on [date]. Ask for an inspection date in writing. Keep it factual.",
  "I read Shelter's page on damp and mould before sending.","Phone reports going nowhere","An inspection booked in writing","{damp,repairs}")
t(B,"raj_p","claude","Getting my deposit back after moving out","Ask for my tenancy deposit back",
  "The letting agent was slow to return my deposit. Claude helped me write a short email with my move-out date and the check-out photos, asking when it would be returned. It mentioned that deposits are usually protected in a scheme, so I checked mine on the scheme's website.",
  "Write a short, polite email to my letting agent asking when my deposit will be returned. I moved out on [date] and left the property clean, with photos. Ask them to confirm any deductions in writing.",
  "I checked my deposit was protected on the scheme's website.","Weeks of silence about my deposit","Deposit back in full","{deposit,renting}")
t(B,"eileen_t","copilot","A friendly note to neighbours about late-night noise","Raise noise with neighbours without a row",
  "I didn't want to start a feud. Copilot drafted a short, friendly note asking if they could keep music down after 11 on weeknights. I softened it a bit more and put it through the door. They knocked to apologise.",
  "Write a short, friendly note to my neighbours about music late at night on weeknights. I want to stay on good terms. No blame, just a polite request.",
  "Nothing to check: I just read it twice before posting it.","Lying awake and getting cross","Quiet weeknights and no row","{neighbours,noise}")
t(B,"dan_w","gemini","A moving house checklist I actually used","Plan everything for moving house",
  "Gemini made a week-by-week checklist for the month before moving: meter readings, change of address, broadband, council tax and post redirection. I printed it and ticked things off. Nothing got missed this time.",
  "Make a week-by-week checklist for moving house in the UK, starting [number] weeks before. Include utilities, council tax, change of address, post and broadband.",
  "I checked the council tax step on my new council's website.","Forgot half the jobs last time I moved","Nothing missed","{moving,checklist}")
t(B,"amira_b","chatgpt","Writing down meter readings when switching supplier","Know what to do with meter readings when switching",
  "I wasn't sure when to take readings or what to do with them. ChatGPT explained it simply. I took photos of the meters on switch day and sent the readings to both companies. The final bill was right.",
  "I'm switching energy supplier on [date]. Explain simply when to take meter readings, who to send them to, and how to check the final bill is right.",
  "I compared the final bill with my photos.","Worried about being billed twice","A correct final bill","{energy,switching}")
t(B,"jo_ellis","claude","Getting three builders' quotes into one table","Compare quotes for a new kitchen floor",
  "Three quotes, all set out differently. I typed out what each included and the prices, and Claude put them in a table with gaps highlighted, like one not including removing the old floor. I asked that builder to confirm before deciding.",
  "Put these three quotes into a table so I can compare them. Show what each includes and doesn't include, and the total. Highlight anything missing. [type each quote, without names or phone numbers]",
  "I asked the builders to confirm the missing items.","Quotes impossible to compare","Chose with everything included","{quotes,builders}")
t(B,"ben_k","copilot","Booking a bulky waste collection","Get rid of an old sofa through the council",
  "I didn't know where to start. Copilot explained that most councils offer a paid bulky waste collection and what to search for on their website. I booked it online in five minutes.",
  "How do bulky waste collections usually work with councils in England? What should I search for on my council's website, and what should I check before booking?",
  "I booked through my council's official website.","An old sofa stuck in the hall","Collected the following week","{council,waste}")
t(B,"meg_h","gemini","Understanding my tenancy agreement before signing","Understand a tenancy agreement",
  "The agreement was 20 pages. I pasted it with names and the address removed and asked Gemini to list the main things I was agreeing to and anything unusual. It flagged a clause about professional cleaning. I asked the agent about it and checked Shelter's advice.",
  "Summarise this tenancy agreement in plain English. List what I'm agreeing to, the notice period, and any clauses that seem unusual or worth asking about. Don't give legal advice. [paste the agreement with names and address removed]",
  "I checked the cleaning clause with Shelter's advice pages.","20 pages I was going to sign unread","Asked about one clause before signing","{renting,contracts}")
t(B,"leon_a","chatgpt","A list of everyone to tell when I moved","Make a change of address list",
  "ChatGPT gave me a long list of who usually needs your new address: bank, GP, DVLA, employer, electoral register and more. I crossed off what didn't apply and did the rest over two evenings.",
  "Give me a checklist of organisations people in the UK usually need to tell when they move house. Group them so I can work through them.",
  "I used the official GOV.UK pages for DVLA and the electoral register.","Post still going to the old flat","Everyone updated in two evenings","{moving,address}")
t(B,"pam_r","claude","A reminder plan for boiler and smoke alarm checks","Remember yearly home safety checks",
  "I never remembered when the boiler was last serviced. Claude made a simple yearly calendar of home checks, like testing smoke alarms monthly and booking the boiler service each autumn. I put them in my phone calendar.",
  "Make a simple yearly calendar of home maintenance and safety checks for a small house. Say how often each one should be done.",
  "I checked the smoke alarm advice on my fire service's website.","No idea when anything was last done","Reminders set in my phone","{maintenance,safety}")
t(B,"kai_l","gemini","Cutting my energy use without spending money","Find free ways to use less energy",
  "Gemini gave me a list of free changes, like lowering the boiler flow temperature and washing at 30. I picked five to try. I compared my smart meter readings before and after.",
  "List free or nearly free ways to reduce energy use in a UK home. Put the ones that save the most first. Keep it practical.",
  "I compared smart meter readings for a month before and after.","High bills and no idea where to start","Five changes that cut my usage","{energy,saving}")
t(B,"stella_m","copilot","Replying to a rent increase letter","Understand and reply to a rent increase notice",
  "My landlord wrote to raise the rent. Copilot explained in general terms what to check, like whether the right notice had been given, and drafted a polite reply asking a question about the start date. I checked the rules on GOV.UK because they depend on the type of tenancy.",
  "My landlord has sent a letter raising my rent from [amount] to [amount] from [date]. What should I check, in general terms, and can you draft a polite reply asking [your question]? Don't assume the law, tell me where to check.",
  "I checked the rules for my tenancy type on GOV.UK.","Panicked about the increase","Understood my options and replied calmly","{renting,rent}")
t(B,"hugh_d","chatgpt","Talking to a neighbour about an overgrown hedge","Raise an overgrown hedge politely",
  "The hedge was blocking light into our garden. ChatGPT suggested starting with a friendly chat and gave me a few opening lines. It went fine and they cut it back the next month.",
  "Give me three friendly ways to start a conversation with my neighbour about their hedge blocking light into my garden. I want to stay on good terms.",
  "Nothing to check: it was just ideas for a conversation.","A dark garden and a grudge brewing","Hedge cut back and still friends","{neighbours,garden}")
t(B,"gwen_o","claude","Comparing home insurance renewal quotes","Compare my renewal price with new quotes",
  "My renewal went up a lot. I typed out the cover and excess for my renewal and two quotes, and Claude compared them side by side. One cheap quote had a much higher excess. I rang my insurer with a better quote and they matched it.",
  "Compare these home insurance quotes side by side: price, excess, and what's covered. Point out anything that makes a cheap quote worse value. [type the key details of each]",
  "I read each policy summary before deciding.","Renewal price up by a third","Insurer matched a better quote","{insurance,renewal}")
t(B,"ollie_s","gemini","Writing a check-in inventory note for a new flat","Record the condition of a flat on move-in day",
  "Gemini gave me a room-by-room list of what to photograph and note on move-in day. I emailed my notes and photos to the agent the same day so there's a dated record.",
  "Make a room-by-room checklist of what to photograph and note when moving into a rented flat, so I have a record of its condition.",
  "I compared it with the agent's inventory.","Lost money from my last deposit","A dated record of everything","{renting,inventory}")
t(B,"ruth_c","copilot","Setting up broadband at a new address","Get broadband sorted before moving",
  "Copilot explained what to check, like whether my address could get full fibre and how long installation usually takes. I used the provider's postcode checker and ordered three weeks ahead.",
  "I'm moving on [date]. What should I check and when should I order broadband so it's working when I arrive? Keep it short.",
  "I used the provider's own address checker.","No internet for two weeks last move","Working on moving day","{broadband,moving}")
t(B,"pete_v","chatgpt","A fair cleaning rota for a shared house","Make a cleaning rota for five housemates",
  "Every week someone felt hard done by. ChatGPT made a rotating rota so everyone does each job once a month. We stuck it on the fridge.",
  "Make a weekly cleaning rota for [number] housemates that rotates so everyone does every job equally over a month. Jobs: [list jobs].",
  "We all agreed it before starting.","Arguments over the bins","A rota on the fridge everyone follows","{shared-house,cleaning}")
t(B,"ana_g","claude","Decluttering a room at a time","Make a plan to clear out the spare room",
  "I felt overwhelmed. Claude broke it into 20-minute jobs over two weeks and suggested where to donate or recycle things. I did one job a day.",
  "Break clearing out a cluttered spare room into 20-minute jobs I can do one a day. Suggest where things could go: keep, donate, recycle or bin.",
  "I checked my council's recycling page for the electricals.","A room I couldn't open the door to","Cleared in two weeks","{declutter,planning}")
t(B,"simon_j","gemini","Asking my landlord for a repair date in writing","Get a leaking tap fixed",
  "I'd reported a leaking tap twice by text. Gemini helped me write an email listing the dates I'd reported it and asking for a repair date. The plumber came that week.",
  "Write a short, polite email to my landlord about a leaking [tap/pipe]. I reported it on [date] and [date]. Ask for a repair date in writing.",
  "I kept copies of my texts as a record.","Two texts ignored","Fixed that week","{repairs,landlord}")

# ---------------- complaints (19) ----------------
B = "complaints"
t(B,"lucy_f","chatgpt","Getting a refund for a faulty kettle","Ask a shop for a refund on a faulty item",
  "The kettle stopped working after three weeks and the shop offered only a repair. ChatGPT explained my rights in general terms and helped me write a short email asking for a refund. I checked the Citizens Advice page first. They refunded me.",
  "Write a short, polite email to a shop. I bought a [item] on [date] and it stopped working on [date]. Ask for a refund. Explain in plain English what rights people usually have for faulty goods in the UK, and tell me where to check.",
  "I checked the Citizens Advice page on faulty goods.","Offered a repair I didn't want","Full refund","{refunds,faulty-goods}")
t(B,"marcus_e","copilot","Claiming compensation for a delayed flight","Claim compensation for a long flight delay",
  "Our flight was delayed over four hours. Copilot explained what usually counts and helped me fill in the airline's claim form with the facts. I checked the rules on the Civil Aviation Authority website. The airline paid out.",
  "My flight from [airport] to [airport] on [date] arrived [hours] hours late. Explain in plain English how flight delay compensation usually works for UK flights, and help me write the claim. Tell me where to check the rules.",
  "I checked the rules on the Civil Aviation Authority website.","Didn't know I could claim","Compensation paid","{flights,compensation}")
t(B,"jen_o","gemini","Complaining about being overcharged on my phone contract","Get an overcharge on my mobile bill refunded",
  "My bill was higher than my contract price for three months. Gemini helped me list the months and amounts and write a short complaint. They refunded the difference.",
  "Write a short complaint to my mobile provider. My contract is [amount] a month but I've been charged [amounts] for [months]. Ask for the difference back and a corrected bill.",
  "I checked my contract summary for the agreed price.","Overcharged for three months","Difference refunded","{mobile,overcharging}")
t(B,"stan_l","claude","Taking a complaint to the ombudsman after 8 weeks","Escalate an energy complaint",
  "My energy complaint had dragged on. Claude explained that you can usually go to the ombudsman once 8 weeks have passed, and helped me write a timeline of what happened. The Energy Ombudsman accepted the case.",
  "Help me write a clear timeline of my complaint for the ombudsman. Dates and what happened: [list]. Keep it short and factual. Also explain in general terms when people can usually take an energy complaint to the ombudsman.",
  "I checked the Energy Ombudsman's website for the rules.","Going round in circles with the supplier","Case accepted by the ombudsman","{ombudsman,energy}")
t(B,"tina_r","chatgpt","Chasing a parcel that never arrived","Get a refund for a parcel marked delivered",
  "The tracking said delivered but nothing came. ChatGPT reminded me that my contract is with the seller, not the courier, and helped me write to the seller. They sent a replacement.",
  "Write a short message to an online seller. My order [what] was marked delivered on [date] but I didn't receive it. I've checked with neighbours. Ask for a replacement or refund.",
  "I checked the Citizens Advice page on missing deliveries.","A parcel marked delivered that never came","Replacement sent","{parcels,online-shopping}")
t(B,"des_m","copilot","Complaining to the council about missed bin collections","Report repeated missed bin collections",
  "Our bins were missed four times in two months. Copilot helped me write a short complaint listing the dates. I sent it through the council's complaints form and got an apology and a fixed collection.",
  "Write a short complaint to my council. Our [bin type] was missed on [dates]. Ask for it to be sorted and for a reply. Keep it polite and factual.",
  "I used the council's own complaints form.","Four missed collections","Apology and collections back on track","{council,bins}")
t(B,"helen_w","gemini","Cancelling a gym membership that wouldn't let me leave","Cancel a gym membership",
  "The gym kept saying I had to cancel in person. Gemini helped me write a cancellation email quoting the notice period from my contract and asking for written confirmation. They confirmed it.",
  "Write an email cancelling my gym membership. My contract says [notice period]. Ask them to confirm the cancellation and the last payment date in writing.",
  "I checked my contract for the notice period.","Told I had to cancel in person","Cancellation confirmed in writing","{gym,cancelling}")
t(B,"ray_b","claude","Complaining about a garage repair","Raise a poor car repair with a garage",
  "The same fault came back a week after the repair. Claude helped me write a calm complaint with the dates and the invoice, asking them to put it right. They fixed it free.",
  "Write a calm complaint to a garage. They repaired [fault] on [date] for [amount] and the same fault came back on [date]. Ask them to put it right at no cost.",
  "I checked the Motor Ombudsman's advice pages.","Paid for a repair that didn't last","Fixed again at no cost","{cars,repairs}")
t(B,"nina_p","chatgpt","Getting my bank to look at a complaint properly","Complain to my bank about a delayed transfer",
  "A transfer was held for days and I missed a payment. ChatGPT helped me write a short complaint with the timeline and what it cost me. The bank apologised and paid the late fee.",
  "Write a short complaint to my bank. A transfer I made on [date] was held until [date], which meant [consequence]. Ask them to explain and cover [cost].",
  "I checked the Financial Ombudsman's page on complaining to your bank.","A missed payment because of the bank","Apology and late fee covered","{banking,complaint}")
t(B,"kev_o","copilot","Complaining about a holiday that wasn't as described","Complain to a holiday company",
  "The hotel pool was closed all week and the brochure didn't say. Copilot helped me write a complaint with photos and the booking description. They offered a partial refund.",
  "Write a complaint to a holiday company. Our booking promised [feature] but [what happened]. I have photos. Ask for a partial refund. Keep it factual and polite.",
  "I kept copies of the booking page.","A holiday that wasn't as booked","Partial refund","{holidays,complaint}")
t(B,"pauline_g","gemini","A complaint about NHS appointment admin","Complain about cancelled hospital appointments",
  "My appointment was cancelled three times with no new date. This was about the booking, not my care. Gemini helped me write to the hospital's PALS team with the dates. They found me a new date within a month.",
  "Write a short, polite message to a hospital's Patient Advice and Liaison Service. My appointment was cancelled on [dates] and I haven't been given a new date. Ask for help getting one.",
  "I found the PALS contact on the hospital's own website.","Three cancellations and no date","New appointment within a month","{nhs,appointments}")
t(B,"terry_c","claude","Chasing an insurance claim that went quiet","Get an update on a slow insurance claim",
  "My claim had gone quiet for six weeks. Claude helped me write a short email asking for an update and a timescale. I got a reply in two days.",
  "Write a short email to my insurer. I made a claim on [date] and haven't heard anything since [date]. Ask for an update and when they expect to decide.",
  "I checked the insurer's complaints process on their website.","Six weeks of silence","Reply in two days","{insurance,claims}")
t(B,"bella_s","chatgpt","Getting money back for a cancelled concert","Get a refund for a cancelled event",
  "The concert was cancelled and the ticket site was confusing. ChatGPT helped me write a short refund request including the booking fee. It came back in full.",
  "Write a short refund request for a cancelled event on [date]. I paid [amount] including fees. Ask for a full refund including fees.",
  "I read the ticket site's own refund policy.","Unsure I'd get the fees back","Refunded in full","{tickets,refunds}")
t(B,"vik_r","copilot","Complaining about a water leak the company left for weeks","Get a water company to fix a leak in the street",
  "Water was running down our road for weeks. Copilot helped me write a short complaint with dates and photos. The water company fixed it the following week.",
  "Write a short complaint to my water company. There has been a leak at [location] since [date], which I reported on [date]. Ask when it will be fixed.",
  "I used the water company's online form.","Weeks of water down the road","Fixed the following week","{water,leaks}")
t(B,"orla_k","gemini","Complaining about a kitchen fitter who didn't finish","Ask a tradesperson to finish a job",
  "The fitter left with jobs undone. Gemini helped me write a list of what was unfinished and a polite letter giving a date to return. He came back and finished.",
  "Write a polite but firm letter to a tradesperson. The job [what] was agreed on [date] and these parts are unfinished: [list]. Ask them to return by [date].",
  "I read the Citizens Advice page on problems with builders.","A half-finished kitchen","Job finished","{trades,complaint}")
t(B,"gus_h","claude","Asking Royal Mail about a lost recorded letter","Claim for a lost signed-for letter",
  "My signed-for letter never arrived. Claude helped me gather what I'd need, like the proof of posting, and write the claim notes. I claimed online.",
  "I sent a signed-for letter on [date] and it hasn't arrived. What information will I usually need to make a claim, and can you help me write a short description?",
  "I used the claim form on Royal Mail's website.","A lost letter and no idea what to do","Claim made online","{post,claims}")
t(B,"maya_d","chatgpt","Complaining about a letting agent's fees","Question a fee from a letting agent",
  "The agent tried to charge a fee for renewing my tenancy. ChatGPT told me some fees are banned in England and suggested I check GOV.UK. It was a banned fee, so I wrote and said so, and they dropped it.",
  "My letting agent wants to charge me [amount] for [reason]. Explain in general terms what fees agents can and can't charge tenants in England, and tell me where to check. Then draft a short reply.",
  "I checked the tenant fees guidance on GOV.UK.","An unexpected fee","Fee dropped","{renting,fees}")
t(B,"cal_n","copilot","Getting a restaurant to correct a bill","Write to a restaurant about an overcharge",
  "We noticed later we'd been charged for an extra bottle of wine. Copilot helped me write a short, friendly email with the receipt. They refunded it the same day.",
  "Write a short, friendly email to a restaurant. On [date] our bill included [item] we didn't order. I've attached the receipt. Ask for a refund.",
  "I checked the receipt against what we ordered.","Charged for something we didn't have","Refunded the same day","{restaurants,refunds}")
t(B,"fay_l","gemini","Writing a complaint that stays calm","Turn an angry rant into a complaint someone will read",
  "I wrote a furious first draft. I asked Gemini to keep the facts and remove the anger. The calm version got a proper answer, which my angry emails never had.",
  "Rewrite this complaint so it's calm, short and factual. Keep every fact and date, and remove the anger. End with what I want them to do. [paste your draft]",
  "I checked every date was still right.","Angry emails that got ignored","A calm complaint that got an answer","{complaints,tone}")

# ---------------- letters (19) ----------------
B = "letters"
t(B,"len_w","chatgpt","Understanding a DVLA letter about my licence","Understand a DVLA letter",
  "The letter talked about renewing my photocard. ChatGPT explained what it meant and that I could do it online. I renewed it on GOV.UK, not through any other site.",
  "Explain this DVLA letter in plain English. What do I need to do and by when? [type the letter without your name, address or licence number]",
  "I only used the official GOV.UK service.","Confused about a letter from the DVLA","Renewed online in ten minutes","{dvla,driving}")
t(B,"ama_o","gemini","Translating a school letter for my mum","Explain an English letter in my mum's language",
  "My mum's English is limited. I typed the school letter, without names, and asked Gemini for a simple version in Twi. I checked it with her, and she understood the trip details and the cost.",
  "Translate this school letter into simple [language] for a parent who doesn't read much English. Keep dates and costs exact. [paste the letter without names]",
  "I went through the dates and cost with her myself.","Mum relying on me to read every letter","She read it herself","{translation,school}")
t(B,"col_b","copilot","Working out what a jury summons wants from me","Understand a jury summons",
  "I'd never had one. Copilot explained the steps in plain words and what to do if I couldn't go on those dates. I replied online through the official link on the letter.",
  "Explain in plain English what a jury summons in England usually asks you to do, and what to do if the dates are a problem. [type the main parts of the letter without your details]",
  "I used the official GOV.UK reply service.","Didn't know what to do","Replied on time","{jury,courts}")
t(B,"iris_m","claude","Filling in a long form one question at a time","Fill in a long application form",
  "Forms make me freeze. I typed each question into Claude and asked what it was really asking for. Then I wrote my own answers. It took an evening instead of a fortnight of avoiding it.",
  "This is a question from a form: [question]. Explain in plain English what it's asking and what kind of information to put. Don't write the answer for me.",
  "My answers were all my own words.","A form I'd avoided for weeks","Sent off in one evening","{forms,admin}")
t(B,"jack_t","chatgpt","Replying to a TV Licensing letter","Tell TV Licensing I don't need a licence",
  "I kept getting letters but I don't watch live TV or iPlayer. ChatGPT explained what counts and how to tell them. I filled in the no-licence-needed form on the official site.",
  "Explain in plain English when someone in the UK needs a TV licence. I only use [what you watch]. What should I do about the letters I'm getting?",
  "I checked the rules on the official TV Licensing website.","Worrying letters every month","Declared online and the letters stopped","{tv-licence,letters}")
t(B,"may_q","copilot","Understanding a planning letter about next door","Understand a planning notice",
  "The council sent a letter about my neighbour's extension. Copilot explained what it meant and how comments usually work. I looked at the plans on the council's planning portal.",
  "Explain this council planning letter in plain English. What is happening, can I comment, and by when? [type the letter without names or addresses]",
  "I read the plans on the council's planning portal.","A letter full of planning terms","Knew what was planned and the deadline","{planning,council}")
t(B,"bob_h","gemini","Summarising a long contract before signing","Summarise a phone contract",
  "Gemini summarised the key points: length, monthly price, price rises and how to leave early. I checked those points in the contract summary the provider has to give you.",
  "Summarise this contract in plain English: how long it lasts, the price, any price rises, and what happens if I leave early. [paste the contract]",
  "I checked each point against the contract summary.","A contract I didn't understand","Knew the key terms before signing","{contracts,phones}")
t(B,"ruby_a","claude","Writing to my MP","Write to my MP about a local issue",
  "I wanted to raise the bus cuts in our area but didn't know how to set it out. Claude helped me write a short letter with the facts and one clear ask. I sent it through the parliament website. I got a reply.",
  "Help me write a short letter to my MP about [issue] in [area]. Give the facts, how it affects people, and one clear request. Keep it under 250 words.",
  "I checked the facts on the bus company's website.","Angry but not sure what to do","Letter sent and a reply received","{mp,local-issues}")
t(B,"sam_o","chatgpt","Writing a reference for a friend's job application","Write a character reference",
  "My friend asked me for a character reference. ChatGPT gave me a structure: how I know them, examples, and a closing line. I wrote the examples myself.",
  "Give me a structure for a short character reference for a friend applying for a [job]. I've known them for [years] through [how]. I'll add the examples myself.",
  "Everything in it was true and my own.","Blank page","A reference I was happy to sign","{references,writing}")
t(B,"dora_k","gemini","Writing a condolence card","Find the right words for a sympathy card",
  "I never know what to write. Gemini gave me a few short options, and I mixed two and added a memory of my own. It felt personal, not copied.",
  "Give me three short, warm options for a sympathy card to [relationship] whose [person] has died. Simple, not religious.",
  "Nothing to check: I made it personal myself.","Staring at a blank card","A message that felt right","{cards,writing}")
t(B,"neil_p","copilot","Making a formal email sound right","Write a formal email to an organisation",
  "I write like I talk. Copilot turned my rough notes into a clear formal email without making it stiff. I use the same prompt for anything official now.",
  "Turn my notes into a short, clear, polite email to [organisation]. Not too formal. [your notes]",
  "I read it through before sending.","Worried I sounded rude or sloppy","Clear emails to anyone official","{email,tone}")
t(B,"hazel_r","claude","Understanding a letter about my electoral registration","Answer a household enquiry form",
  "The council's form about who lives at the address confused me. Claude explained what it was for and that it's normal every year. I filled it in online.",
  "Explain what this council letter about electoral registration is asking me to do. [type the main text without names or reference numbers]",
  "I used the online link from the council's own letter and checked it on the council's website.","Thought it might be a scam","Filled in properly","{elections,council}")
t(B,"ty_m","chatgpt","Making a passport renewal less stressful","Renew a passport online",
  "ChatGPT gave me a short list of what I'd need before starting: old passport, a digital photo and a card to pay. I did it on GOV.UK in one go.",
  "What will I need before I start renewing an adult UK passport online? Give me a short checklist.",
  "I used only the official GOV.UK passport service.","Kept putting it off","Renewed in one go","{passport,forms}")
t(B,"ella_v","gemini","Replying to my insurance renewal letter","Understand what changed in a renewal letter",
  "Gemini compared last year's and this year's renewal letters and listed what changed, including a higher excess. I rang and asked them to put it back.",
  "Compare these two insurance renewal letters and list what has changed: price, excess and cover. [type the key parts of both without policy numbers]",
  "I checked the changes on the policy documents.","Nearly renewed without reading","Spotted a higher excess","{insurance,renewal}")
t(B,"cliff_d","copilot","Explaining a letter from the pension service","Understand a State Pension letter",
  "My dad got a letter about his State Pension and asked me what it meant. Copilot explained it in simple terms and I read it through with him. He rang the Pension Service to confirm one thing.",
  "Explain this State Pension letter in plain English for an older person. What does it say and does anything need to be done? [type the main text without names or numbers]",
  "Dad rang the Pension Service using the number on GOV.UK.","Dad worried about a letter","He understood it and knew what to ask","{pension,parents}")
t(B,"abby_n","claude","Writing a letter to support a friend's appeal","Write a supporting letter",
  "A friend was appealing a decision and asked for a letter about how they cope day to day. Claude gave me a structure and reminded me to stick to what I've seen myself. I wrote it in my own words.",
  "Give me a structure for a supporting letter for a friend's appeal. I know them as [relationship] and see them [how often]. Remind me what kinds of details are useful. I'll write it myself.",
  "Everything I wrote was what I'd seen myself.","Not sure what would help","A clear letter in my own words","{appeals,letters}")
t(B,"gil_s","chatgpt","Writing to a company to cancel a subscription by post","Cancel a magazine subscription",
  "They only accepted cancellations in writing. ChatGPT wrote a short letter asking to cancel and confirm. I posted it with proof of postage.",
  "Write a short letter cancelling my subscription to [what]. Ask them to confirm the cancellation and that no more payments will be taken.",
  "I kept proof of postage.","Charged for a magazine I didn't read","Cancelled and confirmed","{subscriptions,letters}")
t(B,"tess_b","gemini","Understanding a council housing letter","Understand a letter about my housing application",
  "The letter talked about bands and bidding. Gemini explained the terms simply. I then rang the housing team with two questions I'd written down.",
  "Explain these terms from a council housing letter in plain English: [list terms]. What questions should I ask the housing team?",
  "The housing team answered my questions.","Lost in housing jargon","Knew where I stood","{housing,council}")
t(B,"arlo_f","copilot","Writing a thank-you letter to a nurse team","Write a thank-you note",
  "I wanted to thank the ward staff after my mum's stay. Copilot gave me a starting point and I added the names and moments I remembered.",
  "Help me start a short thank-you note to a hospital ward team who looked after my mum. Warm and simple. I'll add the details.",
  "Nothing to check: I made it personal.","Didn't know how to start","A note the team pinned up","{thanks,writing}")

# ---------------- work (19) ----------------
B = "work"
t(B,"lee_c","chatgpt","Explaining a gap in my CV","Explain a career break on my CV",
  "I'd been off for two years caring for my dad. ChatGPT helped me write one honest line for the CV and a short answer for interviews. It stopped me dreading the question.",
  "I had a [length] gap in work because [reason]. Write one honest line for my CV and a short, confident answer if I'm asked about it in an interview.",
  "Everything it wrote was true.","Dreading questions about the gap","A calm, honest answer ready","{cv,career-break}")
t(B,"tara_b","claude","Practising interview questions out loud","Prepare for a job interview",
  "I pasted the job advert and asked Claude to ask me likely questions one at a time and give feedback on my answers. I did it three evenings in a row. The real interview felt familiar.",
  "Act as an interviewer for this job. Ask me one likely question at a time, wait for my answer, then give short feedback. [paste the job advert]",
  "I checked the company's own website for facts about them.","Freezing in interviews","Felt prepared and got a second interview","{interviews,jobs}")
t(B,"ross_m","copilot","Understanding my redundancy letter","Understand a redundancy letter",
  "The letter had terms like notice pay and statutory redundancy pay. Copilot explained them and listed questions to ask HR. I also used the redundancy pay calculator on GOV.UK.",
  "Explain the terms in this redundancy letter in plain English and list questions I should ask HR. [type the main parts without names]",
  "I used the redundancy pay calculator on GOV.UK and spoke to Acas.","Shock and confusion","Knew what to ask HR","{redundancy,work}")
t(B,"gina_l","gemini","Asking for a pay rise","Prepare a case for a pay rise",
  "Gemini helped me list what I'd taken on in the past year and turn it into a short, confident email asking for a meeting. My manager agreed to review it.",
  "Help me write a short email asking my manager for a meeting about a pay rise. Here's what I've done this year: [list]. Confident, not pushy.",
  "All the achievements were real.","Never asked in five years","A review meeting booked","{pay,work}")
t(B,"ollie_w","chatgpt","Asking for reasonable adjustments at work","Ask my employer for adjustments",
  "I have dyslexia and wanted written instructions instead of verbal ones. ChatGPT helped me write a short request explaining what would help. I checked Acas's advice too. My manager agreed.",
  "Help me write a short request to my manager asking for [adjustment] because of [condition, only what you're comfortable sharing]. Explain how it would help me do my job.",
  "I read Acas's guidance on reasonable adjustments.","Struggling quietly","Adjustment agreed","{adjustments,work}")
t(B,"pip_s","claude","Making a simple invoice template","Invoice clients as a self-employed cleaner",
  "Claude made me a simple invoice layout with what should be on it: dates, what I did, the amount and how to pay. I set it up in a free spreadsheet.",
  "What should a simple invoice for a self-employed [job] in the UK include? Give me a clean layout I can copy into a spreadsheet.",
  "I checked GOV.UK's page on invoicing.","Scribbled bills on paper","Proper invoices that look professional","{self-employed,invoices}")
t(B,"jay_d","copilot","Getting my Self Assessment notes in order","Prepare for my tax return",
  "I put off my tax return every year. Copilot made a checklist of what to gather and helped me sort my expenses into categories. I filed on the HMRC website two weeks early.",
  "I'm self-employed as a [job]. Make a checklist of what I need to gather for my Self Assessment tax return, and help me group these expenses: [list].",
  "I checked allowable expenses on GOV.UK.","Last-minute panic every January","Filed two weeks early","{tax,self-employed}")
t(B,"maz_k","gemini","Rewriting my LinkedIn summary","Update my profile after a career change",
  "I'd moved from retail to admin. Gemini rewrote my summary to focus on skills that carry over. I edited it to sound like me.",
  "Rewrite my LinkedIn summary for someone moving from [old job] to [new job]. Focus on skills that carry over. Keep it short and in the first person. [paste current summary]",
  "I made sure every skill was real.","A profile stuck in my old job","A summary for the work I want","{linkedin,career-change}")
t(B,"wes_r","chatgpt","Writing a polite resignation letter","Resign on good terms",
  "ChatGPT wrote a short, polite resignation letter with my notice period and a thank-you. I wanted to leave on good terms and I did.",
  "Write a short, polite resignation letter. My last day will be [date], which gives [notice] notice. Thank them for the opportunity.",
  "I checked my notice period in my contract.","Worried about leaving badly","Left on good terms","{resigning,letters}")
t(B,"cat_y","claude","Turning messy meeting notes into actions","Tidy up notes from a volunteer committee meeting",
  "I'm secretary of a small volunteer group. I paste my rough notes and Claude turns them into a short list of decisions and who does what. Takes five minutes instead of an hour.",
  "Turn these rough meeting notes into a short summary: decisions made, and actions with who is doing them. [paste notes with no personal details]",
  "I check it against my notes before sending.","An hour typing up minutes","Five minutes and clearer actions","{meetings,volunteering}")
t(B,"ivy_p","copilot","Asking to swap a shift without awkwardness","Ask a colleague to swap a shift",
  "Copilot gave me a friendly message and offered to swap back another time. My colleague said yes straight away.",
  "Write a short, friendly message asking a colleague to swap my [day] shift. Offer to cover one of theirs in return.",
  "Nothing to check.","Awkward asking","Swap sorted","{shifts,work}")
t(B,"nate_g","gemini","Making a flexible working request","Ask to work different hours",
  "Gemini helped me set out what I was asking for and how the work would still get done. I read the Acas guidance on flexible working first. My employer agreed to a trial.",
  "Help me write a flexible working request. I'd like to [change]. Explain how my work will still get done. Keep it clear and positive.",
  "I read the Acas guidance on flexible working.","Childcare clash every day","A three-month trial agreed","{flexible-working,work}")
t(B,"lola_b","chatgpt","Checking if a job advert looked like a scam","Check a too-good-to-be-true job offer",
  "A message offered easy money for liking videos. ChatGPT listed the warning signs, like being asked to pay first. I didn't reply and reported it.",
  "Does this job offer look like a scam? List any warning signs. [paste the message without clicking links]",
  "I checked Action Fraud's page on job scams.","Tempted by easy money","Spotted the scam","{jobs,scams}")
t(B,"ed_h","claude","Writing a cover letter that doesn't sound like everyone else's","Write a cover letter for a warehouse job",
  "Claude gave me a draft, but it sounded like a robot. I asked it to ask me questions about my experience first, then write. The second version sounded like me.",
  "Before writing my cover letter, ask me five questions about my experience for this job. Then write a short letter using my answers. [paste the job advert]",
  "Every detail came from my answers.","Generic letters getting nowhere","A letter in my own voice","{cover-letters,jobs}")
t(B,"suki_t","copilot","Getting help with a spreadsheet formula","Add up hours worked in a spreadsheet",
  "I needed to total my weekly hours. Copilot gave me the formula and explained it. It worked first time.",
  "In a spreadsheet, column A has dates and column B has hours worked. Give me a formula to total the hours for each week, and explain it simply.",
  "I checked the totals by hand for one week.","Adding up hours with a calculator","A spreadsheet that does it","{spreadsheets,work}")
t(B,"ben_a","gemini","Applying to volunteer at a food bank","Write a short volunteering application",
  "Gemini helped me write a few lines about why I wanted to help and what I could do. I added my own reasons. I start next month.",
  "Help me write a short paragraph for a volunteering application at a [place]. I can help [when] and I'm good at [skills].",
  "Nothing to check: it was my own reasons.","Didn't know what to say","Starting next month","{volunteering,applications}")
t(B,"rhi_j","chatgpt","A simple plan for a market stall","Plan costs for a craft market stall",
  "ChatGPT helped me list costs, like the pitch fee and materials, and work out how many items I'd need to sell to break even. Made it feel less of a gamble.",
  "I want to sell [items] at a craft market. Pitch fee is [amount], each item costs [amount] to make and I'll sell at [price]. How many do I need to sell to break even? Show the working.",
  "I checked the sums.","No idea if it would pay","Knew my break-even number","{small-business,planning}")
t(B,"oscar_n","claude","Writing a calm email to my manager about workload","Raise workload without sounding like I'm complaining",
  "Claude helped me turn a stressed message into a calm one with a list of tasks and a question about priorities. My manager took two jobs off me.",
  "Rewrite this email to my manager so it's calm and constructive. List my current tasks and ask which to prioritise. [paste your draft]",
  "I read it before sending.","Overloaded and stressed","Two tasks taken off me","{workload,email}")
t(B,"fran_c","copilot","Understanding my contract before starting a new job","Understand a job contract",
  "Copilot summarised hours, holiday, notice and probation in plain words. I asked HR about the probation period before signing.",
  "Summarise this employment contract in plain English: hours, pay, holiday, notice, probation. Flag anything to ask about. [paste without names]",
  "I asked HR to confirm the probation terms.","Signing without reading","Knew what I was agreeing to","{contracts,jobs}")

# ---------------- health-admin (19) ----------------
B = "health-admin"
t(B,"joan_p","chatgpt","Keeping a list of mum's medicines for appointments","Keep an up-to-date medicines list for a parent",
  "I asked ChatGPT for a simple table layout: medicine name, dose, time of day and who prescribed it. I fill it in from the boxes and take it to every appointment. I don't ask it anything about the medicines themselves.",
  "Give me a simple table layout to keep a list of someone's medicines for appointments: name, dose, when taken, and who prescribed it. Don't give any medical advice.",
  "The pharmacist checked the list was complete.","Forgetting what mum takes","A list the GP said was really useful","{medicines,carers}")
t(B,"ron_s","copilot","Understanding a hospital appointment letter","Understand where and when to go",
  "The letter listed a clinic code and instructions. Copilot explained what to bring and that the code was just the clinic's name. I rang the number on the letter about parking.",
  "Explain the practical parts of this hospital appointment letter: where to go, what to bring, and anything I need to do beforehand. [type the letter without names or NHS number]",
  "I rang the number on the letter to confirm.","Worried I'd go to the wrong place","Arrived at the right clinic on time","{hospital,appointments}")
t(B,"sita_r","claude","Organising my answers for a PIP form","Prepare notes for a PIP form",
  "I wrote down my own examples of daily problems and asked Claude to help me sort them under the form's activity headings. I wrote the answers in my own words. I also got help from a local advice service.",
  "Help me sort my own notes under the activity headings on the PIP form. Don't add anything I haven't said or exaggerate. [paste your own notes with no names, NHS or NI numbers]",
  "A local advice service read it before I sent it.","Notes everywhere and a deadline","An organised form in my own words","{pip,benefits}")
t(B,"tim_b","gemini","Getting set up on the NHS App","Order repeat prescriptions online",
  "Gemini explained the steps to order repeat prescriptions through the NHS App. I did it with my granddaughter on the phone. No more queueing at the surgery.",
  "Explain in simple steps how to order a repeat prescription in the NHS App. Assume I'm not confident with apps.",
  "I followed the NHS website's own instructions too.","Queueing at the surgery every month","Ordering on my phone","{nhs-app,prescriptions}")
t(B,"vera_k","chatgpt","Writing questions for a consultant appointment","Plan questions for a specialist",
  "I always forget to ask things. ChatGPT helped me turn my worries into a short list of clear questions. I didn't ask it what was wrong. The consultant answered each one.",
  "Help me turn my notes into five clear questions to ask a consultant. Don't suggest what might be wrong or any treatment. [your own notes]",
  "Nothing to check: they were my own questions.","Leaving appointments with questions unasked","Every question answered","{appointments,questions}")
t(B,"glen_m","copilot","Applying for a Blue Badge for my dad","Gather what's needed for a Blue Badge application",
  "Copilot listed what's usually needed and helped me make a checklist. We applied through the official GOV.UK link to dad's council.",
  "What do people usually need to apply for a Blue Badge in England? Give me a checklist. Tell me to use the official service.",
  "We only used the official GOV.UK service.","Not sure where to start","Application sent","{blue-badge,parents}")
t(B,"amy_w","gemini","Finding an NHS dentist","Find a dentist taking NHS patients",
  "Gemini explained how to search the NHS website for dentists and what to say when ringing. I rang five practices from the list and found one.",
  "How can I find a dentist taking new NHS patients in England? What should I ask when I ring?",
  "I used the NHS website's search.","No dentist for two years","Registered with one","{dentist,nhs}")
t(B,"kofi_a","claude","Sending my fit note to work","Explain a fit note to my employer",
  "Claude helped me write a short email to my manager attaching my fit note and saying when it ends. I didn't share more than I wanted to.",
  "Write a short email to my manager attaching my fit note, which runs from [date] to [date]. Keep it brief. I don't want to share medical details.",
  "I checked the dates against the fit note.","Not sure what to tell work","A short, private email","{fit-note,work}")
t(B,"lydia_h","chatgpt","Getting my thoughts together for a carer's assessment","Prepare for a carer's assessment",
  "ChatGPT gave me a list of things to think about before the assessment, like how many hours I care and what I find hardest. I wrote my own answers on it.",
  "I'm having a carer's assessment from my council. What kinds of things will I probably be asked about? Give me a list to prepare my own answers.",
  "I read my council's page on carer's assessments.","Not sure what to say","Felt ready and listened to","{carers,assessments}")
t(B,"ned_f","copilot","Changing GP surgery after moving","Register with a new GP",
  "Copilot explained the steps and that I could register online. I used the NHS website to find surgeries near me.",
  "I've moved house. How do I register with a new GP in England? Keep it short.",
  "I used the NHS website to find a surgery.","No GP after moving","Registered online","{gp,moving}")
t(B,"cara_d","gemini","Asking for a copy of my medical records","Request my records",
  "Gemini helped me write a short request to my GP surgery for a copy of my records. They sent them within the month.",
  "Write a short request to my GP surgery asking for a copy of my medical records. Keep it polite.",
  "I checked the NHS page on getting your records.","Didn't know I could ask","Records received","{records,gp}")
t(B,"paul_r","claude","A calendar for dad's appointments","Keep track of several appointments",
  "Dad had appointments with four different services. Claude helped me design a simple shared calendar with what to bring to each. My sister and I both use it now.",
  "Help me set up a simple shared calendar for a parent's appointments. Each entry should say where, when, what to bring and who's going with them.",
  "Nothing to check.","Missed appointments","None missed since","{appointments,carers}")
t(B,"nora_l","chatgpt","Asking my GP surgery for an appointment by email","Write a short message to get an appointment",
  "I find phoning hard. ChatGPT helped me write a short message for the surgery's online form explaining I needed an appointment and the best times to contact me. They booked me in.",
  "Write a short message for my GP surgery's online form asking for an appointment about [general topic]. Say I find phone calls hard and give my best times.",
  "Nothing to check.","Anxious about phoning","Appointment booked online","{gp,anxiety}")
t(B,"bill_o","copilot","Filling in a travel insurance medical questionnaire","Organise information for a travel insurance declaration",
  "Copilot helped me list my conditions and medicines from my own notes so I could answer the insurer's questions accurately. I didn't let it decide anything.",
  "Help me organise my own list of conditions and medicines so I can answer a travel insurance medical questionnaire. Don't advise me what to declare. [your own list]",
  "I checked the list with my repeat prescription.","Worried I'd forget something","Accurate answers given","{insurance,travel}")
t(B,"kim_e","gemini","Translating an appointment letter for my dad","Explain an appointment letter in Polish",
  "Dad reads Polish best. Gemini translated the practical parts of his appointment letter. I checked the time and date myself.",
  "Translate the practical parts of this appointment letter into simple [language]: date, time, place and what to bring. [paste without names or NHS number]",
  "I checked the date and time myself.","Dad worried about letters","He knew where to go","{translation,appointments}")
t(B,"ada_s","claude","Preparing for a care home visit","List questions to ask a care home",
  "We were looking at care homes for my gran. Claude gave us a list of practical questions about visiting, costs and staffing. We used it at three homes.",
  "Give me a list of practical questions to ask when visiting a care home for a grandparent: costs, visiting, staffing, activities.",
  "We checked each home's inspection report on the CQC website.","Overwhelmed choosing a care home","Compared three homes fairly","{care-homes,family}")
t(B,"hal_g","chatgpt","A diary template to take to the GP","Keep a simple diary of how I've been",
  "My GP asked me to keep a diary. ChatGPT gave me a simple daily template. I filled it in myself for two weeks and took it in.",
  "Give me a simple daily diary template to record how I've been for my GP: date, what happened, and anything I want to mention. No medical advice.",
  "Nothing to check: I filled it in myself.","Vague answers at appointments","Two weeks of clear notes","{gp,diary}")
t(B,"meena_r","copilot","Understanding a prescription charge letter","Understand a prescription penalty charge letter",
  "I got a letter about a penalty charge for a free prescription. Copilot explained what it was and what to check about exemptions. I checked on the NHS website and appealed with my certificate.",
  "Explain in plain English what this NHS penalty charge letter means and what I should check. [type the main text without names or reference numbers]",
  "I checked the exemption rules on the NHS website.","A scary-looking charge letter","Appealed with my certificate","{prescriptions,nhs}")
t(B,"jim_k","gemini","Writing a list of questions for a hearing test","Prepare for a hearing appointment",
  "Gemini helped me write down what I'd noticed in my own words and a few practical questions about hearing aids on the NHS. The audiologist went through all of them.",
  "Help me turn my notes into a short list to take to a hearing appointment: what I've noticed and practical questions. No medical advice. [your notes]",
  "Nothing to check.","Forgetting what to say","Everything covered","{hearing,appointments}")

# ---------------- family (19) ----------------
B = "family"
t(B,"zoe_m","chatgpt","Understanding the school application process","Apply for a primary school place",
  "ChatGPT explained the general steps and that the deadline is set by the council. I checked my council's website for the dates and applied online.",
  "Explain in plain English how applying for a primary school place usually works in England. What should I check on my council's website?",
  "I used my council's own admissions page.","Confused about how it works","Applied before the deadline","{school,admissions}")
t(B,"leo_b","copilot","A chore chart the kids actually follow","Make a weekly chore chart for two children",
  "Copilot made a simple chart with age-appropriate jobs and a small reward each week. We stuck it on the fridge. It's lasted a month so far.",
  "Make a simple weekly chore chart for a [age]-year-old and a [age]-year-old. Age-appropriate jobs and a small weekly reward.",
  "Nothing to check.","Nagging every day","Chores done without arguments","{children,chores}")
t(B,"ana_r","gemini","Understanding Tax-Free Childcare","Find out how Tax-Free Childcare works",
  "Gemini explained how it works in general terms. I checked the details and applied on GOV.UK.",
  "Explain in plain English how Tax-Free Childcare works in the UK and who can usually get it. Tell me where to check.",
  "I checked the details on GOV.UK.","Paying full price for childcare","Account set up","{childcare,money}")
t(B,"ryan_c","claude","Explaining how my child is taught maths","Understand the method my child's school uses",
  "My son's homework used a method I'd never seen. Claude explained it with an example so I could help without confusing him.",
  "My child is learning [method] for [topic] in Year [number]. Explain it with a simple example so I can help with homework.",
  "I checked with his teacher it was the same method.","Making homework worse","Able to help","{homework,maths}")
t(B,"mia_s","chatgpt","Planning a birthday party on a budget","Plan a party for under a set amount",
  "ChatGPT suggested a party at home with simple games and a shopping list. We kept it under budget and the kids loved it.",
  "Plan a birthday party for [number] children aged [age] at home for under [amount]. Games, food and a shopping list.",
  "I checked prices before shopping.","Party costs adding up","A great party under budget","{parties,budget}")
t(B,"dev_p","copilot","Writing to school about my child's absence","Explain a child's absence",
  "Copilot wrote a short, clear note for the school's absence email. I use it as a template now.",
  "Write a short note to my child's school explaining they were absent on [date] because [reason]. Keep it brief.",
  "Nothing to check.","Not sure what to include","A quick template I reuse","{school,absence}")
t(B,"kate_h","gemini","Meal ideas for a fussy eater","Find meals a fussy child will eat",
  "Gemini suggested meals built around the foods my daughter already likes, with one small new thing each time. Slowly working.",
  "My child only eats [foods]. Suggest simple family meals built around these, adding one small new thing at a time.",
  "Nothing to check.","Cooking two dinners every night","One meal for everyone most nights","{food,children}")
t(B,"sean_l","claude","Sharing care for mum between siblings","Make a fair rota for visiting a parent",
  "Three of us live different distances away. Claude helped us make a rota that balanced visits, phone calls and shopping. Fewer arguments in the family chat.",
  "Help us make a fair weekly rota for [number] siblings caring for a parent. [describe who lives where and what needs doing]",
  "We all agreed it on a call.","Arguments about who does what","A rota everyone sticks to","{carers,siblings}")
t(B,"bea_t","chatgpt","Writing a wedding speech","Write a short father-of-the-bride speech",
  "ChatGPT gave me a structure and asked me for stories. I wrote the stories myself and it helped me tighten it to five minutes.",
  "Help me structure a five-minute father-of-the-bride speech. Ask me questions for stories, then help me trim it. Warm and a bit funny.",
  "Nothing to check: the stories were mine.","Terrified of a blank page","A speech people remembered","{weddings,speeches}")
t(B,"hamid_k","copilot","Finding help with school uniform costs","Find out about uniform support",
  "Copilot told me some councils and schools offer help with uniform costs and what to search for. Our council had a grant and the school had a pre-loved rail.",
  "Are there ways to get help with school uniform costs in England? What should I search for on my council's website and ask the school?",
  "I checked my council's website.","Uniform costs I couldn't cover","A grant and second-hand uniform","{school,money}")
t(B,"ella_p","gemini","A packing list for a family holiday","Pack for a week away with a toddler",
  "Gemini made a packing list by category. I ticked it off the night before. For once we didn't buy forgotten things at the airport.",
  "Make a packing list for a week's holiday to [place] with a [age] child. Group it by category.",
  "Nothing to check.","Always forgetting something","Nothing forgotten","{holidays,packing}")
t(B,"jon_d","claude","Talking to my child about staying safe online","Plan a talk about online safety",
  "Claude gave me some simple, non-scary ways to start the conversation with my 9-year-old, and pointed me to the NSPCC's advice.",
  "Give me simple, calm ways to talk to a [age]-year-old about staying safe online. Suggest a few questions to start the conversation.",
  "I read the NSPCC's online safety advice.","Didn't know how to bring it up","A good first chat","{online-safety,children}")
t(B,"gemma_f","chatgpt","A family calendar that works","Organise everyone's activities",
  "ChatGPT helped me set out a weekly plan with clubs, lifts and who's doing what. We put it in a shared calendar.",
  "Help me organise a weekly family plan: [list activities, times and who needs a lift]. Spot any clashes.",
  "Nothing to check.","Double-booked lifts","Everyone knows the plan","{calendar,family}")
t(B,"paddy_o","copilot","Writing a eulogy for my grandad","Write a eulogy",
  "Copilot gave me a structure and helped me put my memories in order. The words were mine. It made a hard week a little easier.",
  "Help me structure a short eulogy for my grandad. I'll give you some memories: [memories]. Keep it warm and simple.",
  "Nothing to check: the memories were mine.","Couldn't find the words","A eulogy the family loved","{funerals,writing}")
t(B,"lena_v","gemini","A bedtime routine for a teenager","Agree screen time and bedtime with a teen",
  "Gemini suggested ways to agree a routine together rather than set rules. We wrote it together and he mostly sticks to it.",
  "Suggest how to agree a bedtime and screen routine with a [age]-year-old, so it feels fair to them. Give me some conversation starters.",
  "Nothing to check.","Nightly arguments","A routine we agreed together","{teenagers,routines}")
t(B,"rob_w","claude","Choosing a childminder","Prepare questions for childminder visits",
  "Claude gave me a list of questions to ask. I checked each childminder's Ofsted report before visiting.",
  "Give me a list of questions to ask when choosing a childminder for a [age]-year-old.",
  "I read their Ofsted reports.","Didn't know what to ask","Chose with confidence","{childcare,choosing}")
t(B,"sara_n","chatgpt","A story to explain a new baby to a toddler","Prepare a toddler for a new sibling",
  "ChatGPT wrote a short, simple story about becoming a big sister. We read it every night for a month before the baby came.",
  "Write a short, simple bedtime story for a [age]-year-old about becoming a big [brother/sister].",
  "Nothing to check.","Worried about jealousy","A toddler excited to meet the baby","{children,stories}")
t(B,"ty_r","copilot","Writing to the nursery about a change in pick-up","Tell the nursery about new pick-up arrangements",
  "Copilot drafted a short, clear email. I added the names in the email myself, not in the AI chat.",
  "Write a short email to my child's nursery saying [person] will now collect them on [days]. I'll add the names myself.",
  "I added the names myself.","Not sure what to say","A clear email sent","{nursery,childcare}")
t(B,"alix_m","gemini","A weekly meal plan for a busy family","Plan family dinners for the week",
  "Gemini planned five quick dinners with a shared shopping list and suggested batch cooking on Sunday. Weeknights are calmer.",
  "Plan five quick family dinners for the week, under 30 minutes each, with a shopping list. One should be batch-cooked on Sunday.",
  "Nothing to check.","What's for tea panic every night","Five dinners planned","{meal-planning,family}")

# ---------------- getting-started (19) ----------------
B = "getting-started"
t(B,"vic_h","chatgpt","My first ever question to an AI","Try an AI tool for the first time",
  "My son set up ChatGPT on my phone. I asked it to explain my boiler's error code in simple words. It did, and told me to call an engineer if it kept happening. I was surprised how easy it was.",
  "My boiler shows the code [code]. What does it usually mean, in simple words? What should I check before calling an engineer?",
  "I checked the code in the boiler's manual.","Scared of AI","Use it most weeks now","{beginners,first-steps}")
t(B,"gill_b","copilot","Using voice instead of typing","Talk to an AI tool instead of typing",
  "My fingers aren't great on a phone. I found the microphone button in Copilot and just talked. It wrote back and I could read it at my own pace.",
  "Can you explain how to use the microphone to talk to you instead of typing?",
  "Nothing to check.","Typing on a phone was a struggle","I just talk to it now","{beginners,voice}")
t(B,"ari_k","gemini","Asking it to explain more simply","Get answers I understand",
  "The first answers were full of jargon. I learnt to add \"explain it like I'm new to this\" and \"use short sentences\". Big difference.",
  "Explain [topic] like I'm completely new to it. Use short sentences and no jargon.",
  "Nothing to check.","Answers full of jargon","Answers I understand","{beginners,prompting}")
t(B,"pearl_d","claude","Learning to ask a follow-up question","Get a better answer by replying",
  "I used to give up if the first answer wasn't right. A volunteer showed me I can just reply, like \"shorter please\" or \"what does that word mean?\". It's a conversation.",
  "That's helpful. Can you make it shorter and explain what [word] means?",
  "Nothing to check.","Gave up after one answer","Getting what I need","{beginners,follow-ups}")
t(B,"monty_s","chatgpt","Turning off chat history for privacy","Find the privacy settings",
  "I asked ChatGPT how to stop my chats being used to train it. It explained where the setting usually is. I found it in settings and turned it off.",
  "How do I find the setting to stop my chats being used to improve the model? Explain simply.",
  "I checked the setting in the app myself.","Worried about privacy","Setting turned off","{privacy,settings}")
t(B,"june_w","copilot","Which free AI tool should I start with?","Choose a free AI tool",
  "I asked a few friends and tried two. Copilot was already on my laptop, so I used that. The tool matters less than how you ask.",
  "I'm new to AI tools. What can a free AI chatbot help an older person with day to day? Give me five simple examples to try.",
  "Nothing to check.","Didn't know where to start","Using it for letters and recipes","{beginners,choosing}")
t(B,"del_r","gemini","Getting shorter answers","Stop AI giving me essays",
  "Every answer was a page long. Now I start with \"in three bullet points\" or \"in under 50 words\". Much easier to read on my phone.",
  "In three short bullet points, tell me [question].",
  "Nothing to check.","Pages of text on my phone","Short, readable answers","{beginners,prompting}")
t(B,"kay_o","claude","When the AI got it wrong","Learn to double-check answers",
  "I asked about bin collection days and it confidently gave the wrong day. Lesson learnt: it doesn't know local details. I check anything important on the official website now.",
  "Where should I check [local information] officially? Don't guess the answer.",
  "I now check local details on my council's website.","Trusted every answer","Check anything that matters","{beginners,checking}")
t(B,"ivan_p","chatgpt","Using AI to translate a conversation","Help a neighbour who speaks little English",
  "My neighbour and I used ChatGPT on my phone to translate back and forth. Slow, but we sorted out the parcel mix-up and had a laugh.",
  "Translate this into [language], simply: [message]. Then translate the reply back into English.",
  "Nothing to check.","Couldn't understand each other","Sorted it out together","{translation,neighbours}")
t(B,"elsie_m","copilot","Teaching my mum to use AI","Show a parent how to use an AI tool",
  "I sat with my mum and we asked it for a soup recipe from what was in her cupboard. Low stakes, and she saw it was just typing a question. Then we talked about what not to type in.",
  "I have [ingredients]. Suggest a simple soup recipe with short steps.",
  "We talked about never typing bank details.","Mum thought AI was dangerous","She uses it for recipes now","{beginners,parents}")
t(B,"hank_t","gemini","Giving it a role to get better answers","Ask the AI to act as a helper",
  "I found starting with \"You are a patient teacher\" made the answers kinder and simpler. Small trick, big help.",
  "You are a patient teacher helping someone new to computers. Explain how to [task] step by step.",
  "Nothing to check.","Answers too technical","Patient, simple steps","{beginners,prompting}")
t(B,"tilly_c","claude","Making a to-do list from a brain dump","Turn worries into a list",
  "I typed everything on my mind and asked for a list grouped by urgency. Seeing it laid out made me calmer.",
  "Here's everything on my mind. Turn it into a short to-do list grouped by what's urgent, what can wait, and what I can drop. [your list]",
  "Nothing to check.","Overwhelmed","A list I can work through","{lists,planning}")
t(B,"sid_a","chatgpt","Learning what not to type into an AI","Understand what to keep private",
  "I asked ChatGPT itself what I shouldn't share. It listed passwords, bank details and anything I wouldn't want on a postcard. I keep that rule now.",
  "What kinds of personal information should I avoid typing into an AI chatbot, and why?",
  "I read the site's page on what you can safely share.","Typed anything in","Keep private things out","{privacy,beginners}")
t(B,"betty_l","copilot","Using AI at the library computer session","Try AI with a volunteer's help",
  "The library runs a weekly session. The volunteer helped me ask Copilot to write a letter to my grandson. Now I go every week.",
  "Help me write a short, cheerful letter to my grandson who has just started university.",
  "Nothing to check.","Never used a computer much","Going every week","{library,beginners}")
t(B,"frank_m","gemini","Asking AI to explain something on a form","Understand a confusing form question",
  "One question on a form made no sense. I typed just that question and asked what it meant. It explained it and I answered it myself.",
  "What does this form question mean, in simple words? [type the question only]",
  "I answered it myself.","Stuck on one question","Form finished","{forms,beginners}")
t(B,"ros_k","claude","Getting it to ask me questions first","Get help that fits my situation",
  "Instead of guessing, I ask it to ask me questions first. The answers fit my situation much better.",
  "Before you answer, ask me three questions so you understand my situation. Then help me with [task].",
  "Nothing to check.","Generic answers","Answers that fit","{prompting,beginners}")
t(B,"wilf_o","chatgpt","Using AI for a recipe from what's in the fridge","Avoid wasting food",
  "I type what's in the fridge and ask for one simple meal. It's become a habit and we throw away less.",
  "I have [ingredients]. Suggest one simple meal in under 30 minutes with short steps.",
  "Nothing to check.","Food going in the bin","Using up leftovers","{food,beginners}")
t(B,"cass_j","copilot","Starting a new chat for a new topic","Stop answers getting muddled",
  "Answers got confused when I asked about different things in one chat. Starting a new chat for each topic fixed it.",
  "(Start a new chat, then:) I want help with [new topic].",
  "Nothing to check.","Muddled answers","Clear answers","{beginners,tips}")
t(B,"lou_g","gemini","Checking an answer by asking for sources","Know where an answer comes from",
  "I ask it to tell me which official website I should check. Then I go there myself. It's a good habit.",
  "Which official UK website should I check to confirm this? Give me the organisation's name, not just a link.",
  "I visited the official site myself.","Took answers on trust","Check the official source","{checking,beginners}")

# ---------------- staying-safe (19) ----------------
B = "staying-safe"
t(B,"maud_e","chatgpt","Checking a text that said it was from HMRC","Check a tax refund text",
  "A text said I was owed a tax refund and gave a link. I copied the words, without clicking, and asked ChatGPT. It said HMRC doesn't send refund links by text. I forwarded it to 7726 and deleted it.",
  "Does this text look like a scam? Explain the warning signs. I haven't clicked the link. [paste the text]",
  "I checked GOV.UK's page on HMRC scams.","Nearly clicked","Reported and deleted","{scams,hmrc}")
t(B,"reg_b","copilot","Working out if a call from 'my bank' was real","Check a suspicious phone call",
  "Someone rang saying they were from my bank and asked me to move money. I hung up. Afterwards Copilot explained this is a common scam. I rang my bank on the number on my card from a different phone.",
  "Someone called saying they were from my bank and asked me to move money to a safe account. Is that a known scam? What should I do now?",
  "I called my bank on the number on my card.","Shaken by the call","Bank confirmed it was a scam","{scams,banking}")
t(B,"tilda_w","gemini","Checking a 'Hi Mum' WhatsApp message","Spot a family impersonation scam",
  "A message from a new number said it was my daughter with a new phone and needed money. Gemini listed the warning signs. I rang my daughter on her old number. It wasn't her.",
  "I got this WhatsApp message from a new number claiming to be my child. Does it look like a scam? What should I do? [paste message]",
  "I rang my daughter on her usual number.","Nearly sent money","Blocked and reported","{scams,whatsapp}")
t(B,"cyril_h","claude","Checking an online marketplace buyer","Spot a fake buyer",
  "A buyer wanted to pay through a link and send a courier. Claude explained the warning signs. I only accepted cash on collection.",
  "A buyer for my [item] on [marketplace] wants to pay through a link and send a courier. Does this look like a scam?",
  "I read the marketplace's own safety advice.","Excited about a quick sale","Avoided a scam","{scams,selling}")
t(B,"gloria_p","chatgpt","Checking a too-good investment advert","Check an investment advert",
  "An advert with a celebrity promised huge returns. ChatGPT listed the red flags. I checked the FCA's warning list and the company was on it.",
  "This advert promises [returns]. What are the warning signs of an investment scam? [describe the advert]",
  "I checked the FCA warning list.","Tempted by the returns","Company was on the FCA warning list","{scams,investments}")
t(B,"ern_s","copilot","Checking a QR code on a parking machine","Pay for parking safely",
  "There was a sticker with a QR code on the parking machine. Copilot said fake QR stickers are a known trick. I used the council's official app instead.",
  "Is it safe to scan a QR code stuck on a parking machine? What should I do instead?",
  "I used the council's official parking app.","About to scan it","Paid through the official app","{scams,parking}")
t(B,"daisy_q","gemini","Spotting a fake energy rebate email","Check an energy rebate email",
  "An email offered an energy rebate if I entered my card details. Gemini listed the red flags, like the urgent deadline and the sender's address. I reported it to the scam email service.",
  "Does this email look like a scam? List the warning signs. I haven't clicked anything. [paste email text]",
  "I forwarded it to the official scam email reporting address.","Almost entered card details","Reported it","{scams,email}")
t(B,"mick_a","claude","Setting up two-step verification","Make my email account safer",
  "Claude explained what two-step verification is and why it helps. I followed my email provider's own help page to set it up.",
  "Explain two-step verification in simple terms and why it helps. Then tell me what to search for on my email provider's help page.",
  "I followed my email provider's help page.","Only a password protecting everything","Two-step verification on","{security,accounts}")
t(B,"jean_k","chatgpt","Checking a romance message","Ask if an online friend might be a scammer",
  "Someone I'd met online started asking for money for a flight. I asked ChatGPT about the warning signs. It listed several that matched. I stopped replying.",
  "Someone I met online is asking for money for [reason]. What are the warning signs of a romance scam?",
  "I read Action Fraud's page on romance scams.","Unsure about someone","Stopped before sending money","{scams,romance}")
t(B,"bert_n","copilot","A computer pop-up said I had a virus","Check a tech support pop-up",
  "A pop-up said my computer was infected and to ring a number. Copilot said real companies don't do this. I closed the browser and didn't call.",
  "A pop-up says my computer has a virus and tells me to call a number. Is this a scam? What should I do?",
  "I ran my normal antivirus to be sure.","Panicked by the pop-up","Closed it and stayed safe","{scams,computers}")
t(B,"flo_d","gemini","Checking a charity collector's website","Check a charity is real",
  "Someone at the door gave me a leaflet. Gemini explained how to check a charity is registered. I looked it up on the Charity Commission's register.",
  "How can I check a charity is real and registered in England and Wales?",
  "I searched the Charity Commission register.","Not sure the collector was real","Donated directly to a registered charity","{charity,scams}")
t(B,"hamish_t","claude","Checking a concert ticket seller","Avoid fake tickets",
  "A seller on social media had cheap tickets for a sold-out show. Claude listed the warning signs, like asking for bank transfer. I bought through the official resale site.",
  "Someone is selling tickets for a sold-out event on social media and wants a bank transfer. Is this risky? What's safer?",
  "I used the official resale site.","Nearly paid a stranger","Bought through the official site","{scams,tickets}")
t(B,"sal_m","chatgpt","Understanding what a password manager is","Stop reusing passwords",
  "I used one password for everything. ChatGPT explained password managers in plain words. My son helped me set one up.",
  "Explain what a password manager is in simple words and why it's safer than reusing one password.",
  "My son helped me choose a well-known one.","One password for everything","Different passwords for each account","{passwords,security}")
t(B,"queenie_r","copilot","Checking a delivery email with a 'reschedule' link","Check a delivery email",
  "An email said a parcel needed rescheduling. I wasn't expecting anything. Copilot listed the warning signs. I deleted it.",
  "Does this delivery email look like a scam? I'm not expecting a parcel. [paste the text without clicking anything]",
  "I checked the courier's own website for scam warnings.","Confused by the email","Deleted it","{scams,delivery}")
t(B,"ozzy_b","gemini","Spotting a fake voice message","Check a voice message from a 'relative'",
  "A voice note sounded like my nephew asking for money urgently. Gemini explained that voices can be faked. I rang my nephew. He was fine.",
  "I got an urgent voice message that sounded like a relative asking for money. Can voices be faked? What should I do?",
  "I rang my nephew directly.","Frightened by the message","Checked and it was fake","{scams,voice}")
t(B,"pru_l","claude","Checking a fake job interview request","Check a job offer that asked for my bank details",
  "A 'recruiter' wanted my bank details before an interview. Claude explained why that's a warning sign. I didn't send anything.",
  "A recruiter wants my bank details before an interview. Is this normal? What are the warning signs?",
  "I checked the company's real website.","Nearly shared my bank details","Kept them private","{scams,jobs}")
t(B,"walt_c","chatgpt","Checking a 'your account is locked' email","Check an account warning email",
  "An email said my streaming account was locked. ChatGPT pointed out the generic greeting and odd sender address. I logged in through the app directly and everything was fine.",
  "Does this email look like phishing? What should I check? I haven't clicked anything. [paste text]",
  "I logged in through the official app, not the email.","Worried about my account","Account was fine","{phishing,email}")
t(B,"edna_f","copilot","Asking AI what I should never share with it","Learn what to keep out of AI chats",
  "Before using Copilot for my letters, I asked what to keep out. It said passwords, bank details and anything identifying. I use placeholders like [my address] now.",
  "What should I never type into an AI chatbot? Give me a short list.",
  "I read this site's safe sharing page.","Unsure what was safe","Use placeholders now","{privacy,beginners}")
t(B,"rex_h","gemini","Checking a 'free gift' survey","Check a prize survey",
  "A message said I'd won a gift for filling in a survey and paying postage. Gemini said this is a common scam. I ignored it.",
  "I've been told I won a gift if I complete a survey and pay postage. Is this a scam?",
  "I read the Citizens Advice scams page.","Thought I'd won something","Ignored the scam","{scams,prizes}")

assert len(P) == 170, len(P)
cnt = {}
for p in P: cnt[p[0]] = cnt.get(p[0], 0) + 1
print(cnt)
q = lambda s: "$t$" + s + "$t$"
rows = []
for i, (b, a, tk, ti, ta, bo, pr, ch, be, af, tg) in enumerate(P):
    hrs = random.randint(8, 45 * 24)
    rows.append(f" (null,'{b}','STORY','published',true,'{a}',\n  {q(ti)},\n  {q(ta)}, '{tk}', '{TOOL[tk]}',\n  {q(bo)},\n  {q(pr)},\n  {q(ch)},\n  {q(be)}, {q(af)},\n  '{tg}', now() - interval '{hrs} hours', now() - interval '{hrs} hours')")
sql = """-- 170 more example tips for The Boring Bits, so each of the 9 categories has 20 (with seed_examples.sql).
-- Not real people's posts. Each is marked is_sample, shows an "Example" label and has a made-up display name.
-- Each is based on a common use people describe online (forums, council and ombudsman AI guidance, news).
-- Generated by sql/gen_examples_more.py. Remove all examples with:
--   delete from public.posts where is_sample;

insert into public.posts (author, board_id, type, status, is_sample, sample_author, title, task, tool_key, tool, body, prompt, checks, outcome_before, outcome_after, tags, created_at, updated_at)
values
""" + ",\n\n".join(rows) + ";\n"
pathlib.Path(__file__).with_name("seed_examples_more.sql").write_text(sql)
print("ok", len(sql))
