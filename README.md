# Padaan: The Road There

A crowd-sourced route directory and trip planner for remote destinations in the Philippines (pilot: La Union, Region I).
Team GEIST, DMMMSU College of Information Technology, ITPE 106 Technopreneurship.

    npm install
    npm run dev

## What is in the app (from the MVP documentation)
- **Explore**: destinations with category, route-status and budget filters
- **Route details**: transport legs (jeepney, tricycle, habal-habal, bus, boat, walk) with fare, time, "look for" landmark, last-confirmed date, and a trust panel
- **Trip planner**: combines routes into a day-by-day itinerary with travel time, fare range and transfers; print or save as PDF for a trip sheet
- **Saved**, **Offline region packs**, and a 3-step **Contribute** flow with a review tracker

All route data is SAMPLE data (src/data.ts) until verified by local contributors. Edit it to add real routes.

## Design
The UI follows Google Maps: neutral surfaces, one blue accent, round map controls, red place pins with a blue location dot, a draggable bottom sheet on phones and a side panel on desktop. Light and dark follow the device. Colours live as tokens at the top of `src/index.css`; the theme layer is the last block in that file.
