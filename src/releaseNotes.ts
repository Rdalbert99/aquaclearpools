/**
 * App version + release notes.
 *
 * Bump APP_VERSION and add an entry at the top of RELEASE_NOTES whenever a new
 * version is published. The "What's New" page and the Settings version line
 * both read from here.
 */

export const APP_VERSION = "1.0.0";

export type ReleaseNote = {
  version: string;
  date: string;
  highlights: string[];
};

export const RELEASE_NOTES: ReleaseNote[] = [
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
