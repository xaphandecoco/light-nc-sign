# Light NC Sign: notice of changes

Light NC Sign is a modified copy of [OpenSign](https://github.com/OpenSignLabs/OpenSign) (upstream tag
`v2.41.3`, commit `e5f2c5c0a9f65ec01d8a53e4bf3a390c7ade7bcd`), run by Light of the World Worldwide
Ministries - North Caloocan.

The whole work is licensed under the GNU Affero General Public License version 3 (see `LICENSE`).
Upstream copyright and licence notices are kept. Source for the running version is always at
`https://github.com/xaphandecoco/light-nc-sign/tree/<release tag>`, linked from the footer of every page
(AGPL-3.0 section 13). This file lists the changes, as AGPL-3.0 section 5(a) asks.

Licence notes carried over from upstream:
- The root `LICENSE` says the directory `apps/OpenSignServer/cloud/customRoute` is covered by "the licence
  defined in that directory". That directory has no licence file in this tag, and
  `apps/OpenSignServer/package.json` said `MIT`. We treat everything as AGPL-3.0 and set that package to
  `AGPL-3.0`. Third-party components keep their own licences.
- `apps/OpenSignServer/font/times.ttf` (upstream) is not an open font; we do not use it in the browser
  (see "Fonts" below) and it should be reviewed before further redistribution.

## Changes

Branding
- Product name "Light NC Sign" everywhere (screens, page titles, emails, signing certificate text).
- Logo, favicon and app icons are the Light of the World Worldwide Ministries seal. Colours are the Light NC
  palette (yellow `#FAD719` with ink `#3F3F40`), light and dark. Internal theme names are now `lncsignlight` and
  `lncsigndark`.
- Email templates and the sender name use "Light NC Sign". The "report spam" footer that pointed to the upstream
  company was replaced with a plain notice.
- Footer on every page: "Light NC Sign is based on OpenSign, licensed AGPL-3.0. Source code" (links to the
  exact release tag).

Sign-up is closed
- The cloud functions `usersignup` and `newsletter` are removed. `addadmin` works only with the master key (used once at
  deploy to create the owner account; the owner account must exist before the public address opens).
- A `beforeSave` guard on the user class (`UserBeforeSave.js`) refuses any new user that is not made with the
  master key, so `POST /users` and account creation through login adapters are refused.
- Server functions that legitimately create accounts for signed-in admins or for signers (`adduser`,
  `savecontact`, `editContact`, the contact-book trigger, `linkContactToDoc`) now save the new user with the master
  key after their own checks.
- The `/addadmin` and `/upgrade-2.1` pages, the extra-info sign-up dialog after login, and the Google and SSO
  login adapters are removed.
- Tests: `apps/OpenSignServer/spec/NoSignUp.spec.js` (the old placeholder spec was removed).

No outside calls from the browser
- Removed or self-hosted: Bootstrap CSS (jsDelivr), Font Awesome Pro (upstream CDN), Google Fonts for typed
  signatures, the Times font (upstream CDN), the pdf.js worker (unpkg), the sending animation (lottie.host),
  the logo and avatar images used by the email builder, the newsletter call, the SSO endpoint, the country lookup
  (`ipapi.co`), the optional "remove background" feature (it downloaded a model from a CDN), and the upstream
  social-media and documentation links.
- Fonts: the PDF text font is Tinos Regular (SIL OFL 1.1, (c) The Tinos Project Authors), the typed-signature
  fonts are Fasthand, Dancing Script, Delicious Handrawn and Cedarville Cursive (SIL OFL, `@fontsource`).
- Icons: Font Awesome Free 6.7.2 (icons CC BY 4.0, fonts SIL OFL 1.1, code MIT) replaces Font Awesome Pro. The
  Free set has no "light" style, so those icons are drawn in the solid style, and a few Pro-only icons may show
  as empty squares.
- Bootstrap 4.0.0 CSS (MIT) is bundled from the same file upstream loaded (checksum verified).

Build and release
- The front-end version script no longer calls the GitHub API; the release tag is passed in at build time.
- Docker images are built from `npm ci` with Node 22.23.0; `.github/workflows/Docker.yml` (pushed to Docker Hub)
  is replaced by `.github/workflows/release.yml`, which builds both images, saves them as archives with
  `SHA256SUMS` and attaches them to the GitHub release. The build fails if the built pages mention an outside host
  or the upstream name outside the attribution line (`apps/OpenSign/audit-build.sh`).
- `docker-compose.yml`, `Caddyfile` and `.env.example` describe Light NC Sign (pinned MongoDB, local storage,
  app id `lnc-sign`, port 8080, no SSO). The upstream sample environment file and Makefile were removed.
- The upstream public API description (`public/openapi.json`) was removed.
