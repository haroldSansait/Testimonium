# Bundled Android fonts

Unmodified static TTF files from [Expo Google Fonts](https://github.com/expo/google-fonts/tree/master/font-packages), retrieved 2026-11-13. Individual source URLs and SHA-256 checksums are recorded in sources.json.

Each family includes its SIL Open Font License 1.1 notice from the Google Fonts repository:
- https://github.com/google/fonts/blob/main/ofl/inter/OFL.txt
- https://github.com/google/fonts/blob/main/ofl/playfairdisplay/OFL.txt

Inter: 400, 500, 600, 700, 800; normal and italic.
Playfair Display: 700, 800; normal (the editorial heading weights used by this app).

Android XML families are registered by expo-font at build time. No font download is needed at startup. Existing Caloy code spans retain their explicit monospace font.

`plugins/with-font-licenses.cjs` copies both OFL notices into the APK's `assets/licenses/` directory during Android prebuild.
