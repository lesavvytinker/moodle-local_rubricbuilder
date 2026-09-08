/**
 * RubricBuilder - TinyMCE plugin
 * Two modes: Rubric (cell-level scores) and Marking Guide (free score)
 */
(function() {
    'use strict';

    function esc(str) {
        return String(str || '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    function escNL(str) { return esc(str).replace(/\n/g, '<br>'); }

    // Looks up a user-facing string from window.RB_STRINGS (populated by
    // lib.php via get_string()), falling back to a hardcoded English string
    // only if RB_STRINGS somehow isn't available — this keeps the plugin
    // from breaking outright rather than as a substitute for translations.
    function t(key, fallback) {
        return (typeof window.RB_STRINGS !== 'undefined' && window.RB_STRINGS[key] !== undefined)
            ? window.RB_STRINGS[key]
            : fallback;
    }
    // Same as t(), but substitutes a single {$a} placeholder with the given value.
    function ta(key, a, fallback) {
        return t(key, fallback).replace('{$a}', a);
    }

    // -------------------------------------------------------------------------
    // HTML Generators
    // -------------------------------------------------------------------------
    function generateRubricHTML(data) {
        var rows = data.rows;  // [{label, cols:[{score, desc}, ...]}]
        var numCols = 0;
        rows.forEach(function(r) { if (r.cols.length > numCols) numCols = r.cols.length; });

        var html = '<p></p>\n';
        html += '<h4>Select one cell for each criterion. Scores will appear in the box visible to the student below.</h4>\n';
        html += '<h4><strong>Important:</strong> Add any additional feedback <em>after</em> selecting from each criterion.</h4>\n';
        html += '<p></p>\n';
        html += '<table class="rs-table rs-rubric rgdr-table rgdr-rubric" style="border-collapse:collapse;width:100%;" border="1" cellpadding="10">\n';
        html += '  <thead><tr><th>Criteria</th>';
        for (var i = 0; i < numCols; i++) html += '<th></th>';
        html += '</tr></thead>\n  <tbody>\n';
        rows.forEach(function(row) {
            html += '    <tr>\n';
            html += '      <td class="rs-crit"><strong>' + esc(row.label) + '</strong></td>\n';
            row.cols.forEach(function(col) {
                var score = (col.score !== '' && col.score !== undefined) ? col.score : '0';
                if (col.desc && col.desc.trim()) {
                    html += '      <td class="rs-cell rs-score-' + esc(String(score).replace('.','_')) + '" data-score="' + esc(score) + '">';
                    html += '<strong class="rs-cell-score-badge">' + esc(score) + ' mark' + (parseFloat(score) === 1 ? '' : 's') + '</strong><br>';
                    html += escNL(col.desc) + '</td>\n';
                } else {
                    html += '      <td> </td>\n';
                }
            });
            html += '    </tr>\n';
        });
        html += '  </tbody>\n</table>';
        return html;
    }

    function generateMarkingGuideHTML(data) {
        var rows = data.rows;
        var total = 0;
        rows.forEach(function(r) { total += parseFloat(r.max) || 0; });
        var html = '<table class="rs-table rs-marking-guide rgdr-table rgdr-marking-guide" style="border-collapse:collapse;width:100%;" border="1" cellpadding="10">\n';
        html += '  <thead><tr>\n    <th style="text-align:left;">Criteria</th>\n    <th>Max Marks</th>\n    <th>Score</th>\n  </tr></thead>\n  <tbody>\n';
        rows.forEach(function(row) {
            html += '    <tr class="rs-criterion-row">\n';
            var descHtml = row.desc ? '<br><span class="rs-criterion-desc">' + escNL(row.desc) + '</span>' : '<span class="rs-criterion-desc"></span>';
            html += '      <td class="rs-criterion-label-cell"><strong class="rs-criterion-label">' + esc(row.label) + '</strong>' + descHtml + '</td>\n';
            html += '      <td class="rs-max-cell"><label>Max</label> <input class="rs-max-input" min="0" step="0.1" type="number" value="' + esc(row.max) + '"></td>\n';
            html += '      <td class="rs-score-cell"><label>Score</label> <input class="rs-score-input" min="0" step="0.1" type="number" placeholder="0.0"> <span class="rs-confirm-btn">Confirm</span></td>\n';
            html += '    </tr>\n';
        });
        html += '  </tbody>\n  <tfoot><tr class="rs-total-row"><td class="rs-total-label" colspan="2">Total</td><td class="rs-total-value rs-score-cell">0.0 / ' + total + '.0</td></tr></tfoot>\n</table>';
        return html;
    }

    // -------------------------------------------------------------------------
    // Modal
    // -------------------------------------------------------------------------
    var OVERLAY_ID = 'rb-overlay';
    var MODAL_ID   = 'rb-modal';
    var _editor    = null;

    // Keepalive: while the modal is open, periodically ping the server so
    // Moodle's session-activity clock never runs down mid-edit. Someone
    // building out a detailed rubric can easily spend longer on it than a
    // short session timeout allows, and losing everything they typed to a
    // session-expiry alert is exactly the failure mode this avoids.
    var KEEPALIVE_INTERVAL_MS = 120000; // 2 minutes — comfortably below any realistic session timeout.
    var _keepaliveTimer = null;

    function startKeepalive() {
        stopKeepalive();
        _keepaliveTimer = setInterval(function() {
            apiRequest({action: 'ping'}).catch(function() { /* keepalive is best-effort; ignore failures */ });
        }, KEEPALIVE_INTERVAL_MS);
    }

    function stopKeepalive() {
        if (_keepaliveTimer) {
            clearInterval(_keepaliveTimer);
            _keepaliveTimer = null;
        }
    }

    function openBuilder(editor) {
        _editor = editor;
        if (document.getElementById(OVERLAY_ID)) return;
        injectStyles();
        resetState();
        var overlay = document.createElement('div');
        overlay.id = OVERLAY_ID;
        overlay.innerHTML = buildModalHTML();
        document.body.appendChild(overlay);
        wireEvents();
        switchMode('rubric');
        startKeepalive();
    }

    function closeBuilder() {
        var el = document.getElementById(OVERLAY_ID);
        if (el) el.parentNode.removeChild(el);
        _editor = null;
        stopKeepalive();
    }

    function confirmClose() {
        if (confirm(t('confirmcloseunsaved', 'Close Rubric Builder? Unsaved changes will be lost.'))) closeBuilder();
    }

    function buildModalHTML() {
        return [
            '<div id="' + MODAL_ID + '">',
            '  <div id="rb-header">',
            '    <span id="rb-title">&#128203; ' + esc(t('modaltitle', 'Rubric Builder')) + '</span>',
            '    <button id="rb-close" title="' + esc(t('close', 'Close')) + '">&times;</button>',
            '  </div>',
            '  <div id="rb-tabs">',
            '    <button class="rb-tab rb-tab-active" data-mode="rubric">' + esc(t('tabrubric', 'Rubric')) + '</button>',
            '    <button class="rb-tab" data-mode="marking-guide">' + esc(t('tabmarkingguide', 'Marking Guide')) + '</button>',
            '    <button class="rb-tab rb-tab-right" data-mode="templates">&#128190; ' + esc(t('tabtemplates', 'Templates')) + '</button>',
            '  </div>',

            '  <div id="rb-name-bar">',
            '    <label for="rb-global-name">' + esc(t('templatenamelabel', 'Template name')) + '</label>',
            '    <input id="rb-global-name" class="rb-input" type="text" placeholder="' + esc(t('templatenameplaceholder', 'e.g. Describe Image — General Rubric')) + '">',
            '    <span class="rb-hint" id="rb-name-bar-hint">' + esc(t('templatenamehint', 'Only needed if you plan to save this as a reusable template.')) + '</span>',
            '  </div>',

            '  <!-- RUBRIC PANEL -->',
            '  <div id="rb-rubric-panel" class="rb-panel">',
            '    <div class="rb-section-title">',
            '      ' + esc(t('criteriarows', 'Criteria rows')),
            '      <button class="rb-small-btn" id="rb-add-row">' + esc(t('addcriterion', '+ Add criterion')) + '</button>',
            '      <span class="rb-hint">' + esc(t('rubrichint', 'Each cell has its own score value. Rows can have different numbers of cells.')) + '</span>',
            '      <span class="rb-max-badge" id="rb-rubric-max-badge">' + esc(t('maxpossible', 'Max possible:')) + ' <strong id="rb-rubric-max-value">0</strong></span>',
            '    </div>',
            '    <div id="rb-rows-body"></div>',
            '  </div>',

            '  <!-- MARKING GUIDE PANEL -->',
            '  <div id="rb-mg-panel" class="rb-panel" style="display:none;">',
            '    <div class="rb-section-title">',
            '      ' + esc(t('criteria', 'Criteria')),
            '      <button class="rb-small-btn" id="rb-mg-add-row">' + esc(t('addcriterion', '+ Add criterion')) + '</button>',
            '      <span class="rb-max-badge" id="rb-mg-max-badge">' + esc(t('maxpossible', 'Max possible:')) + ' <strong id="rb-mg-max-value">0</strong></span>',
            '    </div>',
            '    <table id="rb-mg-table">',
            '      <thead><tr><th>' + esc(t('criterionlabelheader', 'Criterion label')) + '</th><th>' + esc(t('descriptionheader', 'Description')) + '</th><th>' + esc(t('maxmarksheader', 'Max marks')) + '</th><th></th></tr></thead>',
            '      <tbody id="rb-mg-body"></tbody>',
            '    </table>',
            '  </div>',

            '  <!-- TEMPLATES PANEL -->',
            '  <div id="rb-templates-panel" class="rb-panel" style="display:none;">',
            '    <div class="rb-tpl-toolbar">',
            '      <div class="rb-section-title" style="margin:0;">' + esc(t('savedtemplates', 'Saved Templates')) + '</div>',
            '      <button class="rb-small-btn" id="rb-tpl-refresh">&#8635; ' + esc(t('refresh', 'Refresh')) + '</button>',
            '    </div>',
            '    <div id="rb-tpl-editing-indicator" style="display:none;">',
            '      <span>&#9998; ' + esc(t('editingprefix', 'Editing')) + ' <strong id="rb-tpl-editing-name"></strong> ' + esc(t('editingsuffix', '— changes here won\'t affect the saved template until you update it.')) + '</span>',
            '      <button id="rb-tpl-editing-clear" class="rb-small-btn">' + esc(t('startnewclear', 'Start new (clear)')) + '</button>',
            '    </div>',
            '    <div id="rb-tpl-save-wrap">',
            '      <span class="rb-hint">' + esc(t('usestemplatenamefield', 'Uses the "Template name" field above.')) + '</span>',
            '      <button id="rb-tpl-save-new" class="rb-small-btn rb-tpl-save-btn">&#128190; ' + esc(t('saveasnewtemplate', 'Save as new template')) + '</button>',
            '      <button id="rb-tpl-update" class="rb-small-btn rb-tpl-update-btn" disabled>&#128260; ' + esc(t('updateloadedtemplate', 'Update loaded template')) + '</button>',
            '    </div>',
            '    <div id="rb-tpl-list"><div class="rb-tpl-loading">' + esc(t('loadingtemplates', 'Loading templates...')) + '</div></div>',
            '  </div>',

            '  <div id="rb-footer">',
            '    <button id="rb-cancel">' + esc(t('cancel', 'Cancel')) + '</button>',
            '    <button id="rb-save-insert">&#128190; ' + esc(t('saveastemplateandinsert', 'Save as Template &amp; Insert')) + '</button>',
            '    <button id="rb-insert">&#10003; ' + esc(t('insertintoeditor', 'Insert into editor')) + '</button>',
            '  </div>',
            '</div>'
        ].join('\n');
    }

    // -------------------------------------------------------------------------
    // State
    // rows: [{label, cols:[{score, desc}]}]
    // mgRows: [{label, desc, max}]
    // loadedTemplateId/loadedTemplateName: set when a saved template has been
    // loaded into the editor, so "Update loaded template" knows what to
    // overwrite instead of always creating a new row.
    // -------------------------------------------------------------------------
    var state = { mode: 'rubric', rows: [], mgRows: [], loadedTemplateId: null, loadedTemplateName: '' };

    function resetState() {
        state.mode = 'rubric';
        state.rows = [
            {label: 'Criterion 1', cols: [{score:'10',desc:''},{score:'8',desc:''},{score:'6',desc:''},{score:'4',desc:''},{score:'2',desc:''},{score:'0',desc:''}]},
        ];
        state.mgRows = [{label: 'Criterion 1', desc: '', max: '5'}];
        state.loadedTemplateId = null;
        state.loadedTemplateName = '';
    }

    // Draws attention to the (empty) template-name field instead of a bare
    // alert: focuses it, briefly highlights it red, and swaps the hint text
    // under it to explain why. Used whenever a save action is attempted
    // without a name.
    function focusNameFieldWithError(message) {
        var nameEl = document.getElementById('rb-global-name');
        var hint   = document.getElementById('rb-name-bar-hint');
        if (nameEl) {
            nameEl.classList.add('rb-input-error');
            nameEl.focus();
            setTimeout(function() { nameEl.classList.remove('rb-input-error'); }, 1800);
        }
        if (hint) {
            hint.textContent = message;
            hint.classList.add('rb-hint-error');
        }
    }

    // Reflects state.loadedTemplateId in the Templates tab UI: shows/hides
    // the "Editing: X" banner, enables/disables the Update button, and
    // pre-fills the name field so a straight re-save keeps the same name.
    function updateEditingIndicator() {
        var indicator = document.getElementById('rb-tpl-editing-indicator');
        var nameSpan  = document.getElementById('rb-tpl-editing-name');
        var updateBtn = document.getElementById('rb-tpl-update');
        var nameEl    = document.getElementById('rb-global-name');
        if (!indicator || !updateBtn) return;
        if (state.loadedTemplateId) {
            indicator.style.display = 'flex';
            if (nameSpan) nameSpan.textContent = state.loadedTemplateName;
            updateBtn.disabled = false;
            if (nameEl && !nameEl.value) nameEl.value = state.loadedTemplateName;
        } else {
            indicator.style.display = 'none';
            updateBtn.disabled = true;
        }
    }

    // -------------------------------------------------------------------------
    // Sync
    // -------------------------------------------------------------------------
    function syncRows() {
        document.querySelectorAll('.rb-row-label').forEach(function(inp) {
            var ri = +inp.getAttribute('data-ri');
            if (state.rows[ri]) state.rows[ri].label = inp.value;
        });
        document.querySelectorAll('.rb-col-score').forEach(function(inp) {
            var ri = +inp.getAttribute('data-ri'), ci = +inp.getAttribute('data-ci');
            if (state.rows[ri] && state.rows[ri].cols[ci]) state.rows[ri].cols[ci].score = inp.value;
        });
        document.querySelectorAll('.rb-col-desc').forEach(function(ta) {
            var ri = +ta.getAttribute('data-ri'), ci = +ta.getAttribute('data-ci');
            if (state.rows[ri] && state.rows[ri].cols[ci]) state.rows[ri].cols[ci].desc = ta.value;
        });
    }

    function syncMGRows() {
        document.querySelectorAll('.rb-mg-label').forEach(function(inp) {
            if (state.mgRows[+inp.getAttribute('data-ri')]) state.mgRows[+inp.getAttribute('data-ri')].label = inp.value;
        });
        document.querySelectorAll('.rb-mg-desc').forEach(function(ta) {
            if (state.mgRows[+ta.getAttribute('data-ri')]) state.mgRows[+ta.getAttribute('data-ri')].desc = ta.value;
        });
        document.querySelectorAll('.rb-mg-max').forEach(function(inp) {
            if (state.mgRows[+inp.getAttribute('data-ri')]) state.mgRows[+inp.getAttribute('data-ri')].max = inp.value;
        });
    }

    // -------------------------------------------------------------------------
    // Render
    // -------------------------------------------------------------------------
    // -------------------------------------------------------------------------
    // Live max-possible-score display
    // Rubric mode: only one cell per row gets selected during grading, so a
    // row's contribution to the max is its HIGHEST cell score, not the sum
    // of all its cells — matching how local_rubricgrader actually totals it.
    // Marking Guide mode: each row's "Max marks" field is summed directly.
    // Reads straight from the live DOM inputs rather than `state`, so it
    // stays accurate on every keystroke without needing a full re-render.
    // -------------------------------------------------------------------------
    function computeRubricMaxFromDOM() {
        var max = 0;
        document.querySelectorAll('.rb-row-block').forEach(function(rowEl) {
            var rowMax = 0;
            rowEl.querySelectorAll('.rb-col-score').forEach(function(inp) {
                var v = parseFloat(inp.value);
                if (!isNaN(v) && v > rowMax) rowMax = v;
            });
            max += rowMax;
        });
        return max;
    }

    function computeMGMaxFromDOM() {
        var max = 0;
        document.querySelectorAll('.rb-mg-max').forEach(function(inp) {
            var v = parseFloat(inp.value);
            if (!isNaN(v)) max += v;
        });
        return max;
    }

    function updateRubricMaxBadge() {
        var el = document.getElementById('rb-rubric-max-value');
        if (el) el.textContent = computeRubricMaxFromDOM();
    }

    function updateMGMaxBadge() {
        var el = document.getElementById('rb-mg-max-value');
        if (el) el.textContent = computeMGMaxFromDOM();
    }

    function renderRows() {
        var container = document.getElementById('rb-rows-body');
        if (!container) return;
        container.innerHTML = '';
        state.rows.forEach(function(row, ri) {
            var div = document.createElement('div');
            div.className = 'rb-row-block';
            div.setAttribute('data-ri', ri);

            // Row header
            var header = '<div class="rb-row-header">';
            header += '<span class="rb-drag-handle" draggable="true" data-ri="' + ri + '" title="Drag to reorder">&#8597;</span>';
            header += '<input class="rb-row-label rb-input" type="text" value="' + esc(row.label) + '" data-ri="' + ri + '" placeholder="' + esc(t('criterionlabelplaceholder', 'Criterion label')) + '">';
            header += '<button class="rb-small-btn rb-add-col" data-ri="' + ri + '" style="white-space:nowrap;">' + esc(t('addcell', '+ Add cell')) + '</button>';
            header += '<button class="rb-copy-btn rb-copy-row" data-ri="' + ri + '">&#10063; ' + esc(t('copybtn', 'Copy')) + '</button>';
            header += '<button class="rb-del-btn rb-del-row" data-ri="' + ri + '">&times; ' + esc(t('removebtn', 'Remove')) + '</button>';
            header += '</div>';

            // Cells grid — each cell has score + description
            var cells = '<div class="rb-cells-grid">';
            row.cols.forEach(function(col, ci) {
                cells += '<div class="rb-col-block">';
                cells += '<div class="rb-col-score-row">';
                cells += '<label class="rb-cell-label">' + esc(t('scorelabel', 'Score')) + '</label>';
                cells += '<input class="rb-col-score rb-input rb-input-sm" type="number" value="' + esc(col.score) + '" data-ri="' + ri + '" data-ci="' + ci + '" min="0" step="0.5" placeholder="0">';
                cells += '<button class="rb-del-btn rb-del-col" data-ri="' + ri + '" data-ci="' + ci + '" style="padding:2px 6px;font-size:11px;">&times;</button>';
                cells += '</div>';
                cells += '<textarea class="rb-col-desc rb-cell-text" data-ri="' + ri + '" data-ci="' + ci + '" rows="4" placeholder="' + esc(t('celldescplaceholder', 'Cell description...')) + '">' + esc(col.desc) + '</textarea>';
                cells += '</div>';
            });
            cells += '</div>';

            div.innerHTML = header + cells;
            container.appendChild(div);
        });
        wireDragDrop(container);
        updateRubricMaxBadge();
    }

    function renderMGRows() {
        var tbody = document.getElementById('rb-mg-body');
        if (!tbody) return;
        tbody.innerHTML = '';
        state.mgRows.forEach(function(row, ri) {
            var tr = document.createElement('tr');
            tr.innerHTML = [
                '<td><input class="rb-mg-label rb-input" type="text" value="' + esc(row.label) + '" data-ri="' + ri + '"></td>',
                '<td><textarea class="rb-mg-desc rb-input" rows="3" data-ri="' + ri + '">' + esc(row.desc) + '</textarea></td>',
                '<td><input class="rb-mg-max rb-input rb-input-sm" type="number" value="' + esc(row.max) + '" data-ri="' + ri + '" min="0" step="0.5"></td>',
                '<td><button class="rb-del-btn rb-del-mg-row" data-ri="' + ri + '">&times;</button></td>'
            ].join('');
            tbody.appendChild(tr);
        });
        updateMGMaxBadge();
    }

    // -------------------------------------------------------------------------
    // Drag to reorder
    // -------------------------------------------------------------------------
    function wireDragDrop(container) {
        var dragSrcRi = null;
        container.addEventListener('dragstart', function(e) {
            var h = e.target.closest ? e.target.closest('.rb-drag-handle') : null;
            if (!h) return;
            dragSrcRi = +h.getAttribute('data-ri');
            e.dataTransfer.effectAllowed = 'move';
        });
        container.addEventListener('dragover', function(e) {
            e.preventDefault();
            var h = e.target.closest ? e.target.closest('.rb-drag-handle') : null;
            container.querySelectorAll('.rb-row-block').forEach(function(b) { b.classList.remove('rb-drag-over'); });
            if (h) {
                var target = +h.getAttribute('data-ri');
                if (target !== dragSrcRi) container.querySelectorAll('[data-ri="' + target + '"]')[0].classList.add('rb-drag-over');
            }
        });
        container.addEventListener('dragleave', function() {
            container.querySelectorAll('.rb-row-block').forEach(function(b) { b.classList.remove('rb-drag-over'); });
        });
        container.addEventListener('drop', function(e) {
            e.preventDefault();
            var h = e.target.closest ? e.target.closest('.rb-drag-handle') : null;
            if (!h) return;
            var targetRi = +h.getAttribute('data-ri');
            if (isNaN(dragSrcRi) || dragSrcRi === targetRi) return;
            syncRows();
            var moved = state.rows.splice(dragSrcRi, 1)[0];
            state.rows.splice(targetRi, 0, moved);
            dragSrcRi = null;
            renderRows();
        });
    }

    // -------------------------------------------------------------------------
    // Mode switching
    // -------------------------------------------------------------------------
    function switchMode(mode) {
        // Track the last non-template mode so saveTemplate knows what type to save
        if (mode !== 'templates') state.mode = mode;
        var rubricPanel = document.getElementById('rb-rubric-panel');
        var mgPanel     = document.getElementById('rb-mg-panel');
        var tplPanel    = document.getElementById('rb-templates-panel');
        var insertBtn   = document.getElementById('rb-insert');
        var saveInsertBtn = document.getElementById('rb-save-insert');
        rubricPanel.style.display = mode === 'rubric' ? '' : 'none';
        mgPanel.style.display     = mode === 'marking-guide' ? '' : 'none';
        tplPanel.style.display    = mode === 'templates' ? '' : 'none';
        insertBtn.style.display   = mode === 'templates' ? 'none' : '';
        if (saveInsertBtn) saveInsertBtn.style.display = mode === 'templates' ? 'none' : '';
        if (mode === 'rubric') renderRows();
        else if (mode === 'marking-guide') renderMGRows();
        else if (mode === 'templates') { loadTemplateList(); updateEditingIndicator(); }
    }

    // -------------------------------------------------------------------------
    // Wire events
    // -------------------------------------------------------------------------
    // Generates HTML from whichever mode (rubric/marking-guide) is currently
    // active, syncing the live form fields into state first. Shared by both
    // the plain "Insert into editor" button and "Save as Template & Insert".
    function generateCurrentHtml() {
        if (state.mode === 'rubric') {
            syncRows();
            return generateRubricHTML({rows: state.rows});
        } else if (state.mode === 'marking-guide') {
            syncMGRows();
            return generateMarkingGuideHTML({rows: state.mgRows});
        }
        return '';
    }

    function insertHtmlAndClose(html) {
        if (_editor && html) {
            _editor.setContent(html);
            _editor.fire('change');
            var ta = document.getElementById(_editor.id);
            if (ta) ta.value = html;
        }
        closeBuilder();
    }

    function wireEvents() {
        document.getElementById('rb-close').addEventListener('click', confirmClose);
        document.getElementById('rb-cancel').addEventListener('click', confirmClose);

        document.querySelectorAll('.rb-tab').forEach(function(btn) {
            btn.addEventListener('click', function() {
                if (state.mode === 'rubric') syncRows();
                else if (state.mode === 'marking-guide') syncMGRows();
                document.querySelectorAll('.rb-tab').forEach(function(b) { b.classList.remove('rb-tab-active'); });
                this.classList.add('rb-tab-active');
                switchMode(this.getAttribute('data-mode'));
            });
        });

        var modal = document.getElementById(MODAL_ID);

        // Add criterion row
        document.getElementById('rb-add-row').addEventListener('click', function() {
            syncRows();
            state.rows.push({label: 'Criterion ' + (state.rows.length + 1), cols: [{score:'10',desc:''},{score:'8',desc:''},{score:'6',desc:''},{score:'4',desc:''},{score:'2',desc:''},{score:'0',desc:''}]});
            renderRows();
        });

        // Add MG row
        document.getElementById('rb-mg-add-row').addEventListener('click', function() {
            syncMGRows();
            state.mgRows.push({label: 'Criterion ' + (state.mgRows.length + 1), desc: '', max: '5'});
            renderMGRows();
        });

        // Delegated clicks
        modal.addEventListener('click', function(e) {
            var t = e.target;

            // Add cell to a row
            if (t.classList.contains('rb-add-col')) {
                syncRows();
                var ri = +t.getAttribute('data-ri');
                state.rows[ri].cols.push({score: '0', desc: ''});
                renderRows();
            }
            // Delete cell
            if (t.classList.contains('rb-del-col')) {
                syncRows();
                var ri = +t.getAttribute('data-ri'), ci = +t.getAttribute('data-ci');
                state.rows[ri].cols.splice(ci, 1);
                renderRows();
            }
            // Delete row
            if (t.classList.contains('rb-del-row')) {
                syncRows();
                state.rows.splice(+t.getAttribute('data-ri'), 1);
                renderRows();
            }
            // Copy row
            if (t.classList.contains('rb-copy-row')) {
                syncRows();
                var ri = +t.getAttribute('data-ri');
                var orig = state.rows[ri];
                state.rows.splice(ri + 1, 0, {
                    label: orig.label + ' (copy)',
                    cols: orig.cols.map(function(c) { return {score: c.score, desc: c.desc}; })
                });
                renderRows();
            }
            // Delete MG row
            if (t.classList.contains('rb-del-mg-row')) {
                syncMGRows();
                state.mgRows.splice(+t.getAttribute('data-ri'), 1);
                renderMGRows();
            }
        });

        // Prevent scroll wheel on number inputs
        modal.addEventListener('wheel', function(e) {
            if (document.activeElement && document.activeElement.type === 'number') document.activeElement.blur();
        }, {passive: true});

        // Keep the live max-possible-score badge in sync as scores/max marks are typed
        modal.addEventListener('input', function(e) {
            if (e.target.classList.contains('rb-col-score')) updateRubricMaxBadge();
            if (e.target.classList.contains('rb-mg-max')) updateMGMaxBadge();
            if (e.target.id === 'rb-global-name') {
                e.target.classList.remove('rb-input-error');
                var hint = document.getElementById('rb-name-bar-hint');
                if (hint) { hint.textContent = 'Only needed if you plan to save this as a reusable template.'; hint.classList.remove('rb-hint-error'); }
            }
        });

        // Templates
        document.getElementById('rb-tpl-save-new').addEventListener('click', function() { saveTemplateAs(true); });
        document.getElementById('rb-tpl-update').addEventListener('click', function() { saveTemplateAs(false); });
        document.getElementById('rb-tpl-editing-clear').addEventListener('click', function() {
            if (state.loadedTemplateId && !confirm(ta('confirmstopediting', state.loadedTemplateName, 'Stop editing "{$a}" and start a blank rubric? Unsaved changes here will be lost.'))) return;
            resetState();
            var nameEl = document.getElementById('rb-global-name');
            if (nameEl) nameEl.value = '';
            updateEditingIndicator();
            renderRows();
        });
        document.getElementById('rb-tpl-refresh').addEventListener('click', loadTemplateList);
        document.getElementById('rb-tpl-list').addEventListener('click', function(e) {
            if (e.target.classList.contains('rb-tpl-load-btn')) loadTemplate(+e.target.getAttribute('data-id'));
            if (e.target.classList.contains('rb-tpl-del-btn'))  deleteTemplate(+e.target.getAttribute('data-id'));
        });

        // Insert
        document.getElementById('rb-insert').addEventListener('click', function() {
            insertHtmlAndClose(generateCurrentHtml());
        });

        // Save as Template & Insert — saves whatever's currently built as a
        // template (new, or updating the one currently loaded if the name is
        // unchanged), then inserts it into the editor in one click.
        document.getElementById('rb-save-insert').addEventListener('click', function() {
            var html = generateCurrentHtml(); // also syncs state.rows/mgRows so templatedata below is current
            var nameEl = document.getElementById('rb-global-name');
            var name = nameEl ? nameEl.value.trim() : '';
            if (!name) { focusNameFieldWithError(t('errorenternametoinsert', 'Enter a template name above to save & insert.')); return; }

            var templatedata = JSON.stringify({rows: state.rows, mgRows: state.mgRows});
            var payload = {action: 'save', name: name, mode: state.mode, templatedata: templatedata};
            if (state.loadedTemplateId && name === state.loadedTemplateName) {
                payload.id = state.loadedTemplateId; // same template, same name → update in place rather than duplicate
            }
            apiRequest(payload).then(function(data) {
                if (data.error) {
                    alert(ta('errorsavefailednotinserted', data.error, 'Could not save the template, so nothing was inserted either. Error: {$a}'));
                    return;
                }
                state.loadedTemplateId = data.id;
                state.loadedTemplateName = name;
                insertHtmlAndClose(html);
            });
        });
    }

    // -------------------------------------------------------------------------
    // Template API
    // -------------------------------------------------------------------------
    // NOTE: these are resolved fresh inside apiRequest() on every call rather
    // than captured once into module-level constants here. Capturing them at
    // script-parse time created a load-order race: if this file started
    // executing even slightly before Moodle finished injecting
    // window.RB_SESSKEY via js_init_code, the empty-string fallback got
    // locked in permanently, silently sending a blank sesskey on every
    // request for the rest of the page's life (require_sesskey() always
    // rejects a blank sesskey, surfacing as Moodle's generic session-expired
    // error even on a perfectly fresh session).
    function getTemplateUrl() {
        return (typeof window.RB_TEMPLATE_URL !== 'undefined' && window.RB_TEMPLATE_URL)
            ? window.RB_TEMPLATE_URL
            : '/local/rubricbuilder/template.php';
    }

    var _refreshedSesskey = null; // set once we've recovered a current sesskey from the server

    function getSesskey() {
        // A sesskey recovered via refreshsesskey() (see below) is the most
        // up to date, so it takes priority once we have one.
        if (_refreshedSesskey) return _refreshedSesskey;
        // Prefer Moodle core's own M.cfg.sesskey — it's guaranteed to be
        // ready before any plugin JS runs, so it can't hit the same race.
        // Fall back to our own injected value, then to Moodle's sesskey()
        // cookie-independent global if present, in case M.cfg isn't loaded
        // on some page for any reason.
        if (typeof M !== 'undefined' && M.cfg && M.cfg.sesskey) return M.cfg.sesskey;
        if (typeof window.RB_SESSKEY !== 'undefined' && window.RB_SESSKEY) return window.RB_SESSKEY;
        return '';
    }

    function rawRequest(params) {
        var url = getTemplateUrl() + '?sesskey=' + encodeURIComponent(getSesskey());
        var body = new URLSearchParams();
        Object.keys(params).forEach(function(k) { body.append(k, params[k]); });
        return fetch(url, {
            method: 'POST',
            headers: {'Content-Type': 'application/x-www-form-urlencoded'},
            body: body.toString()
        }).then(function(r) { return r.json(); });
    }

    function apiRequest(params, _isRetry) {
        var sesskey = getSesskey();
        if (!sesskey) {
            // Fail loudly and specifically rather than sending a request we
            // already know will be rejected — this makes the real cause
            // immediately obvious instead of surfacing as a generic
            // session-timeout alert from the server round-trip.
            return Promise.resolve({error: t('errornosesskey', 'Could not find a valid session key (sesskey) on this page. Try reloading the page before saving.')});
        }
        return rawRequest(params).then(function(data) {
            // The client's cached sesskey can drift out of sync with what
            // Moodle currently has for this session (e.g. a tab left open
            // for a while). Rather than surface that to the person as a
            // scary "session timed out" alert — and lose whatever they've
            // typed into the rubric — recover a current sesskey and retry
            // the exact same request ONCE, transparently.
            if (!_isRetry && data && data.errorcode === 'invalidsesskey') {
                return rawRequest({action: 'refreshsesskey'}).then(function(freshData) {
                    if (freshData && freshData.sesskey) {
                        _refreshedSesskey = freshData.sesskey;
                        return apiRequest(params, true);
                    }
                    return data; // couldn't recover — surface the original error
                }).catch(function() { return data; });
            }
            return data;
        });
    }

    function loadTemplateList() {
        var listEl = document.getElementById('rb-tpl-list');
        if (!listEl) return;
        listEl.innerHTML = '<div class="rb-tpl-loading">' + esc(t('loadingdots', 'Loading...')) + '</div>';
        apiRequest({action: 'list'}).then(function(data) {
            if (!data.templates || !data.templates.length) { listEl.innerHTML = '<div class="rb-tpl-empty">' + esc(t('notemplatessaved', 'No templates saved yet.')) + '</div>'; return; }
            var html = '<table class="rb-tpl-table"><thead><tr><th>' + esc(t('colname', 'Name')) + '</th><th>' + esc(t('coltype', 'Type')) + '</th><th>' + esc(t('colsavedby', 'Saved by')) + '</th><th>' + esc(t('coldate', 'Date')) + '</th><th></th></tr></thead><tbody>';
            data.templates.forEach(function(t2) {
                var modeLabel = t2.mode === 'marking-guide' ? t('tabmarkingguide', 'Marking Guide') : t('tabrubric', 'Rubric');
                html += '<tr><td><strong>' + esc(t2.name) + '</strong></td>';
                html += '<td><span class="rb-tpl-badge rb-tpl-badge-' + esc(t2.mode) + '">' + esc(modeLabel) + '</span></td>';
                html += '<td>' + esc(t2.createdbyname) + '</td><td>' + new Date(t2.timemodified*1000).toLocaleDateString() + '</td>';
                html += '<td class="rb-tpl-actions"><button class="rb-small-btn rb-tpl-load-btn" data-id="' + t2.id + '">&#9654; ' + esc(t('loadbtn', 'Load')) + '</button>';
                html += '<button class="rb-del-btn rb-tpl-del-btn" data-id="' + t2.id + '">&times;</button></td></tr>';
            });
            listEl.innerHTML = html + '</tbody></table>';
        }).catch(function() { listEl.innerHTML = '<div class="rb-tpl-empty">' + esc(t('couldnotloadtemplates', 'Could not load templates.')) + '</div>'; });
    }

    function saveTemplateAs(asNew) {
        var nameEl = document.getElementById('rb-global-name');
        var name = nameEl ? nameEl.value.trim() : '';
        if (!name) { focusNameFieldWithError(t('errornametemplaterequired', 'A template name is required to save.')); return; }
        if (!asNew && !state.loadedTemplateId) {
            // Shouldn't happen since the button is disabled in this case, but guard anyway.
            alert(t('errornotemplateloaded', 'No template is currently loaded to update. Use "Save as new template" instead.'));
            return;
        }
        // Sync whichever mode is active — also sync the other to preserve edits
        syncRows();
        syncMGRows();
        var templatedata = JSON.stringify({rows: state.rows, mgRows: state.mgRows});
        var payload = {action: 'save', name: name, mode: state.mode, templatedata: templatedata};
        if (!asNew) payload.id = state.loadedTemplateId;
        apiRequest(payload).then(function(data) {
            if (data.error) { alert(ta('errorprefix', data.error, 'Error: {$a}')); return; }
            // Whether we created a new row or updated an existing one, treat
            // the result as "now loaded" so a further click of Update saves
            // back to the same place instead of creating another duplicate.
            state.loadedTemplateId = data.id;
            state.loadedTemplateName = name;
            updateEditingIndicator();
            alert(asNew ? ta('templatesaved', name, 'Template "{$a}" saved!') : ta('templateupdated', name, 'Template "{$a}" updated!'));
            loadTemplateList();
        });
    }

    function loadTemplate(id) {
        apiRequest({action: 'get', id: id}).then(function(data) {
            if (data.error) { alert(ta('errorprefix', data.error, 'Error: {$a}')); return; }
            state.mode = data.mode;
            if (data.templatedata.rows)   state.rows   = data.templatedata.rows;
            if (data.templatedata.mgRows) state.mgRows = data.templatedata.mgRows;
            state.loadedTemplateId = data.id;
            state.loadedTemplateName = data.name;
            var nameEl = document.getElementById('rb-global-name');
            if (nameEl) nameEl.value = data.name;
            updateEditingIndicator();
            document.querySelectorAll('.rb-tab').forEach(function(b) { b.classList.remove('rb-tab-active'); });
            var tab = document.querySelector('.rb-tab[data-mode="' + data.mode + '"]');
            if (tab) tab.classList.add('rb-tab-active');
            switchMode(data.mode);
        });
    }

    function deleteTemplate(id) {
        if (!confirm(t('confirmdeletetemplate', 'Delete this template?'))) return;
        apiRequest({action: 'delete', id: id}).then(function(data) {
            if (data.error) { alert(ta('errorprefix', data.error, 'Error: {$a}')); return; }
            if (state.loadedTemplateId === id) {
                // The template currently loaded into the editor was just
                // deleted — stop treating it as "loaded" so Update doesn't
                // try to save back to a row that no longer exists.
                state.loadedTemplateId = null;
                state.loadedTemplateName = '';
                updateEditingIndicator();
            }
            loadTemplateList();
        });
    }

    // -------------------------------------------------------------------------
    // Styles
    // -------------------------------------------------------------------------
    function injectStyles() {
        if (document.getElementById('rb-styles')) return;
        var s = document.createElement('style');
        s.id = 'rb-styles';
        s.textContent = [
            '#rb-overlay{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.55);z-index:99999;display:flex;align-items:center;justify-content:center;}',
            '#rb-modal{background:#fff;border-radius:8px;width:92vw;max-width:1100px;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 8px 40px rgba(0,0,0,.35);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-size:14px;}',
            '#rb-header{background:#1a56db;color:#fff;padding:14px 18px;border-radius:8px 8px 0 0;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;}',
            '#rb-title{font-size:16px;font-weight:600;}',
            '#rb-close{background:none;border:none;color:#fff;font-size:22px;cursor:pointer;line-height:1;padding:0 4px;}',
            '#rb-tabs{display:flex;border-bottom:2px solid #e5e7eb;background:#f8fafc;padding:0 18px;flex-shrink:0;}',
            '.rb-tab{background:none;border:none;padding:10px 18px;cursor:pointer;font-size:14px;color:#6b7280;border-bottom:2px solid transparent;margin-bottom:-2px;}',
            '.rb-tab:hover{color:#1a56db;}',
            '.rb-tab-active{color:#1a56db!important;font-weight:600;border-bottom-color:#1a56db!important;}',
            '.rb-tab-right{margin-left:auto!important;color:#059669!important;}',
            '.rb-tab-right.rb-tab-active{border-bottom-color:#059669!important;}',
            '.rb-panel{padding:14px 18px 8px;overflow-y:auto;flex:1;min-height:0;}',
            '.rb-section-title{font-weight:600;color:#374151;margin-bottom:12px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;}',
            '.rb-hint{font-weight:normal;color:#9ca3af;font-size:12px;}',
            '.rb-hint-error{color:#dc2626!important;font-weight:600;}',
            '#rb-name-bar{display:flex;align-items:center;gap:10px;padding:10px 18px;background:#fafafa;border-bottom:1px solid #e5e7eb;flex-wrap:wrap;flex-shrink:0;}',
            '#rb-name-bar label{font-weight:600;color:#374151;font-size:13px;white-space:nowrap;}',
            '#rb-name-bar input{max-width:320px;}',
            '.rb-input-error{border-color:#dc2626!important;box-shadow:0 0 0 2px rgba(220,38,38,.15)!important;}',
            '.rb-max-badge{margin-left:auto;font-weight:600;color:#065f46;background:#d1fae5;border-radius:4px;padding:4px 10px;font-size:12.5px;white-space:nowrap;}',
            '.rb-max-badge strong{font-size:14px;}',
            '.rb-small-btn{background:#e0e7ff;color:#3730a3;border:none;border-radius:4px;padding:4px 10px;cursor:pointer;font-size:12px;}',
            '.rb-small-btn:hover{background:#c7d2fe;}',
            '.rb-input{width:100%;box-sizing:border-box;border:1px solid #d1d5db;border-radius:4px;padding:6px 8px;font-size:13px;font-family:inherit;}',
            '.rb-input:focus{outline:none;border-color:#1a56db;box-shadow:0 0 0 2px rgba(26,86,219,.15);}',
            '.rb-input-sm{width:80px!important;}',
            /* Row block */
            '.rb-row-block{border:1px solid #e5e7eb;border-radius:6px;margin-bottom:14px;overflow:hidden;}',
            '.rb-row-block.rb-drag-over{border-color:#6366f1;background:#eef2ff;}',
            '.rb-row-header{background:#f8fafc;padding:8px 12px;display:flex;align-items:center;gap:8px;border-bottom:1px solid #e5e7eb;flex-wrap:wrap;}',
            '.rb-row-header .rb-input{flex:1;min-width:180px;}',
            '.rb-drag-handle{cursor:grab;color:#9ca3af;font-size:18px;padding:0 2px;user-select:none;flex-shrink:0;}',
            '.rb-drag-handle:hover{color:#6366f1;}',
            /* Cells grid */
            '.rb-cells-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;padding:12px;}',
            '.rb-col-block{border:1px solid #e5e7eb;border-radius:4px;padding:8px;background:#fafafa;}',
            '.rb-col-score-row{display:flex;align-items:center;gap:6px;margin-bottom:6px;}',
            '.rb-cell-label{font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;white-space:nowrap;}',
            '.rb-cell-text{width:100%;box-sizing:border-box;font-size:12px;resize:vertical;font-family:inherit;border:1px solid #d1d5db;border-radius:4px;padding:4px 6px;}',
            /* Buttons */
            '.rb-copy-btn{background:none;border:1px solid #6ee7b7;color:#059669;border-radius:4px;padding:3px 8px;cursor:pointer;font-size:12px;white-space:nowrap;}',
            '.rb-copy-btn:hover{background:#d1fae5;}',
            '.rb-del-btn{background:none;border:1px solid #fca5a5;color:#dc2626;border-radius:4px;padding:3px 8px;cursor:pointer;font-size:12px;white-space:nowrap;}',
            '.rb-del-btn:hover{background:#fee2e2;}',
            /* MG table */
            '#rb-mg-table{width:100%;border-collapse:collapse;}',
            '#rb-mg-table th{text-align:left;padding:8px 10px;background:#f3f4f6;font-size:12px;color:#6b7280;border-bottom:1px solid #e5e7eb;}',
            '#rb-mg-table td{padding:6px 10px;border-bottom:1px solid #f3f4f6;vertical-align:top;}',
            /* Footer */
            '#rb-footer{padding:12px 18px;border-top:1px solid #e5e7eb;display:flex;justify-content:flex-end;gap:10px;background:#f8fafc;border-radius:0 0 8px 8px;flex-shrink:0;}',
            '#rb-cancel{background:#fff;border:1px solid #d1d5db;color:#374151;border-radius:5px;padding:8px 18px;cursor:pointer;font-size:14px;}',
            '#rb-cancel:hover{background:#f3f4f6;}',
            '#rb-insert{background:#1a56db;color:#fff;border:none;border-radius:5px;padding:8px 22px;cursor:pointer;font-size:14px;font-weight:600;}',
            '#rb-insert:hover{background:#1e40af;}',
            '#rb-save-insert{background:#fff;border:1px solid #059669;color:#059669;border-radius:5px;padding:8px 18px;cursor:pointer;font-size:14px;font-weight:600;}',
            '#rb-save-insert:hover{background:#ecfdf5;}',
            /* Templates */
            '.rb-tpl-toolbar{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;}',
            '#rb-tpl-editing-indicator{display:none;align-items:center;gap:10px;background:#eef2ff;border:1px solid #c7d2fe;color:#3730a3;border-radius:5px;padding:8px 12px;margin-bottom:10px;font-size:12.5px;}',
            '#rb-tpl-editing-indicator button{margin-left:auto;flex-shrink:0;}',
            '#rb-tpl-save-wrap{display:flex;gap:8px;align-items:center;margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid #e5e7eb;flex-wrap:wrap;}',
            '.rb-tpl-save-btn{background:#059669!important;color:#fff!important;border:none!important;padding:6px 14px!important;white-space:nowrap;}',
            '.rb-tpl-save-btn:hover{background:#047857!important;}',
            '.rb-tpl-update-btn{background:#1a56db!important;color:#fff!important;border:none!important;padding:6px 14px!important;white-space:nowrap;}',
            '.rb-tpl-update-btn:hover:not(:disabled){background:#1e40af!important;}',
            '.rb-tpl-update-btn:disabled{background:#e5e7eb!important;color:#9ca3af!important;cursor:not-allowed;}',
            '.rb-tpl-loading,.rb-tpl-empty{color:#9ca3af;padding:24px;text-align:center;}',
            '.rb-tpl-table{width:100%;border-collapse:collapse;font-size:13px;}',
            '.rb-tpl-table th{text-align:left;padding:8px 10px;background:#f3f4f6;font-size:12px;color:#6b7280;border-bottom:1px solid #e5e7eb;}',
            '.rb-tpl-table td{padding:8px 10px;border-bottom:1px solid #f9fafb;vertical-align:middle;}',
            '.rb-tpl-table tr:hover td{background:#f8fafc;}',
            '.rb-tpl-badge{display:inline-block;border-radius:3px;padding:2px 7px;font-size:11px;font-weight:600;}',
            '.rb-tpl-badge-rubric{background:#dbeafe;color:#1d4ed8;}',
            '.rb-tpl-badge-marking-guide{background:#d1fae5;color:#065f46;}',
            '.rb-tpl-actions{display:flex;gap:6px;}'
        ].join('\n');
        document.head.appendChild(s);
    }

    // -------------------------------------------------------------------------
    // TinyMCE integration
    // -------------------------------------------------------------------------
    function injectButtonIntoEditor(editor) {
        if (!editor) return;
        var ta = document.getElementById(editor.id);
        var taName = ta ? (ta.getAttribute('name') || '').toLowerCase() : '';
        var edId = (editor.id || '').toLowerCase();
        if (taName.indexOf('graderinfo') === -1 && edId.indexOf('graderinfo') === -1) return;

        function doInject() {
            var container = editor.getContainer ? editor.getContainer() : null;
            if (!container || document.getElementById('rb-float-btn-' + editor.id)) return;

            var wrap = document.createElement('div');
            wrap.id = 'rb-float-btn-' + editor.id;
            wrap.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:6px;';

            var btn = document.createElement('button');
            btn.type = 'button';
            btn.innerHTML = '&#128203; ' + esc(t('modaltitle', 'Rubric Builder'));
            btn.style.cssText = 'display:inline-flex;align-items:center;gap:6px;background:#1a56db;color:#fff;border:none;border-radius:5px;padding:6px 14px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;box-shadow:0 1px 4px rgba(0,0,0,.18);';
            btn.addEventListener('mouseenter', function() { this.style.background='#1e40af'; });
            btn.addEventListener('mouseleave', function() { this.style.background='#1a56db'; });
            btn.addEventListener('click', function() { openBuilder(editor); });

            var clearBtn = document.createElement('button');
            clearBtn.type = 'button';
            clearBtn.innerHTML = '&#10005; ' + esc(t('cleareditorbtn', 'Clear editor'));
            clearBtn.style.cssText = 'display:inline-flex;align-items:center;gap:6px;background:#fff;color:#6b7280;border:1px solid #d1d5db;border-radius:5px;padding:6px 12px;font-size:13px;cursor:pointer;font-family:inherit;';
            clearBtn.addEventListener('mouseenter', function() { this.style.background='#fee2e2';this.style.color='#dc2626';this.style.borderColor='#fca5a5'; });
            clearBtn.addEventListener('mouseleave', function() { this.style.background='#fff';this.style.color='#6b7280';this.style.borderColor='#d1d5db'; });
            clearBtn.addEventListener('click', function() {
                if (!confirm(t('confirmcleareditor', 'Clear the editor content?'))) return;
                editor.setContent('');
                editor.fire('change');
                var ta = document.getElementById(editor.id);
                if (ta) ta.value = '';
            });

            wrap.appendChild(btn);
            wrap.appendChild(clearBtn);
            container.parentNode.insertBefore(wrap, container);
        }

        if (editor.initialized) doInject(); else editor.on('init', doInject);
    }

    function bootstrap() {
        // Register TinyMCE plugin if available
        function registerTMCE() {
            if (typeof tinymce === 'undefined') return;
            if (!tinymce._rb_registered) {
                tinymce._rb_registered = true;
                tinymce.PluginManager.add('rubricbuilder', function(editor) {
                    editor.ui.registry.addButton('rubricbuilder', {
                        text: '📋 ' + t('modaltitle', 'Rubric Builder'),
                        tooltip: t('toolbartooltip', 'Build a rubric or marking guide'),
                        onAction: function() { openBuilder(editor); }
                    });
                    return {};
                });
                tinymce.on('AddEditor', function(e) {
                    setTimeout(function() { injectButtonIntoEditor(e.editor); }, 400);
                });
            }
            if (tinymce.editors) tinymce.editors.forEach(injectButtonIntoEditor);
        }

        // Primary strategy: watch DOM for graderinfo textarea appearing,
        // then find or wait for its TinyMCE editor
        function watchForGraderInfo() {
            var btnWrapId = 'rb-grader-wrap';

            function tryInjectForTextarea(ta) {
                if (!ta) return;
                var taId = ta.id;
                if (!taId) return;

                // Already injected?
                if (document.getElementById('rb-float-btn-' + taId)) return;

                // Try to get the TinyMCE editor for this textarea
                function doWithEditor(editor) {
                    injectButtonIntoEditor(editor);
                }

                if (typeof tinymce !== 'undefined') {
                    registerTMCE();
                    var ed = tinymce.get(taId);
                    if (ed && ed.initialized) {
                        doWithEditor(ed);
                        return;
                    }
                    // Wait for it to initialise
                    var attempts = 0;
                    var iv = setInterval(function() {
                        attempts++;
                        var ed2 = typeof tinymce !== 'undefined' ? tinymce.get(taId) : null;
                        if (ed2 && ed2.initialized) {
                            clearInterval(iv);
                            doWithEditor(ed2);
                        } else if (attempts > 40) {
                            clearInterval(iv);
                            // Inject button directly next to textarea as last resort
                            injectDirectButton(ta);
                        }
                    }, 250);
                } else {
                    // No TinyMCE at all — inject direct button
                    injectDirectButton(ta);
                }
            }

            function findAndInject() {
                // Look for any textarea whose name or id contains graderinfo
                var textareas = document.querySelectorAll('textarea[name*="graderinfo"], textarea[id*="graderinfo"]');
                textareas.forEach(function(ta) { tryInjectForTextarea(ta); });
            }

            // Run immediately
            findAndInject();

            // Watch for DOM changes (Moodle may load the editor dynamically)
            if (typeof MutationObserver !== 'undefined') {
                var observer = new MutationObserver(function(mutations) {
                    var found = false;
                    mutations.forEach(function(m) {
                        m.addedNodes.forEach(function(n) {
                            if (n.nodeType === 1) found = true;
                        });
                    });
                    if (found) findAndInject();
                });
                observer.observe(document.body, {childList: true, subtree: true});
            }

            // Also poll for a few seconds as belt-and-braces
            var polls = 0;
            var pollIv = setInterval(function() {
                polls++;
                findAndInject();
                if (typeof tinymce !== 'undefined') registerTMCE();
                if (polls >= 20) clearInterval(pollIv);
            }, 500);
        }

        // Direct button injection when TinyMCE isn't available/ready
        function injectDirectButton(ta) {
            if (!ta || !ta.id) return;
            if (document.getElementById('rb-float-btn-' + ta.id)) return;
            var wrap = buildButtonWrap(ta.id);
            ta.parentNode && ta.parentNode.insertBefore(wrap, ta);
        }

        watchForGraderInfo();
    }

    function buildButtonWrap(editorId) {
        var wrap = document.createElement('div');
        wrap.id = 'rb-float-btn-' + editorId;
        wrap.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:6px;';

        // Always resolve the editor at click time so we get the live TinyMCE instance
        function resolveEditor() {
            if (typeof tinymce !== 'undefined') {
                var ed = tinymce.get(editorId);
                if (ed) return ed;
            }
            // Fallback: wrap the raw textarea
            var ta = document.getElementById(editorId);
            if (ta) {
                return {
                    id: editorId,
                    setContent: function(h) { ta.value = h; },
                    fire: function() {}
                };
            }
            return null;
        }

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.innerHTML = '&#128203; ' + esc(t('modaltitle', 'Rubric Builder'));
        btn.style.cssText = 'display:inline-flex;align-items:center;gap:6px;background:#1a56db;color:#fff;border:none;border-radius:5px;padding:6px 14px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;box-shadow:0 1px 4px rgba(0,0,0,.18);';
        btn.addEventListener('mouseenter', function() { this.style.background='#1e40af'; });
        btn.addEventListener('mouseleave', function() { this.style.background='#1a56db'; });
        btn.addEventListener('click', function() {
            var ed = resolveEditor();
            if (ed) openBuilder(ed);
            else alert(t('editornotready', 'Editor not ready yet — please wait a moment and try again.'));
        });

        var clearBtn = document.createElement('button');
        clearBtn.type = 'button';
        clearBtn.innerHTML = '&#10005; ' + esc(t('cleareditorbtn', 'Clear editor'));
        clearBtn.style.cssText = 'display:inline-flex;align-items:center;gap:6px;background:#fff;color:#6b7280;border:1px solid #d1d5db;border-radius:5px;padding:6px 12px;font-size:13px;cursor:pointer;font-family:inherit;';
        clearBtn.addEventListener('mouseenter', function() { this.style.background='#fee2e2';this.style.color='#dc2626';this.style.borderColor='#fca5a5'; });
        clearBtn.addEventListener('mouseleave', function() { this.style.background='#fff';this.style.color='#6b7280';this.style.borderColor='#d1d5db'; });
        clearBtn.addEventListener('click', function() {
            if (!confirm(t('confirmcleareditor', 'Clear the editor content?'))) return;
            var ed = resolveEditor();
            if (ed) { ed.setContent(''); ed.fire && ed.fire('change'); }
            var ta = document.getElementById(editorId);
            if (ta) ta.value = '';
        });

        wrap.appendChild(btn);
        wrap.appendChild(clearBtn);
        return wrap;
    }

    function injectButtonIntoEditor(editor) {
        if (!editor) return;
        var ta = document.getElementById(editor.id);
        var taName = ta ? (ta.getAttribute('name') || '').toLowerCase() : '';
        var edId = (editor.id || '').toLowerCase();
        if (taName.indexOf('graderinfo') === -1 && edId.indexOf('graderinfo') === -1) return;
        if (document.getElementById('rb-float-btn-' + editor.id)) return;

        function doInject() {
            var container = editor.getContainer ? editor.getContainer() : null;
            if (!container) return;
            if (document.getElementById('rb-float-btn-' + editor.id)) return;
            var wrap = buildButtonWrap(editor.id);
            container.parentNode.insertBefore(wrap, container);
        }

        if (editor.initialized) doInject(); else editor.on('init', doInject);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootstrap);
    else bootstrap();

})();
