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

(() => {
    function httpError(message, status) {
        const error = new Error(message);
        error.status = status;
        return error;
    }

    async function request(url, options = {}, {
        format = 'json', messages = {}, sessionStatuses = [401], serverMessages = false,
        sessionMessage = 'La sessione è scaduta. Accedi di nuovo prima di continuare; conserva le modifiche non salvate.',
        httpErrorMessage
    } = {}) {
        let response;
        try {
            response = await fetch(url, options);
        } catch (error) {
            if (error.name === 'AbortError') throw error;
            throw new Error('Connessione al server non riuscita. Le modifiche potrebbero non essere salvate. Controlla la connessione e riprova.');
        }
        if (response.redirected || sessionStatuses.includes(response.status)) throw httpError(sessionMessage, 401);
        if (!response.ok) {
            const body = serverMessages ? await response.json().catch(() => ({})) : {};
            throw httpError(messages[response.status] || body?.detail || body?.message || httpErrorMessage
                || `Operazione non riuscita (HTTP ${response.status}). Riprova; le modifiche potrebbero non essere salvate.`, response.status);
        }
        const contentType = response.headers.get('Content-Type') || '';
        if (format === 'empty') {
            if (contentType.includes('text/html')) throw new Error('Risposta inattesa dal server. Verifica l’accesso e riprova.');
            return undefined;
        }
        const expected = format === 'json' ? /application\/(?:[\w.-]+\+)?json/i : format === 'image' ? /image\//i
            : format === 'png' ? /image\/png/i : /application\/pdf/i;
        if (!expected.test(contentType)) throw new Error('Risposta inattesa dal server. Verifica l’accesso e riprova.');
        try {
            const result = format === 'json' ? await response.json() : await response.blob();
            if (format === 'json' && (!result || typeof result !== 'object' || Array.isArray(result))) throw new Error('Invalid response');
            return result;
        } catch {
            throw new Error('Risposta del server incompleta o non valida. Controlla la connessione e riprova.');
        }
    }

    globalThis.MindMapHttp = { request };
})();
