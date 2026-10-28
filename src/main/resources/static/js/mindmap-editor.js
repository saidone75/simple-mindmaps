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

const MAP_CENTER_X = 700;
const MAP_CENTER_Y = 450;
const BASE_CANVAS_WIDTH = 1400;
const BASE_CANVAS_HEIGHT = 900;
const CANVAS_PADDING = 180;
const WORKSPACE_EDGE_MARGIN = 48;
const WORKSPACE_PAN_STEP = 10;
const MIN_ZOOM_PERCENT = 10;
const MAX_ZOOM_PERCENT = 200;
const DEFAULT_GRID_SIZE = 20;
const state = {
    map: structuredClone(initialMap),
    selectedNodeId: null,
    drag: null,
    resize: null,
    pan: null,
    workspaceViewport: null,
    pendingImageNodeId: null,
    pendingAutosaves: new Map(),
    autosaveCount: 0,
    autosavePromise: null,
    contextMenu: null,
    hoveredNodeId: null,
    hoverHideTimer: null,
    undoStack: [],
    redoStack: [],
    interactionSnapshot: null,
    isApplyingHistory: false,
    gridEnabled: false,
    gridSize: DEFAULT_GRID_SIZE,
    zoomAnimationFrame: null,
    zoomAnimationTarget: null,
    imageOverlayNodeId: null
};

// Keep unchanged SVG elements (especially images) alive between frames.
const renderCache = { nodes: new Map(), connectors: new Map(), layers: null, gridKey: null };
const layoutSizeCache = new WeakMap();
let renderFrame = null;
let interactionFrame = null;
let pendingPointerMove = null;
let edgePanActive = false;
let interactionPointerId = null;
let suppressPointerClick = false;
let appliedViewport = null;
let formEditGroup = null;
let renderNodeIndex = null;
let renderNodeSizes = null;

function requestRender() {
    if (renderFrame != null) return;
    renderFrame = requestAnimationFrame(() => {
        renderFrame = null;
        render();
    });
}

function sameRenderInputs(previous, next) {
    return previous?.length === next.length && next.every((value, index) => Object.is(value, previous[index]));
}

function updateCachedElement(cache, id, inputs, layer, draw) {
    const previous = cache.get(id);
    if (previous && sameRenderInputs(previous.inputs, inputs)) return previous;
    const element = draw();
    if (previous) previous.element.replaceWith(element);
    else layer.appendChild(element);
    const entry = { inputs, element };
    cache.set(id, entry);
    return entry;
}

function removeStaleElements(cache, activeIds) {
    for (const [id, entry] of cache) {
        if (activeIds.has(id)) continue;
        entry.element.remove();
        cache.delete(id);
    }
}

const svg = document.getElementById("mindmap-canvas");
const textInput = document.getElementById("node-text");
const descriptionInput = document.getElementById("node-description");
const hintFields = ["hint", "hint2", "hint3"];
const hintInputs = ["node-hint", "node-hint-2", "node-hint-3"].map(id => document.getElementById(id));
const colorInput = document.getElementById("node-color");
const textColorInput = document.getElementById("node-text-color");
const mapBackgroundInput = document.getElementById("map-background-color");
let backgroundSavePromise = Promise.resolve();
let editingBackground = false;
const branchColorInput = document.getElementById("branch-color");
const branchStyleInput = document.getElementById("branch-style");
const branchWidthInput = document.getElementById("branch-width");
const branchCurveInput = document.getElementById("branch-curve");
const fontSizeInput = document.getElementById("node-font-size");
const imageUrlInput = document.getElementById("node-image-url");
const imageUploadInput = document.getElementById("node-image-upload");
const imagePreview = document.getElementById("node-image-preview");
const imageAlternatives = document.getElementById("node-image-alternatives");
const imageCandidates = document.getElementById("node-image-candidates");
const imageWidthInput = document.getElementById("node-image-width");
const imageHeightInput = document.getElementById("node-image-height");
const imageWidthValue = document.getElementById("node-image-width-value");
const imageHeightValue = document.getElementById("node-image-height-value");
const autosaveStatus = document.getElementById("autosave-status");
const failedEditorRequests = new Map();
const activeEditorRequests = new Set();
let leavingEditor = false;
let allowEditorUnload = false;
const nodeEmojiInput = document.getElementById("node-emoji");
const branchTextInput = document.getElementById("branch-text");
const autoLayoutBtn = document.getElementById("auto-layout-btn");
const zoomInput = document.getElementById("zoom-control");
const zoomValue = document.getElementById("zoom-value");
const gridEnabledInput = document.getElementById("grid-enabled");
const gridSizeInput = document.getElementById("grid-size-control");
const stylePresetInput = document.getElementById("style-preset-control");
const canvasPanel = svg.closest(".canvas-panel");
const canvasViewport = svg.closest(".canvas-scroll-area");
const nodeEditorOverlay = document.getElementById("node-editor-overlay");
const imageEditorOverlay = document.getElementById("image-editor-overlay");
const appDialog = document.getElementById("app-dialog");
const mapTitle = document.getElementById("map-title");
const renameMapBtn = document.getElementById("rename-map-btn");

let showLoading = globalThis.window?.showLoading ?? function showLoading(msg) {
    let el = document.getElementById('loading-overlay');
    if (!el) {
        el = document.createElement('div');
        el.id = 'loading-overlay';
        el.innerHTML = '<div class="loading-icon" aria-hidden="true">🐇</div><p></p>';
        document.body.appendChild(el);
    }
    el.querySelector('p').textContent = msg || 'Caricamento...';
    el.style.display = 'flex';
};

let hideLoading = globalThis.window?.hideLoading ?? function hideLoading() {
    const el = document.getElementById('loading-overlay');
    if (el) el.style.display = 'none';
};

if (globalThis.window !== undefined) {
    globalThis.window.showLoading = showLoading;
    globalThis.window.hideLoading = hideLoading;
}

function updateNodeEditorOverlay(node) {
    if (!nodeEditorOverlay?.classList.contains("visible") || !canvasPanel || !node) return;
    const nodeSize = getNodeSize(node);
    const canvasRect = canvasPanel.getBoundingClientRect();
    const svgRect = svg.getBoundingClientRect();
    const viewBox = (svg.getAttribute("viewBox") || "").trim().split(/\s+/).map(Number);
    if (viewBox.length !== 4 || !viewBox.every(Number.isFinite) || svgRect.width <= 0 || svgRect.height <= 0) return;

    const [viewX, viewY, viewWidth, viewHeight] = viewBox;
    const scaleX = svgRect.width / viewWidth;
    const scaleY = svgRect.height / viewHeight;
    const nodeRightClientX = svgRect.left + ((node.x + nodeSize.width - viewX) * scaleX);
    const nodeTopClientY = svgRect.top + ((node.y - viewY) * scaleY);

    const defaultLeft = nodeRightClientX - canvasRect.left + 14 + canvasPanel.scrollLeft;
    const defaultTop = nodeTopClientY - canvasRect.top + canvasPanel.scrollTop;
    const maxLeft = canvasPanel.scrollLeft + canvasPanel.clientWidth - nodeEditorOverlay.offsetWidth - 12;
    const maxTop = canvasPanel.scrollTop + canvasPanel.clientHeight - nodeEditorOverlay.offsetHeight - 12;

    const left = Math.max(canvasPanel.scrollLeft + 12, Math.min(defaultLeft, maxLeft));
    const top = Math.max(canvasPanel.scrollTop + 12, Math.min(defaultTop, maxTop));

    nodeEditorOverlay.style.left = `${Math.round(left)}px`;
    nodeEditorOverlay.style.top = `${Math.round(top)}px`;
}

function hideNodeEditorOverlay() {
    if (!nodeEditorOverlay) return;
    nodeEditorOverlay.classList.remove("visible");
}

function showImageEditorOverlay(node) {
    if (!imageEditorOverlay || !node) return;
    state.imageOverlayNodeId = node.id;
    imageEditorOverlay.classList.add("visible");
    updateImagePreview(node.imageUri || "");
    renderImageCandidates(node);
    updateImageEditorOverlay(node);
}

function hideImageEditorOverlay() {
    if (!imageEditorOverlay) return;
    state.imageOverlayNodeId = null;
    imageEditorOverlay.classList.remove("visible");
}

function updateImageEditorOverlay(node) {
    if (!imageEditorOverlay?.classList.contains("visible") || !canvasPanel || !node) return;
    const nodeSize = getNodeSize(node);
    const canvasRect = canvasPanel.getBoundingClientRect();
    const svgRect = svg.getBoundingClientRect();
    const viewBox = (svg.getAttribute("viewBox") || "").trim().split(/\s+/).map(Number);
    if (viewBox.length !== 4 || !viewBox.every(Number.isFinite) || svgRect.width <= 0 || svgRect.height <= 0) return;
    const [viewX, viewY, viewWidth, viewHeight] = viewBox;
    const scaleX = svgRect.width / viewWidth;
    const scaleY = svgRect.height / viewHeight;
    const nodeRightClientX = svgRect.left + ((node.x + nodeSize.width - viewX) * scaleX);
    const nodeTopClientY = svgRect.top + ((node.y - viewY) * scaleY);
    const defaultLeft = nodeRightClientX - canvasRect.left + 14 + canvasPanel.scrollLeft;
    const defaultTop = nodeTopClientY - canvasRect.top + canvasPanel.scrollTop;
    const maxLeft = canvasPanel.scrollLeft + canvasPanel.clientWidth - imageEditorOverlay.offsetWidth - 12;
    const maxTop = canvasPanel.scrollTop + canvasPanel.clientHeight - imageEditorOverlay.offsetHeight - 12;
    const left = Math.max(canvasPanel.scrollLeft + 12, Math.min(defaultLeft, maxLeft));
    const top = Math.max(canvasPanel.scrollTop + 12, Math.min(defaultTop, maxTop));
    imageEditorOverlay.style.left = `${Math.round(left)}px`;
    imageEditorOverlay.style.top = `${Math.round(top)}px`;
}

function snapshotEditorState() {
    return {
        map: structuredClone(state.map),
        selectedNodeId: state.selectedNodeId
    };
}

async function restoreEditorState(snapshot) {
    const nodePaths = new Set([...state.map.nodes, ...snapshot.map.nodes].map(node => `/api/nodes/${node.id}`));
    const mapPath = `/api/maps/${state.map.id}`;
    const restored = await editorRequest(`/api/maps/${state.map.id}/restore`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(snapshot.map)
    });
    // A successful full restore supersedes previous failed writes to this map.
    for (const key of failedEditorRequests.keys()) {
        const path = key.slice(key.indexOf(" ") + 1);
        if (nodePaths.has(path) || path === mapPath || path.startsWith(`${mapPath}/`)) failedEditorRequests.delete(key);
    }
    const errorBox = document.getElementById("editor-request-error");
    errorBox.hidden = failedEditorRequests.size === 0;
    errorBox.textContent = [...failedEditorRequests.values()].join(" ");
    if (autosaveStatus) autosaveStatus.textContent = "Mappa ripristinata e salvata.";
    const remap = id => id == null ? null : restored.nodeIds[id] ?? id;
    for (const entry of [...state.undoStack, ...state.redoStack]) {
        entry.selectedNodeId = remap(entry.selectedNodeId);
        for (const node of entry.map.nodes) {
            node.id = remap(node.id);
            node.parentId = remap(node.parentId);
        }
    }
    // Keep frontend-only settings until their persistence is implemented (TODO 12).
    const localNodes = new Map(snapshot.map.nodes.map(node => [remap(node.id), node]));
    state.map = restored.map;
    for (const node of state.map.nodes) {
        const local = localNodes.get(node.id);
        if (local) {
            node.branchWidth = local.branchWidth;
            node.branchCurve = local.branchCurve;
        }
    }
    state.selectedNodeId = remap(snapshot.selectedNodeId);
    if (stylePresetInput) stylePresetInput.value = state.map.stylePreset;
    refreshMapTitle();
    closeContextMenu();
    if (state.selectedNodeId) selectNode(state.selectedNodeId);
    else {
        hideNodeEditorOverlay();
        hideImageEditorOverlay();
        render();
    }
    return restored.nodeIds;
}


const { pushUndoSnapshot, beginInteractionSnapshot, commitInteractionSnapshot,
    clearInteractionSnapshot, undoChange, redoChange } = globalThis.MindMapHistory.create({
    state,
    snapshot: snapshotEditorState,
    restore: restoreEditorState,
    waitForSaves: async () => {
        await flushAutosave();
        await backgroundSavePromise;
        while (activeEditorRequests.size) await Promise.all([...activeEditorRequests]);
    },
    setBusy: busy => {
        document.querySelector(".editor-page").inert = busy;
        if (busy) showLoading("Sto ripristinando la mappa…");
        else hideLoading();
    },
    onError: reportEditorError,
    onEditBoundary: () => { formEditGroup = null; }
});

const openDialog = globalThis.MindMapDialogs.open;


function getNodeById(id) {
    return renderNodeIndex ? renderNodeIndex.get(id) : state.map.nodes.find(n => n.id === id);
}


function hasNodeEmoji(node) {
    return !!normalizeNodeEmoji(node.emoji);
}


const STYLE_PRESETS = {
    CLASSIC: { rootColor: "#D9D2E9", childColor: "#9FC5E8", shape: "ROUNDED", branchColor: "#7c8a9a", branchStyle: "SOLID", branchWidth: 4, branchCurve: "CUBIC" },
    TRUE_SUMMER: { rootColor: "#AFC4D9", childColor: "#D4C6DD", shape: "SQUARED", branchColor: "#5E7893", branchStyle: "SOLID", branchWidth: 3, branchCurve: "QUADRATIC" }
};

function getCurrentStylePresetName() {
    const preset = (state.map.stylePreset || "CLASSIC").toUpperCase();
    return STYLE_PRESETS[preset] ? preset : "CLASSIC";
}

function getCurrentStylePreset() {
    return STYLE_PRESETS[getCurrentStylePresetName()];
}


function colorPickerValue(value, fallback) {
    const variable = /^var\((--[\w-]+)\)$/.exec(value || "");
    const resolved = variable ? getComputedStyle(document.documentElement).getPropertyValue(variable[1]).trim() : value;
    return /^#[0-9a-f]{6}$/i.test(resolved || "") ? resolved : fallback;
}

function getNodeColor(node) {
    const preset = getCurrentStylePreset();
    return node.color || (node.parentId == null ? preset.rootColor : preset.childColor);
}


function renderConnectorDefs() {
    const defs = document.createElementNS(SVG_NS, "defs");

    const arrow = document.createElementNS(SVG_NS, "marker");
    arrow.setAttribute("id", "arrow-head");
    arrow.setAttribute("viewBox", "0 0 10 10");
    arrow.setAttribute("refX", "10");
    arrow.setAttribute("refY", "5");
    arrow.setAttribute("markerWidth", "6");
    arrow.setAttribute("markerHeight", "6");
    arrow.setAttribute("orient", "auto-start-reverse");
    const arrowPath = document.createElementNS(SVG_NS, "path");
    arrowPath.setAttribute("d", "M 0 0 L 10 5 L 0 10 z");
    arrowPath.setAttribute("fill", "#4b5563");
    arrow.appendChild(arrowPath);
    defs.appendChild(arrow);

    const arrowBold = document.createElementNS(SVG_NS, "marker");
    arrowBold.setAttribute("id", "arrow-head-bold");
    arrowBold.setAttribute("viewBox", "0 0 14 14");
    arrowBold.setAttribute("refX", "14");
    arrowBold.setAttribute("refY", "7");
    arrowBold.setAttribute("markerWidth", "8");
    arrowBold.setAttribute("markerHeight", "8");
    arrowBold.setAttribute("orient", "auto-start-reverse");
    const arrowBoldPath = document.createElementNS(SVG_NS, "path");
    arrowBoldPath.setAttribute("d", "M 0 0 L 14 7 L 0 14 z");
    arrowBoldPath.setAttribute("fill", "#374151");
    arrowBold.appendChild(arrowBoldPath);
    defs.appendChild(arrowBold);

    svg.appendChild(defs);
}

function renderGrid(viewport) {
    const layer = renderCache.layers.grid;
    const gridSize = Math.max(5, Number(state.gridSize) || DEFAULT_GRID_SIZE);
    const inputs = [state.gridEnabled, gridSize, viewport.x, viewport.y, viewport.width, viewport.height];
    if (sameRenderInputs(renderCache.gridKey, inputs)) return;
    renderCache.gridKey = inputs;
    layer.replaceChildren();
    if (!state.gridEnabled) return;

    // Two reusable patterns replace potentially thousands of individual lines.
    const defs = document.createElementNS(SVG_NS, "defs");
    for (const [id, size, strokeWidth] of [["editor-grid-minor", gridSize, "0.45"], ["editor-grid-major", gridSize * 5, "0.9"]]) {
        const pattern = document.createElementNS(SVG_NS, "pattern");
        pattern.setAttribute("id", id);
        pattern.setAttribute("patternUnits", "userSpaceOnUse");
        pattern.setAttribute("width", size);
        pattern.setAttribute("height", size);
        const path = document.createElementNS(SVG_NS, "path");
        path.setAttribute("d", `M ${size} 0 H 0 V ${size}`);
        path.setAttribute("fill", "none");
        path.setAttribute("stroke", "#8fa0b5");
        path.setAttribute("stroke-width", strokeWidth);
        pattern.appendChild(path);
        defs.appendChild(pattern);
    }
    layer.appendChild(defs);
    for (const id of ["editor-grid-minor", "editor-grid-major"]) {
        const rect = document.createElementNS(SVG_NS, "rect");
        for (const key of ["x", "y", "width", "height"]) rect.setAttribute(key, viewport[key]);
        rect.setAttribute("fill", `url(#${id})`);
        rect.setAttribute("opacity", "0.28");
        rect.setAttribute("pointer-events", "none");
        layer.appendChild(rect);
    }
}

function renderConnectors(depthMap) {
    for (const node of state.map.nodes) {
        if (node.parentId == null) continue;
        const parent = getNodeById(node.parentId);
        if (!parent) continue;

        const parentSize = getLayoutNodeSize(parent);
        const nodeSize = getLayoutNodeSize(node);
        const x1 = parent.x + parentSize.width / 2;
        const y1 = parent.y + parentSize.height / 2;
        const x2 = node.x + nodeSize.width / 2;
        const y2 = node.y + nodeSize.height / 2;
        const depth = depthMap.get(node.id) || 1;
        const inputs = [node, x1, y1, x2, y2, depth,
            node.branchColor, node.branchStyle, node.branchWidth, node.branchCurve, node.branchText];
        updateCachedElement(renderCache.connectors, node.id, inputs, renderCache.layers.connectors, () => {
            const group = document.createElementNS(SVG_NS, "g");
            const path = document.createElementNS(SVG_NS, "path");
            path.setAttribute("class", "connector");
            path.setAttribute("d", buildConnectorPath(node, x1, y1, x2, y2));
            applyBranchStyle(path, node, depth);
            group.appendChild(path);
            renderBranchLabel(node, (x1 + x2) / 2, (y1 + y2) / 2, x1, y1, x2, y2, group);
            return group;
        });
    }
}

function appendNodeText(group, node, width, height, emojiValue) {
    const text = document.createElementNS(SVG_NS, "text");
    const lines = getNodeDisplayLines(node, hasNodeImage(node) ? 18 : 20);
    const fontSize = Number(node.fontSize) || 18;
    const lineHeight = Math.max(16, Math.round(fontSize * 1.2));
    const firstLineY = hasNodeImage(node)
        ? node.y + height - 16 - ((lines.length - 1) * lineHeight)
        : emojiValue
            ? node.y + ((height - ((lines.length - 1) * lineHeight)) / 2) + 14
            : node.y + ((height - ((lines.length - 1) * lineHeight)) / 2);
    text.setAttribute("class", "node-text");
    if (node.textColor) text.style.fill = node.textColor;
    text.setAttribute("x", node.x + width / 2);
    text.setAttribute("y", firstLineY);
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("dominant-baseline", "middle");
    text.setAttribute("font-size", fontSize);
    const descriptionFontSize = Math.max(12, Math.round(fontSize * 0.78));
    lines.forEach((line, index) => {
        const tspan = document.createElementNS(SVG_NS, "tspan");
        tspan.setAttribute("x", node.x + width / 2);
        tspan.setAttribute("dy", index === 0 ? "0" : String(lineHeight));
        if (line.isDescription) {
            tspan.setAttribute("font-size", String(descriptionFontSize));
            tspan.setAttribute("font-weight", "500");
        }
        tspan.textContent = line.text || " ";
        text.appendChild(tspan);
    });
    text.addEventListener("click", async event => {
        event.stopPropagation();
        await quickEdit(node.id);
    });
    group.appendChild(text);
}

function bindNodeGroupEvents(group, node) {
    group.addEventListener("pointerdown", startDrag);
    group.addEventListener("click", () => selectNode(node.id));
    group.addEventListener("dblclick", () => quickEdit(node.id));
    group.addEventListener("mouseenter", () => {
        if (state.hoverHideTimer) {
            clearTimeout(state.hoverHideTimer);
            state.hoverHideTimer = null;
        }
        if (state.hoveredNodeId === node.id) return;
        state.hoveredNodeId = node.id;
        requestRender();
    });
    group.addEventListener("mouseleave", () => {
        if (state.hoveredNodeId !== node.id) return;
        if (state.hoverHideTimer) clearTimeout(state.hoverHideTimer);
        state.hoverHideTimer = setTimeout(() => {
            state.hoveredNodeId = null;
            state.hoverHideTimer = null;
            requestRender();
        }, 1800);
    });
    group.addEventListener("contextmenu", event => openContextMenu(event, node.id));
}

function createNodeGroupElement(node) {
    const group = document.createElementNS(SVG_NS, "g");
    const selectedClass = node.id === state.selectedNodeId ? " selected" : "";
    group.setAttribute("class", `node-group${selectedClass}`);
    group.dataset.id = node.id;
    return group;
}


function appendNodeBackground(group, node, width, height, depth) {
    const rect = document.createElementNS(SVG_NS, "rect");
    const radius = getNodeCornerRadius(node, depth);
    rect.setAttribute("x", node.x);
    rect.setAttribute("y", node.y);
    rect.setAttribute("rx", radius);
    rect.setAttribute("ry", radius);
    rect.setAttribute("width", width);
    rect.setAttribute("height", height);
    rect.setAttribute("fill", getNodeColor(node));
    rect.setAttribute("stroke", "#546170");
    rect.setAttribute("stroke-width", "1.5");
    group.appendChild(rect);
}

function appendNodeImageContent(group, node, width) {
    if (!hasNodeImage(node)) return;
    renderNodeImage(group, node, width);
    if (node.id === state.selectedNodeId) renderImageResizeHandle(group, node, width);
}

function appendNodeInteractionControls(group, node, width, height) {
    if (node.id === state.hoveredNodeId) renderNodeActionButtons(group, node, width);
    if (node.id === state.selectedNodeId || node.id === state.hoveredNodeId) {
        renderNodeResizeHandle(group, node, width, height);
    }
}

function appendNodeEmoji(group, node, width, emojiValue) {
    if (!emojiValue) return;

    const emoji = document.createElementNS(SVG_NS, "text");
    emoji.setAttribute("class", "node-emoji");
    emoji.setAttribute("x", node.x + width / 2);
    emoji.setAttribute("y", node.y + 28);
    emoji.setAttribute("text-anchor", "middle");
    emoji.setAttribute("dominant-baseline", "middle");
    emoji.textContent = emojiValue;
    emoji.addEventListener("click", async event => {
        event.stopPropagation();
        await quickEdit(node.id);
    });
    group.appendChild(emoji);
}

function renderNodeGroup(node, depth) {
    const { width, height } = getLayoutNodeSize(node);
    const group = createNodeGroupElement(node);
    const emojiValue = hasNodeImage(node) ? "" : normalizeNodeEmoji(node.emoji);

    appendNodeBackground(group, node, width, height, depth);
    appendNodeImageContent(group, node, width);
    appendNodeInteractionControls(group, node, width, height);
    appendNodeEmoji(group, node, width, emojiValue);
    appendNodeText(group, node, width, height, emojiValue);

    bindNodeGroupEvents(group, node);
    return group;
}

function updateNodeElement(node, depth) {
    // Position is applied to the existing group so dragging keeps its image alive.
    const inputs = [node, node.parentId, node.text, node.description, node.emoji,
        node.fontSize, node.shape, node.imageUri, node.imageWidth, node.imageHeight,
        node.nodeWidth, node.nodeHeight, node.branchColor, node.textColor, depth, getNodeColor(node),
        node.id === state.selectedNodeId, node.id === state.hoveredNodeId];
    const previous = renderCache.nodes.get(node.id);
    const entry = updateCachedElement(renderCache.nodes, node.id, inputs, renderCache.layers.nodes,
        () => renderNodeGroup(node, depth));
    if (entry !== previous) {
        entry.x = node.x;
        entry.y = node.y;
    }
    const dx = node.x - entry.x, dy = node.y - entry.y;
    const transform = dx || dy ? `translate(${dx}, ${dy})` : '';
    if (entry.transform !== transform) {
        if (transform) entry.element.setAttribute('transform', transform);
        else entry.element.removeAttribute('transform');
        entry.transform = transform;
    }
}

function render() {
    if (canvasViewport) canvasViewport.style.backgroundColor = state.map.backgroundColor || "";
    if (mapBackgroundInput) mapBackgroundInput.value = state.map.backgroundColor || "#fafbfd";
    if (renderFrame != null) {
        cancelAnimationFrame(renderFrame);
        renderFrame = null;
    }
    if (!renderCache.layers) {
        renderConnectorDefs();
        renderCache.layers = {};
        for (const name of ["grid", "connectors", "nodes"]) {
            const layer = document.createElementNS(SVG_NS, "g");
            layer.setAttribute("class", `${name}-layer`);
            svg.appendChild(layer);
            renderCache.layers[name] = layer;
        }
    }
    renderNodeIndex = new Map(state.map.nodes.map(node => [node.id, node]));
    renderNodeSizes = new Map();
    try {
        const viewport = getViewportForRender();
        renderGrid(viewport);
        const depthMap = buildDepthMap(state.map.nodes, renderNodeIndex);
        renderConnectors(depthMap);
        const connectorIds = new Set();
        for (const node of state.map.nodes) {
            const depth = depthMap.get(node.id) || 0;
            updateNodeElement(node, depth);
            if (node.parentId != null && renderNodeIndex.has(node.parentId)) connectorIds.add(node.id);
        }
        removeStaleElements(renderCache.nodes, new Set(renderNodeIndex.keys()));
        removeStaleElements(renderCache.connectors, connectorIds);
        applyCanvasViewport(viewport);
        const selectedNode = getNodeById(state.selectedNodeId);
        if (selectedNode && nodeEditorOverlay?.classList.contains("visible")) updateNodeEditorOverlay(selectedNode);
        const imageOverlayNode = getNodeById(state.imageOverlayNodeId);
        if (imageOverlayNode) updateImageEditorOverlay(imageOverlayNode);
    } finally {
        renderNodeIndex = null;
        renderNodeSizes = null;
    }
}

function openContextMenu(event, nodeId) {
    event.preventDefault();
    event.stopPropagation();
    selectNode(nodeId, { showNodeOverlay: false });
    closeContextMenu();

    const content = document.createElement("div");
    content.className = "node-context-menu";
    content.style.position = "fixed";
    content.style.left = `${event.clientX}px`;
    content.style.top = `${event.clientY}px`;
    content.innerHTML = `
        <button type="button" data-action="add-child">➕ Aggiungi figlio</button>
        <button type="button" data-action="edit-text">✏️ Modifica testo</button>
        <button type="button" data-action="edit-branch">🌿 Modifica ramo</button>
        <button type="button" data-action="upload-image">🖼️ Aggiungi immagine</button>
        <button type="button" data-action="delete" class="danger">🗑️ Elimina nodo</button>
    `;

    document.body.appendChild(content);

    let cleanupAutoUpdate = null;

    const floating = globalThis.window?.FloatingUIDOM;

    if (floating?.computePosition) {
        const {
            computePosition,
            flip,
            shift,
            offset,
            autoUpdate
        } = floating;

        const virtualReference = {
            getBoundingClientRect() {
                return DOMRect.fromRect({
                    x: event.clientX,
                    y: event.clientY,
                    width: 0,
                    height: 0
                });
            },
            contextElement: content
        };

        const updateMenuPosition = () => {
            return computePosition(virtualReference, content, {
                placement: "right-start",
                strategy: "fixed",
                middleware: [
                    offset(8),
                    flip(),
                    shift({ padding: 8 })
                ]
            }).then(({ x, y }) => {
                content.style.left = `${Math.round(x)}px`;
                content.style.top = `${Math.round(y)}px`;
            }).catch(() => {
                content.style.left = `${event.clientX}px`;
                content.style.top = `${event.clientY}px`;
            });
        };

        updateMenuPosition();

        if (typeof autoUpdate === "function") {
            try {
                cleanupAutoUpdate = autoUpdate(
                    virtualReference,
                    content,
                    updateMenuPosition
                );
            } catch {
                cleanupAutoUpdate = null;
            }
        }
    }

    state.contextMenu = {
        content,
        cleanupAutoUpdate,
        openedAt: Date.now()
    };

    content.addEventListener("click", async actionEvent => {
        const action = actionEvent.target?.dataset?.action;
        if (!action) return;

        if (action === "add-child") await addChildNode(nodeId).catch(reportEditorError);
        if (action === "edit-text") await quickEdit(nodeId);
        if (action === "edit-branch") await quickEditBranchText(nodeId).catch(reportEditorError);
        if (action === "upload-image") startImageUploadForNode(nodeId);
        if (action === "delete") await deleteNodeWithChecks(nodeId).catch(reportEditorError);

        closeContextMenu();
    });
}

function closeContextMenu() {
    const menu = state.contextMenu;
    if (!menu) return;
    if (typeof menu.cleanupAutoUpdate === "function") {
        menu.cleanupAutoUpdate();
    }
    menu.content?.remove();
    state.contextMenu = null;
}

function getCanvasBounds() {
    let minX = 0;
    let minY = 0;
    let maxX = BASE_CANVAS_WIDTH - CANVAS_PADDING;
    let maxY = BASE_CANVAS_HEIGHT - CANVAS_PADDING;
    for (const node of state.map.nodes) {
        const nodeSize = getLayoutNodeSize(node);
        minX = Math.min(minX, node.x);
        minY = Math.min(minY, node.y);
        maxX = Math.max(maxX, node.x + nodeSize.width);
        maxY = Math.max(maxY, node.y + nodeSize.height);
    }
    const root = state.map.nodes.find(node => node.parentId == null);
    const rootSize = root ? getLayoutNodeSize(root) : null;
    const centerX = root ? root.x + rootSize.width / 2 : MAP_CENTER_X;
    const centerY = root ? root.y + rootSize.height / 2 : MAP_CENTER_Y;
    const halfWidth = Math.max(BASE_CANVAS_WIDTH / 2, centerX - minX + CANVAS_PADDING, maxX - centerX + CANVAS_PADDING);
    const halfHeight = Math.max(BASE_CANVAS_HEIGHT / 2, centerY - minY + CANVAS_PADDING, maxY - centerY + CANVAS_PADDING);

    return { x: centerX - halfWidth, y: centerY - halfHeight, width: halfWidth * 2, height: halfHeight * 2 };
}

function applyCanvasViewport(viewport = getViewportForRender()) {
    const zoomPercent = Number(zoomInput?.value) || 100;
    const clampedZoomPercent = Math.min(MAX_ZOOM_PERCENT, Math.max(MIN_ZOOM_PERCENT, zoomPercent));
    if (zoomInput && Number(zoomInput.value) !== clampedZoomPercent) {
        zoomInput.value = String(clampedZoomPercent);
    }
    const zoomFactor = clampedZoomPercent / 100;
    const { x, y, width, height } = viewport;
    const offsetX = appliedViewport ? (appliedViewport.x - x) * zoomFactor : 0;
    const offsetY = appliedViewport ? (appliedViewport.y - y) * zoomFactor : 0;
    const pixelWidth = String(Math.round(width * zoomFactor));
    const pixelHeight = String(Math.round(height * zoomFactor));

    for (const [name, value] of [
        ["viewBox", `${x} ${y} ${width} ${height}`],
        ["width", pixelWidth],
        ["height", pixelHeight]
    ]) {
        if (svg.getAttribute(name) !== value) svg.setAttribute(name, value);
    }
    // Keep the drawing scale fixed when its bounds grow, including on mobile.
    if (svg.style.width !== `${pixelWidth}px`) svg.style.width = `${pixelWidth}px`;
    if (svg.style.height !== `${pixelHeight}px`) svg.style.height = `${pixelHeight}px`;
    appliedViewport = viewport;
    if (canvasViewport) {
        if (offsetX) canvasViewport.scrollLeft += offsetX;
        if (offsetY) canvasViewport.scrollTop += offsetY;
    }
    if (zoomValue) {
        zoomValue.textContent = `${clampedZoomPercent}%`;
    }
}

function getViewportForRender() {
    if (!state.workspaceViewport) state.workspaceViewport = getCanvasBounds();
    const current = state.workspaceViewport;
    const interaction = state.drag || state.resize;
    const nodes = interaction ? [getNodeById(interaction.nodeId)].filter(Boolean) : state.map.nodes;
    let left = current.x, top = current.y;
    let right = left + current.width, bottom = top + current.height;
    const matrix = interaction ? svg.getScreenCTM() : null;
    const area = interaction && canvasViewport ? canvasViewport.getBoundingClientRect() : null;
    const margin = WORKSPACE_EDGE_MARGIN / Math.max(Math.abs(matrix?.a || 1), 0.01);
    const padding = Math.max(CANVAS_PADDING, margin * 2);
    for (const node of nodes) {
        const size = getLayoutNodeSize(node);
        const nodeRight = node.x + size.width, nodeBottom = node.y + size.height;
        // During dragging, expand only at the corresponding visible work-area edge.
        const nearLeft = area && matrix && node.x * matrix.a + matrix.e <= area.left + WORKSPACE_EDGE_MARGIN;
        const nearRight = area && matrix && nodeRight * matrix.a + matrix.e >= area.left + canvasViewport.clientWidth - WORKSPACE_EDGE_MARGIN;
        const nearTop = area && matrix && node.y * matrix.d + matrix.f <= area.top + WORKSPACE_EDGE_MARGIN;
        const nearBottom = area && matrix && nodeBottom * matrix.d + matrix.f >= area.top + canvasViewport.clientHeight - WORKSPACE_EDGE_MARGIN;
        if (interaction ? nearLeft && node.x < left + margin : node.x < left) left = Math.min(left, node.x - padding);
        if (interaction ? nearRight && nodeRight > right - margin : nodeRight > right) right = Math.max(right, nodeRight + padding);
        if (interaction ? nearTop && node.y < top + margin : node.y < top) top = Math.min(top, node.y - padding);
        if (interaction ? nearBottom && nodeBottom > bottom - margin : nodeBottom > bottom) bottom = Math.max(bottom, nodeBottom + padding);
    }
    if (left !== current.x || top !== current.y || right !== current.x + current.width || bottom !== current.y + current.height) {
        state.workspaceViewport = { x: left, y: top, width: right - left, height: bottom - top };
    }
    return state.workspaceViewport;
}


function focusCanvasOnContent(node) {
    if (!canvasViewport) return;
    const viewport = getViewportForRender();
    const size = node ? getLayoutNodeSize(node) : null;
    const point = svg.createSVGPoint();
    point.x = node ? node.x + size.width / 2 : viewport.x + viewport.width / 2;
    point.y = node ? node.y + size.height / 2 : viewport.y + viewport.height / 2;
    const matrix = svg.getScreenCTM();
    if (!matrix) return;
    const center = point.matrixTransform(matrix);
    const panelRect = canvasViewport.getBoundingClientRect();

    canvasViewport.scrollLeft += center.x - panelRect.left - canvasViewport.clientLeft - canvasViewport.clientWidth / 2;
    canvasViewport.scrollTop += center.y - panelRect.top - canvasViewport.clientTop - canvasViewport.clientHeight / 2;
}

function renderNodeImage(group, node, width) {
    const { x: imageX, y: imageY, width: imageWidth, height: imageHeight } = getNodeImageBounds(node, width);
    const clipId = `clip-node-${node.id}`;

    const defs = document.createElementNS(SVG_NS, "defs");
    const clipPath = document.createElementNS(SVG_NS, "clipPath");
    clipPath.setAttribute("id", clipId);
    const clipRect = document.createElementNS(SVG_NS, "rect");
    clipRect.setAttribute("x", imageX);
    clipRect.setAttribute("y", imageY);
    clipRect.setAttribute("width", imageWidth);
    clipRect.setAttribute("height", imageHeight);
    clipRect.setAttribute("rx", 8);
    clipRect.setAttribute("ry", 8);
    clipPath.appendChild(clipRect);
    defs.appendChild(clipPath);
    group.appendChild(defs);

    const image = document.createElementNS(SVG_NS, "image");
    image.setAttribute("x", imageX);
    image.setAttribute("y", imageY);
    image.setAttribute("width", imageWidth);
    image.setAttribute("height", imageHeight);
    image.setAttribute("href", node.imageUri);
    image.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", node.imageUri);
    image.setAttribute("preserveAspectRatio", "xMidYMid slice");
    image.setAttribute("clip-path", `url(#${clipId})`);
    image.style.pointerEvents = "all";
    image.addEventListener("pointerdown", event => {
        event.stopPropagation();
    });
    image.addEventListener("click", event => {
        event.stopPropagation();
        event.preventDefault();
        selectNode(node.id, { showNodeOverlay: false });
        showImageEditorOverlay(node);
    });
    group.appendChild(image);
}

function renderImageResizeHandle(group, node, nodeWidth) {
    const bounds = getNodeImageBounds(node, nodeWidth);
    const handle = document.createElementNS(SVG_NS, "circle");
    handle.setAttribute("class", "image-resize-handle");
    handle.setAttribute("cx", bounds.x + bounds.width);
    handle.setAttribute("cy", bounds.y + bounds.height);
    handle.setAttribute("r", "7");
    handle.dataset.nodeId = node.id;
    handle.addEventListener("pointerdown", startImageResize);
    group.appendChild(handle);
}

function renderNodeActionButtons(group, node, nodeWidth) {
    const actions = [
        {
            key: "add-child",
            label: "➕",
            title: "Aggiungi nodo figlio",
            onClick: () => addChildNode(node.id).catch(reportEditorError)
        },
        {
            key: "add-image",
            label: "🖼️",
            title: "Aggiungi immagine",
            onClick: () => startImageUploadForNode(node.id)
        },
        {
            key: "edit-emoji",
            label: "😀",
            title: "Emoji nodo",
            onClick: () => quickEditEmoji(node.id).catch(reportEditorError)
        },
        {
            key: "delete-node",
            label: "🗑️",
            title: "Elimina nodo",
            onClick: () => deleteNodeWithChecks(node.id).catch(reportEditorError)
        }
    ];

    const spacing = 34;
    const actionRowY = node.y - 18;
    const startX = node.x + (nodeWidth / 2) - ((actions.length - 1) * spacing / 2);

    actions.forEach((action, index) => {
        const x = startX + (index * spacing);
        const button = document.createElementNS(SVG_NS, "g");
        button.setAttribute("class", "node-action-button");
        button.dataset.nodeId = node.id;
        button.dataset.action = action.key;
        button.setAttribute("transform", `translate(${x}, ${actionRowY})`);
        button.addEventListener("pointerdown", event => {
            event.stopPropagation();
            event.preventDefault();
        });
        button.addEventListener("click", event => {
            event.stopPropagation();
            event.preventDefault();
            selectNode(node.id);
            action.onClick();
        });

        const rect = document.createElementNS(SVG_NS, "rect");
        rect.setAttribute("x", "-14");
        rect.setAttribute("y", "-14");
        rect.setAttribute("rx", "14");
        rect.setAttribute("ry", "14");
        rect.setAttribute("width", "28");
        rect.setAttribute("height", "28");
        button.appendChild(rect);

        const icon = document.createElementNS(SVG_NS, "text");
        icon.setAttribute("x", "0");
        icon.setAttribute("y", "0");
        icon.setAttribute("text-anchor", "middle");
        icon.setAttribute("dominant-baseline", "middle");
        icon.setAttribute("class", "node-action-icon");
        icon.textContent = action.label;
        button.appendChild(icon);

        const tooltip = document.createElementNS(SVG_NS, "title");
        tooltip.textContent = action.title;
        button.appendChild(tooltip);

        group.appendChild(button);
    });
}

function renderNodeResizeHandle(group, node, nodeWidth, nodeHeight) {
    const handle = document.createElementNS(SVG_NS, "circle");
    handle.setAttribute("class", "node-resize-handle");
    handle.setAttribute("cx", node.x + nodeWidth - 3);
    handle.setAttribute("cy", node.y + nodeHeight - 3);
    handle.setAttribute("r", "8");
    handle.dataset.nodeId = node.id;
    handle.addEventListener("pointerdown", startNodeResize);
    group.appendChild(handle);
}

function renderBranchLabel(node, cx, cy, x1, y1, x2, y2, target) {
    const branchText = (node.branchText || "").trim();
    if (!branchText) return;
    const label = document.createElementNS(SVG_NS, "text");
    label.setAttribute("class", "branch-label");
    label.setAttribute("x", String(cx));
    label.setAttribute("y", String(cy - 6));
    label.setAttribute("text-anchor", "middle");
    label.textContent = truncate(branchText, 26);
    const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
    label.setAttribute("transform", `rotate(${Math.max(-24, Math.min(24, angle))}, ${cx}, ${cy - 6})`);
    label.addEventListener("pointerdown", event => event.stopPropagation());
    label.addEventListener("click", async event => {
        event.stopPropagation();
        await quickEditBranchText(node.id).catch(reportEditorError);
    });
    target.appendChild(label);
}


function selectNode(nodeId, options = {}) {
    const showNodeOverlay = options.showNodeOverlay !== false;
    if (state.selectedNodeId !== nodeId) formEditGroup = null;
    state.selectedNodeId = nodeId;
    const node = getNodeById(nodeId);
    if (!node) return;
    textInput.value = node.text || "";
    descriptionInput.value = node.description || "";
    hintInputs.forEach((input, index) => { input.value = node[hintFields[index]] || ""; });
    if (nodeEmojiInput) nodeEmojiInput.value = node.emoji || "";
    branchTextInput.value = node.branchText || "";
    colorInput.value = colorPickerValue(getNodeColor(node), "#D9D2E9");
    textColorInput.value = colorPickerValue(node.textColor || "var(--ink)", "#314256");
    branchColorInput.value = colorPickerValue(node.branchColor, "#7c8a9a");
    branchStyleInput.value = node.branchStyle || "SOLID";
    branchWidthInput.value = clampBranchWidth(Number(node.branchWidth));
    branchCurveInput.value = (node.branchCurve || "CUBIC").toUpperCase();
    fontSizeInput.value = node.fontSize || 18;
    imageUrlInput.value = node.imageUri || "";
    const imageSize = getNodeImageSize(node);
    if (imageWidthInput) imageWidthInput.value = imageSize.width;
    if (imageHeightInput) imageHeightInput.value = imageSize.height;
    updateImageSizeLabels();
    updateImagePreview(node.imageUri || "");
    render();
    const selected = getNodeById(state.selectedNodeId);
    if (nodeEditorOverlay && selected && showNodeOverlay) {
        nodeEditorOverlay.classList.add("visible");
        updateNodeEditorOverlay(selected);
    } else {
        hideNodeEditorOverlay();
    }
    hideImageEditorOverlay();
}

function canStartPointerInteraction(event) {
    return event.isPrimary && event.button === 0 && interactionPointerId === null
        && !state.isApplyingHistory && !leavingEditor;
}

function captureInteractionPointer() {
    if (interactionPointerId !== null && !canvasViewport.hasPointerCapture(interactionPointerId)) {
        canvasViewport.setPointerCapture(interactionPointerId);
    }
}

function startDrag(event) {
    if (!canStartPointerInteraction(event)) return;
    event.stopPropagation();
    const nodeId = Number(event.currentTarget.dataset.id);
    const node = getNodeById(nodeId);
    if (!node) return;

    beginInteractionSnapshot();
    interactionPointerId = event.pointerId;
    const point = toSvgPoint(event);
    state.drag = {
        nodeId,
        offsetX: point.x - node.x,
        offsetY: point.y - node.y,
        startClientX: event.clientX,
        startClientY: event.clientY,
        overlayHidden: false,
        moved: false,
    };
}

function startImageResize(event) {
    if (!canStartPointerInteraction(event)) return;
    event.stopPropagation();
    event.preventDefault();
    const nodeId = Number(event.currentTarget.dataset.nodeId);
    const node = getNodeById(nodeId);
    if (!node) return;

    interactionPointerId = event.pointerId;
    captureInteractionPointer();
    beginInteractionSnapshot();
    selectNode(nodeId, { showNodeOverlay: false });
    const nodeSize = getNodeSize(node);
    const bounds = getNodeImageBounds(node, nodeSize.width);
    const point = toSvgPoint(event);
    state.resize = {
        mode: "image",
        nodeId,
        anchorX: bounds.x,
        anchorY: bounds.y,
        pointerOffsetX: bounds.x + bounds.width - point.x,
        pointerOffsetY: bounds.y + bounds.height - point.y,
    };
}

function startNodeResize(event) {
    if (!canStartPointerInteraction(event)) return;
    event.stopPropagation();
    event.preventDefault();
    const nodeId = Number(event.currentTarget.dataset.nodeId);
    const node = getNodeById(nodeId);
    if (!node) return;

    interactionPointerId = event.pointerId;
    captureInteractionPointer();
    beginInteractionSnapshot();
    selectNode(nodeId, { showNodeOverlay: false });
    const size = getNodeSize(node);
    const point = toSvgPoint(event);
    state.resize = {
        mode: "node",
        nodeId,
        startX: node.x,
        startY: node.y,
        pointerOffsetX: node.x + size.width - point.x,
        pointerOffsetY: node.y + size.height - point.y,
    };
}

function startCanvasPan(event) {
    if (!canvasViewport || !canStartPointerInteraction(event)) return;
    if (event.target.closest('.node-group, .branch-label, button, input, select, textarea, a, [contenteditable]')) return;
    interactionPointerId = event.pointerId;
    captureInteractionPointer();
    state.pan = {
        startClientX: event.clientX,
        startClientY: event.clientY,
        startScrollLeft: canvasViewport.scrollLeft,
        startScrollTop: canvasViewport.scrollTop,
        moved: false,
    };
    canvasViewport.classList.add("is-panning");
    event.preventDefault();
}

function toSvgPoint(event) {
    const pt = svg.createSVGPoint();
    pt.x = event.clientX;
    pt.y = event.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
}

function snapToGrid(value) {
    if (!state.gridEnabled) return value;
    const gridSize = Math.max(5, Number(state.gridSize) || DEFAULT_GRID_SIZE);
    return Math.round(value / gridSize) * gridSize;
}

function applyPointerMove(event) {
    if (state.drag) {
        if (!state.drag.moved) return false;
        const node = getNodeById(state.drag.nodeId);
        if (!node) return false;
        const point = toSvgPoint(event);
        if (!state.drag.overlayHidden && state.drag.moved) {
            hideNodeEditorOverlay();
            state.drag.overlayHidden = true;
        }
        const x = snapToGrid(Math.round(point.x - state.drag.offsetX));
        const y = snapToGrid(Math.round(point.y - state.drag.offsetY));
        if (x === node.x && y === node.y) return false;
        node.x = x;
        node.y = y;
        scheduleAutosave(node);
        return true;
    }
    if (state.resize) {
        const node = getNodeById(state.resize.nodeId);
        if (!node) return false;
        const point = toSvgPoint(event);
        if (state.resize.mode === "node") {
            const intrinsic = getIntrinsicNodeSize(node);
            const width = Math.max(intrinsic.width, clampNodeWidth(snapToGrid(point.x - state.resize.startX + state.resize.pointerOffsetX)));
            const height = Math.max(intrinsic.height, clampNodeHeight(snapToGrid(point.y - state.resize.startY + state.resize.pointerOffsetY)));
            if (width === node.nodeWidth && height === node.nodeHeight) return false;
            node.nodeWidth = width;
            node.nodeHeight = height;
        } else {
            const width = clampImageSize(snapToGrid(point.x - state.resize.anchorX + state.resize.pointerOffsetX));
            const height = clampImageSize(snapToGrid(point.y - state.resize.anchorY + state.resize.pointerOffsetY));
            if (width === node.imageWidth && height === node.imageHeight) return false;
            node.imageWidth = width;
            node.imageHeight = height;
            if (imageWidthInput) imageWidthInput.value = width;
            if (imageHeightInput) imageHeightInput.value = height;
            updateImageSizeLabels();
        }
        scheduleAutosave(node);
        return true;
    }
    if (state.pan && canvasViewport) {
        if (Math.hypot(event.clientX - state.pan.startClientX, event.clientY - state.pan.startClientY) > 3) state.pan.moved = true;
        canvasViewport.scrollLeft = state.pan.startScrollLeft - (event.clientX - state.pan.startClientX);
        canvasViewport.scrollTop = state.pan.startScrollTop - (event.clientY - state.pan.startClientY);
    }
    return false;
}

function queuePointerMove(event) {
    pendingPointerMove = { clientX: event.clientX, clientY: event.clientY };
    if (interactionFrame == null) interactionFrame = requestAnimationFrame(() => flushPointerMove());
}

function panNearWorkspaceEdge(event) {
    if (!state.drag?.moved || !canvasViewport) return false;
    const rect = canvasViewport.getBoundingClientRect();
    const left = rect.left + canvasViewport.clientLeft, top = rect.top + canvasViewport.clientTop;
    const right = left + canvasViewport.clientWidth, bottom = top + canvasViewport.clientHeight;
    if (event.clientX < left || event.clientX > right || event.clientY < top || event.clientY > bottom) return false;
    const step = (position, min, max) => {
        if (position < min + WORKSPACE_EDGE_MARGIN) return -WORKSPACE_PAN_STEP * (1 - (position - min) / WORKSPACE_EDGE_MARGIN);
        if (position > max - WORKSPACE_EDGE_MARGIN) return WORKSPACE_PAN_STEP * (1 - (max - position) / WORKSPACE_EDGE_MARGIN);
        return 0;
    };
    const previousLeft = canvasViewport.scrollLeft, previousTop = canvasViewport.scrollTop;
    const dx = step(event.clientX, left, right), dy = step(event.clientY, top, bottom);
    if (dx) canvasViewport.scrollLeft += dx;
    if (dy) canvasViewport.scrollTop += dy;
    return canvasViewport.scrollLeft !== previousLeft || canvasViewport.scrollTop !== previousTop;
}

function flushPointerMove(allowPan = true) {
    if (interactionFrame != null) cancelAnimationFrame(interactionFrame);
    interactionFrame = null;
    const event = pendingPointerMove;
    pendingPointerMove = null;
    if (!event) return;
    if (applyPointerMove(event) || edgePanActive) render();
    edgePanActive = allowPan && panNearWorkspaceEdge(event);
    if (edgePanActive) queuePointerMove(event);
}

document.addEventListener("pointermove", event => {
    if (event.pointerId !== interactionPointerId) return;
    if (state.drag && !state.drag.moved) {
        if (Math.hypot(event.clientX - state.drag.startClientX, event.clientY - state.drag.startClientY) <= 3) return;
        // Capture on a stable ancestor only once a tap becomes a drag.
        captureInteractionPointer();
        state.drag.moved = true;
        selectNode(state.drag.nodeId, { showNodeOverlay: false });
    }
    queuePointerMove(event);
});

function shouldHideNodeEditorAfterPointerEnd(wasDragging, dragMoved, justOpenedContextMenu) {
    return (wasDragging && dragMoved) || justOpenedContextMenu;
}

function resetPointerInteractionState() {
    const pointerId = interactionPointerId;
    interactionPointerId = null;
    state.drag = null;
    state.resize = null;
    state.pan = null;
    edgePanActive = false;
    pendingPointerMove = null;
    if (interactionFrame != null) cancelAnimationFrame(interactionFrame);
    interactionFrame = null;
    canvasViewport?.classList.remove("is-panning");
    if (pointerId !== null && canvasViewport.hasPointerCapture(pointerId)) canvasViewport.releasePointerCapture(pointerId);
    applyCanvasViewport();
}

function refreshOverlaysAfterPointerEnd(wasDragging, dragMoved) {
    const selectedNode = getNodeById(state.selectedNodeId);
    const justOpenedContextMenu = state.contextMenu && (Date.now() - state.contextMenu.openedAt) < 250;
    if (selectedNode) {
        if (shouldHideNodeEditorAfterPointerEnd(wasDragging, dragMoved, justOpenedContextMenu)) {
            hideNodeEditorOverlay();
        } else {
            if (nodeEditorOverlay) nodeEditorOverlay.classList.add("visible");
            updateNodeEditorOverlay(selectedNode);
        }
    }

    const imageOverlayNode = getNodeById(state.imageOverlayNodeId);
    if (imageOverlayNode) updateImageEditorOverlay(imageOverlayNode);
}

function flushResizeAutosave(resizeState) {
    if (!resizeState) return;
    const resizedNode = getNodeById(resizeState.nodeId);
    if (!resizedNode) return;
    runAutosave(resizedNode);
}

function finishPointerInteraction(event, cancelled = false) {
    if (interactionPointerId === null || (event && event.pointerId !== interactionPointerId)) return;
    if (!cancelled && event) queuePointerMove(event);
    flushPointerMove(false);
    const wasDragging = !!state.drag;
    const dragMoved = !!state.drag?.moved;
    const resizeState = state.resize ? { ...state.resize } : null;

    const interacted = dragMoved || !!resizeState || !!state.pan?.moved;
    suppressPointerClick = interacted;
    if (dragMoved || resizeState) commitInteractionSnapshot();
    else clearInteractionSnapshot();

    if (renderFrame != null) render();
    resetPointerInteractionState();
    if (interacted) refreshOverlaysAfterPointerEnd(wasDragging, dragMoved);
    flushResizeAutosave(resizeState);
}

document.addEventListener('pointerup', event => finishPointerInteraction(event));
document.addEventListener('pointercancel', event => finishPointerInteraction(event, true));
canvasViewport.addEventListener('lostpointercapture', event => {
    if (event.target === canvasViewport) finishPointerInteraction(event, true);
});
globalThis.addEventListener('blur', () => finishPointerInteraction(null, true));
document.addEventListener('visibilitychange', () => {
    if (document.hidden) finishPointerInteraction(null, true);
});
document.addEventListener('pointerdown', () => { suppressPointerClick = false; }, true);
document.addEventListener('click', event => {
    if (!suppressPointerClick || event.detail === 0) return;
    suppressPointerClick = false;
    event.preventDefault();
    event.stopImmediatePropagation();
}, true);

document.addEventListener("click", event => {
    const justOpenedContextMenu = state.contextMenu && (Date.now() - state.contextMenu.openedAt) < 200;
    if (justOpenedContextMenu) return;
    if (event.target.closest(".node-context-menu")) return;
    if (!event.target.closest(".node-editor-overlay") && !event.target.closest(".image-editor-overlay") && !event.target.closest(".node-group")) {
        if (event.target === svg || event.target.closest(".canvas-scroll-area") || event.target.closest(".canvas-panel")) {
            hideNodeEditorOverlay();
            hideImageEditorOverlay();
        }
    }
    if (!event.target.closest(".image-editor-overlay") && !event.target.closest(".node-group")) {
        if (event.target === svg || event.target.closest(".canvas-scroll-area") || event.target.closest(".canvas-panel")) {
            hideImageEditorOverlay();
        }
    }
    closeContextMenu();
});

document.getElementById("apply-image-url-btn").addEventListener("click", () => {
    const node = getNodeById(state.selectedNodeId);
    if (!node) return;
    pushUndoSnapshot();
    node.imageUri = normalizeImageUri(imageUrlInput.value);
    if (hasNodeImage(node)) {
        node.emoji = "";
        if (nodeEmojiInput) nodeEmojiInput.value = "";
    }
    ensureNodeImageSize(node);
    imageUrlInput.value = node.imageUri || "";
    updateImagePreview(node.imageUri || "");
    render();
    if (nodeEditorOverlay) {
        nodeEditorOverlay.classList.add("visible");
        updateNodeEditorOverlay(node);
    }
    queueAutoSubmitSelectedNode();
});

document.getElementById("clear-image-btn").addEventListener("click", () => {
    imageUrlInput.value = "";
    pushUndoSnapshot();
    updateImagePreview("");
    const node = getNodeById(state.selectedNodeId);
    if (!node) return;
    node.imageUri = null;
    node.imageWidth = DEFAULT_IMAGE_SIZE;
    node.imageHeight = DEFAULT_IMAGE_SIZE;
    if (imageWidthInput) imageWidthInput.value = DEFAULT_IMAGE_SIZE;
    if (imageHeightInput) imageHeightInput.value = DEFAULT_IMAGE_SIZE;
    updateImageSizeLabels();
    render();
    if (nodeEditorOverlay) {
        nodeEditorOverlay.classList.add("visible");
        updateNodeEditorOverlay(node);
    }
    queueAutoSubmitSelectedNode();
});

imageUploadInput.addEventListener("change", event => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        const dataUrl = typeof reader.result === "string" ? reader.result : "";
        const targetNodeId = state.pendingImageNodeId ?? state.selectedNodeId;
        const node = getNodeById(targetNodeId);
        state.pendingImageNodeId = null;
        event.target.value = "";
        if (!node) return;
        pushUndoSnapshot();
        imageUrlInput.value = dataUrl;
        updateImagePreview(dataUrl);
        node.imageUri = dataUrl;
        node.emoji = "";
        if (nodeEmojiInput) nodeEmojiInput.value = "";
        ensureNodeImageSize(node);
        if (imageWidthInput) imageWidthInput.value = node.imageWidth;
        if (imageHeightInput) imageHeightInput.value = node.imageHeight;
        updateImageSizeLabels();
        render();
        queueAutoSubmitSelectedNode();
    };
    reader.readAsDataURL(file);
});

if (imageWidthInput) {
imageWidthInput.addEventListener("input", () => {
    const node = getNodeById(state.selectedNodeId);
    if (!node) return;
    node.imageWidth = clampImageSize(Number(imageWidthInput?.value ?? node.imageWidth));
    imageWidthInput.value = node.imageWidth;
    updateImageSizeLabels();
    render();
    if (nodeEditorOverlay) {
        nodeEditorOverlay.classList.add("visible");
        updateNodeEditorOverlay(node);
    }
});
}

if (imageHeightInput) {
imageHeightInput.addEventListener("input", () => {
    const node = getNodeById(state.selectedNodeId);
    if (!node) return;
    node.imageHeight = clampImageSize(Number(imageHeightInput?.value ?? node.imageHeight));
    imageHeightInput.value = node.imageHeight;
    updateImageSizeLabels();
    render();
    if (nodeEditorOverlay) {
        nodeEditorOverlay.classList.add("visible");
        updateNodeEditorOverlay(node);
    }
});
}

const autosubmitFields = [textInput, descriptionInput, ...hintInputs, nodeEmojiInput, branchTextInput, colorInput, textColorInput, branchColorInput, branchStyleInput, branchWidthInput, branchCurveInput, fontSizeInput, imageUrlInput].filter(Boolean);
const instantAutosubmitFields = new Set([textInput, ...hintInputs, imageUrlInput, colorInput, textColorInput, branchColorInput, branchWidthInput, fontSizeInput]);
for (const field of autosubmitFields) {
    const eventName = instantAutosubmitFields.has(field) ? "input" : "change";
    field.addEventListener(eventName, () => queueAutoSubmitSelectedNode(field));
}
if (imageWidthInput) imageWidthInput.addEventListener("change", () => queueAutoSubmitSelectedNode());
if (imageHeightInput) imageHeightInput.addEventListener("change", () => queueAutoSubmitSelectedNode());
function updateImagePreview(uri) {
    for (const option of imageCandidates.children) option.setAttribute('aria-pressed', String(option.dataset.uri === uri));
    if (uri) {
        if (imagePreview.getAttribute("src") !== uri) imagePreview.src = uri;
        imagePreview.style.display = "block";
    } else {
        imagePreview.removeAttribute("src");
        imagePreview.style.display = "none";
    }
}

function renderImageCandidates(node) {
    const candidates = [...new Set(node.imageCandidates || [])].slice(0, 6);
    imageAlternatives.hidden = candidates.length === 0;
    imageCandidates.replaceChildren();
    const usedImages = new Set(state.map.nodes.filter(other => other.id !== node.id).map(other => other.imageUri));
    candidates.forEach((uri, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'image-candidate';
        button.dataset.uri = uri;
        button.disabled = usedImages.has(uri);
        button.setAttribute('aria-label', `Immagine alternativa ${index + 1}${button.disabled ? ', già usata da un altro nodo' : ''}`);
        button.setAttribute('aria-pressed', String(uri === node.imageUri));
        const image = document.createElement('img');
        image.src = uri;
        image.alt = '';
        image.loading = 'lazy';
        image.decoding = 'async';
        image.addEventListener('error', () => {
            button.disabled = true;
            button.setAttribute('aria-label', `Immagine alternativa ${index + 1} non disponibile`);
        }, { once: true });
        button.appendChild(image);
        button.addEventListener('click', () => {
            const current = getNodeById(node.id);
            if (!current || current.imageUri === uri) return;
            if (state.map.nodes.some(other => other.id !== current.id && other.imageUri === uri)) {
                renderImageCandidates(current);
                return;
            }
            pushUndoSnapshot();
            current.imageUri = uri;
            current.emoji = '';
            if (nodeEmojiInput) nodeEmojiInput.value = '';
            imageUrlInput.value = uri;
            ensureNodeImageSize(current);
            updateImagePreview(uri);
            requestRender();
            updateImageEditorOverlay(current);
            scheduleAutosave(current);
        });
        imageCandidates.appendChild(button);
    });
}

function applyFormToNode(node) {
    node.text = normalizeNodeText(textInput.value);
    node.description = normalizeNodeText(descriptionInput.value || "").slice(0, 280);
    hintInputs.forEach((input, index) => { node[hintFields[index]] = sanitizePlainText(input.value || "").trim().slice(0, 280); });
    node.emoji = normalizeNodeEmoji(nodeEmojiInput?.value || "");
    node.branchText = (branchTextInput.value || "").trim();
    node.color = colorInput.value;
    node.textColor = textColorInput.value;
    node.branchColor = branchColorInput.value;
    node.branchStyle = branchStyleInput.value;
    node.branchWidth = clampBranchWidth(Number(branchWidthInput.value));
    node.branchCurve = (branchCurveInput.value || "CUBIC").toUpperCase();
    node.fontSize = Number(fontSizeInput.value);
    node.imageUri = normalizeImageUri(imageUrlInput.value);
    node.imageWidth = clampImageSize(Number(imageWidthInput?.value ?? node.imageWidth));
    node.imageHeight = clampImageSize(Number(imageHeightInput?.value ?? node.imageHeight));
    if (hasNodeImage(node)) {
        node.emoji = "";
    } else if (hasNodeEmoji(node)) {
        node.imageUri = null;
    }
}

function normalizeImageUri(value) {
    const trimmed = (value || "").trim();
    if (!trimmed.length) return null;
    if (trimmed.startsWith("data:image/")) return trimmed;
    if (!URL.canParse(trimmed)) return null;
    const parsed = new URL(trimmed);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        return parsed.toString();
    }
    return null;
}

function clampBranchWidth(value) {
    if (!Number.isFinite(value) || value <= 0) return 4;
    return Math.min(12, Math.max(1, Math.round(value)));
}


function handleCanvasWheelZoom(event) {
    if (!zoomInput) return;
    if (!(event.ctrlKey || event.metaKey)) return;

    const deltaModeFactor = event.deltaMode === WheelEvent.DOM_DELTA_LINE
        ? 16
        : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? 120
            : 1;
    const normalizedDeltaY = event.deltaY * deltaModeFactor;
    if (!Number.isFinite(normalizedDeltaY) || normalizedDeltaY === 0) return;

    event.preventDefault();
    const intensity = Math.min(1.2, Math.abs(normalizedDeltaY) / 100);
    const rawStep = (normalizedDeltaY < 0 ? 1 : -1) * 3 * intensity;
    const step = Math.sign(rawStep) * Math.max(0.8, Math.abs(rawStep));
    const currentZoom = Number(zoomInput.value) || 100;
    const nextZoom = Math.min(MAX_ZOOM_PERCENT, Math.max(MIN_ZOOM_PERCENT, currentZoom + step));
    if (nextZoom === currentZoom) return;
    animateZoomTo(nextZoom);
}

function animateZoomTo(targetZoom) {
    state.zoomAnimationTarget = Math.min(MAX_ZOOM_PERCENT, Math.max(MIN_ZOOM_PERCENT, targetZoom));
    if (state.zoomAnimationFrame) return;

    function tick() {
        const currentZoom = Number(zoomInput.value) || 100;
        const delta = state.zoomAnimationTarget - currentZoom;
        if (Math.abs(delta) < 0.05) {
            zoomInput.value = String(state.zoomAnimationTarget);
            applyCanvasViewport();
            state.zoomAnimationFrame = null;
            return;
        }
        const easedStep = delta * 0.22;
        zoomInput.value = String(currentZoom + easedStep);
        applyCanvasViewport();
        state.zoomAnimationFrame = requestAnimationFrame(tick);
    }

    state.zoomAnimationFrame = requestAnimationFrame(tick);
}

function ensureNodeImageSize(node) {
    node.imageWidth = clampImageSize(Number(node.imageWidth));
    node.imageHeight = clampImageSize(Number(node.imageHeight));
}

function getIntrinsicNodeSize(node) {
    const imageSize = getNodeImageSize(node);
    const fontSize = Number(node.fontSize) || 18;
    const lineHeight = Math.max(16, Math.round(fontSize * 1.2));
    const lineCount = getNodeDisplayLines(node, hasNodeImage(node) ? 18 : 20).length;
    const textBlockHeight = lineCount * lineHeight;
    return hasNodeImage(node)
        ? {
            width: Math.max(IMAGE_NODE_WIDTH, imageSize.width + 60),
            height: Math.max(IMAGE_NODE_HEIGHT, imageSize.height + textBlockHeight + 44)
        }
        : { width: BASE_NODE_WIDTH, height: Math.max(BASE_NODE_HEIGHT, textBlockHeight + 34) };
}


function updateImageSizeLabels() {
    if (imageWidthValue && imageWidthInput) imageWidthValue.textContent = imageWidthInput.value;
    if (imageHeightValue && imageHeightInput) imageHeightValue.textContent = imageHeightInput.value;
}

const exportPngButton = document.getElementById("export-png-btn");
const exportPdfButton = document.getElementById("export-pdf-btn");
const exportPdfFormatSelect = document.getElementById("export-pdf-format");

async function exportCanvas(format) {
    const normalizedFormat = (format || "png").toLowerCase();
    const isPdf = normalizedFormat === "pdf";
    const pdfFormat = (exportPdfFormatSelect?.value || "a4").toLowerCase() === "a3" ? "a3" : "a4";
    const svgMarkup = await buildExportSvg();
    const url = isPdf
        ? `/api/maps/${state.map.id}/export/pdf?format=${pdfFormat}`
        : `/api/maps/${state.map.id}/export/png`;
    const blob = await editorRequest(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ svg: svgMarkup })
    }, isPdf ? "pdf" : "png");
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = isPdf ? `mindmap-${pdfFormat}.pdf` : "mindmap.png";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(blobUrl);
}


function toWikimediaVideoPosterUrl(href) {
    if (!href) return href;
    const value = href.trim();
    const match = value.match(/^https?:\/\/(upload\.wikimedia\.org)\/(wikipedia\/commons)\/([0-9a-f]\/[^?#]+\.(?:webm|ogv))(?:[?#].*)?$/i);
    if (!match) return value;
    const [, host, basePath, filePath] = match;
    const fileName = filePath.substring(filePath.lastIndexOf('/') + 1);
    return `https://${host}/${basePath}/thumb/${filePath}/${fileName}.jpg`;
}


function convertWebpDataUriToPng(dataUri) {
    return new Promise(resolve => {
        const img = new Image();
        img.onload = () => {
            try {
                const canvas = document.createElement("canvas");
                canvas.width = Math.max(1, img.naturalWidth || img.width || 1);
                canvas.height = Math.max(1, img.naturalHeight || img.height || 1);
                const ctx = canvas.getContext("2d");
                if (!ctx) {
                    resolve(dataUri);
                    return;
                }
                ctx.drawImage(img, 0, 0);
                resolve(canvas.toDataURL("image/png"));
            } catch (error) {
                console.warn("Impossibile convertire WebP in PNG durante l'esportazione", error);
                resolve(dataUri);
            }
        };
        img.onerror = () => resolve(dataUri);
        img.src = dataUri;
    });
}

async function normalizeExportImageHref(href) {
    if (!href) return "";
    const trimmed = href.trim();
    if (!trimmed) return "";
    if (trimmed.toLowerCase().startsWith("data:image/webp")) {
        return await convertWebpDataUriToPng(trimmed);
    }
    return toWikimediaVideoPosterUrl(trimmed);
}

async function buildExportSvg() {
    flushPointerMove(false);
    if (renderFrame != null) render();
    const clone = svg.cloneNode(true);
    const viewBox = (svg.getAttribute("viewBox") || "0 0 1400 900").split(/\s+/).map(Number);
    const width = Number.isFinite(viewBox[2]) ? viewBox[2] : 1400;
    const height = Number.isFinite(viewBox[3]) ? viewBox[3] : 900;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
    clone.setAttribute("width", String(width));
    clone.setAttribute("height", String(height));
    clone.setAttribute("viewBox", svg.getAttribute("viewBox") || `0 0 ${width} ${height}`);

    if (state.map.backgroundColor) {
        const background = document.createElementNS(SVG_NS, "rect");
        background.setAttribute("x", String(viewBox[0] || 0));
        background.setAttribute("y", String(viewBox[1] || 0));
        background.setAttribute("width", String(width));
        background.setAttribute("height", String(height));
        background.setAttribute("fill", state.map.backgroundColor);
        clone.prepend(background);
    }

    const transientControls = clone.querySelectorAll(".node-resize-handle, .image-resize-handle, .node-action-button");
    transientControls.forEach(control => control.remove());

    const exportImages = Array.from(clone.querySelectorAll("image"));
    for (const image of exportImages) {
        const href = await normalizeExportImageHref(image.getAttribute("href") || image.getAttributeNS("http://www.w3.org/1999/xlink", "href"));
        if (!href) {
            image.remove();
            continue;
        }
        image.setAttribute("href", href);
        image.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", href);
    }

    return new XMLSerializer().serializeToString(clone);
}

if (exportPngButton) {
    exportPngButton.addEventListener("click", async event => {
        event.preventDefault();
        await exportCanvas("png").catch(reportEditorError);
    });
}
if (exportPdfButton) {
    exportPdfButton.addEventListener("click", async () => {
        await exportCanvas("pdf").catch(reportEditorError);
    });
}
if (zoomInput) {
    zoomInput.addEventListener("input", () => applyCanvasViewport());
}
if (gridEnabledInput) {
    gridEnabledInput.addEventListener("change", () => {
        state.gridEnabled = !!gridEnabledInput.checked;
        render();
    });
}
if (gridSizeInput) {
    gridSizeInput.addEventListener("change", () => {
        state.gridSize = Math.max(5, Number(gridSizeInput.value) || DEFAULT_GRID_SIZE);
        render();
    });
}
if (renameMapBtn) {
    renameMapBtn.addEventListener("click", () => renameMap().catch(reportEditorError));
}

if (canvasViewport) {
    canvasViewport.addEventListener("pointerdown", startCanvasPan);

    canvasViewport.addEventListener("scroll", () => {
        const selectedNode = getNodeById(state.selectedNodeId);
        if (selectedNode) updateNodeEditorOverlay(selectedNode);
        const imageOverlayNode = getNodeById(state.imageOverlayNodeId);
        if (imageOverlayNode) updateImageEditorOverlay(imageOverlayNode);
    });

    globalThis.addEventListener("wheel", event => {
        if (!event.ctrlKey && !event.metaKey) return;
        const rect = canvasViewport.getBoundingClientRect();
        const isInsideCanvasByPointer = event.clientX >= rect.left && event.clientX <= rect.right
            && event.clientY >= rect.top && event.clientY <= rect.bottom;
        if (!isInsideCanvasByPointer) return;
        handleCanvasWheelZoom(event);
    }, { passive: false, capture: true });
}

async function reorderMap() {
    pushUndoSnapshot();
    const root = applyOrganicLayout();
    state.workspaceViewport = null;
    render();
    focusCanvasOnContent(root);
    await persistAllNodePositions();
}

autoLayoutBtn.addEventListener("click", () => reorderMap().catch(reportEditorError));

function reportEditorError(error) {
    const message = error.message || "Operazione non riuscita. Riprova.";
    const errorBox = document.getElementById("editor-request-error");
    errorBox.textContent = message;
    errorBox.hidden = false;
    if (autosaveStatus) autosaveStatus.textContent = "Operazione non completata.";
}

function editorRequest(url, options = {}, format = "json") {
    const request = sendEditorRequest(url, options, format);
    activeEditorRequests.add(request);
    request.then(() => activeEditorRequests.delete(request), () => activeEditorRequests.delete(request));
    return request;
}

async function sendEditorRequest(url, options = {}, format = "json") {
    const requestKey = `${options.method || "GET"} ${url}`;
    try {
        const result = await globalThis.MindMapHttp.request(url, options, {
            format,
            messages: {
                403: "Non hai il permesso di completare questa operazione.",
                404: "La mappa o il nodo non è più disponibile.",
                409: "Questa immagine è già usata da un altro nodo. Scegli un’altra alternativa e riprova il salvataggio.",
                413: "Il contenuto inviato è troppo grande.",
                429: "Troppe richieste. Attendi qualche istante e riprova."
            }
        });
        failedEditorRequests.delete(requestKey);
        const errorBox = document.getElementById("editor-request-error");
        errorBox.hidden = failedEditorRequests.size === 0;
        errorBox.textContent = [...failedEditorRequests.values()].join(" ");
        return result;
    } catch (error) {
        failedEditorRequests.set(requestKey, error.message);
        reportEditorError(error);
        throw error;
    }
}

function saveMapBackground() {
    const color = state.map.backgroundColor || "#fafbfd";
    if (autosaveStatus) autosaveStatus.textContent = "Salvataggio in corso...";
    backgroundSavePromise = backgroundSavePromise.then(async () => {
        await editorRequest(`/api/maps/${state.map.id}/background`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ backgroundColor: color })
        });
        if (autosaveStatus) autosaveStatus.textContent = failedEditorRequests.size
        ? "Restano operazioni non completate. Controlla il messaggio di errore." : "Modifiche salvate.";
    }).catch(reportEditorError);
    return backgroundSavePromise;
}

mapBackgroundInput?.addEventListener("input", () => {
    if (!editingBackground) pushUndoSnapshot();
    editingBackground = true;
    state.map.backgroundColor = mapBackgroundInput.value;
    requestRender();
});
mapBackgroundInput?.addEventListener("change", () => {
    state.map.backgroundColor = mapBackgroundInput.value;
    editingBackground = false;
    saveMapBackground();
});

async function createNode(payload) {
    return editorRequest(`/api/maps/${state.map.id}/nodes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });
}

async function saveNode(node) {
    if (autosaveStatus) autosaveStatus.textContent = "Salvataggio in corso...";
    await editorRequest(`/api/nodes/${node.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(node)
    });
    if (autosaveStatus) autosaveStatus.textContent = failedEditorRequests.size
        ? "Restano operazioni non completate. Controlla il messaggio di errore." : state.pendingAutosaves.size || state.autosaveCount > 1
            ? "Altre modifiche in attesa di salvataggio..." : "Modifiche salvate.";
}

function queueAutoSubmitSelectedNode(field = null) {
    const node = getNodeById(state.selectedNodeId);
    if (!node) return;
    const now = performance.now();
    if (!field || !formEditGroup || formEditGroup.nodeId !== node.id || formEditGroup.field !== field || now - formEditGroup.time > 750) {
        pushUndoSnapshot();
    }
    formEditGroup = field ? { nodeId: node.id, field, time: now } : null;
    applyFormToNode(node);
    if (!hintInputs.includes(field)) requestRender();
    scheduleAutosave(node);
}

function scheduleAutosave(node) {
    if (autosaveStatus) autosaveStatus.textContent = "Modifiche non ancora salvate...";
    const previous = state.pendingAutosaves.get(node.id);
    if (previous) clearTimeout(previous.timer);
    const pending = { nodeId: node.id, timer: null };
    pending.timer = setTimeout(() => {
        if (state.pendingAutosaves.get(node.id) !== pending) return;
        const currentNode = getNodeById(pending.nodeId);
        if (currentNode) runAutosave(currentNode);
        else state.pendingAutosaves.delete(pending.nodeId);
    }, 500);
    state.pendingAutosaves.set(node.id, pending);
}

function runAutosave(node) {
    const pending = state.pendingAutosaves.get(node.id);
    if (pending) {
        clearTimeout(pending.timer);
        state.pendingAutosaves.delete(node.id);
    }
    const nodeSnapshot = structuredClone(node);
    state.autosaveCount++;
    const startFrom = state.autosavePromise ?? Promise.resolve();
    const queuedPromise = startFrom
        .catch(() => {})
        .then(() => saveNode(nodeSnapshot));

    const trackedPromise = queuedPromise.finally(() => {
        state.autosaveCount--;
        if (state.autosavePromise === trackedPromise) {
            state.autosavePromise = null;
        }
    });
    state.autosavePromise = trackedPromise;
    trackedPromise.catch(reportEditorError);

    return trackedPromise;
}

async function flushAutosave() {
    const saves = [];
    if (state.autosavePromise) saves.push(state.autosavePromise);
    for (const pending of [...state.pendingAutosaves.values()]) {
        const currentNode = getNodeById(pending.nodeId);
        if (currentNode) saves.push(runAutosave(currentNode));
        else {
            clearTimeout(pending.timer);
            state.pendingAutosaves.delete(pending.nodeId);
        }
    }
    await Promise.all(saves);
}

function hasFailedSaves() {
    return [...failedEditorRequests.keys()].some(key => /^(POST|PUT|DELETE) /.test(key) && !key.includes('/export/'));
}

function hasUnsavedChanges() {
    return editingBackground || state.pendingAutosaves.size > 0 || state.autosaveCount > 0
        || activeEditorRequests.size > 0 || state.isApplyingHistory || hasFailedSaves();
}

async function saveBeforeLeaving(proceed) {
    if (leavingEditor || state.isApplyingHistory) return;
    leavingEditor = true;
    const workspace = document.querySelector('.editor-page');
    const focused = document.activeElement;
    // Commit controls whose change event is dispatched on blur before locking the editor.
    focused?.blur();
    workspace.inert = true;
    showLoading('Sto salvando le ultime modifiche…');
    try {
        if (editingBackground) {
            editingBackground = false;
            saveMapBackground();
        }
        let saveError;
        do {
            const results = await Promise.allSettled([
                flushAutosave(), backgroundSavePromise, ...activeEditorRequests
            ]);
            const failed = results.find(result => result.status === 'rejected');
            if (failed && !saveError) saveError = failed.reason;
        } while (state.pendingAutosaves.size || state.autosaveCount || activeEditorRequests.size);
        if (saveError) throw saveError;
        // Background saves report errors without rejecting their queue promise.
        if (hasFailedSaves()) throw new Error('Ci sono modifiche non salvate. Controlla il messaggio di errore e riprova prima di continuare.');
        allowEditorUnload = true;
        proceed();
    } catch (error) {
        leavingEditor = false;
        allowEditorUnload = false;
        workspace.inert = false;
        hideLoading();
        reportEditorError(error);
        focused?.focus({ preventScroll: true });
    }
}

for (const form of document.querySelectorAll('.editor-page form')) {
    form.addEventListener('submit', event => {
        event.preventDefault();
        // The first submit already ran validation. Submit natively after saving:
        // requestSubmit can be ignored while the browser is still dispatching that event.
        saveBeforeLeaving(() => HTMLFormElement.prototype.submit.call(form));
    });
}

document.querySelector('.back-link')?.addEventListener('click', event => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const href = event.currentTarget.href;
    saveBeforeLeaving(() => location.assign(href));
});

globalThis.addEventListener('beforeunload', event => {
    if (allowEditorUnload || !hasUnsavedChanges()) return;
    // Closing/reloading cannot reliably await fetch; let the browser warn instead.
    event.preventDefault();
    event.returnValue = '';
});

globalThis.addEventListener('pageshow', () => {
    if (!leavingEditor) return;
    leavingEditor = false;
    allowEditorUnload = false;
    document.querySelector('.editor-page').inert = false;
    hideLoading();
});

async function fetchMap() {
    return editorRequest(`/api/maps/${state.map.id}`);
}

async function updateMapTitle(title) {
    return editorRequest(`/api/maps/${state.map.id}/title`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title })
    });
}

function refreshMapTitle() {
    const normalizedTitle = (state.map.title || "").trim() || "Nuova mappa";
    if (mapTitle) mapTitle.textContent = normalizedTitle;
    document.title = normalizedTitle;
}

async function renameMap() {
    const value = await openDialog({
        title: "Rinomina mappa",
        message: "Inserisci il nuovo titolo della mappa.",
        mode: "prompt",
        value: state.map.title || ""
    });
    if (value === null) return;
    const updatedMap = await updateMapTitle(value);
    state.map.title = updatedMap.title;
    refreshMapTitle();
}

function startImageUploadForNode(nodeId) {
    const node = getNodeById(nodeId);
    if (!node) return;
    state.pendingImageNodeId = nodeId;
    selectNode(nodeId, { showNodeOverlay: false });
    showImageEditorOverlay(node);
}

function buildChildrenMap(nodes) {
    const children = new Map();
    for (const node of nodes) {
        if (node.parentId == null) continue;
        if (!children.has(node.parentId)) children.set(node.parentId, []);
        children.get(node.parentId).push(node);
    }
    return children;
}

function applyOrganicLayout() {
    const nodes = state.map.nodes;
    const roots = nodes.filter(node => node.parentId == null)
        .sort((a, b) => String(a.id).localeCompare(String(b.id), undefined, { numeric: true }));
    if (!roots.length) return;
    const root = roots[0];
    const childrenMap = buildChildrenMap(nodes);
    const sizes = new Map(nodes.map(node => [node.id, getLayoutNodeSize(node)]));
    const weights = new Map();
    const padding = 16;
    const diameter = node => {
        const size = sizes.get(node.id);
        return Math.hypot(size.width, size.height) + padding;
    };
    const measure = node => {
        const children = childrenMap.get(node.id) || [];
        const weight = Math.max(diameter(node), children.reduce((sum, child) => sum + measure(child), 0));
        weights.set(node.id, weight);
        return weight;
    };
    roots.forEach(measure);

    // Extra roots occupy their own sectors alongside the main root's branches.
    const branches = [...(childrenMap.get(root.id) || []), ...roots.slice(1)];
    const placements = [{ node: root, depth: 0, angle: 0 }];
    const ringSizes = [diameter(root)];
    const ringRadii = [0];
    const placeBranches = (children, startAngle, span, depth) => {
        const totalWeight = children.reduce((sum, child) => sum + weights.get(child.id), 0);
        let cursor = startAngle;
        for (const child of children) {
            const childSpan = span * weights.get(child.id) / totalWeight;
            placements.push({ node: child, depth, angle: cursor + childSpan / 2 });
            ringSizes[depth] = Math.max(ringSizes[depth] || 0, diameter(child));
            // Reserve enough arc length even for large images and dense subtrees.
            ringRadii[depth] = Math.max(ringRadii[depth] || 0, diameter(child) / Math.min(childSpan, Math.PI));
            placeBranches(childrenMap.get(child.id) || [], cursor, childSpan, depth + 1);
            cursor += childSpan;
        }
    };
    placeBranches(branches, -Math.PI / 2, Math.PI * 2, 1);
    for (let depth = 1; depth < ringSizes.length; depth += 1) {
        ringRadii[depth] = Math.max(ringRadii[depth],
            ringRadii[depth - 1] + (ringSizes[depth - 1] + ringSizes[depth]) / 2);
    }

    // Expand radially to resolve collisions without moving the center or turning
    // outer nodes back towards their parents. Angles and level order stay fixed.
    let expansion = 1;
    for (let iteration = 0; iteration < 2; iteration += 1) {
        for (const { node, depth, angle } of placements) {
            const size = sizes.get(node.id);
            const radius = ringRadii[depth] * expansion;
            node.x = MAP_CENTER_X + Math.cos(angle) * radius - size.width / 2;
            node.y = MAP_CENTER_Y + Math.sin(angle) * radius - size.height / 2;
        }
        let requiredExpansion = 1;
        for (let i = 0; i < placements.length; i += 1) {
            for (let j = i + 1; j < placements.length; j += 1) {
                const first = placements[i].node;
                const second = placements[j].node;
                const firstSize = sizes.get(first.id);
                const secondSize = sizes.get(second.id);
                const dx = Math.abs(first.x + firstSize.width / 2 - second.x - secondSize.width / 2);
                const dy = Math.abs(first.y + firstSize.height / 2 - second.y - secondSize.height / 2);
                const scaleX = ((firstSize.width + secondSize.width) / 2 + padding) / Math.max(dx, 0.001);
                const scaleY = ((firstSize.height + secondSize.height) / 2 + padding) / Math.max(dy, 0.001);
                requiredExpansion = Math.max(requiredExpansion, Math.min(scaleX, scaleY));
            }
        }
        expansion *= requiredExpansion;
    }
    return root;
}

function getLayoutNodeSize(node) {
    if (renderNodeSizes?.has(node.id)) return renderNodeSizes.get(node.id);
    const inputs = [node.text, node.description, node.fontSize, node.imageUri,
        node.imageWidth, node.imageHeight, node.nodeWidth, node.nodeHeight];
    const cached = layoutSizeCache.get(node);
    const size = cached && sameRenderInputs(cached.inputs, inputs)
        ? cached.size
        : getNodeSize(node);
    if (size !== cached?.size) layoutSizeCache.set(node, { inputs, size });
    renderNodeSizes?.set(node.id, size);
    return size;
}

async function persistAllNodePositions() {
    for (const node of state.map.nodes) {
        await saveNode(node);
    }
}

async function addChildNode(parentId) {
    const preset = getCurrentStylePreset();
    const parent = getNodeById(parentId);
    if (!parent) return;
    pushUndoSnapshot();
    const node = await createNode({
        parentId: parent.id,
        text: "Nuovo nodo",
        description: "Breve descrizione del nodo.",
        emoji: null,
        branchText: null,
        x: parent.x + 220,
        y: parent.y + 90,
        color: preset.childColor,
        fontSize: 18,
        shape: preset.shape,
        branchColor: preset.branchColor,
        branchStyle: preset.branchStyle,
        branchWidth: preset.branchWidth,
        branchCurve: preset.branchCurve,
        imageUri: null,
        imageWidth: DEFAULT_IMAGE_SIZE,
        imageHeight: DEFAULT_IMAGE_SIZE,
        nodeWidth: BASE_NODE_WIDTH,
        nodeHeight: BASE_NODE_HEIGHT
    });
    state.map.nodes.push(node);
    selectNode(node.id, { showNodeOverlay: false });
    render();
}

async function applyStylePresetToMap(presetName) {
    const normalized = (presetName || "CLASSIC").toUpperCase();
    const preset = STYLE_PRESETS[normalized] || STYLE_PRESETS.CLASSIC;
    state.map.stylePreset = normalized;
    if (stylePresetInput) stylePresetInput.value = normalized;

    await flushAutosave();
    for (const node of state.map.nodes) {
        node.shape = preset.shape;
        node.branchColor = preset.branchColor;
        node.branchStyle = preset.branchStyle;
        node.branchWidth = preset.branchWidth;
        node.branchCurve = preset.branchCurve;
        node.color = node.parentId == null ? preset.rootColor : preset.childColor;
    }

    render();
    selectNode(state.selectedNodeId, { showNodeOverlay: false });
    await Promise.all(state.map.nodes.map(node => saveNode(node)));
}

if (globalThis.window) {
    globalThis.window.applyMapStylePreset = async presetName => {
        pushUndoSnapshot();
        await applyStylePresetToMap(presetName).catch(reportEditorError);
    };
}

async function deleteNodeWithChecks(nodeId) {
    const node = getNodeById(nodeId);
    if (!node) return;
    const rootCount = state.map.nodes.filter(n => n.parentId == null).length;
    if (node.parentId == null && rootCount === 1) {
        await openDialog({
            title: "Operazione non disponibile",
            message: "La mappa deve avere almeno un nodo principale.",
            mode: "alert"
        });
        return;
    }
    const shouldDelete = await openDialog({
        title: "Eliminare nodo",
        message: "Eliminare questo nodo e tutti i suoi rami collegati?",
        mode: "confirm"
    });
    if (!shouldDelete) return;
    pushUndoSnapshot();
    await flushAutosave();
    await editorRequest(`/api/nodes/${node.id}`, { method: "DELETE" }, "empty");
    state.map = await fetchMap();
    state.selectedNodeId = state.map.nodes[0]?.id ?? null;
    if (state.selectedNodeId) selectNode(state.selectedNodeId);
    render();
    if (nodeEditorOverlay) {
        nodeEditorOverlay.classList.add("visible");
        updateNodeEditorOverlay(node);
    }
}

async function quickEdit(nodeId) {
    selectNode(nodeId);
    textInput.focus();
    textInput.setSelectionRange(0, textInput.value.length);
}

async function quickEditBranchText(nodeId) {
    const node = getNodeById(nodeId);
    if (!node) return;
    const value = await openDialog({
        title: "Testo del ramo",
        message: "Inserisci il testo da mostrare sul collegamento.",
        mode: "prompt",
        value: node.branchText || ""
    });
    if (value === null) return;
    pushUndoSnapshot();
    node.branchText = sanitizePlainText(value.trim());
    selectNode(nodeId);
    render();
    await saveNode(node);
}

async function quickEditEmoji(nodeId) {
    const node = getNodeById(nodeId);
    if (!node) return;
    const value = await openDialog({
        title: "Emoji del nodo",
        message: "Inserisci una emoji da associare al nodo.",
        mode: "prompt",
        value: node.emoji || ""
    });
    if (value === null) return;
    pushUndoSnapshot();
    node.emoji = normalizeNodeEmoji(value);
    if (node.emoji) {
        node.imageUri = null;
        imageUrlInput.value = "";
        updateImagePreview("");
    }
    selectNode(nodeId);
    render();
    await saveNode(node);
}

function slugify(value) {
    return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") || "mappa";
}

function isInteractiveTarget(target) {
    return !!target?.closest?.('input, textarea, select, button, a, summary, [role="button"], [role="textbox"], [contenteditable]:not([contenteditable="false"])');
}

document.addEventListener("keydown", async event => {
    // Text fields keep native undo/redo; controls keep their normal keyboard behavior.
    if (leavingEditor || event.defaultPrevented || event.isComposing || event.altKey
        || appDialog?.open || isInteractiveTarget(event.target)
        || state.isApplyingHistory || state.drag || state.resize || state.pan) return;
    const isUndoShortcut = (event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === "z";
    const isRedoShortcut = ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y")
        || ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "z");

    if (isUndoShortcut) {
        event.preventDefault();
        clearInteractionSnapshot();
        undoChange();
        return;
    }

    if (isRedoShortcut) {
        event.preventDefault();
        clearInteractionSnapshot();
        redoChange();
        return;
    }

    if (!state.selectedNodeId) return;
    const node = getNodeById(state.selectedNodeId);
    if (!node) return;

    if (event.key === "Tab" && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        await addChildNode(node.id).catch(reportEditorError);
        return;
    }

    if ((event.key === "Delete" || event.key === "Backspace") && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        await deleteNodeWithChecks(node.id).catch(reportEditorError);
        return;
    }

    if (event.key === "Enter" && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        await quickEdit(node.id);
    }
});

state.map.stylePreset = getCurrentStylePresetName();
refreshMapTitle();
if (stylePresetInput) {
    stylePresetInput.value = state.map.stylePreset;
    const onPresetChange = async () => {
        pushUndoSnapshot();
        await applyStylePresetToMap(stylePresetInput.value).catch(reportEditorError);
    };
    stylePresetInput.addEventListener("change", onPresetChange);
    stylePresetInput.addEventListener("input", onPresetChange);
}
selectNode(null);
render();
if (autoLayoutOnOpen) {
    reorderMap().catch(error => {
        console.error("Impossibile salvare il riordino iniziale della mappa", error);
        reportEditorError(error);
    });
}
