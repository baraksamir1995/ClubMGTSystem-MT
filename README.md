# ClubMGTSystem — Gym / Club Management System

Monorepo containing all four platform scaffolds for the Gym / Club Management System.

## Repositories

| Directory | Platform | Description |
|---|---|---|
| [`gym-backend/`](./gym-backend) | NestJS | REST API — auth, payments, scheduling |
| [`gym-admin/`](./gym-admin) | Next.js 14 | Club admin panel (all authenticated staff) |
| [`gym-super-admin/`](./gym-super-admin) | Next.js 14 | Super admin panel (platform-wide, `super_admin` role only) |
| [`gym-mobile/`](./gym-mobile) | Expo (React Native) | Member-facing mobile app (iOS + Android) |

## Shared Infrastructure

- **Database & Auth**: Supabase (PostgreSQL + Auth)
- **Payments**: Stripe
- **Email**: Resend
- **Push Notifications**: Firebase Admin (backend) + expo-notifications (mobile)

## Quick Start

Each sub-project is self-contained. Navigate into the directory and follow its own README:

```bash
cd gym-backend    && cp .env.example .env    && npm install && npm run start:dev
cd gym-admin      && cp .env.local.example .env.local && npm install && npm run dev
cd gym-super-admin && cp .env.local.example .env.local && npm install && npm run dev
cd gym-mobile     && npm install && npm start
```

## Extracting into Separate Repos

Each directory is a complete, standalone project. To move any of them to its own GitHub repo:

```bash
# Example: extracting gym-backend
cp -r gym-backend /path/to/gym-backend
cd /path/to/gym-backend
git init
git add .
git commit -m "Initial commit"
gh repo create baraksamir1995/gym-backend --public --source=. --push
```
