# Digital Inkabi Event Management

A web-based event operations platform for organisers to create and manage events, register attendees, generate unique QR-code tickets, and record attendance at the entrance.

The project is being developed as a multi-event management system, not as a public ticket marketplace. Organisers manage their own attendee lists and issue tickets directly.

> **Development status:** Active development. Features and setup requirements may change as the platform evolves.

## Features

### Organiser accounts
- Sign up and sign in with Supabase email/password authentication.
- Organiser dashboard for viewing and creating events.
- Event membership checks to keep event management scoped to authorised organisers.

### Event management
- Create an event quickly using its name, then complete the guided setup when ready.
- Three-step event setup covering event details, branding, and review.
- Store event description, start and end dates, venue details, city, and timezone.
- Save progress and skip setup to return to it later.
- Upload or replace an event poster.

### Attendees and tickets
- Add attendees manually; an attendee's email address is optional.
- Create one unique ticket for each attendee.
- Generate branded tickets using the event poster, attendee name, and a QR code.
- View and download ticket artwork.
- Generate a PDF ticket and email it to an attendee when a valid email address is available.
- Search and filter tickets and view ticket status.

### Entry scanning
- Scan ticket QR codes using a device camera.
- Validate tickets against the selected event.
- Record successful check-ins and identify tickets that have already been used.

### Event teams
- Invite other organisers using an event-specific invitation link.
- View event team members.
- Allow the event owner to remove organisers.

## Tech stack

| Area | Technology |
| --- | --- |
| Framework | Next.js 16 (App Router) |
| UI | React 19 |
| Styling | Tailwind CSS 4 |
| Database and authentication | Supabase |
| Supabase integration | `@supabase/ssr`, `@supabase/supabase-js` |
| QR generation | `qrcode` |
| QR scanning | `html5-qrcode` |
| PDF generation | `jspdf` |
| Transactional email | Resend |
| Deployment | Vercel |

## Getting started

### Prerequisites

- Node.js 20.9 or later.
- npm.
- A Supabase project.
- A Resend account/API key if you want to email PDF tickets.

### 1. Clone the repository

```bash
git clone https://github.com/Sakhile-Basi/qr-ticket-scanner.git
cd qr-ticket-scanner
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_or_publishable_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

RESEND_API_KEY=your_resend_api_key
RESEND_FROM_EMAIL=Your Event Team <tickets@your-verified-domain.com>
```

The Supabase URL and public key are used by the application to connect to Supabase. The service-role key is used by server-side routes for privileged operations.

**Security:** Never expose `SUPABASE_SERVICE_ROLE_KEY` in client-side code, commit `.env.local`, or share secret keys publicly. Keep environment variables configured in your deployment provider as well.

`RESEND_API_KEY` is required for ticket email delivery. `RESEND_FROM_EMAIL` is optional; if omitted, the application uses Resend's onboarding sender, which is intended for testing.

### 4. Prepare Supabase

The application expects the Supabase database and access policies used by the project to be configured. Core data areas include:

- `profiles` - organiser profile information.
- `events` - event details and poster references.
- `event_members` - organiser membership and event roles.
- `tickets` - attendee details, unique ticket codes, and ticket status.

The event poster upload flow uses a Supabase Storage bucket named `event-posters`.

Apply the SQL migration files in `supabase/migrations/` to the Supabase project. In particular, the event setup migration adds the event description, date/time, timezone, venue, city, and setup-completion fields.

The QR scanner calls the PostgreSQL RPC function `scan_ticket`. Ensure that this function and the required database permissions are present in your Supabase project before using check-in.

> The application repository is still evolving. Do not assume that creating a blank Supabase project alone is sufficient; the required tables, relationships, RLS policies, Storage configuration, and database function must also be in place.

### 5. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 6. Available scripts

```bash
npm run dev     # Start the local development server
npm run build   # Create a production build
npm run start   # Run the production build locally
npm run lint    # Run ESLint
```

## Main application routes

| Route | Purpose |
| --- | --- |
| `/admin/login` | Organiser sign-in and account creation |
| `/admin/dashboard` | View and create events |
| `/admin/events/[eventId]` | Event overview and management hub |
| `/admin/events/[eventId]/setup` | Guided event setup |
| `/admin/events/[eventId]/attendees` | Register and manage attendees |
| `/admin/events/[eventId]/tickets` | View, generate, and distribute tickets |
| `/admin/events/[eventId]/scanner` | Scan tickets and record check-ins |
| `/admin/events/[eventId]/team` | Manage event organisers |

## Project structure

```text
app/
  admin/
    dashboard/
    events/
      [eventId]/
        attendees/
        scanner/
        setup/
        team/
        tickets/
    login/
  api/
    events/
    tickets/
  auth/
    callback/
lib/
  supabase/
  supabaseAdmin.js
supabase/
  migrations/
public/
```

## Important implementation notes

- An attendee is represented by a ticket record. The current data model does not use a separate attendees table.
- Each ticket belongs to an event and has its own unique `ticket_code`; the QR code encodes that ticket code.
- Event setup is optional until the organiser chooses to complete it. Completing setup requires valid start and end dates, with the end after the start.
- The current event setup flow stores event times using the `Africa/Johannesburg` timezone.
- Camera access for QR scanning requires a secure browser context (HTTPS in deployment, or localhost during local development).
- The service-role key must remain server-side.

## Deployment

The application can be deployed to [Vercel](https://vercel.com/). Configure the required environment variables in the Vercel project settings and make sure the production Supabase project has the same database migrations, policies, Storage bucket, and `scan_ticket` function applied.

## Contributing

This is an actively developed project. When making changes, keep event data scoped to the relevant event and preserve the existing attendee-as-ticket data model unless the database design is intentionally revised.
