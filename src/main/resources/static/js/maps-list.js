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

    function bindCreationSwitches() {
        const switches = document.querySelectorAll('#ai-generate-form input[role="switch"]');
        const sync = () => switches.forEach(input => input.setAttribute('aria-checked', String(input.checked)));
        switches.forEach(input => input.addEventListener('change', sync));
        window.addEventListener('pageshow', sync);
        sync();
    }

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
            bindCreationSwitches();
            bindAiGenerateLoading();
            bindCloneMapConfirm();
            bindDeleteMapConfirm();
        }, { once: true });
    } else {
        bindCreationSwitches();
        bindAiGenerateLoading();
        bindCloneMapConfirm();
        bindDeleteMapConfirm();
    }
    const importButton = document.getElementById('import-map-btn');
    const importFile = document.getElementById('import-map-file');
    const importError = document.getElementById('import-map-error');
    importButton?.addEventListener('click', () => importFile.click());
    importFile?.addEventListener('change', async () => {
        const file = importFile.files[0];
        if (!file) return;
        importFile.value = '';
        importError.hidden = true;
        if (file.size > 100 * 1024 * 1024) {
            importError.textContent = 'Il file della mappa supera il limite di 100 MB.';
            importError.hidden = false;
            return;
        }
        importButton.disabled = true;
        globalThis.showLoading('Sto importando la mappa…');
        try {
            const result = await globalThis.MindMapHttp.request('/api/maps/import', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: file
            }, {
                serverMessages: true,
                messages: { 400: 'Il file non contiene una mappa valida o completa.', 413: 'Il file della mappa supera il limite di 100 MB.' },
                httpErrorMessage: 'Non riesco a importare la mappa. Riprova.'
            });
            if (!Number.isSafeInteger(result.id) || result.id <= 0) throw new Error('Risposta del server non valida.');
            location.assign(`/maps/${result.id}`);
        } catch (error) {
            importError.textContent = error.message;
            importError.hidden = false;
            importButton.disabled = false;
            globalThis.hideLoading();
        }
    });
    const mapGrid = document.querySelector('.map-grid');
    const orderStatus = document.getElementById('map-order-status');
    let cardDrag = null;
    let savingOrder = false;
    const cards = () => [...mapGrid.querySelectorAll('.map-card')];
    async function saveCardOrder(previous, focusHandle) {
        const ordered = cards();
        if (ordered.every((card, index) => card === previous[index])) return;
        savingOrder = true;
        mapGrid.inert = true;
        orderStatus.hidden = false;
        orderStatus.textContent = 'Sto salvando l’ordine delle mappe…';
        try {
            await globalThis.MindMapHttp.request('/api/maps/order', {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: ordered.map(card => Number(card.dataset.mapId)) })
            }, { format: 'empty', serverMessages: true,
                messages: { 409: 'L’elenco è cambiato. Ricarica la pagina prima di riordinare le mappe.' } });
            orderStatus.textContent = 'Ordine delle mappe salvato.';
        } catch (error) {
            mapGrid.append(...previous);
            orderStatus.textContent = error.message;
        } finally {
            savingOrder = false;
            mapGrid.inert = false;
            focusHandle.focus({ preventScroll: true });
        }
    }
    mapGrid?.addEventListener('pointerdown', event => {
        const handle = event.target.closest('.map-reorder-handle');
        if (!handle || savingOrder || cardDrag || !event.isPrimary || event.button !== 0) return;
        cardDrag = { card: handle.closest('.map-card'), handle, previous: cards(), pointerId: event.pointerId,
            startX: event.clientX, startY: event.clientY, moved: false };
        mapGrid.setPointerCapture(event.pointerId);
        event.preventDefault();
    });
    mapGrid?.addEventListener('pointermove', event => {
        if (!cardDrag || event.pointerId !== cardDrag.pointerId) return;
        if (!cardDrag.moved && Math.hypot(event.clientX - cardDrag.startX, event.clientY - cardDrag.startY) < 5) return;
        cardDrag.moved = true;
        cardDrag.card.classList.add('is-reordering');
        const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('.map-card');
        if (target && target !== cardDrag.card && target.parentElement === mapGrid) {
            const items = cards();
            if (items.indexOf(cardDrag.card) < items.indexOf(target)) target.after(cardDrag.card);
            else target.before(cardDrag.card);
        }
        if (event.clientY < 60) window.scrollBy(0, -18);
        else if (event.clientY > window.innerHeight - 60) window.scrollBy(0, 18);
        event.preventDefault();
    });
    function finishCardDrag(event, cancel = false) {
        if (!cardDrag || event.pointerId !== cardDrag.pointerId) return;
        const drag = cardDrag;
        cardDrag = null;
        drag.card.classList.remove('is-reordering');
        if (mapGrid.hasPointerCapture(drag.pointerId)) mapGrid.releasePointerCapture(drag.pointerId);
        if (cancel) mapGrid.append(...drag.previous);
        else void saveCardOrder(drag.previous, drag.handle);
    }
    mapGrid?.addEventListener('pointerup', event => finishCardDrag(event));
    mapGrid?.addEventListener('pointercancel', event => finishCardDrag(event, true));
    mapGrid?.addEventListener('lostpointercapture', event => {
        if (event.target === mapGrid) finishCardDrag(event, true);
    });
    mapGrid?.addEventListener('keydown', event => {
        const handle = event.target.closest('.map-reorder-handle');
        if (!handle || savingOrder || cardDrag || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
        event.preventDefault();
        const previous = cards();
        const card = handle.closest('.map-card');
        const direction = ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 1;
        const target = previous[previous.indexOf(card) + direction];
        if (!target) return;
        if (direction < 0) target.before(card);
        else target.after(card);
        void saveCardOrder(previous, handle);
    });
})();
