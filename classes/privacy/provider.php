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
 * Privacy provider for local_rubricbuilder.
 *
 * @package   local_rubricbuilder
 * @copyright 2026 Equip English
 * @license   https://www.gnu.org/licenses/gpl-3.0.html GNU GPL v3 or later
 */

namespace local_rubricbuilder\privacy;

use core_privacy\local\metadata\collection;
use core_privacy\local\request\approved_contextlist;
use core_privacy\local\request\approved_userlist;
use core_privacy\local\request\contextlist;
use core_privacy\local\request\deletion_criteria;
use core_privacy\local\request\userlist;
use core_privacy\local\request\writer;

defined('MOODLE_INTERNAL') || die();

/**
 * Privacy provider implementation for local_rubricbuilder.
 *
 * This plugin stores rubric and marking guide templates created by teachers.
 * Each template record contains the Moodle user ID of the creator.
 */
class provider implements
    \core_privacy\local\metadata\provider,
    \core_privacy\local\request\plugin\provider,
    \core_privacy\local\request\core_userlist_provider {

    /**
     * Returns metadata about the data this plugin stores.
     *
     * @param collection $collection The metadata collection to add to.
     * @return collection The updated collection.
     */
    public static function get_metadata(collection $collection): collection {

        $collection->add_database_table(
            'local_rubricbuilder_templates',
            [
                'name'         => 'privacy:metadata:local_rubricbuilder_templates:name',
                'mode'         => 'privacy:metadata:local_rubricbuilder_templates:mode',
                'templatedata' => 'privacy:metadata:local_rubricbuilder_templates:templatedata',
                'createdby'    => 'privacy:metadata:local_rubricbuilder_templates:createdby',
                'timecreated'  => 'privacy:metadata:local_rubricbuilder_templates:timecreated',
                'timemodified' => 'privacy:metadata:local_rubricbuilder_templates:timemodified',
            ],
            'privacy:metadata:local_rubricbuilder_templates'
        );

        return $collection;
    }

    /**
     * Returns the contexts that contain personal data for the given user.
     *
     * @param int $userid The user ID to search for.
     * @return contextlist The list of contexts containing user data.
     */
    public static function get_contexts_for_userid(int $userid): contextlist {
        $contextlist = new contextlist();
        $contextlist->add_system_context();
        return $contextlist;
    }

    /**
     * Returns users who have data in the given context.
     *
     * @param userlist $userlist The userlist to populate.
     */
    public static function get_users_in_context(userlist $userlist): void {
        $context = $userlist->get_context();
        if (!$context instanceof \context_system) {
            return;
        }
        $sql = 'SELECT DISTINCT createdby FROM {local_rubricbuilder_templates}';
        $userlist->add_from_sql('createdby', $sql, []);
    }

    /**
     * Exports personal data for the given user in the given contexts.
     *
     * @param approved_contextlist $contextlist The approved contexts to export data for.
     */
    public static function export_user_data(approved_contextlist $contextlist): void {
        global $DB;

        $userid = $contextlist->get_user()->id;

        foreach ($contextlist->get_contexts() as $context) {
            if (!$context instanceof \context_system) {
                continue;
            }
            $templates = $DB->get_records(
                'local_rubricbuilder_templates',
                ['createdby' => $userid],
                'timecreated ASC'
            );
            if (empty($templates)) {
                continue;
            }
            $data = array_map(function($t) {
                return (object)[
                    'name'         => $t->name,
                    'mode'         => $t->mode,
                    'templatedata' => $t->templatedata,
                    'timecreated'  => \core_privacy\local\request\transform::datetime($t->timecreated),
                    'timemodified' => \core_privacy\local\request\transform::datetime($t->timemodified),
                ];
            }, $templates);

            writer::with_context($context)->export_data(
                [get_string('pluginname', 'local_rubricbuilder'), get_string('privacy:templates', 'local_rubricbuilder')],
                (object)['templates' => array_values($data)]
            );
        }
    }

    /**
     * Deletes all personal data for all users in the given context.
     *
     * @param \context $context The context to delete data for.
     */
    public static function delete_data_for_all_users_in_context(\context $context): void {
        global $DB;
        if ($context instanceof \context_system) {
            $DB->delete_records('local_rubricbuilder_templates');
        }
    }

    /**
     * Deletes personal data for the given user in the given contexts.
     *
     * @param approved_contextlist $contextlist The approved contexts to delete data for.
     */
    public static function delete_data_for_user(approved_contextlist $contextlist): void {
        global $DB;
        $userid = $contextlist->get_user()->id;
        foreach ($contextlist->get_contexts() as $context) {
            if ($context instanceof \context_system) {
                $DB->delete_records('local_rubricbuilder_templates', ['createdby' => $userid]);
            }
        }
    }

    /**
     * Deletes personal data for the given users in the given context.
     *
     * @param approved_userlist $userlist The approved users to delete data for.
     */
    public static function delete_data_for_users(approved_userlist $userlist): void {
        global $DB;
        $context = $userlist->get_context();
        if (!$context instanceof \context_system) {
            return;
        }
        $userids = $userlist->get_userids();
        if (empty($userids)) {
            return;
        }
        list($insql, $params) = $DB->get_in_or_equal($userids, SQL_PARAMS_NAMED);
        $DB->delete_records_select(
            'local_rubricbuilder_templates',
            "createdby $insql",
            $params
        );
    }
}
