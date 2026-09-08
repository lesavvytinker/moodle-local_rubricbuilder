# Changelog — local_rubricbuilder

## 0.10 (2026-09-07)

- Marking Guide: the criterion label is now bolded, and the description (when present) always appears on its own line beneath the label, rather than running on immediately after it.

## 0.9 (2026-09-04)

- Externalized every user-facing string (button labels, alerts, confirmations, placeholders, hints, table headers — over 60 in total) into `lang/en/local_rubricbuilder.php`, per the Moodle Marketplace guideline against hardcoded text. PHP-side error messages in `template.php` now use `get_string()` directly; JS-side UI strings are resolved via `get_string()` in `lib.php` and passed to `rubric-builder.js` as a single `window.RB_STRINGS` object (with hardcoded English fallbacks retained only as a defensive measure if that object somehow fails to load). Internal developer console logging was deliberately left untouched, since it's never seen by end users.

## 0.8 (2026-09-04)

- `template.php` now checks the plugin's own `local/rubricbuilder:managetemplates` capability instead of the generic `moodle/course:manageactivities`, so a site admin can actually customise who gets template access without it being a dead/unused declaration.
- Bumped `$plugin->requires` from Moodle 4.1 (security support ended Nov 2025 — no longer maintained) to Moodle 4.5 LTS, a version this plugin has actually been tested against.

## 0.7 (2026-09-04)

- Added properly namespaced `rgdr-table`/`rgdr-rubric`/`rgdr-marking-guide` classes to the generated rubric table, alongside the existing `rs-table`/`rs-rubric`/`rs-marking-guide` classes (kept for backward compatibility with rubrics already inserted into questions). Addresses the Moodle Marketplace CSS-namespacing guideline for new content going forward, without affecting anything already built.

## 0.6 (2026-09-03)

- Replaced the "Save as Template & Insert" prompt() popup with a persistent "Template name" field at the top of the modal, visible across the Rubric, Marking Guide, and Templates tabs — one shared field instead of a separate one buried in the Templates tab. It's optional for plain "Insert into editor," but required (with inline validation — the field is highlighted and focused, no alert popup) for any Save action.

## 0.5 (2026-09-03)

- Added a "Save as Template & Insert" button to the Rubric/Marking Guide footer, alongside the existing "Insert into editor" button. Prompts for a template name (pre-filled if a template is already loaded), saves it — updating in place if the name matches the currently loaded template, otherwise saving as new — and only then inserts into the editor and closes. If the save fails, nothing is inserted, so work is never lost silently.

## 0.4 (2026-09-03)

- Added a live "Max possible" badge to both the Rubric and Marking Guide tabs, updating in real time as criteria/scores are added, edited, or removed — so a mismatch (e.g. rubric not actually totalling 100) is visible while building, not just discovered later during grading.

## 0.3 (2026-09-03)

- Fixed template permission check being wrongly limited to the user's first enrolled course only; now checks capability across all of the user's courses.
- Fixed `template.php`'s generated URL being absolute (host-based), which could cause the browser to treat template save/load/delete as cross-origin (and silently drop the login cookie) if the server's configured `wwwroot` doesn't exactly match the visitor's address bar hostname (e.g. behind a reverse proxy). It's now sent as a root-relative path instead.
- Fixed a load-order race where the sesskey used for template requests could be captured as an empty string if this script started executing before Moodle finished injecting it; the sesskey is now read fresh on every request, preferring Moodle core's own `M.cfg.sesskey`.
- Added a keepalive ping (every 2 minutes while the Rubric Builder modal is open) so a long editing session can't run into Moodle's session timeout mid-edit.
- Added automatic recovery from an `invalidsesskey` response: the plugin now fetches a current sesskey and silently retries the request once, rather than surfacing the error and losing in-progress work.
- Added a proper edit/update workflow to the Templates tab: loading a saved template now shows an "Editing: [name]" indicator, and a new "Update loaded template" button overwrites that template in place instead of always creating a duplicate via "Save as new template".

## 0.2 (2026-02-05)

- Added Templates feature: save and load shared rubric/marking guide templates stored in the database.
- Added drag-to-reorder for criterion rows.
- Added Copy row button to duplicate a criterion with all its cell content.
- Added Clear editor button to safely wipe the grader information box.
- Fixed TinyMCE editor detection to work reliably when edit mode is toggled.
- Switched template API calls from GET to POST to support large rubrics without URL length limits.
- Added CSRF protection via `require_sesskey()`.
- Added Privacy API implementation for GDPR compliance.
- Added capability definitions (`db/access.php`).

## 0.1 (2026-02-05)

- Initial release.
- Rubric mode: scored-cell rubric with per-cell score and description.
- Marking Guide mode: free-score guide with criterion label, description, and max marks.
- Inserts generated HTML directly into the "Information for graders" TinyMCE editor.
