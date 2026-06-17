# Roadhouse Direct Booking

Direct booking site for my lodge in Twin Lakes, Colorado. Airbnb and Booking.com take a cut on every reservation, and over a season that adds up to real money. So I built my own booking flow. Guests pick dates, see live availability, pay with a card, and the reservation drops into the same channel manager that syncs everything else, so I'm never double-booked.

This repo is the frontend. The backend lives in Supabase Edge Functions, which are kept in a private repo.

## Stack

React + TypeScript on Vite, Tailwind for styling, Supabase for the backend, Square Web Payments SDK for cards, Netlify for hosting.

## How a booking works

1. `availability.ts` queries a `hostex-availability` edge function, which checks the channel manager so the site can never double-book against Airbnb or Booking.com
2. The booking flow collects guest details and tokenizes the card with the Square Web Payments SDK (card data never touches my server)
3. The token goes to a `booking-api` edge function that authorizes the payment through Square and creates the reservation
4. Confirmation page gives the guest a booking reference and a cancel link

Cancellations run through their own page with seasonal policy logic (peak season has a stricter window than shoulder season).

## Running locally

```
npm install
cp .env.example .env   # fill in your values
npm run dev
```

| Variable | What it is |
|---|---|
| `VITE_BOOKING_API_BASE` | URL of your booking-api edge function |
| `VITE_SQUARE_APP_ID` | Square application ID (sandbox or production) |

Deploys to Netlify with the included `netlify.toml`.

## Notes

The production edge functions handle availability checks, payment authorization, webhook reconciliation, and payment capture on check-in day.
