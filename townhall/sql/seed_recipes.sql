-- Five seed recipes for The Boring Bits. Run by hand in Supabase > SQL Editor, AFTER the pivot migration.
-- They are drafts: only admins see them, every title starts "DRAFT, NOT TESTED: ", and no tested tools are set,
-- so they show "Not tested yet". Before publishing each one: test it with the tools listed, check every fact and
-- link against the official source, set the tested date, tested tools and re-test date, and remove the DRAFT prefix.
-- Facts were checked on 20 Nov 2026 against: the Energy Ombudsman's own pages (8 weeks, deadlock letter, 12 months);
-- National Debtline and several appeal guides (POPLA for BPA members, IAS for IPC members, 28 days from rejection;
-- Citizens Advice was not reached); commentary on the Renters' Rights Act 2025 (main changes from 1 May 2026).
-- The 5-week deposit cap comes from the Tenant Fees Act 2019 and was not re-checked here. Links were not opened.
-- Author: the first admin account, or none if there is no admin yet. Remove them any time with:
--   delete from public.posts where type = 'RECIPE' and status = 'draft' and title like 'DRAFT, NOT TESTED:%';

insert into public.posts (author, board_id, type, status, title, task, tool_key, tools, tags, tested_on, prompts, never_paste, how_to_check, failure_points, deadline_warning)
select (select id from public.profiles where role = 'admin' order by created_at limit 1), v.*
from (values
 ('complaints', 'RECIPE', 'draft',
  $t$DRAFT, NOT TESTED: Complain to an energy supplier about a wrong bill$t$,
  $t$Write a clear, polite complaint to your energy supplier about a bill you think is wrong, and know when you can take it further.$t$,
  '', array['chatgpt','copilot','gemini','claude'], array['energy','complaint','bills'], current_date,
  jsonb_build_array(
    jsonb_build_object('label', 'Understand the bill', 'text', $t$I'll paste the main figures from my energy bill. Explain in plain English what each line means, how the total was worked out, and whether it uses an estimated or an actual meter reading. Don't guess anything that isn't in what I paste.

[paste the billing period, meter readings, units used, unit rate, standing charge and total, with no account number or address]$t$),
    jsonb_build_object('label', 'Draft the complaint', 'text', $t$Write a short, polite complaint to my energy supplier. My bill for [period] says I used [X] kWh, but my own meter reading on [date] was [reading], so I think the bill is wrong. Ask them to correct the bill, explain how they worked it out, and confirm in writing. Say I am making a formal complaint. Keep it under 200 words. Use [my name] and [account number] as placeholders.$t$),
    jsonb_build_object('label', 'Check their reply', 'text', $t$Here is my energy supplier's reply to my complaint. Summarise what they have agreed to do and what they haven't. Does it say it is their final response, or a "deadlock letter"? List anything I should ask them to clarify.

[paste the reply, with your name, address and account number removed]$t$)),
  $t$Your account number, full address, bank details, date of birth and passwords. Put them into the email or letter yourself after the AI has drafted it.$t$,
  jsonb_build_array(
    jsonb_build_object('label', 'Energy Ombudsman', 'url', 'https://www.energyombudsman.org/'),
    jsonb_build_object('label', 'Citizens Advice: energy', 'url', 'https://www.citizensadvice.org.uk/consumer/energy/'),
    jsonb_build_object('label', 'Ofgem', 'url', 'https://www.ofgem.gov.uk/')),
  $t$The AI may invent a rule, a compensation amount or a complaint reference. Delete anything you can't find on the official sites. It can't see your account, so it can't tell you whether the supplier's figures are right. Keep copies of everything you send and receive.$t$,
  $t$Your supplier has 8 weeks to sort out your complaint. After that, or sooner if they send a "deadlock letter", you can take it to the Energy Ombudsman for free. You must go to the Ombudsman within 12 months of the deadlock letter.$t$),

 ('letters', 'RECIPE', 'draft',
  $t$DRAFT, NOT TESTED: Understand a confusing council letter in plain English$t$,
  $t$Turn a confusing letter from your council into plain English, with a list of what you need to do and by when.$t$,
  '', array['chatgpt','copilot','gemini','claude'], array['council','letters','council-tax'], current_date,
  jsonb_build_array(
    jsonb_build_object('label', 'Explain the letter', 'text', $t$Explain this letter from my council in plain English, as if to a friend. Then list:
1. What the letter is about, in one sentence.
2. What I need to do, if anything.
3. Any dates or deadlines it mentions, exactly as written.
4. Who I can contact about it, as the letter says.
Only use what is in the letter. If something isn't clear, say so instead of guessing.

[paste the letter text, with your name, address, reference numbers and any amounts that identify you removed]$t$),
    jsonb_build_object('label', 'Draft a reply', 'text', $t$Help me write a short, polite reply to this council letter. I want to [say what you want: ask a question, ask for more time, say they have made a mistake]. Keep it under 150 words. Use [my name], [my address] and [reference number] as placeholders.$t$)),
  $t$Your council tax account or reference number, National Insurance number, bank details, and anyone else's name or details.$t$,
  jsonb_build_array(
    jsonb_build_object('label', 'GOV.UK: find your local council', 'url', 'https://www.gov.uk/find-local-council'),
    jsonb_build_object('label', 'Citizens Advice', 'url', 'https://www.citizensadvice.org.uk/'),
    jsonb_build_object('label', 'Local Government and Social Care Ombudsman', 'url', 'https://www.lgo.org.uk/')),
  $t$The AI may get the type of letter wrong, or invent a deadline. Always check dates against the letter itself. Rules differ between England, Scotland, Wales and Northern Ireland, and between councils. If the letter is about debt, enforcement or court, get free advice from Citizens Advice straight away.$t$,
  $t$Many council letters give a time limit to reply or to challenge a decision. Find it on the letter before you do anything else.$t$),

 ('money', 'RECIPE', 'draft',
  $t$DRAFT, NOT TESTED: Appeal a private parking charge$t$,
  $t$Write an appeal to a private parking company about a parking charge you think is unfair, and know where to go if they say no.$t$,
  '', array['chatgpt','copilot','gemini','claude'], array['parking','appeal','money'], current_date,
  jsonb_build_array(
    jsonb_build_object('label', 'Check what kind of ticket it is', 'text', $t$I've had a parking ticket. Based only on the wording below, is it a Penalty Charge Notice from a council, or a parking charge from a private company? What tells you that? Which company or council issued it, and does it name a trade body such as the British Parking Association (BPA) or the International Parking Community (IPC)?

[paste the wording from the ticket or letter, with the reference number, car registration and your name and address removed]$t$),
    jsonb_build_object('label', 'Draft the appeal', 'text', $t$Write a short, polite appeal to [parking company] about parking charge [reference number]. My reasons are: [list your reasons, for example the signs were hidden, I had a valid ticket, the machine was broken]. I have this evidence: [list photos, receipts or tickets]. Stick to the facts I've given. Don't add legal arguments I haven't mentioned. Keep it under 250 words.$t$)),
  $t$Your car registration, the charge reference number, your name and address, and bank or card details. Add them yourself to the final appeal.$t$,
  jsonb_build_array(
    jsonb_build_object('label', 'POPLA (for BPA members)', 'url', 'https://www.popla.co.uk/'),
    jsonb_build_object('label', 'Independent Appeals Service (for IPC members)', 'url', 'https://www.theias.org/'),
    jsonb_build_object('label', 'National Debtline: parking charge notices', 'url', 'https://nationaldebtline.org/get-information/guides/parking-charge-notices-ew/')),
  $t$The AI often mixes up council tickets and private parking charges, which follow different rules. It may invent legal grounds or quote rules that don't apply. The rules in Scotland and Northern Ireland differ from England and Wales. Paying the charge usually ends any appeal.$t$,
  $t$Appeal to the parking company first, as soon as you can. If they reject it, you usually have 28 days from the rejection to appeal to POPLA (if the company is in the BPA) or the IAS (if it is in the IPC). Check the deadline on the rejection letter.$t$),

 ('home', 'RECIPE', 'draft',
  $t$DRAFT, NOT TESTED: Check a tenancy agreement for unusual clauses$t$,
  $t$Use AI to spot clauses in a tenancy agreement that look unusual or unfair, so you know what to ask about before you sign.$t$,
  '', array['chatgpt','copilot','gemini','claude'], array['renting','tenancy','home'], current_date,
  jsonb_build_array(
    jsonb_build_object('label', 'Find unusual clauses', 'text', $t$I rent in [England / Scotland / Wales / Northern Ireland]. Read these clauses from my tenancy agreement. List any that look unusual, unfair or one-sided, and explain each in plain English. For each, suggest a polite question I could ask the landlord or agent. Don't tell me a clause is illegal unless you're sure, and say which law you mean so I can check it.

[paste the clauses, with names, addresses, signatures and bank details removed]$t$),
    jsonb_build_object('label', 'Check fees and deposit', 'text', $t$Based only on the agreement text I pasted, list every payment the tenant has to make: rent, deposit, and any fees or charges. Show how much and when. Then list what the agreement says about getting the deposit back.$t$)),
  $t$Your name, the landlord's or agent's names, the property address, signatures, bank details and any ID documents.$t$,
  jsonb_build_array(
    jsonb_build_object('label', 'GOV.UK: private renting', 'url', 'https://www.gov.uk/private-renting'),
    jsonb_build_object('label', 'GOV.UK: tenancy deposit protection', 'url', 'https://www.gov.uk/tenancy-deposit-protection'),
    jsonb_build_object('label', 'Citizens Advice: housing', 'url', 'https://www.citizensadvice.org.uk/housing/'),
    jsonb_build_object('label', 'Shelter', 'url', 'https://www.shelter.org.uk/')),
  $t$Renting law in England changed a lot from 1 May 2026 (the Renters' Rights Act 2025), and AI tools may describe the old rules, such as fixed-term assured shorthold tenancies and "no-fault" section 21 evictions. Rules differ in Scotland, Wales and Northern Ireland. The AI can't tell you whether a clause would stand up in court. For anything serious, ask Shelter or Citizens Advice.$t$,
  $t$In England, your landlord must protect your deposit in a government-approved scheme within 30 days of receiving it. In most cases the deposit can't be more than 5 weeks' rent.$t$),

 ('health-admin', 'RECIPE', 'draft',
  $t$DRAFT, NOT TESTED: Prepare questions before a GP appointment$t$,
  $t$Turn your own notes into a short, clear list of what to tell your GP and what to ask, so you get the most out of a short appointment. This recipe doesn't diagnose anything.$t$,
  '', array['chatgpt','copilot','gemini','claude'], array['gp','appointments','nhs'], current_date,
  jsonb_build_array(
    jsonb_build_object('label', 'Organise my notes', 'text', $t$Help me prepare for a 10-minute GP appointment. Turn my notes below into:
1. A three-sentence summary of what I want to talk about.
2. A short timeline: when it started and what has changed.
3. Up to five questions to ask the GP.
Use only what I've written. Don't suggest what might be wrong, and don't suggest any treatment or medicine.

[paste your own notes, with your name, date of birth and NHS number removed]$t$),
    jsonb_build_object('label', 'After the appointment', 'text', $t$Here are my notes from my GP appointment. Turn them into a short list of what I was told to do next, and by when. Don't add any medical information that isn't in my notes.$t$)),
  $t$Your NHS number, full name, date of birth, address, and anyone else's health information.$t$,
  jsonb_build_array(
    jsonb_build_object('label', 'NHS website', 'url', 'https://www.nhs.uk/'),
    jsonb_build_object('label', 'NHS 111 online', 'url', 'https://111.nhs.uk/')),
  $t$Even when told not to, AI tools sometimes suggest what might be wrong. Ignore it: only a health professional can do that. Free AI tools may keep what you type, so keep details to the minimum you need.$t$,
  $t$Not for urgent problems. If it's urgent, use NHS 111. In an emergency, call 999.$t$)
) as v(board_id, type, status, title, task, tool_key, tools, tags, tested_on, prompts, never_paste, how_to_check, failure_points, deadline_warning);
