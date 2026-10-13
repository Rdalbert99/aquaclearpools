/**
 * App version + release notes.
 *
 * Bump APP_VERSION and add an entry at the top of RELEASE_NOTES whenever a new
 * version is published. The "What's New" page and the Settings version line
 * both read from here.
 */

export const APP_VERSION = "1.2.0";

export type ReleaseNote = {
  version: string;
  date: string;
  highlights: string[];
};

export const RELEASE_NOTES: ReleaseNote[] = [
  {
    version: "1.2.0",
    date: "2026-10-13",
    highlights: [
      "Chemistry Lab: a Taylor-style test-kit rack on the visit screen, the customer page and the calculator — tap a well for its ideal band and dosing advice.",
      "Phosphates, iron and copper are now selectable tests, with staining warnings and surface notes.",
      "Calcium dosing defaults to OxyChem DOWFLAKE Xtra (83–87%) and shows a starting range instead of a single guess.",
      "Dose corrections and safety guards: calcium, baking soda and pH advice now say 'manual verification required' when pool volume or product strength is unknown.",
      "The home-screen icon now shows the AC shield logo.",
    ],
  },
  {
    version: "1.1.0",
    date: "2026-10-07",
    highlights: [
      "Refresh app button: pull in a newly published version straight from the menu, the top bar, or Settings.",
      "Broadcast texting for admins: pick a template, see the exact customer count, confirm before anything sends.",
      "Voice entry on the service visit screen — dictate readings, chemicals and tasks, then review before saving.",
      "Tasks are ticked once and flow through to history and customer reports — no more entering the same job twice.",
      "In-season and off-season scheduling per customer, honoured by calendars and routes.",
    ],
  },
  {
    version: "1.0.0",
    date: "2026-07-25",
    highlights: [
      "Aqua Clear is now an installable app — add it to your home screen on iPhone, Android, tablet, or desktop.",
      "Runs full screen with its own app icon and splash screen.",
      "Faster loading, and the app shell still opens when you briefly lose signal.",
      "Automatic update detection: you'll be prompted to refresh whenever a new version is published.",
      "Mobile bottom navigation for quicker access to your dashboard, schedule, clients, and calculator.",
      "App version is now shown in Settings, with this What's New page.",
    ],
  },
];

export const LATEST_RELEASE = RELEASE_NOTES[0];
