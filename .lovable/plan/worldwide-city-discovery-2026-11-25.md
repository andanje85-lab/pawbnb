# Worldwide City Discovery

## What will change
- Replace the U.S.-state-only city directory with an international selection of dog-boarding destinations.
- Store and display each city’s country name in the homepage footer and related-city links, while preserving existing U.S. URLs.
- Keep the existing city landing page route and add a focused test for international city entries.

## Technical details
- Update `src/data/cities.ts` to use a country field and include a balanced set of cities across regions.
- Update the footer and city landing page labels to use the new country field.
- Add a data test ensuring representative cities outside the U.S. remain available.

This update is limited to worldwide city discovery; currency conversion and the location-permission prompt are separate unfinished requests.