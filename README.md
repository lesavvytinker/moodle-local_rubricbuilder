# Rubric Builder for Moodle (`local_rubricbuilder`)

A local plugin that adds a **Rubric Builder** button to the "Information for graders" editor on quiz question editing pages, allowing teachers to visually build rubrics and marking guides without writing HTML by hand.

> **Pairs naturally with [Rubric Grader](https://github.com/lesavvytinker/moodle-local_rubricgrader)** for a complete build-and-grade workflow — but this plugin is fully useful on its own. The rubric it generates is a clear, readable reference for any grader, whether or not Rubric Grader is installed; Rubric Grader simply adds one-click, automated grading and student feedback on top of it.

## Features

- **Rubric mode** — build a scored-cell rubric where each cell has its own point value and description. Works for any combination of per-criterion marks (e.g. one criterion worth 6, another worth 2).
- **Marking Guide mode** — build a free-score marking guide where each criterion has a label, description, and maximum mark.
- **Templates** — save rubrics and marking guides as shared templates that any staff member with editing teacher access can load and reuse.
- **Drag to reorder** — criterion rows can be dragged to reposition them.
- **Copy row** — duplicate a criterion row to save time on similar criteria.
- **Clear editor** — safely clear the grader information box to start fresh.

## Requirements

- Moodle 4.5 or higher
- PHP 7.4 or higher
- The `local_rubricgrader` plugin is recommended alongside this plugin — it's what turns the rubric this plugin builds into a one-click, automated grading experience with automatic student feedback. Not required to use this plugin, but you'll be grading manually without it.

## Installation

1. Download the plugin ZIP file.
2. Go to **Site administration → Plugins → Install plugins**.
3. Upload the ZIP file and follow the on-screen instructions.
4. Moodle will create the required database table (`local_rubricbuilder_templates`) automatically.

Alternatively, extract the `rubricbuilder` folder into your Moodle installation's `/local/` directory and visit the site administration page to trigger the upgrade.

## Usage

1. Navigate to a quiz question editing page (e.g. Edit question for an Essay question type).
2. A blue **Rubric Builder** button appears above the "Information for graders" editor.
3. Click the button to open the builder popup.
4. Choose **Rubric** or **Marking Guide** mode from the tabs.
5. Add criteria rows and fill in descriptions and scores.
6. Click **Insert into editor** to insert the generated HTML into the grader information box.
7. Save the question as normal.

### Saving templates

1. Build your rubric or marking guide.
2. Click the **Templates** tab in the builder popup.
3. Enter a template name and click **Save current as template**.
4. Any staff member with editing teacher access on your Moodle site can load your template from the same Templates tab.

## Permissions

| Capability | Default role | Description |
|---|---|---|
| `local/rubricbuilder:managetemplates` | Editing teacher, Manager, Admin | Save, load, and delete rubric templates |

## Privacy

This plugin stores rubric templates in the database, including the Moodle user ID of the teacher who created each template. See `classes/privacy/provider.php` for full details of data stored and the export/deletion API.

## Changelog

See `CHANGES.md`.

## License

GNU General Public License v3 or later — see <https://www.gnu.org/licenses/gpl-3.0.html>

## Author

Developed for Equip English. Contributions welcome.
