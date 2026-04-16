# gym-admin

Next.js 14 Admin Panel for the Gym / Club Management System.

## Tech Stack

- **Framework**: Next.js 14 (App Router) with TypeScript
- **Styling**: Tailwind CSS
- **Database/Auth**: Supabase (@supabase/ssr)
- **Data Fetching**: React Query
- **Notifications**: react-hot-toast
- **Icons**: Lucide React

## Getting Started

### Prerequisites

- Node.js >= 18
- npm >= 9

### Installation

```bash
npm install
```

### Environment Variables

Copy `.env.local.example` to `.env.local` and fill in the values:

```bash
cp .env.local.example .env.local
```

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |

### Running the App

```bash
# Development
npm run dev

# Production build
npm run build
npm run start
```

## Auth Flow

- All routes are protected by `middleware.ts`
- Unauthenticated users are redirected to `/login`
- After login, users are redirected to `/dashboard`
- The Supabase session is managed via cookies (SSR-compatible)

## Project Structure

```
app/
├── layout.tsx          # Root layout
├── page.tsx            # Redirects to /dashboard
├── globals.css         # Tailwind imports
├── login/
│   └── page.tsx        # Login page (email/password)
└── dashboard/
    └── page.tsx        # Main dashboard (protected)
lib/
├── supabase/
│   ├── client.ts       # Browser Supabase client
│   └── server.ts       # Server-side Supabase client
middleware.ts            # Auth session check on every request
```
