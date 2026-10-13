# Redesign v6 build notes (branch redesign-v6, Oct 13 2026)

What changed in the site
- New look matching roadhousetwinlakes.com (header, Playfair Display and Montserrat, dark teal buttons, light sage page, tan tiles). All styling in src/theme.css.
- Home: date range picker, guests, pets, 21 day availability grid (booking-api GET /calendar per room), one "At the lodge" section, Grizzly as the group option, reviews placeholders, location, footer.
- Room page: photo grid, collapsed description and amenities, price box with the live quote from POST /availability plus add ons (pet fee, early check in by the hour up to 2 hours, late checkout 1 hour). Add ons only show when the room is free the night before (early) or the checkout night (late).
- Checkout (booking-flow): same Square Web Payments code as before (card, Apple Pay, Google Pay, Cash App Pay), new layout, policy checkbox required, extras added to the hold amount and sent as `extras` plus a note.
- Search state lives in the URL (checkIn, checkOut, guests, pets, early, late) so pages agree and links are shareable.

Fees used by the client (src/lib/booking.ts)
- Pet fee per stay: rooms $95, Penthouse $125, Carriage House $125, Grizzly $185 (from past reservations in Supabase; no config exists yet).
- Early check in per hour: rooms $15, Penthouse and Carriage $25, Grizzly $40. Max 2 hours (2pm).
- Late checkout per hour: same rates, 1 hour (11am).
- Cleaning, nightly rate and tax come from booking-api.

Server work still needed before go live (booking-api)
1. Recompute the price server side in /authorize (nightly from Hostex or daily_prices, cleaning from property_config, pets and early/late from new property_config columns) and reject if the client amount differs. The client currently sends `extras` and the total; the server trusts it.
2. Add property_config columns: pet_fee, max_pets, early_fee_per_hour, late_fee_per_hour, early_cap_per_day, late_cap_per_day. Enforce lodge wide caps (1 early, 2 late per day) in /authorize and expose them in /availability so the client can hide the add on when the cap is hit.
3. Store `extras` and `policyAcknowledged` on direct_booking_requests, and carry early/late into the Hostex note so cleaning knows.
4. Security list from the Oct 13 review: send-sms auth, square-sales-webhook signature check, rotate OWNER_TOKEN, CORS lock, rate limit /availability and cache it 60 seconds, remove the $150 fallback.

Placeholders to fill
- Three guest reviews on the home page, street address, phone, email, café hours, map embed.

Local run
- `.env.local` with VITE_BOOKING_API_BASE and VITE_SQUARE_APP_ID (both exist on Netlify). Without the Square app id the card form shows "Failed to initialize payment form" locally; that is expected.
