# Casa Corazon — Household Expense Tracker

A mobile-first PWA for tracking shared household expenses between 3 people (Nash & Jordi, and Karen). Uses Notion as the backend database.

## Stack

- Next.js 16 (App Router) + TypeScript
- Tailwind CSS v4
- Notion API (via `@notionhq/client`)
- Vercel deployment

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Set up the Notion integration

1. Go to https://www.notion.so/profile/integrations
2. Click **New integration**
3. Name it **Casa Corazon App**, select your workspace
4. Copy the **Internal Integration Secret** — this is your `NOTION_TOKEN`
5. In Notion, open your Expenses database, click **...** (top right) > **Connections** > connect **Casa Corazon App**

### 3. Configure environment variables

Copy `.env.example` to `.env.local` and fill in:

```
NOTION_TOKEN=<your integration secret>
NOTION_DATABASE_ID=7b5e0dc24e1a47f8b23ff4c3908058a9
```

### 4. Generate PWA icons

```bash
node scripts/generate-icons.mjs
```

### 5. Run locally

```bash
npm run dev
```

Open http://localhost:3000

## Deploy to Vercel

### Option A: Push to GitHub and connect

1. Push this repo to GitHub
2. Go to https://vercel.com/new and import the repo
3. Add environment variables in **Project > Settings > Environment Variables**:
   - `NOTION_TOKEN`
   - `NOTION_DATABASE_ID`
4. Deploy

### Option B: CLI

```bash
npx vercel deploy
```

Set environment variables in the Vercel dashboard after deployment.

## Project structure

```
app/
  layout.tsx          — Root layout with bottom nav, PWA meta tags
  page.tsx            — Redirects to /add
  add/page.tsx        — Tab 1: Add Expense form
  unpaid/page.tsx     — Tab 2: Unpaid expenses
  balance/page.tsx    — Tab 3: Balance dashboard
  history/page.tsx    — Tab 4: History / settlements
  api/
    expenses/
      route.ts        — GET (list) + POST (create)
      [id]/route.ts   — PATCH (update)
components/
  AppShell.tsx        — Layout wrapper with identity check
  BottomNav.tsx       — Fixed bottom navigation
  IdentityPicker.tsx  — First-visit user selection
  ExpenseForm.tsx     — Add expense form
  ExpenseRow.tsx      — Expense display card
  RecurringBanner.tsx — Missing recurring expenses banner
  Toast.tsx           — Toast notifications
  Spinner.tsx         — Loading spinner
lib/
  notion.ts           — Notion API client
  types.ts            — TypeScript types
  categoryRules.ts    — Category defaults
  calculateKarenOwes.ts — Debt calculation
  generateItemName.ts — Auto item naming
  recurringCheck.ts   — Missing recurring detection
  useUser.ts          — User identity hook
```

## Notion database properties

The Notion database should have these properties:

| Property | Type | Notes |
|---|---|---|
| Item | Title | |
| Amount (MXN) | Number | |
| Karen Owes | Number | Calculated server-side |
| Date | Date | Start date only |
| Category | Select | Rent, Internet, Electricity, Gas, Water Filter, Kitchen, Garden, Cleaning, House Supplies, Pet, Maintenance, Loan, Other |
| Paid By | Select | Nash & Jordi, Karen |
| Split | Select | Shared (all 3), N&J only, Karen only |
| Type | Select | Recurring Bill, One-Off, Settlement |
| Status | Select | Paid, Pending |
| Settlement Method | Select | Direct payment, Rent deduction, Bank transfer |
| To discuss | Checkbox | |
| Notes | Rich text | |
| Settlement | Relation | Self-relation for linking expenses to settlements |
