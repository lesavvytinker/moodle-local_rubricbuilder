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
 * Language strings for local_rubricbuilder.
 *
 * @package   local_rubricbuilder
 * @copyright 2026 Equip English
 * @license   https://www.gnu.org/licenses/gpl-3.0.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

$string['pluginname']           = 'Rubric Builder';
$string['managetemplates']      = 'Manage rubric templates';

// template.php error strings.
$string['error_permissiondenied']       = 'Permission denied';
$string['error_templatenotfound']       = 'Template not found';
$string['error_invalidtemplatedata']    = 'Invalid template data';
$string['error_notyourtemplate_edit']   = 'You can only edit your own templates';
$string['error_notyourtemplate_delete'] = 'You can only delete your own templates';
$string['error_unknownaction']          = 'Unknown action';

// Rubric Builder modal UI strings (used by rubric-builder.js via RB_STRINGS).
$string['js_modaltitle']              = 'Rubric Builder';
$string['js_close']                   = 'Close';
$string['js_tabrubric']               = 'Rubric';
$string['js_tabmarkingguide']         = 'Marking Guide';
$string['js_tabtemplates']            = 'Templates';
$string['js_tabchecklist']            = 'Checklist';
$string['js_templatenamelabel']       = 'Template name';
$string['js_templatenameplaceholder'] = 'e.g. Describe Image — General Rubric';
$string['js_templatenamehint']        = 'Only needed if you plan to save this as a reusable template.';
$string['js_criteriarows']            = 'Criteria rows';
$string['js_addcriterion']            = '+ Add criterion';
$string['js_rubrichint']              = 'Each cell has its own score value. Rows can have different numbers of cells.';
$string['js_maxpossible']             = 'Max possible:';
$string['js_criteria']                = 'Criteria';
$string['js_criterionlabelheader']    = 'Criterion label';
$string['js_descriptionheader']       = 'Description';
$string['js_maxmarksheader']          = 'Max marks';
$string['js_savedtemplates']          = 'Saved Templates';
$string['js_refresh']                 = 'Refresh';
$string['js_editingprefix']           = 'Editing';
$string['js_editingsuffix']           = '— changes here won\'t affect the saved template until you update it.';
$string['js_startnewclear']           = 'Start new (clear)';
$string['js_usestemplatenamefield']   = 'Uses the "Template name" field above.';
$string['js_saveasnewtemplate']       = 'Save as new template';
$string['js_updateloadedtemplate']    = 'Update loaded template';
$string['js_loadingtemplates']        = 'Loading templates...';
$string['js_cancel']                  = 'Cancel';
$string['js_saveastemplateandinsert'] = 'Save as Template & Insert';
$string['js_insertintoeditor']        = 'Insert into editor';
$string['js_confirmcloseunsaved']     = 'Close Rubric Builder? Unsaved changes will be lost.';
$string['js_confirmstopediting']      = 'Stop editing "{$a}" and start a blank rubric? Unsaved changes here will be lost.';
$string['js_errorsavefailednotinserted'] = 'Could not save the template, so nothing was inserted either. Error: {$a}';
$string['js_errornotemplateloaded']   = 'No template is currently loaded to update. Use "Save as new template" instead.';
$string['js_errorprefix']             = 'Error: {$a}';
$string['js_templatesaved']           = 'Template "{$a}" saved!';
$string['js_templateupdated']         = 'Template "{$a}" updated!';
$string['js_confirmdeletetemplate']   = 'Delete this template?';
$string['js_confirmcleareditor']      = 'Clear the editor content?';
$string['js_editornotready']          = 'Editor not ready yet — please wait a moment and try again.';
$string['js_errornametemplaterequired'] = 'A template name is required to save.';
$string['js_errorenternametoinsert']  = 'Enter a template name above to save & insert.';
$string['js_errornosesskey']          = 'Could not find a valid session key (sesskey) on this page. Try reloading the page before saving.';
$string['js_loadingdots']             = 'Loading...';
$string['js_notemplatessaved']        = 'No templates saved yet.';
$string['js_couldnotloadtemplates']   = 'Could not load templates.';
$string['js_colname']                 = 'Name';
$string['js_coltype']                 = 'Type';
$string['js_colsavedby']              = 'Saved by';
$string['js_coldate']                 = 'Date';
$string['js_loadbtn']                 = 'Load';
$string['js_scorelabel']              = 'Score';
$string['js_criterionlabelplaceholder'] = 'Criterion label';
$string['js_addcell']                 = '+ Add cell';
$string['js_copybtn']                 = 'Copy';
$string['js_removebtn']               = 'Remove';
$string['js_celldescplaceholder']     = 'Cell description...';
$string['js_cleareditorbtn']          = 'Clear editor';
$string['js_toolbartooltip']          = 'Build a rubric or marking guide';
$string['js_checklistsections']       = 'Checklist sections';
$string['js_addsection']              = '+ Add section';
$string['js_checklisthint']           = 'Group items into sections. Each item can be worth partial credit and take a remark once graded.';
$string['js_sectionlabelplaceholder'] = 'Section label';
$string['js_additem']                 = '+ Add item';
$string['js_itemlabelplaceholder']    = 'Item label';
$string['js_maxlabel']                = 'Max';
$string['js_itemdescplaceholder']     = 'Optional description...';

// Privacy strings.
$string['privacy:metadata:local_rubricbuilder_templates']                  = 'Rubric and marking guide templates created by teachers.';
$string['privacy:metadata:local_rubricbuilder_templates:name']             = 'The name of the template.';
$string['privacy:metadata:local_rubricbuilder_templates:mode']             = 'The type of template (rubric or marking-guide).';
$string['privacy:metadata:local_rubricbuilder_templates:templatedata']     = 'The JSON-encoded rubric or marking guide structure.';
$string['privacy:metadata:local_rubricbuilder_templates:createdby']        = 'The Moodle user ID of the teacher who created the template.';
$string['privacy:metadata:local_rubricbuilder_templates:timecreated']      = 'The date and time the template was created.';
$string['privacy:metadata:local_rubricbuilder_templates:timemodified']     = 'The date and time the template was last modified.';
$string['privacy:templates']    = 'Rubric templates';
