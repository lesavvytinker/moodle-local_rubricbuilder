<?php
/**
 * Library functions for local_rubricbuilder.
 *
 * @package   local_rubricbuilder
 * @copyright 2026 Equip English
 * @license   https://www.gnu.org/licenses/gpl-3.0.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

/**
 * Injects the Rubric Builder JavaScript on quiz question editing pages.
 *
 * Hooked via the before_http_headers callback. Passes the template API URL
 * and sesskey to JavaScript via js_init_code, then loads rubric-builder.js.
 * Activates on the following pages:
 * - /question/question.php
 * - /question/bank/editquestion/question.php
 * - /mod/quiz/editquestion.php
 * - /question/edit.php
 * - /mod/quiz/edit.php
 *
 * @return void
 */
function local_rubricbuilder_before_http_headers(): void {
    global $PAGE;

    $path = $PAGE->url->get_path();

    $isquestionedit =
        strpos($path, '/question/question.php') !== false ||
        strpos($path, '/question/bank/editquestion/question.php') !== false ||
        strpos($path, '/mod/quiz/editquestion.php') !== false ||
        strpos($path, '/question/edit.php') !== false ||
        strpos($path, '/mod/quiz/edit.php') !== false;

    if ($isquestionedit) {
        // Pass the template API URL and sesskey to JS for CSRF-protected AJAX calls.
        //
        // We deliberately strip the scheme+host from the generated URL and keep
        // only the path (+query), so the browser resolves it against whatever
        // origin the page is actually being served from. If $CFG->wwwroot's
        // host doesn't exactly match the hostname in the visitor's address bar
        // (common behind reverse proxies/YunoHost-style setups), sending an
        // absolute cross-host URL would make fetch() treat this as a
        // cross-origin request and silently drop the login cookie — which
        // Moodle then reports as a session/sesskey error even though the user
        // is genuinely logged in. A root-relative path avoids that entirely
        // while still working for Moodle installs in a subdirectory.
        $pluginurl = (new moodle_url('/local/rubricbuilder/template.php'))->out(false);
        $urlparts = parse_url($pluginurl);
        if (!empty($urlparts['path'])) {
            $pluginurl = $urlparts['path'] . (!empty($urlparts['query']) ? '?' . $urlparts['query'] : '');
        }
        $sesskey   = sesskey();
        $PAGE->requires->js_init_code(
            'window.RB_TEMPLATE_URL = ' . json_encode($pluginurl) . ';' .
            'window.RB_SESSKEY = ' . json_encode($sesskey) . ';',
            true
        );
        $PAGE->requires->js(new moodle_url('/local/rubricbuilder/rubric-builder.js'), true);
    }
}
