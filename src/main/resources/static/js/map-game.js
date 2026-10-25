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

/* Public image matching game. Answers, elapsed time and score are checked by the server. */
(() => {
    const svg = document.getElementById('game-board');
    const tray = document.getElementById('game-images');
    const feedback = document.getElementById('game-feedback');
    const stats = document.getElementById('game-stats');
    const start = document.getElementById('start-game');
    const zoom = document.getElementById('game-zoom');
    const zoomValue = document.getElementById('game-zoom-value');
    const zoomOut = document.getElementById('game-zoom-out');
    const zoomIn = document.getElementById('game-zoom-in');
    const zoomFit = document.getElementById('game-zoom-fit');
    const progress = document.getElementById('game-progress');
    const welcome = document.getElementById('game-welcome');
    const feedbackWrap = document.querySelector('.game-feedback-wrap');
    const endpoint = location.pathname.replace(/\/$/, '');
    let board, selected, busy = false, lastResult, finished = false;
    const matched = new Map();
    let bounds;
    const make = (name, attrs = {}, text) => {
        const el = document.createElementNS(SVG_NS, name);
        for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
        if (text !== undefined) el.textContent = text;
        return el;
    };
    async function request(path, body) {
        const response = await fetch(`${endpoint}/${path}`, {
            method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body || {})
        });
        if (!response.ok) throw new Error(response.status === 404 ? 'Questo gioco non è più disponibile. Chiedi un nuovo link e torna a giocare!' : 'Facciamo una piccola pausa: riprova tra poco, puoi farcela!');
        return response.json();
    }
    function showStats() {
        stats.textContent = `${lastResult?.matched || 0}/${board.images.length} immagini al loro posto. Un passo alla volta!`;
        if (finished) stats.textContent = `Tutte le immagini a casa! Hai conquistato ${lastResult.score} punti ★`;
        progress.max = board.images.length;
        progress.value = lastResult?.matched || 0;
    }
    function select(id) {
        selected = id;
        for (const button of tray.children) button.setAttribute('aria-pressed', String(button.dataset.id === id));
    }
    function celebrate(node, complete) {
        const group = svg.querySelector(`[data-node-id="${node.id}"]`);
        group?.classList.add('just-matched');
        setTimeout(() => group?.classList.remove('just-matched'), 1100);
        if (globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
        const {width} = getNodeSize(node);
        const box = getNodeImageBounds(node, width);
        const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
        const burst = make('g', {class: 'game-celebration', 'aria-hidden': 'true'});
        burst.appendChild(make('circle', {cx, cy, r: Math.max(box.width, box.height) / 2 + 8, fill: 'none', stroke: '#e9ba52', 'stroke-width': 4, class: 'celebration-ring'}));
        const colors = ['#e7ae35', '#b287d8', '#6bb996', '#eb919f', '#7caedd'];
        const count = complete ? 24 : 14;
        for (let i = 0; i < count; i++) {
            const angle = i * Math.PI * 2 / count;
            const distance = 65 + Math.random() * (complete ? 100 : 55);
            const star = make('text', {x: cx, y: cy, fill: colors[i % colors.length], 'font-size': 14 + Math.random() * 16, 'text-anchor': 'middle', class: 'celebration-particle'}, i % 3 ? '✦' : '●');
            star.style.setProperty('--spark-x', `${Math.cos(angle) * distance}px`);
            star.style.setProperty('--spark-y', `${Math.sin(angle) * distance}px`);
            star.style.setProperty('--spark-turn', `${Math.random() * 160 - 80}deg`);
            burst.appendChild(star);
        }
        svg.appendChild(burst);
        setTimeout(() => burst.remove(), 1200);
    }
    function renderTray() {
        tray.replaceChildren();
        board.images.forEach((card, index) => {
            const button = document.createElement('button');
            button.type = 'button'; button.className = 'game-image'; button.dataset.id = card.id;
            button.draggable = true; button.setAttribute('aria-pressed', 'false');
            button.setAttribute('aria-label', `Seleziona immagine ${index + 1}`);
            const img = document.createElement('img'); img.src = card.uri; img.alt = `Immagine ${index + 1}`;
            img.addEventListener('error', () => { feedback.textContent = 'Un’immagine si sta facendo aspettare! Chiedi una mano a un adulto: presto potrai tornare a giocare.'; });
            button.appendChild(img);
            button.onclick = () => select(card.id);
            button.ondragstart = event => { select(card.id); event.dataTransfer.setData('text/plain', card.id); };
            tray.appendChild(button);
        });
    }
    async function attempt(node) {
        if (!selected || busy || finished || matched.has(node.id)) return;
        busy = true;
        const cardId = selected;
        try {
            const result = await request('attempt', {runId: board.runId, imageId: cardId, nodeId: node.id});
            lastResult = result;
            if (result.correct) {
                const card = board.images.find(c => c.id === cardId);
                matched.set(node.id, card.uri);
                [...tray.children].find(b => b.dataset.id === cardId)?.remove();
                select(null); renderMap();
                celebrate(node, result.complete);
                feedbackWrap.dataset.mood = 'success';
                if (result.complete) {
                    const message = document.createElement('p');
                    message.className = 'basket-empty';
                    message.textContent = '★ Zainetto vuoto, mappa piena di scoperte. Ottimo lavoro!';
                    tray.appendChild(message);
                }
                feedback.textContent = result.complete ? `Ce l’hai fatta! Hai completato tutta la mappa e conquistato ${result.score} punti. Ogni tentativo ti ha aiutato a imparare!` : 'Ottimo lavoro! Un’immagine ha trovato la sua casella. Continua così!';
            } else {
                feedbackWrap.dataset.mood = 'hint';
                feedback.textContent = `Bel tentativo! Proviamo insieme un’altra casella. Un piccolo indizio: ${result.hint}`;
            }
            finished = result.complete;
            showStats();
        } catch (error) { feedbackWrap.dataset.mood = 'hint'; feedback.textContent = error.message; }
        finally { busy = false; }
    }
    function renderMap() {
        svg.replaceChildren();
        const nodes = board.map.nodes;
        const depths = buildDepthMap(nodes);
        for (const node of nodes) {
            const parent = nodes.find(n => n.id === node.parentId);
            if (!parent) continue;
            const p = getNodeSize(parent), n = getNodeSize(node);
            const x1 = parent.x + p.width / 2, y1 = parent.y + p.height / 2;
            const x2 = node.x + n.width / 2, y2 = node.y + n.height / 2;
            const path = make('path', {d: buildConnectorPath(node, x1, y1, x2, y2)});
            applyBranchStyle(path, node, depths.get(node.id) || 1); svg.appendChild(path);
            if (node.branchText) {
                const cx = (x1+x2)/2, cy = (y1+y2)/2 - 6;
                const angle = Math.max(-24, Math.min(24, Math.atan2(y2-y1, x2-x1)*180/Math.PI));
                svg.appendChild(make('text', {x:cx, y:cy, 'text-anchor':'middle', class:'branch-label', transform:`rotate(${angle}, ${cx}, ${cy})`}, truncate(node.branchText, 26)));
            }
        }
        for (const node of nodes) {
            const {width, height} = getNodeSize(node);
            const imageNode = hasNodeImage(node);
            const group = make('g', {'data-node-id': node.id, class: imageNode ? `game-target${matched.has(node.id) ? ' matched' : ''}` : ''});
            const radius = getNodeCornerRadius(node, depths.get(node.id) || 0, false);
            group.appendChild(make('rect', {x:node.x, y:node.y, width,height, rx:radius, fill:node.color || '#D9D2E9', stroke:'#546170', 'stroke-width':1.5}));
            if (imageNode) {
                const box = getNodeImageBounds(node, width);
                if (matched.has(node.id)) {
                    const clipId = `game-image-${node.id}`;
                    const defs = make('defs');
                    const clip = make('clipPath', {id:clipId});
                    clip.appendChild(make('rect', {...box,rx:8,ry:8}));
                    defs.appendChild(clip); group.appendChild(defs);
                    group.appendChild(make('image', {...box, href:matched.get(node.id), preserveAspectRatio:'xMidYMid slice', 'clip-path':`url(#${clipId})`}));
                }
                else {
                    group.appendChild(make('rect', {...box, rx:8, fill:'rgba(255,255,255,.5)', stroke:'#546170', 'stroke-dasharray':'6 4'}));
                    group.appendChild(make('text', {x:box.x+box.width/2, y:box.y+box.height/2, 'text-anchor':'middle', 'font-size':24, fill:'#9783af'}, '✧'));
                }
                group.setAttribute('tabindex', '0'); group.setAttribute('role','button');
                group.setAttribute('aria-label', `${node.text}${matched.has(node.id) ? ', completata' : ', inserisci immagine'}`);
                group.onclick = () => attempt(node);
                group.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); attempt(node); } };
                group.ondragover = e => {
                    e.preventDefault();
                    if (selected && !matched.has(node.id)) group.classList.add('drop-ready');
                };
                group.ondragleave = () => group.classList.remove('drop-ready');
                group.ondrop = e => { e.preventDefault(); group.classList.remove('drop-ready'); attempt(node); };
            }
            const lines = getNodeDisplayLines(node, imageNode ? 18 : 20);
            const font = Number(node.fontSize) || 18, lineHeight = Math.max(16, Math.round(font*1.2));
            const emoji = imageNode ? '' : normalizeNodeEmoji(node.emoji);
            if (emoji) group.appendChild(make('text', {x:node.x+width/2,y:node.y+28,'text-anchor':'middle','dominant-baseline':'middle'},emoji));
            const firstY = imageNode ? node.y+height-16-(lines.length-1)*lineHeight : node.y+(height-(lines.length-1)*lineHeight)/2+(emoji?14:0);
            const text = make('text', {'text-anchor':'middle','dominant-baseline':'middle',class:'node-text','font-size':font});
            lines.forEach((line,i) => text.appendChild(make('tspan',{x:node.x+width/2,y:firstY+i*lineHeight,'font-size':line.isDescription?Math.max(12,Math.round(font*.78)):font,'font-weight':line.isDescription?'500':'700'},line.text)));
            group.appendChild(text); svg.appendChild(group);
        }
    }
    function resize() {
        if (zoomValue) zoomValue.textContent = `${zoom.value}%`;
        if (zoomOut) zoomOut.disabled = Number(zoom.value) <= 10;
        if (zoomIn) zoomIn.disabled = Number(zoom.value) >= 250;
        if (!bounds) return;
        const viewport = svg.parentElement;
        const centerX = viewport && svg.clientWidth ? (viewport.scrollLeft + viewport.clientWidth / 2) / svg.clientWidth : 0;
        const centerY = viewport && svg.clientHeight ? (viewport.scrollTop + viewport.clientHeight / 2) / svg.clientHeight : 0;
        svg.setAttribute('viewBox', `${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}`);
        const scale = Number(zoom.value) / 100;
        svg.style.width = `${bounds.w * scale}px`;
        svg.style.height = `${bounds.h * scale}px`;
        if (viewport) {
            viewport.scrollLeft = Math.max(0, centerX * svg.clientWidth - viewport.clientWidth / 2);
            viewport.scrollTop = Math.max(0, centerY * svg.clientHeight - viewport.clientHeight / 2);
        }
    }
    function changeZoom(value) {
        zoom.value = String(Math.max(10, Math.min(250, value)));
        resize();
    }
    zoomOut?.addEventListener('click', () => changeZoom(Number(zoom.value) - 25));
    zoomIn?.addEventListener('click', () => changeZoom(Number(zoom.value) + 25));
    zoomFit?.addEventListener('click', () => {
        if (!bounds) return;
        const availableWidth = svg.parentElement.clientWidth - 24;
        const availableHeight = Math.max(320, (globalThis.innerHeight || 900) * .65);
        changeZoom(Math.floor(Math.min(availableWidth / bounds.w, availableHeight / bounds.h, 1) * 100));
        svg.parentElement.scrollTop = 0;
        svg.parentElement.scrollLeft = 0;
    });
    // Drag only the background; image targets keep their click and drop behavior.
    const panViewport = svg.closest?.('.game-board-scroll') || svg.parentElement;
    let pan = null;
    function endPan(event) {
        if (!pan || (event?.pointerId != null && event.pointerId !== pan.pointerId)) return;
        const pointerId = pan.pointerId;
        pan = null;
        panViewport.classList.remove('is-panning');
        if (panViewport.hasPointerCapture(pointerId)) panViewport.releasePointerCapture(pointerId);
    }
    panViewport?.addEventListener('pointerdown', event => {
        if (!board || pan || !event.isPrimary || event.button !== 0 || event.target.closest('.game-target')) return;
        pan = {
            pointerId: event.pointerId,
            x: event.clientX, y: event.clientY,
            left: panViewport.scrollLeft, top: panViewport.scrollTop
        };
        panViewport.setPointerCapture(event.pointerId);
        panViewport.classList.add('is-panning');
        event.preventDefault();
    });
    panViewport?.addEventListener('pointermove', event => {
        if (!pan || pan.pointerId !== event.pointerId) return;
        panViewport.scrollLeft = pan.left - (event.clientX - pan.x);
        panViewport.scrollTop = pan.top - (event.clientY - pan.y);
        event.preventDefault();
    });
    panViewport?.addEventListener('pointerup', endPan);
    panViewport?.addEventListener('pointercancel', endPan);
    panViewport?.addEventListener('lostpointercapture', endPan);
    globalThis.addEventListener?.('blur', () => endPan());
    zoom.oninput = resize;
    globalThis.addEventListener?.('resize', resize);
    start.onclick = async () => {
        if (busy) return;
        busy = true; start.disabled = true;
        try {
            const next = await request('start');
            board = next; selected = null; matched.clear(); finished = false; lastResult = null;
            const sizes = board.map.nodes.map(n => ({x:n.x,y:n.y,...getNodeSize(n)}));
            const x = Math.min(...sizes.map(n=>n.x))-40, y = Math.min(...sizes.map(n=>n.y))-40;
            bounds = {x,y,w:Math.max(...sizes.map(n=>n.x+n.width))-x+40,h:Math.max(...sizes.map(n=>n.y+n.height))-y+40};
            welcome.hidden = true;
            svg.removeAttribute('hidden');
            feedbackWrap.dataset.mood = '';
            renderTray(); renderMap(); resize(); showStats();
            feedback.textContent = 'Si parte! Scegli un’immagine e cerca la sua casella. Prenditi tutto il tempo che vuoi!'; start.textContent = 'Giochiamo ancora ↻';
        } catch (error) { feedbackWrap.dataset.mood = 'hint'; feedback.textContent = error.message; }
        finally { busy = false; start.disabled = false; }
    };
})();
