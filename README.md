# appium-ts-mobile-automation

A mobile UI automation framework built on **Appium 3 + WebdriverIO v9 + Jest +
TypeScript**, driving a **real USB-connected device** (Android and iOS; native,
React Native, Flutter and hybrid apps).

It grew out of a production test suite for a doctor-appointment app. The app
under test is not named here — it is configured through `.env` — but the
framework, the sample modules and the design decisions are all real.

The suite drives the app the way a user does — tap, type, scroll — and checks
what the user sees. The backend API is used only to **set up and clean up**
data, never to stand in for a user action.

---

## Why it is built this way

| Decision | Reason |
|---|---|
| **Four tiers, nothing else** — locators, pages, data, specs | A spec reads as a list of `await` calls. Selectors, actions and data each live in exactly one place. |
| **Specs contain no logic** — no loops, `if`, `try/catch`, variables or hooks | A branch means a test asserts different things depending on state it did not control. Lint rules enforce it. |
| **The tenant is provisioned, not assumed** | `jest.global-setup.ts` seeds doctors, chambers and fees through the API, idempotently and read-first. A wiped database no longer reads as 60 product defects. |
| **Explicit waits only** | No implicit wait, no `sleep`, no coordinate swipes. Mixing waits compounds timeouts; a swipe near a bottom nav gets delivered as a tab tap. |
| **Per-OS code lives only in `BasePage` / `driver.ts`** | Specs, pages and locators stay platform-neutral, so one suite shape serves every target. |
| **Generated vs. fixed test data is decided by the value's job** | App vocabulary is a literal; input the app stores is generated with `faker`; real accounts come from env vars. |
| **One device, one worker** | `maxWorkers: 1`, `bail: 0`: two workers racing a phone fail like app bugs, and one run must surface every failure. |
| **Teardown may swallow, a spec may not** | `ErrorHelper.eachWarnOnFailure` isolates each item of a cleanup loop, so one stuck record cannot hide the rest. |

---

## What the sample suite covers

| Module | What is tested |
|---|---|
| **Login** | email sign-in, validation messages, wrong credentials, remember-me, logged-out screens, forgot password |
| **Doctor search** | the doctor list, search by name, speciality filter, doctor details |
| **Booking** | the full flow — doctor, chamber, date, appointment type, patient details, confirmation, queue tracking, cancellation |
| **Appointments** | Upcoming and Past lists, ordering, status, detail, cancelling, follow-ups, completed appointments |
| **Prescriptions** | list and detail for prescriptions a doctor issued |
| **Profile & dashboard** | editing every profile field, allergies and conditions, validation, photo upload (formats and size limit), dashboard tiles, password change |

Known product defects are written as tests too and **skipped** until the fix
ships — un-skip one and a green run proves the fix.

---

## Project layout

```
tests/                 one spec per module — test steps only
src/
  locators/            selector strings and expected on-screen text, per module
  pages/               page objects: actions + expect* checks (BasePage holds all per-OS code)
  data/                test data — faker-generated, never hard-coded for unique fields
  support/             driver, config, fixtures (hooks) and kits (imports) per module
  api/                 API helpers for set-up and clean-up only
plan/                  the test plan per module — scope, decisions, known gaps (git-ignored — local only)
findings/              defects found, in a fixed format (git-ignored — local only)
baselines/             what each screen looked like when it was crawled (sanitized samples)
tools/                 preflight check, device mirror, goal gate
jest.global-setup.ts   runs once: proves credentials, provisions the tenant
jest.setup.ts          runs per spec: login check + failure capture
```

Every module has exactly one file in each of `locators/`, `pages/`, `support/`
and `tests/`, and mirrors it in `plan/`, `findings/` and `baselines/`.

---

## Prerequisites

- **Node.js 20+**
- **Java 17** (OpenJDK) with `JAVA_HOME` set
- **Android platform-tools** (`adb`) with `ANDROID_HOME` set
- **Appium 3** and its driver:
  ```bash
  npm install -g appium
  appium driver install uiautomator2      # xcuitest for iOS
  ```
- **scrcpy** *(optional)* — to watch the phone while tests run: `brew install scrcpy`
- A phone with the **app under test installed**, USB debugging on, connected and
  authorised (`adb devices` lists it as `device`).

> The sample specs assert against one specific app's screens, so they will only
> go green against an app with matching UI. The architecture, helpers and
> tooling are reusable as they are.

---

## Setup

```bash
git clone https://github.com/foyezkabir/appium-ts-mobile-automation.git
cd appium-ts-mobile-automation
npm install
cp .env.example .env
```

Fill in **every** value in `.env` — each key is explained in `.env.example`:

| Key | What it is |
|---|---|
| `APPIUM_PLATFORM`, `APPIUM_FRAMEWORK`, `APPIUM_AUTOMATION` | the target, e.g. `android`, `rn`, `UiAutomator2` |
| `APPIUM_APP_ID`, `APPIUM_APP_ACTIVITY` | the app under test |
| `APPIUM_UDID` | the device id, from `adb devices` |
| `APPIUM_HOST`, `APPIUM_PORT` | where the Appium server listens (`127.0.0.1`, `4723`) |
| `APP_EMAIL`, `APP_PASSWORD` | the test account |
| `APP_BRAND_NAME` | the app's display name as painted on its login screen |
| `API_BASE_URL` | the API the **installed app** uses |
| `TENANT_EMAIL_DOMAIN`, `TENANT_SEED_PASSWORD` | mailbox domain and shared password for the accounts the suite provisions |

> **Quote every value.** dotenv treats an unquoted `#` as the start of a comment
> and silently cuts the value off. `.env` is git-ignored — never commit it.
>
> Required values are never defaulted: a missing variable throws, naming it,
> instead of running against the wrong target and still reporting green.

---

## Running the tests

```bash
npm run appium            # 1. start the server in its own terminal
npm run preflight         # 2. device attached, authorised, server answering
npm run test:harness      # 3. prove the plumbing — if this is red, fix it first
npm test                  # 4. the whole suite, with a read-only mirror of the phone
npm run test:nomirror     #    the whole suite, headless (CI)
npm run test:nomirror -- tests/profile.spec.ts                       # one module
npm run test:nomirror -- tests/profile.spec.ts -t "Cancel discards"  # one case
npm run verify            # typecheck + lint — run before every commit
npm run report            # open the HTML report of the last run
```

Results land in `appium-reports/`: a JUnit report, an HTML report, and for every
failure a screenshot plus the screen's view hierarchy.

---

## How a run works

**Once, before anything** — `jest.global-setup.ts`:
- proves the `.env` credentials sign in, and stops with a clear message if not;
- **provisions the test world**: doctors, chambers, fees, availability. It is
  idempotent and read-first — on an already-provisioned tenant it makes zero
  writes. Tests never name a doctor; they ask for a role ("the doctor with a
  teleconsultation chamber").

**Before every spec and test** — `jest.setup.ts`:
- login is handled globally: confirm the session is live, sign in only if needed;
- a failing test saves a screenshot and the page source automatically.

**During a test**: one Jest worker, every wait on a condition.

---

## Data and cleanup

- **Generated data** — realistic names, addresses and phone numbers, so nothing
  fixed can later collide with a real record.
- **Bookings** the suite makes are cancelled after each test.
- **Profile edits** are made through the app and undone through the app.
- **The password test** changes the password in the app, restores it through the
  API, and proves it with a UI login. A safety file lets the next run restore it
  if a run dies halfway.
- **Known leftovers**, by the product's own rules: completed appointments and
  issued prescriptions cannot be deleted. They are named in the plans, not faked
  away.

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `npm run preflight` fails | device unplugged, locked, or USB debugging not authorised — check `adb devices` |
| "UiAutomation not connected" | another automation tool holds the device; only one may at a time |
| Every test fails at login | `APP_EMAIL` / `APP_PASSWORD` wrong or unquoted in `.env` |
| Global setup stops with a credentials message | the password changed on the account; update `.env` |
| Data the test just created is missing in the app | `API_BASE_URL` must match the environment the installed app uses |
| "Missing required environment variable X" | copy `.env.example` to `.env` and fill every value |
