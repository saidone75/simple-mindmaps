/*
 * Alice's Simple Mind Maps
 * Copyright (C) 2026 Miss Alice & Saidone
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

(function () {
    const openDialog = globalThis.MindMapDialogs.open;

    const bindAiGenerateLoading = function () {
        const form = document.getElementById('ai-generate-form');
        if (!form) return;
        const apiUrl = form.dataset.generationApi;
        const errorBox = document.getElementById('ai-generation-error');
        const submitButtons = [...form.querySelectorAll('button[type="submit"]')];
        let running = false, pollTimer, activeRequest;
        let progress, connectionSlow = false;

        function updateSpinner() {
            const nodes = progress?.totalNodes > 0
                ? `Nodi preparati ${progress.completedNodes} di ${progress.totalNodes}` : '';
            const activity = connectionSlow ? 'La connessione è lenta, continuo a controllare…'
                : progress?.activity || 'Sto avviando la creazione della mappa…';
            globalThis.updateLoading(activity, nodes, progress || { totalNodes: 0 });
        }

        function stop(hide = true) {
            running = false;
            clearTimeout(pollTimer);
            activeRequest?.abort();
            submitButtons.forEach(button => { button.disabled = false; });
            if (hide) globalThis.hideLoading();
        }

        function fail(message) {
            stop();
            errorBox.textContent = message;
            errorBox.hidden = false;
        }

        async function request(url, options = {}) {
            const controller = new AbortController();
            activeRequest = controller;
            const timeout = setTimeout(() => controller.abort(), 10000);
            try {
                return await globalThis.MindMapHttp.request(url, {
                    ...options, signal: controller.signal, cache: 'no-store',
                    headers: { Accept: 'application/json', ...options.headers }
                }, {
                    sessionStatuses: [401, 403],
                    sessionMessage: 'La sessione è scaduta. Accedi di nuovo per continuare.',
                    serverMessages: true,
                    httpErrorMessage: 'Non riesco ad avviare la creazione della mappa. Riprova tra poco.'
                });
            } finally {
                clearTimeout(timeout);
                if (activeRequest === controller) activeRequest = null;
            }
        }

        function showProgress(next) {
            progress = next;
            connectionSlow = false;
            updateSpinner();
            if (progress.status === 'FAILED') {
                fail(progress.activity);
                return;
            }
            if (progress.status === 'COMPLETED') {
                const target = new URL(form.action);
                target.pathname = `${target.pathname.replace(/\/$/, '')}/${progress.id}/open`;
                stop(false);
                window.location.assign(target.href);
                return;
            }
            pollTimer = setTimeout(poll, 2000);
        }

        async function poll() {
            if (!running) return;
            try {
                const next = await request(`${apiUrl}/${progress.id}`);
                if (running) showProgress(next);
            } catch (error) {
                if (!running) return;
                if (error.status === 401 || error.status === 404 || error.status === 400) {
                    fail(error.status === 404
                        ? 'Questa attività non è più disponibile. Controlla Le mie mappe prima di riprovare.' : error.message);
                    return;
                }
                connectionSlow = true;
                updateSpinner();
                pollTimer = setTimeout(poll, 5000);
            }
        }

        form.addEventListener('submit', async event => {
            if (!apiUrl || typeof globalThis.updateLoading !== 'function') return;
            event.preventDefault();
            if (running) return;
            running = true;
            progress = null;
            connectionSlow = false;
            errorBox.hidden = true;
            submitButtons.forEach(button => { button.disabled = true; });
            globalThis.showLoading('Sto avviando la creazione della mappa…');
            updateSpinner();
            const data = new FormData(form);
            try {
                const next = await request(apiUrl, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        topic: data.get('topic'), maxDepth: Number(data.get('maxDepth')),
                        includeBranchText: data.get('includeBranchText') === 'true',
                        includeWikimediaImages: data.get('searchWikimediaImages') === 'true'
                    })
                });
                if (running) showProgress(next);
            } catch (error) {
                if (running) fail(error.status ? error.message
                    : 'Non riesco a confermare l’avvio della creazione. Controlla Le mie mappe prima di riprovare.');
            }
        });
        window.addEventListener('pagehide', () => stop(false));
    };


    const bindCloneMapConfirm = function () {
        const forms = document.querySelectorAll(".clone-map-form");
        forms.forEach((form) => {
            form.addEventListener("submit", async (event) => {
                event.preventDefault();
                const confirmed = await openDialog({
                    title: "Clonare la mappa?",
                    message: "Verrà creata una copia completa della mappa.",
                    mode: "confirm"
                });
                if (confirmed) form.submit();
            });
        });
    };

    const bindDeleteMapConfirm = function () {
        const forms = document.querySelectorAll(".delete-map-form");
        forms.forEach((form) => {
            form.addEventListener("submit", async (event) => {
                event.preventDefault();
                const confirmed = await openDialog({
                    title: "Eliminare la mappa?",
                    message: "Questa azione non può essere annullata.",
                    mode: "confirm"
                });
                if (confirmed) form.submit();
            });
        });
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            bindAiGenerateLoading();
            bindCloneMapConfirm();
            bindDeleteMapConfirm();
        }, { once: true });
    } else {
        bindAiGenerateLoading();
        bindCloneMapConfirm();
        bindDeleteMapConfirm();
    }
})();
