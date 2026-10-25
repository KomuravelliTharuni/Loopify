# Loopify

Loopify is a campus reuse platform for sharing reusable event materials. Members can browse the shared inventory, reserve items for events, confirm handovers, record returns, and review the reuse history.

## Features

- Email and password sign-up/sign-in using Supabase Auth.
- Shared inventory stored in Supabase PostgreSQL and visible to signed-in members.
- Search and filter by material name, category, location, and owner.
- Item listing with quantity, condition, responsible organization, and collection location.
- Reservations with an event name, pickup/event date, and return-by date.
- Database-validated availability to prevent overlapping reservations beyond an item's quantity.
- Reservation lifecycle: reserved, handed over/on loan, returned, needs repair, or cancelled.
- Reuse ledger and impact summary based on recorded transactions.
- A local demo mode for exploring the interface without an account.

## Technology

- React and TypeScript
- Vite
- Supabase Auth
- Supabase PostgreSQL, Row Level Security (RLS), and database functions
- Lucide React icons

## Requirements

- Node.js and npm
- A Supabase project for shared accounts and persistent records

## Run locally

From the project directory:

```sh
npm install
npm run dev
```

Vite prints the local URL in the terminal. The current development setup uses `http://127.0.0.1:5180`.

To check the production build:

```sh
npm run build
```

To serve the built app locally:

```sh
npm run preview
```

## Connect Supabase

1. Create or open a Supabase project.
2. In **Project Settings → API**, copy the project URL and the publishable key (or legacy anon key).
3. Create `.env.local` in the project root using `.env.example` as a template:

   ```env
   VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY
   ```

   Never put a `service_role` key in a frontend environment file or commit credentials to source control.

4. In the Supabase dashboard, open **SQL Editor** and run [`supabase/migrations/202610250001_loopify_schema.sql`](./supabase/migrations/202610250001_loopify_schema.sql).
5. In **Authentication → URL Configuration**, set the local Site URL to the Vite URL and add the matching redirect URL, for example:

   ```text
   Site URL:     http://127.0.0.1:5180
   Redirect URL: http://127.0.0.1:5180/**
   ```

   For a deployed site, configure its HTTPS origin and redirect pattern as well.

6. Restart the development server after changing environment variables.
7. Register or sign in through Loopify. If email confirmation is enabled in Supabase, confirm the email before signing in.

## Database model

The migration creates these tables in the `public` schema:

| Table | Purpose |
|---|---|
| `profiles` | Display name and organization associated with an Auth user ID. |
| `items` | Inventory details, quantity, condition, location, owner organization, and the account that listed the item. |
| `transactions` | Reservation and loan history, including item, borrower account, organization, event, pickup date, return-by date, status, and return details. |

`transactions.borrower_id` references the borrower's Supabase Auth user. The UI looks up the corresponding `profiles.display_name` to show who borrowed an item. Reservation dates, item ID, event, and status are also stored in this table.

The migration also creates database functions for reserving an item, confirming handover, cancelling a reservation, and recording a return. Reservation availability and condition are checked in the database, not only in the browser.

### Seed inventory

The shared project has 11 curated sample materials in `public.items`, owned by the specified account. The removed sample listings **Stands** and **Rack** are excluded. Seed insertion is duplicate-safe by owner, name, and category.

These sample listings are illustrative; they should be reviewed and replaced with accurate campus inventory before operational use.

## How the reservation flow works

1. A signed-in member browses the shared inventory.
2. They choose an item and enter their organization, event, pickup/event date, and return-by date.
3. Loopify calls the `reserve_item` database function. It checks the date range, item condition, item quantity, and overlapping active reservations before saving the reservation.
4. A permitted member confirms the handover. The transaction becomes `on-loan`.
5. After return, a permitted member records its condition and whether it was used. The transaction is marked returned or needs repair, and the item's condition is updated.
6. Reservations and completed activity appear in the Reservations page and reuse ledger.

The UI shows the borrower name and organization, item, event, pickup date, and return-by date when a reservation is available. The database retains the record after completion or cancellation.

## Check records in Supabase

In the Supabase dashboard, open **Table Editor → public**:

- `items` — shared inventory.
- `transactions` — reservations, borrower IDs, event/date details, and status.
- `profiles` — account display names and organizations.

The SQL Editor can also be used for read-only checks. For example, this query displays transaction details with the borrower's name:

```sql
select
  i.name as item,
  p.display_name as borrower_name,
  t.borrower_organization,
  t.event_name,
  t.start_date as pickup_date,
  t.due_date as return_by,
  t.status
from public.transactions t
join public.items i on i.id = t.item_id
left join public.profiles p on p.id = t.borrower_id
order by t.reserved_at desc;
```

To list inventory and current availability:

```sql
select
  i.name,
  i.category,
  i.quantity,
  i.condition,
  i.owner_organization,
  i.storage_location,
  greatest(
    i.quantity - count(t.id) filter (
      where t.status = 'on-loan'
         or (t.status = 'reserved'
             and t.start_date <= current_date
             and t.due_date >= current_date)
    ),
    0
  ) as available_today
from public.items i
left join public.transactions t on t.item_id = i.id
group by i.id
order by i.name;
```

## Demo mode and shared data

When Supabase credentials are missing, or a user chooses **Explore the demo workspace**, Loopify uses browser `localStorage`. Demo data is local to that browser and is not shared or synchronized with Supabase.

Signed-in users load shared items and transactions from Supabase. New items and reservation/return lifecycle changes are written to the database through the Supabase client and database functions.

## Security and data notes

- RLS is enabled for profiles, items, and transactions.
- Signed-in members can read shared inventory and transaction history.
- Members can create items only with their own account as owner.
- Reservation lifecycle changes use database functions that validate the current signed-in user and record ownership/borrower permissions.
- The browser uses only the public publishable/anon key. Database access is restricted by RLS and function permissions.
- Avoid entering real personal or campus information until the project owner has reviewed authentication settings, access policies, retention needs, and applicable privacy requirements.
- The impact report distinguishes verified reuse cycles from self-reported outcomes; the prototype does not claim carbon savings.

## Project structure

```text
src/
  App.tsx                 Main workspace, pages, forms, and user interactions
  AuthScreen.tsx          Sign-in and registration UI
  lib/
    demoInventory.ts      Curated demo inventory
    itemImages.ts         Item illustration selection
    supabase.ts           Supabase client and environment configuration
    types.ts              Shared TypeScript data types
    workspace.ts           Database reads and writes
supabase/
  migrations/
    202610250001_loopify_schema.sql
                          Tables, RLS policies, indexes, and workflow functions
```
