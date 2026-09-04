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
 * AJAX endpoint for rubric builder template save/load/delete.
 * Called by rubric-builder.js via fetch().
 *
 * @package   local_rubricbuilder
 * @copyright 2026 Equip English
 * @license   https://www.gnu.org/licenses/gpl-3.0.html GNU GPL v3 or later
 */

define('AJAX_SCRIPT', true);
require_once('../../config.php');
require_login();

$action = required_param('action', PARAM_ALPHA);
header('Content-Type: application/json');

// PING and REFRESHSESSKEY only require a valid login, not a valid sesskey.
// This is deliberate:
//  - PING is the keepalive call made every 2 minutes while the Rubric
//    Builder modal is open. It must keep succeeding even if the cached
//    sesskey has drifted, since resetting Moodle's session-activity clock
//    (which require_login() already does, above) is the entire point.
//  - REFRESHSESSKEY lets the JS recover from a stale/out-of-sync sesskey by
//    fetching a current one and silently retrying the original request,
//    instead of surfacing "invalidsesskey" to the person and losing
//    whatever they've typed into the rubric. Exposing the current sesskey
//    to any logged-in request (not just sesskey-verified ones) is safe —
//    Moodle already does this for every page via M.cfg.sesskey, and this
//    endpoint is read-only so it has no exploitable side effect even if
//    triggered cross-site.
if ($action === 'ping') {
    echo json_encode(['success' => true, 'time' => time()]);
    exit;
}
if ($action === 'refreshsesskey') {
    echo json_encode(['success' => true, 'sesskey' => sesskey()]);
    exit;
}

// Every other action mutates data or reads potentially sensitive template
// data, so it still requires a verified sesskey.
require_sesskey();

// Only users with the plugin's own managetemplates capability (granted to
// editing teachers and managers by default via db/access.php) can use
// templates.
$context = context_system::instance();
if (!has_capability('local/rubricbuilder:managetemplates', $context) &&
    !has_capability('moodle/site:config', $context)) {
    // Check whether the user has the capability in ANY of their courses.
    // get_user_capability_course() runs a single efficient query across all
    // of the user's courses, rather than looping with has_capability() per
    // course — and critically, it is NOT limited to just one course, so a
    // teacher whose editing rights are on their 2nd/3rd/etc. enrolled course
    // (by id) is no longer wrongly denied access.
    $allowed = (bool) get_user_capability_course('local/rubricbuilder:managetemplates', null, false, 'id', null, 0);
    if (!$allowed) {
        http_response_code(403);
        echo json_encode(['error' => 'Permission denied']);
        exit;
    }
}

switch ($action) {

    // ------------------------------------------------------------------
    // LIST all templates
    // ------------------------------------------------------------------
    case 'list':
        $templates = $DB->get_records(
            'local_rubricbuilder_templates',
            null,
            'timemodified DESC',
            'id, name, mode, createdby, timecreated, timemodified'
        );
        $result = [];
        foreach ($templates as $t) {
            $user = $DB->get_record('user', ['id' => $t->createdby], 'id, firstname, lastname');
            $result[] = [
                'id'           => (int)$t->id,
                'name'         => $t->name,
                'mode'         => $t->mode,
                'createdby'    => $t->createdby,
                'createdbyname'=> $user ? fullname($user) : 'Unknown',
                'timecreated'  => (int)$t->timecreated,
                'timemodified' => (int)$t->timemodified,
            ];
        }
        echo json_encode(['success' => true, 'templates' => $result]);
        break;

    // ------------------------------------------------------------------
    // GET a single template's data
    // ------------------------------------------------------------------
    case 'get':
        $id = required_param('id', PARAM_INT);
        $template = $DB->get_record('local_rubricbuilder_templates', ['id' => $id]);
        if (!$template) {
            echo json_encode(['error' => 'Template not found']);
            break;
        }
        echo json_encode([
            'success'      => true,
            'id'           => (int)$template->id,
            'name'         => $template->name,
            'mode'         => $template->mode,
            'templatedata' => json_decode($template->templatedata, true),
        ]);
        break;

    // ------------------------------------------------------------------
    // SAVE (insert or update)
    // ------------------------------------------------------------------
    case 'save':
        $name         = required_param('name', PARAM_TEXT);
        $mode         = required_param('mode', PARAM_ALPHANUMEXT);
        $templatedata = required_param('templatedata', PARAM_RAW);
        $id           = optional_param('id', 0, PARAM_INT);

        // Validate JSON
        $decoded = json_decode($templatedata);
        if (json_last_error() !== JSON_ERROR_NONE) {
            echo json_encode(['error' => 'Invalid template data']);
            break;
        }

        $now = time();

        if ($id > 0) {
            // Update existing — only owner or admin can update
            $existing = $DB->get_record('local_rubricbuilder_templates', ['id' => $id]);
            if (!$existing) {
                echo json_encode(['error' => 'Template not found']);
                break;
            }
            if ($existing->createdby != $USER->id && !is_siteadmin()) {
                echo json_encode(['error' => 'You can only edit your own templates']);
                break;
            }
            $record = new stdClass();
            $record->id           = $id;
            $record->name         = $name;
            $record->mode         = $mode;
            $record->templatedata = $templatedata;
            $record->timemodified = $now;
            $DB->update_record('local_rubricbuilder_templates', $record);
            echo json_encode(['success' => true, 'id' => $id]);
        } else {
            // Insert new
            $record = new stdClass();
            $record->name         = $name;
            $record->mode         = $mode;
            $record->templatedata = $templatedata;
            $record->createdby    = $USER->id;
            $record->timecreated  = $now;
            $record->timemodified = $now;
            $newid = $DB->insert_record('local_rubricbuilder_templates', $record);
            echo json_encode(['success' => true, 'id' => $newid]);
        }
        break;

    // ------------------------------------------------------------------
    // DELETE
    // ------------------------------------------------------------------
    case 'delete':
        $id = required_param('id', PARAM_INT);
        $existing = $DB->get_record('local_rubricbuilder_templates', ['id' => $id]);
        if (!$existing) {
            echo json_encode(['error' => 'Template not found']);
            break;
        }
        // Only the owner or a site admin can delete
        if ($existing->createdby != $USER->id && !is_siteadmin()) {
            echo json_encode(['error' => 'You can only delete your own templates']);
            break;
        }
        $DB->delete_records('local_rubricbuilder_templates', ['id' => $id]);
        echo json_encode(['success' => true]);
        break;

    default:
        echo json_encode(['error' => 'Unknown action']);
        break;
}
