<?php

// This file is part of Moodle - http://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Moodle is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Moodle.  If not, see <http://www.gnu.org/licenses/>.

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

        // All user-facing text in rubric-builder.js is looked up here via
        // get_string() and handed across as a single JSON object, rather
        // than being hardcoded in the JS itself — the JS has no access to
        // Moodle's string API directly since it isn't an AMD module.
        $strings = [
            'modaltitle'              => get_string('js_modaltitle', 'local_rubricbuilder'),
            'close'                   => get_string('js_close', 'local_rubricbuilder'),
            'tabrubric'               => get_string('js_tabrubric', 'local_rubricbuilder'),
            'tabmarkingguide'         => get_string('js_tabmarkingguide', 'local_rubricbuilder'),
            'tabtemplates'            => get_string('js_tabtemplates', 'local_rubricbuilder'),
            'tabchecklist'            => get_string('js_tabchecklist', 'local_rubricbuilder'),
            'templatenamelabel'       => get_string('js_templatenamelabel', 'local_rubricbuilder'),
            'templatenameplaceholder' => get_string('js_templatenameplaceholder', 'local_rubricbuilder'),
            'templatenamehint'        => get_string('js_templatenamehint', 'local_rubricbuilder'),
            'criteriarows'            => get_string('js_criteriarows', 'local_rubricbuilder'),
            'addcriterion'            => get_string('js_addcriterion', 'local_rubricbuilder'),
            'rubrichint'              => get_string('js_rubrichint', 'local_rubricbuilder'),
            'maxpossible'             => get_string('js_maxpossible', 'local_rubricbuilder'),
            'criteria'                => get_string('js_criteria', 'local_rubricbuilder'),
            'criterionlabelheader'    => get_string('js_criterionlabelheader', 'local_rubricbuilder'),
            'descriptionheader'       => get_string('js_descriptionheader', 'local_rubricbuilder'),
            'maxmarksheader'          => get_string('js_maxmarksheader', 'local_rubricbuilder'),
            'savedtemplates'          => get_string('js_savedtemplates', 'local_rubricbuilder'),
            'refresh'                 => get_string('js_refresh', 'local_rubricbuilder'),
            'editingprefix'           => get_string('js_editingprefix', 'local_rubricbuilder'),
            'editingsuffix'           => get_string('js_editingsuffix', 'local_rubricbuilder'),
            'startnewclear'           => get_string('js_startnewclear', 'local_rubricbuilder'),
            'usestemplatenamefield'   => get_string('js_usestemplatenamefield', 'local_rubricbuilder'),
            'saveasnewtemplate'       => get_string('js_saveasnewtemplate', 'local_rubricbuilder'),
            'updateloadedtemplate'    => get_string('js_updateloadedtemplate', 'local_rubricbuilder'),
            'loadingtemplates'        => get_string('js_loadingtemplates', 'local_rubricbuilder'),
            'cancel'                  => get_string('js_cancel', 'local_rubricbuilder'),
            'saveastemplateandinsert' => get_string('js_saveastemplateandinsert', 'local_rubricbuilder'),
            'insertintoeditor'        => get_string('js_insertintoeditor', 'local_rubricbuilder'),
            'confirmcloseunsaved'     => get_string('js_confirmcloseunsaved', 'local_rubricbuilder'),
            'confirmstopediting'      => get_string('js_confirmstopediting', 'local_rubricbuilder', '__A__'),
            'errorsavefailednotinserted' => get_string('js_errorsavefailednotinserted', 'local_rubricbuilder', '__A__'),
            'errornotemplateloaded'   => get_string('js_errornotemplateloaded', 'local_rubricbuilder'),
            'errorprefix'             => get_string('js_errorprefix', 'local_rubricbuilder', '__A__'),
            'templatesaved'           => get_string('js_templatesaved', 'local_rubricbuilder', '__A__'),
            'templateupdated'         => get_string('js_templateupdated', 'local_rubricbuilder', '__A__'),
            'confirmdeletetemplate'   => get_string('js_confirmdeletetemplate', 'local_rubricbuilder'),
            'confirmcleareditor'      => get_string('js_confirmcleareditor', 'local_rubricbuilder'),
            'editornotready'          => get_string('js_editornotready', 'local_rubricbuilder'),
            'errornametemplaterequired' => get_string('js_errornametemplaterequired', 'local_rubricbuilder'),
            'errorenternametoinsert'  => get_string('js_errorenternametoinsert', 'local_rubricbuilder'),
            'errornosesskey'          => get_string('js_errornosesskey', 'local_rubricbuilder'),
            'loadingdots'             => get_string('js_loadingdots', 'local_rubricbuilder'),
            'notemplatessaved'        => get_string('js_notemplatessaved', 'local_rubricbuilder'),
            'couldnotloadtemplates'   => get_string('js_couldnotloadtemplates', 'local_rubricbuilder'),
            'colname'                 => get_string('js_colname', 'local_rubricbuilder'),
            'coltype'                 => get_string('js_coltype', 'local_rubricbuilder'),
            'colsavedby'              => get_string('js_colsavedby', 'local_rubricbuilder'),
            'coldate'                 => get_string('js_coldate', 'local_rubricbuilder'),
            'loadbtn'                 => get_string('js_loadbtn', 'local_rubricbuilder'),
            'scorelabel'              => get_string('js_scorelabel', 'local_rubricbuilder'),
            'criterionlabelplaceholder' => get_string('js_criterionlabelplaceholder', 'local_rubricbuilder'),
            'addcell'                 => get_string('js_addcell', 'local_rubricbuilder'),
            'copybtn'                 => get_string('js_copybtn', 'local_rubricbuilder'),
            'removebtn'               => get_string('js_removebtn', 'local_rubricbuilder'),
            'celldescplaceholder'     => get_string('js_celldescplaceholder', 'local_rubricbuilder'),
            'cleareditorbtn'          => get_string('js_cleareditorbtn', 'local_rubricbuilder'),
            'toolbartooltip'          => get_string('js_toolbartooltip', 'local_rubricbuilder'),
            'checklistsections'       => get_string('js_checklistsections', 'local_rubricbuilder'),
            'addsection'              => get_string('js_addsection', 'local_rubricbuilder'),
            'checklisthint'           => get_string('js_checklisthint', 'local_rubricbuilder'),
            'sectionlabelplaceholder' => get_string('js_sectionlabelplaceholder', 'local_rubricbuilder'),
            'additem'                 => get_string('js_additem', 'local_rubricbuilder'),
            'itemlabelplaceholder'    => get_string('js_itemlabelplaceholder', 'local_rubricbuilder'),
            'maxlabel'                => get_string('js_maxlabel', 'local_rubricbuilder'),
            'itemdescplaceholder'     => get_string('js_itemdescplaceholder', 'local_rubricbuilder'),
        ];
        // Strings containing a {$a} placeholder are resolved above with a
        // literal '__A__' marker (since the real value isn't known until
        // runtime in JS), then the marker is swapped for a JS template
        // placeholder the JS can substitute with str.replace().
        foreach ($strings as $key => $value) {
            if (strpos($value, '__A__') !== false) {
                $strings[$key] = str_replace('__A__', '{$a}', $value);
            }
        }

        $PAGE->requires->js_init_code(
            'window.RB_TEMPLATE_URL = ' . json_encode($pluginurl) . ';' .
            'window.RB_SESSKEY = ' . json_encode($sesskey) . ';' .
            'window.RB_STRINGS = ' . json_encode($strings) . ';',
            true
        );
        $PAGE->requires->js(new moodle_url('/local/rubricbuilder/rubric-builder.js'), true);
    }
}
