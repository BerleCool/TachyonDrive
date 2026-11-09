# Offline elevation and fuel-estimation model (0.3)

The phone reports WGS84 ellipsoidal altitude and vertical uncertainty from `expo-location`.
Only **differences** are used; displayed altitude is NOT claimed to be mean-sea-level height.
Altitude can be missing or inaccurate in tunnels, dense streets and poor GPS conditions.

## Quality gates

The elevation accumulator requires valid altitude (-500 to 9000 m),
vertical accuracy <= 12 m, moving distance, >= 40 m between accepted anchors,
>= 5 seconds, and a height difference > max(3.5 m, 1.25 × combined
vertical uncertainty). Slopes that exceed plausible road gradients are discarded.
Location gaps and pause/resume reset the anchor, preventing invented climbs.
The accumulator tracks raw ascent, descent, coverage, and rejected readings.

This is an heuristic rather than a survey-grade altimeter. Flat roads can still
report GPS height changes and rolling hills may be missed if GPS quality is poor.

## Fuel math

Let baseline fuel = recorded distance × user-supplied L/100km / 100.
Each trip snapshots fuel price, fuel type, mass and whether terrain adjustment is on.
We model gravity (m × 9.80665 × height) using 33.7 MJ/L for petrol or
36.9 MJ/L for diesel and a nominal 25% conversion efficiency.
To avoid double-counting hills already included in a measured average,
only 60% of that uphill potential-energy equivalent is added, capped at
45% of baseline. Downhill subtracts at most 18% of the theoretical equivalent,
and at most 15% of baseline. Never infer true fuel cut or zero fuel use.
Corrections require at least 15% covered distance and 40m trip distance.
If vertical GPS is unreliable, no correction is applied.

**This is an experimental scenario model, not a fuel sensor**. Results depend heavily
on engine/load, speed, wind, gears, heating and real consumption. The numbers
displayed are approximations; the ±30% sensitivity figures returned by the
model are illustrative only, not statistical confidence intervals.

The default mass 1150 kg is an editable starting point, informed by the
~1055 kg kerb mass listed by ADAC for some GB-generation i20 1.2 MPi trims;
fuel type and actual mass must be confirmed by the owner. Vehicle variants differ.

## External services

No elevation maps or calls to Google are used. Google Elevation API requires
billing and restricts caching/storing responses. Device-only processing avoids
API keys, cost, route upload, and connectivity dependence.

References:
- Expo location altitude and altitudeAccuracy:
  https://docs.expo.dev/versions/v58.0.0/sdk/location/
- ADAC i20 kerb mass, variant-specific:
  https://www.adac.de/rund-ums-fahrzeug/autokatalog/marken-modelle/hyundai/i20/2generation-facelift/291783/
- Fuel volumetric energy values from ACEA:
  https://www.acea.auto/fact/differences-between-diesel-and-petrol/
- Google Elevation API policies:
  https://developers.google.com/maps/documentation/elevation/policies

## Tests

`tests/elevation.test.cjs` covers low-quality/missing altitude, stopped-GPS jitter,
climb/descent, impossible grades, gaps, bounds, opt-in mode and no free downhill.
`tests/trips.test.cjs` retains historic accounting and DST coverage.

Physical GPS and phone-rendering validation are still required on an actual S25 Ultra.
