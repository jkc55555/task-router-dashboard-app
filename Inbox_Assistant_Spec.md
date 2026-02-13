Totally workable---and you can get that "giant inbox + effortless
sorting" feel without sacrificing the discipline that makes it
trustworthy.

Here's a clean way to design it so it feels simple, but remains rigorous
underneath.

The user experience

The Home screen is just three things

Now (what to do next)

Inbox (uncleared stuff)

Projects (what you're committed to)

Everything else is mostly hidden unless you drill in.

The "giant inbox" behavior

Anything can be dumped in: notes, emails, screenshots, links, voice
memos, half-ideas.

The system immediately proposes:

"This is probably a task / project / reference / someday / waiting"

"If task: here's the next action"

"If project: here's the desired outcome + next action"

"If unclear: here are 1--3 questions"

Then you do a one-click disposition:

✅ Next Action

📁 Project

⏳ Waiting

🌱 Someday

📚 Reference

🗑️ Trash

That's the "super easy organizing" part.

How it surfaces things "in the most sensible order"

You want the app to recommend without turning into an unreliable boss.
So: make it a suggestion engine with transparent reasons.

The "Now" list is ranked by a score

Score = urgency + importance + energy fit + friction + freshness

Where:

Urgency: deadlines and time windows

Importance: your goals / roles / areas of responsibility

Energy fit: quick/low-energy vs deep work

Friction: unblock-high-value items first (one email might unlock 10
steps)

Freshness: things that have been ignored too long bubble up

And it should show the reason in plain English:

"Due in 2 days"

"Unblocks 3 tasks"

"Waiting on you since Jan 28"

"Only 10 minutes"

That keeps it from feeling arbitrary.

Projects: suggested focus, not coercion

You described it well: you work on projects "as it makes sense to you,"
but the system should nudge.

Project focus suggestions can be simple:

Top 3 projects this week

Projects with deadlines

Stalled projects (no progress in X days)

High leverage projects (many dependent actions)

Your chosen "theme" (e.g., "cashflow week" or "Ireland logistics week")

And again, show reasons:

"Deadline Feb 20"

"No next action"

"Blocked by one message you can send"

"You flagged this as priority"

Upcoming deadlines: yes, but keep it tight

A useful pattern:

Today / Next 7 days / Next 30 days

Only deadlines tied to either:

a calendar event

a task with a due date

a project milestone

No "fake deadlines" unless you explicitly set them---otherwise the
system becomes noise.

The hidden engine that makes it reliable

Under the hood you still enforce the GTD-like discipline (without naming
it):

Nothing can live forever in Inbox without surfacing ("inbox zero
pressure," but not naggy)

Every project must have:

an outcome statement

at least one next action (or it's marked "needs clarification")

"Done" requires evidence (draft created, email sent, file attached,
etc.)

If the AI suggests a next action, a verifier AI checks:

is it concrete?

is it the true next physical step?

does it depend on missing info?

So the system stays "giant inbox" in feel, but not in chaos.

One design choice that will make or break it

Let the user override rankings instantly.

Pin something to the top

"Snooze until Friday"

"Make this the focus project"

"I'm in low-energy mode"

"I have 20 minutes"

That way the system suggests intelligently, but you remain in
control---no fighting the machine.

If you want to make this real fast, here's a great v1:

Capture (everything goes to Inbox)

One-click disposition (task/project/reference/waiting/someday)

Now list (ranked + reasons + quick filters: 10 min / calls / computer /
errands / deep work)

Deadlines widget (today/7/30)

Weekly review mode (one guided pass to clean up stale items)

If you tell me what you'd want your default "Now" filters to be (time
available? energy level? contexts like calls/errands/computer?), I can
sketch the exact scoring and the minimal data fields each task/project
needs so the system can rank well without becoming complicated.

I love it. make a set of initial instructions I can hand off to a code
development team (don't worry too much about tech stack/platform I've
already got opinions on that) to get started on a prototype

Below is a prototype kickoff spec you can hand to a dev team. It's
written to be stack-agnostic and focuses on product behavior, data
model, and "reliability mechanics" (anti-laziness).

Prototype Kickoff Spec: Inbox-First Task & Project Assistant

0)  Goal

Build a prototype personal assistant that feels like a single giant
inbox where capture is frictionless, organizing is one-click, and the
system surfaces the most sensible next things to do. The assistant uses
AI when helpful, but a deterministic rules layer enforces rigor and
prevents premature "done."

Core principles

Capture first; clarify later.

The system recommends; the user decides.

Nothing is "done" unless it passes validation / evidence rules.

AI is a tool; the platform owns state, memory, and discipline.

1)  Primary UX Surfaces (MVP)

1.1 Home ("Now")

A ranked list of "what to do next," with:

top items (next actions)

ability to pin / reorder (user override)

quick filters: Time available (5/15/30/60/120+), Energy (low/med/high),
Context (calls/errands/computer/deep work)

each item shows a reason for ranking (e.g., "Due in 2 days", "Unblocks 3
tasks", "Waiting on you 12 days", "\~10 minutes")

1.2 Inbox

A single capture stream where anything can be dumped:

text note, pasted email, link, screenshot attachment metadata,
voice-to-text (optional) For each inbox item, show:

AI-proposed classification + next action suggestion

one-click "disposition" buttons (see §2)

"Ask me" prompt if missing info

1.3 Projects

List of projects with:

outcome statement

next action (required) or "needs clarification"

due date (optional)

"stalled" indicator (no progress N days)

suggested "Focus Projects" section (top 3) with reasons

1.4 Deadlines (Widget)

Minimal upcoming deadlines view:

Today / Next 7 days / Next 30 days Only include items with explicit due
dates (task) or milestones (project), not AI-invented dates.

2)  Disposition Model (One-Click Sorting)

Every inbox item must be placeable with one click into one of these
buckets:

Next Action (a single concrete, doable step)

Project (requires \>1 step; must have at least one next action)

Waiting (blocked by someone/something else)

Someday (not committed; optional later)

Reference (information only)

Trash

Rule: nothing leaves Inbox without a bucket assignment (except remaining
in Inbox).

3)  Core Workflow States (Platform-Owned)

Implement a state machine for items:

INBOX

CLARIFYING (missing required info / vague)

ACTIONABLE (has a valid next action)

PROJECT

WAITING

SOMEDAY

REFERENCE

DONE

ARCHIVED

Key enforcement

A PROJECT cannot exist without an outcome + at least one next action (or
else it stays CLARIFYING).

An ACTIONABLE task must have a "valid next action" (see §4).

DONE requires evidence rules (see §6).

4)  "Valid Next Action" Rules (Anti-Vagueness)

A next action is valid only if:

begins with a verb (call, email, draft, buy, schedule, review, etc.)

references a concrete object (person/file/link/place)

is doable in one sitting without requiring planning

has no placeholders ("TBD", "figure out", "work on", "handle")

If invalid:

item remains CLARIFYING

system asks 1--3 targeted questions to make it valid

Example rejection

"Work on taxes" → invalid

"Email CPA asking what docs needed for 2025 filing" → valid

5)  AI Roles (Two-Layer Model)

5.1 Worker AI ("Planner/Doer")

Used for:

proposing classification (task/project/reference/etc.)

drafting next actions

drafting project breakdowns

creating drafts (emails, checklists, summaries)

extracting action items from text

5.2 Verifier AI ("Auditor/Enforcer")

Used only for evaluation:

checks output against platform rules + task-type checklists

flags missing info, vagueness, unsupported claims, skipped steps

returns structured PASS/FAIL with failure reasons

does not rewrite the output (only audits)

Hard gate: platform cannot mark items complete or "actionable" unless
verifier returns PASS.

6)  Definition of Done + Evidence Requirements

Every task type should have "done criteria." In MVP, implement at least:

Draft created (artifact exists: text blob or file pointer)

Message prepared (email/SMS draft with recipient + subject + body)

Scheduled (calendar event created or details captured)

Decision recorded (note with decision + date)

DONE is only permitted when:

required fields are present, and

verifier AI PASSes, and

an evidence artifact is attached (at least a draft / record)

7)  Ranking & Recommendation Engine (Now List)

Implement a scoring model (initial heuristic OK; make tunable):

Inputs

due date proximity

importance (manual priority or project priority)

"staleness" (age since created / last touched)

unblock value (has dependents / unblocks others)

estimated time

energy level

context match

waiting items that need follow-up

Output

ranked list + short "reason tags" (max 2 tags shown)

always allow manual override (pin, move, snooze)

Snooze

snooze until date/time

snooze until next review

snooze "when I'm at computer / errands / calls"

8)  Reviews

8.1 Daily check (lightweight)

show inbox count

show overdue items

show "waiting" follow-ups due

confirm focus projects (optional)

8.2 Weekly review mode (guided)

A guided flow that:

clears inbox items (or explicitly defers)

highlights projects without next actions

highlights stale tasks

prompts to update waiting items

prompts to prune someday items

9)  Data Model (Minimum)

Entities

Item: generic container for everything captured

Task: actionable next action (can be an Item subtype or linked)

Project: outcome + collection of tasks

Artifact/Evidence: drafts, notes, file pointers, message drafts

Reminder: system-generated or user-set

Tag/Context: calls, errands, computer, deep work, etc.

Required fields (suggested)

Item

id

title (short)

body (raw capture)

type (task/project/reference/etc.)

state

created_at / updated_at

source (manual, email, web, etc.)

attachments metadata (optional)

Task

verb/action_text

context

energy

estimated_minutes

due_date (optional)

project_id (optional)

priority (optional)

status/state

Project

outcome_statement

next_action_task_id

due_date (optional)

review_interval (optional)

priority

Artifact

artifact_type (draft/email/decision/note/file)

content or pointer

created_at

linked_item_id

10) AI Interfaces (Structured Outputs Only)

All AI calls must return JSON. No freeform.

Worker output schema (example)

suggested_type

suggested_state

proposed_title

proposed_next_action (if actionable)

proposed_questions\[\] (if unclear)

project_outcome (if project)

subtasks\[\] (optional)

metadata (time estimate, context, energy)

Verifier output schema (example)

status: PASS / FAIL / NEEDS_USER

failures\[\]: {code, severity, message, field_ref}

missing_inputs\[\]

vagueness_flags\[\]

unverifiable_claims\[\]

Platform logic must enforce:

FAIL → do not advance state; send failure list back to worker for
revision

NEEDS_USER → generate questions UI

PASS → proceed

11) Prototype Scope (Recommended Phase 1)

Must deliver:

Capture into Inbox (text + link)

AI classification + suggested next action + one-click disposition

Projects with outcome + required next action

Now list ranking + reasons + filters + snooze + pin

Deadlines widget (today/7/30)

Evidence artifacts (draft notes / message drafts)

Two-layer AI verification gating for:

next action validity

completion validity (draft exists + PASS)

Nice-to-have:

file attachments

calendar/email integrations

mobile capture

12) Non-Goals for MVP

Full autonomy (no "agent sends messages" without confirmation)

Perfect ranking (start heuristic; tune later)

Complex automation beyond reminders

13) Acceptance Criteria

The prototype is successful if:

User can dump 20 messy items into Inbox and triage them quickly.

The system blocks vague tasks and forces clarification.

Projects cannot exist without a next action.

"Now" list feels sensible and explainable.

User can finish a task and it cannot be marked DONE without evidence +
verification PASS.

User can trust the system enough to stop carrying mental RAM.

A)  Sample UI Wireframe Copy (Text-Level)

This is not visual design---this is exact screen language and behavior
your designers/devs can implement.

1.  Home / "Now"

Header:

Now

Filters (pill buttons):

⏱ Time: 5m · 15m · 30m · 60m · 2h+

⚡ Energy: Low · Medium · High

🧭 Context: Calls · Errands · Computer · Deep Work

📌 Pinned

List item format:

Email CPA asking what docs are needed for 2025 filing ⏰ Due in 2 days ·
🔓 Unblocks 3 tasks · ⏱ \~10 min · 🧭 Computer \[Start\] \[Snooze\]
\[Pin\] \[Edit\]

Another example:

Call Jason about SOP draft 💤 Waiting 12 days · 🔔 Follow-up due · ⏱ \~5
min · 🧭 Calls \[Start\] \[Snooze\] \[Pin\] \[Edit\]

Top right:

➕ Capture

🗂 Inbox (5)

📁 Projects

📅 Deadlines

2.  Inbox

Header:

Inbox

Each item shows:

"Email from FedEx about missing customs form" AI thinks this is: Task
Suggested next action: Download and fill out FedEx commercial invoice
for Ireland shipment

\[Make Next Action\] \[Make Project\] \[Waiting\] \[Reference\]
\[Someday\] \[Trash\] \[Edit suggestion\] \[Ask me later\]

Another example:

"Random note: Ireland phone plans?" AI thinks this is: Project Proposed
outcome: Choose and activate phone plans for Ireland Proposed next
action: Compare Vodafone vs Three plans online

\[Make Project\] \[Make Next Action\] \[Someday\] \[Reference\]
\[Trash\]

If unclear:

"Screenshot of receipt" This needs clarification:

Is this for reimbursement?

Should this be attached to an expense report?

\[Answer questions\] \[Reference\] \[Trash\]

3.  Project View

Header:

Project: Choose and activate phone plans for Ireland

Fields:

Outcome:

Have working phone plans for Ireland trip

Due date:

Optional

Status:

Active / Waiting / Someday / Done

Focus:

⭐ Focus this week (toggle)

Next Action (required):

Compare Vodafone vs Three plans online ⏱ \~20 min · 🧭 Computer · ⚡
Medium

Task list:

☐ Compare Vodafone vs Three plans online (next)

☐ Buy selected plans

☐ Set up eSIMs on phones

☐ Test before departure

If no next action:

⚠️ This project needs a next action before it can be active. \[Add next
action\]

4.  Capture

Header:

Capture

Input box:

Dump anything here: notes, tasks, links, emails, ideas...

Buttons:

\[Save to Inbox\]

(Optional) 🎤 Voice

(Optional) 📎 Attach

After save:

Saved to Inbox. Want to clarify it now? \[Clarify now\] \[Later\]

5.  Deadlines

Header:

Deadlines

Today

File insurance form

Call bank

Next 7 Days

Send draft agreement to Mike

Book flights

Next 30 Days

Submit tax docs

Renew passport

(Only real due dates / milestones appear here.)

6.  Weekly Review Mode

Header:

Weekly Review

Step 1: Inbox

You have 12 items in Inbox. \[Start clearing\]

Step 2: Projects

3 projects have no next action. \[Fix now\]

Step 3: Waiting

4 waiting items need follow-up. \[Review\]

Step 4: Someday

Review 8 someday items. \[Skim\] \[Defer all\]

Step 5: Focus

Pick up to 3 focus projects for this week. \[Select\]

B)  10 Realistic Test Scenarios

These are acceptance tests for the prototype.

1.  Messy Capture Dump

User pastes:

an email thread

a random note ("Ireland phones?")

a link

"do taxes"

Expected:

All go to Inbox

AI suggests classification

"do taxes" is rejected as vague and requires clarification

2.  Vague Task Rejection

User tries to save:

"Work on website"

Expected:

System blocks it as invalid next action

Asks: "What's the next physical step?" with examples

Does not allow ACTIONABLE state

3.  Project Without Next Action

User creates project:

"Prepare Q1 financials"

Expected:

System requires outcome + next action

Project stays in CLARIFYING until next action added

4.  AI Suggests Wrong Classification

Inbox item:

"FedEx says customs form missing"

AI suggests: Reference

User clicks: Make Next Action

Expected:

System allows override

Next action must still pass validation

5.  Waiting Follow-Up

User marks:

"Waiting on Jason to send SOP"

Expected:

Goes to WAITING

Follow-up date auto-suggested

Appears in Now list when follow-up is due

6.  Evidence-Gated Completion

Task:

"Draft email to Mike about agreement"

User clicks Done without writing email.

Expected:

System blocks completion

Says: "No draft artifact attached"

Requires draft text before DONE

7.  Two-AI Verification Catch

Worker AI produces:

"Review document"

Verifier AI flags:

Vague verb

No object specified

Expected:

Task remains CLARIFYING

User sees exact failure reasons

8.  Ranking Transparency

User sees in Now:

"Email CPA..."

With tags:

Due in 2 days · Unblocks 3 tasks · \~10 min

Expected:

User can click "Why is this high?" and see scoring factors

User can pin something else above it

9.  Snooze & Resurface

User snoozes:

"Call bank" until Friday

Expected:

Disappears from Now

Reappears Friday morning with "Snoozed until today" reason tag

10. Weekly Review Flow

User enters Weekly Review.

Expected:

System forces pass through Inbox, Projects w/o next actions, Waiting,
Someday

Cannot finish review while any project lacks a next action

At end, user selects 3 focus projects

Final note to your dev team

This prototype should feel:

Effortless to capture

Strict about clarity

Honest about what's actually done

Helpful but not bossy

Trustworthy enough to hold your mental load
