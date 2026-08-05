---
'@rxova/react-otp-input': major
---

Rename the caret class and the injected keyframes/style element from `otp-slots-*` to `rx-otp-*`,
and fix the development warnings, which announced themselves as `react-otp-slots:` — a package name
this has not had for some time, in a format none of its siblings use. They now read
`[react-otp-input]`, like every other package in the suite.

The class name is undocumented and the style element is an implementation detail, but both land in
the DOM, so a stylesheet targeting `.otp-slots-caret` needs updating. Grouped with the 1.0 token
rename because it is the same change of identity, landing in the same release.
