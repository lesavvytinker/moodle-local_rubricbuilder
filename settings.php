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
 * Admin settings for local_rubricbuilder.
 *
 * @package   local_rubricbuilder
 * @copyright 2026 Equip English
 * @license   https://www.gnu.org/licenses/gpl-3.0.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

if ($hassiteconfig) {
    $settings = new admin_settingpage('local_rubricbuilder', get_string('pluginname', 'local_rubricbuilder'));
    $ADMIN->add('localplugins', $settings);

    $settings->add(new admin_setting_configcolourpicker(
        'local_rubricbuilder/rubriccolor',
        get_string('settings_rubriccolor', 'local_rubricbuilder'),
        get_string('settings_rubriccolor_desc', 'local_rubricbuilder'),
        '#1a56db'
    ));

    $settings->add(new admin_setting_configcolourpicker(
        'local_rubricbuilder/markingguidecolor',
        get_string('settings_markingguidecolor', 'local_rubricbuilder'),
        get_string('settings_markingguidecolor_desc', 'local_rubricbuilder'),
        '#059669'
    ));

    $settings->add(new admin_setting_configcolourpicker(
        'local_rubricbuilder/checklistcolor',
        get_string('settings_checklistcolor', 'local_rubricbuilder'),
        get_string('settings_checklistcolor_desc', 'local_rubricbuilder'),
        '#92400e'
    ));
}
