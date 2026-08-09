---
'@rxova/react-seat-map-input': minor
---

Add the seat map input: aircraft cabins, theatres, stadiums and car parks as a headless,
zero-dependency React control.

Each section renders as a real ARIA grid with two-dimensional arrow-key navigation and a single tab
stop, and every seat is a real `<input type="checkbox">` — so `checked`, `FormData`, constraint
validation and the screen-reader role announcement all come from the browser, and a native form
posts a real array under one name.

Unavailable seats carry `aria-disabled`, never the `disabled` attribute. A disabled checkbox is not
focusable, so arrowing across a cabin would silently skip every sold seat and a keyboard user could
never learn which ones are gone — which is most of the information a seat map exists to convey.

Booking rules are props rather than something each application re-derives in a click handler:
`maxSeats`, `minSeats` (a native validation message, not a blocked pick), `contiguous`,
`noOrphanSeats` and `isSelectable`. Every refusal reaches `onReject` and a polite live region with
its reason, because a seat that silently declines to tick is indistinguishable from a broken
control. `findBestSeats(sections, 3)` and `parseLayout` ship as pure, separately importable helpers.

Hostile data and hostile callbacks are contained rather than propagated: a `maxSeats` that is not a
positive integer is ignored and warned about, a `pageSize` that is not falls back to the default so
the page keys can never be inverted or dead, and `isSelectable`, `formatSeatLabel`,
`formatAnnouncement`, `renderSeat` and `formatValidationMessage` all fall back to built-in behaviour
when they throw or return nothing. An unnamed seat and a silently valid form are the two failures
that would do real damage, so neither is reachable from a broken formatter. `onChange` is the
deliberate exception and still propagates — it is the consumer's state setter, and swallowing it
would desync the map while hiding the bug.
