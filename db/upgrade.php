<?php
defined('MOODLE_INTERNAL') || die();

function xmldb_local_rubricbuilder_upgrade($oldversion) {
    global $DB;
    $dbman = $DB->get_manager();

    if ($oldversion < 2026020501) {
        // Define table local_rubricbuilder_templates
        $table = new xmldb_table('local_rubricbuilder_templates');

        $table->add_field('id',           XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, XMLDB_SEQUENCE);
        $table->add_field('name',         XMLDB_TYPE_CHAR,    '255', null, XMLDB_NOTNULL);
        $table->add_field('mode',         XMLDB_TYPE_CHAR,    '20',  null, XMLDB_NOTNULL);
        $table->add_field('templatedata', XMLDB_TYPE_TEXT,    null,  null, XMLDB_NOTNULL);
        $table->add_field('createdby',    XMLDB_TYPE_INTEGER, '10',  null, XMLDB_NOTNULL);
        $table->add_field('timecreated',  XMLDB_TYPE_INTEGER, '10',  null, XMLDB_NOTNULL);
        $table->add_field('timemodified', XMLDB_TYPE_INTEGER, '10',  null, XMLDB_NOTNULL);

        $table->add_key('primary', XMLDB_KEY_PRIMARY, ['id']);
        $table->add_index('createdby', XMLDB_INDEX_NOTUNIQUE, ['createdby']);

        if (!$dbman->table_exists($table)) {
            $dbman->create_table($table);
        }

        upgrade_plugin_savepoint(true, 2026020501, 'local', 'rubricbuilder');
    }

    return true;
}
