# Auto Shop Assistant — Navigation Skeleton

This is a minimal Vite + React + Tailwind project that implements the global navigation
we discussed (DASH, CALENDAR, CHECK-IN, INSPECTIONS, RO MANAGER, CUSTOMER DATABASE, ADMIN submenu, LOG OUT),
plus Welcome/Login/Signup/About pre-auth pages.

## Prereqs
- Node.js 18+ and npm

## Quick Start
```bash
npm install
npm run dev
```
Then open the printed localhost URL (usually http://localhost:5173).

## Notes
- This is UI-only: all screens are placeholders you can click through.
- Next steps: wire Firebase Auth, Firestore, and real feature pages.

## GitHub Setup

1. Create a new repo on GitHub (e.g., `ASAPro`), **empty** (no README/gitignore).
2. In your local project directory:
   ```bash
   git init
   git add .
   git commit -m "chore: bootstrap ASAPro auth skeleton"
   git branch -M main
   git remote add origin https://github.com/<your-username>/ASAPro.git
   git push -u origin main
   ```
3. (Optional) Create a `develop` branch:
   ```bash
   git checkout -b develop
   git push -u origin develop
   ```
4. Enable branch protection for `main` in GitHub (require PRs, status checks).
5. Add a repo secret **FIREBASE_TOKEN** if you want to use the provided deploy workflow:
   - Generate with `firebase login:ci`
   - GitHub → Settings → Secrets and variables → Actions → New repository secret.

### Conventional commits (recommended)
- `feat: add inspection template builder`
- `fix: time punch path`
- `chore: upgrade deps`
- `refactor: split calendar into appointments`



## Shop Setup Wizard
- After signup, navigate to `/setup` to create your initial shop settings.
- Data is written to `shops/{auth.uid}/settings/basic` in Firestore.
- Be sure Firestore is enabled in your Firebase project.
