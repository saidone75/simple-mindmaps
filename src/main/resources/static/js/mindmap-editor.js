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

const SVG_NS = "http://www.w3.org/2000/svg";
const BASE_NODE_WIDTH = 180;
const BASE_NODE_HEIGHT = 64;
const IMAGE_NODE_WIDTH = 220;
const IMAGE_NODE_HEIGHT = 110;
const DEFAULT_IMAGE_SIZE = 128;
const MIN_IMAGE_SIZE = 24;
const MAX_IMAGE_SIZE = 800;
const MIN_NODE_WIDTH = 120;
const MAX_NODE_WIDTH = 720;
const MIN_NODE_HEIGHT = 60;
const MAX_NODE_HEIGHT = 420;
const MAP_CENTER_X = 700;
const MAP_CENTER_Y = 450;
const BASE_CANVAS_WIDTH = 1400;
const BASE_CANVAS_HEIGHT = 900;
const CANVAS_PADDING = 180;
const INTERACTION_VIEWPORT_MAX_STEP = 4;
const MIN_ZOOM_PERCENT = 10;
const MAX_ZOOM_PERCENT = 200;
const DEFAULT_GRID_SIZE = 20;
const state = {
    map: structuredClone(initialMap),
    selectedNodeId: null,
    drag: null,
    resize: null,
    pan: null,
    interactionViewport: null,
    pendingImageNodeId: null,
    autosaveTimer: null,
    autosaveNodeId: null,
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

const svg = document.getElementById("mindmap-canvas");
const textInput = document.getElementById("node-text");
const descriptionInput = document.getElementById("node-description");
const colorInput = document.getElementById("node-color");
const branchColorInput = document.getElementById("branch-color");
const branchStyleInput = document.getElementById("branch-style");
const branchWidthInput = document.getElementById("branch-width");
const branchCurveInput = document.getElementById("branch-curve");
const fontSizeInput = document.getElementById("node-font-size");
const imageUrlInput = document.getElementById("node-image-url");
const imageUploadInput = document.getElementById("node-image-upload");
const imagePreview = document.getElementById("node-image-preview");
const imageWidthInput = document.getElementById("node-image-width");
const imageHeightInput = document.getElementById("node-image-height");
const imageWidthValue = document.getElementById("node-image-width-value");
const imageHeightValue = document.getElementById("node-image-height-value");
const autosaveStatus = document.getElementById("autosave-status");
const nodeEmojiInput = document.getElementById("node-emoji");
const branchTextInput = document.getElementById("branch-text");
const autoLayoutBtn = document.getElementById("auto-layout-btn");
const zoomInput = document.getElementById("zoom-control");
const zoomValue = document.getElementById("zoom-value");
const gridEnabledInput = document.getElementById("grid-enabled");
const gridSizeInput = document.getElementById("grid-size-control");
const stylePresetInput = document.getElementById("style-preset-control");
const canvasPanel = svg.closest(".canvas-panel");
const nodeEditorOverlay = document.getElementById("node-editor-overlay");
const imageEditorOverlay = document.getElementById("image-editor-overlay");
const appDialog = document.getElementById("app-dialog");
const appDialogTitle = document.getElementById("app-dialog-title");
const appDialogMessage = document.getElementById("app-dialog-message");
const appDialogInput = document.getElementById("app-dialog-input");
const appDialogCancel = document.getElementById("app-dialog-cancel");
const appDialogConfirm = document.getElementById("app-dialog-confirm");
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
    if (!nodeEditorOverlay || !canvasPanel || !node) return;
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
    updateImageEditorOverlay(node);
}

function hideImageEditorOverlay() {
    if (!imageEditorOverlay) return;
    state.imageOverlayNodeId = null;
    imageEditorOverlay.classList.remove("visible");
}

function updateImageEditorOverlay(node) {
    if (!imageEditorOverlay || !canvasPanel || !node) return;
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

function restoreEditorState(snapshot) {
    state.isApplyingHistory = true;
    state.map = structuredClone(snapshot.map);
    state.selectedNodeId = snapshot.selectedNodeId;
    state.isApplyingHistory = false;
    if (state.selectedNodeId) {
        selectNode(state.selectedNodeId);
    } else {
        render();
    }
}

function pushUndoSnapshot() {
    if (state.isApplyingHistory) return;
    state.undoStack.push(snapshotEditorState());
    if (state.undoStack.length > 100) state.undoStack.shift();
    state.redoStack = [];
}

function beginInteractionSnapshot() {
    if (state.interactionSnapshot || state.isApplyingHistory) return;
    state.interactionSnapshot = snapshotEditorState();
}

function commitInteractionSnapshot() {
    if (!state.interactionSnapshot || state.isApplyingHistory) return;
    state.undoStack.push(state.interactionSnapshot);
    if (state.undoStack.length > 100) state.undoStack.shift();
    state.redoStack = [];
    state.interactionSnapshot = null;
}

function clearInteractionSnapshot() {
    state.interactionSnapshot = null;
}

function openDialog({ title, message, mode = "alert", value = "" }) {
    if (!appDialog || !appDialogTitle || !appDialogMessage || !appDialogConfirm) {
        return Promise.resolve(mode === "alert" ? true : mode === "confirm" ? false : null);
    }
    return new Promise(resolve => {
        appDialogTitle.textContent = title || "Conferma";
        appDialogMessage.textContent = message || "";
        appDialogConfirm.textContent = mode === "alert" ? "Ok" : "Conferma";
        if (appDialogCancel) {
            appDialogCancel.classList.toggle("hidden", mode === "alert");
        }
        if (appDialogInput) {
            const showInput = mode === "prompt";
            appDialogInput.classList.toggle("hidden", !showInput);
            appDialogInput.value = showInput ? value : "";
        }
        if (typeof appDialog.showModal === "function") appDialog.showModal();
        else appDialog.setAttribute("open", "open");

        const close = result => {
            if (typeof appDialog.close === "function" && appDialog.open) appDialog.close();
            else appDialog.removeAttribute("open");
            appDialogConfirm.removeEventListener("click", onConfirm);
            appDialogCancel?.removeEventListener("click", onCancel);
            appDialog.removeEventListener("click", onOverlayClick);
            document.removeEventListener("keydown", onEscape);
            resolve(result);
        };

        const onConfirm = () => {
            if (mode === "prompt") close(appDialogInput?.value ?? "");
            else close(true);
        };
        const onCancel = () => close(mode === "prompt" ? null : false);
        const onOverlayClick = event => {
            if (event.target === appDialog) onCancel();
        };
        const onEscape = event => {
            if (event.key === "Escape") onCancel();
        };

        appDialogConfirm.addEventListener("click", onConfirm);
        appDialogCancel?.addEventListener("click", onCancel);
        appDialog.addEventListener("click", onOverlayClick);
        document.addEventListener("keydown", onEscape);
        if (mode === "prompt" && appDialogInput) {
            setTimeout(() => {
                appDialogInput.focus();
                appDialogInput.select();
            }, 0);
        } else {
            appDialogConfirm.focus();
        }
    });
}

function undoChange() {
    if (!state.undoStack.length) return;
    const current = snapshotEditorState();
    const previous = state.undoStack.pop();
    state.redoStack.push(current);
    restoreEditorState(previous);
}

function redoChange() {
    if (!state.redoStack.length) return;
    const current = snapshotEditorState();
    const next = state.redoStack.pop();
    state.undoStack.push(current);
    restoreEditorState(next);
}
function getNodeById(id) {
    return state.map.nodes.find(n => n.id === id);
}

function hasNodeImage(node) {
    return !!(node.imageUri && node.imageUri.trim());
}

function hasNodeEmoji(node) {
    return !!normalizeNodeEmoji(node.emoji);
}

function getNodeSize(node) {
    const imageSize = getNodeImageSize(node);
    const fontSize = Number(node.fontSize) || 18;
    const lineHeight = Math.max(16, Math.round(fontSize * 1.2));
    const lineCount = getNodeDisplayLines(node, hasNodeImage(node) ? 18 : 20).length;
    const textBlockHeight = lineCount * lineHeight;
    const baseSize = hasNodeImage(node)
        ? {
            width: Math.max(IMAGE_NODE_WIDTH, imageSize.width + 60),
            height: Math.max(IMAGE_NODE_HEIGHT, imageSize.height + textBlockHeight + 44)
        }
        : { width: BASE_NODE_WIDTH, height: Math.max(BASE_NODE_HEIGHT, textBlockHeight + 34) };
    const customWidth = clampNodeWidth(Number(node.nodeWidth));
    const customHeight = clampNodeHeight(Number(node.nodeHeight));
    return {
        width: Math.max(baseSize.width, customWidth),
        height: Math.max(baseSize.height, customHeight)
    };
}

function getNodeImageSize(node) {
    return {
        width: clampImageSize(Number(node.imageWidth) || DEFAULT_IMAGE_SIZE),
        height: clampImageSize(Number(node.imageHeight) || DEFAULT_IMAGE_SIZE),
    };
}

function isSketchPreset() {
    return false;
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

function getSketchNodeSize(node) {
    const lines = getNodeDisplayLines(node, 24);
    const longest = lines.reduce((max, line) => Math.max(max, (line.text || "").length), 0);
    const fontSize = Number(node.fontSize) || 18;
    const width = Math.max(120, (longest * (fontSize * 0.65)) + 36);
    const height = Math.max(56, (lines.length * (fontSize * 1.2)) + 28);
    return { width, height };
}


function getNodeColor(node) {
    const preset = getCurrentStylePreset();
    return node.color || (node.parentId == null ? preset.rootColor : preset.childColor);
}

function buildDepthMap(nodes) {
    const byId = new Map(nodes.map(node => [node.id, node]));
    const depthMap = new Map();
    const visiting = new Set();

    function resolveDepth(node) {
        if (depthMap.has(node.id)) return depthMap.get(node.id);
        if (node.parentId == null || !byId.has(node.parentId)) {
            depthMap.set(node.id, 0);
            return 0;
        }
        if (visiting.has(node.id)) {
            depthMap.set(node.id, 0);
            return 0;
        }
        visiting.add(node.id);
        const depth = resolveDepth(byId.get(node.parentId)) + 1;
        visiting.delete(node.id);
        depthMap.set(node.id, depth);
        return depth;
    }

    for (const node of nodes) {
        resolveDepth(node);
    }
    return depthMap;
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
    if (!state.gridEnabled) return;
    const gridGroup = document.createElementNS(SVG_NS, "g");
    gridGroup.setAttribute("class", "grid-layer");
    gridGroup.setAttribute("opacity", "0.28");
    const gridSize = Math.max(5, Number(state.gridSize) || DEFAULT_GRID_SIZE);
    const startX = Math.floor(viewport.x / gridSize) * gridSize;
    const startY = Math.floor(viewport.y / gridSize) * gridSize;
    const endX = viewport.x + viewport.width;
    const endY = viewport.y + viewport.height;

    for (let x = startX; x <= endX; x += gridSize) {
        const line = document.createElementNS(SVG_NS, "line");
        line.setAttribute("x1", String(x));
        line.setAttribute("y1", String(startY));
        line.setAttribute("x2", String(x));
        line.setAttribute("y2", String(endY));
        line.setAttribute("stroke", "#8fa0b5");
        line.setAttribute("stroke-width", x % (gridSize * 5) === 0 ? "0.9" : "0.45");
        gridGroup.appendChild(line);
    }
    for (let y = startY; y <= endY; y += gridSize) {
        const line = document.createElementNS(SVG_NS, "line");
        line.setAttribute("x1", String(startX));
        line.setAttribute("y1", String(y));
        line.setAttribute("x2", String(endX));
        line.setAttribute("y2", String(y));
        line.setAttribute("stroke", "#8fa0b5");
        line.setAttribute("stroke-width", y % (gridSize * 5) === 0 ? "0.9" : "0.45");
        gridGroup.appendChild(line);
    }
    svg.appendChild(gridGroup);
}

function applyBranchStyle(path, node, depth = 1) {
    const style = (node.branchStyle || "SOLID").toUpperCase();
    const strokeColor = node.branchColor || "#7c8a9a";

    path.style.stroke = strokeColor;
    path.setAttribute("stroke", strokeColor);
    const configuredWidth = Number(node.branchWidth);
    const depthWidth = Math.max(2, 6 - Math.min(depth, 4));
    const baseWidth = Number.isFinite(configuredWidth) && configuredWidth > 0 ? configuredWidth : depthWidth;
    path.style.strokeWidth = String(baseWidth);
    path.setAttribute("stroke-width", String(baseWidth));
    path.removeAttribute("stroke-dasharray");
    path.removeAttribute("marker-end");
    path.style.strokeLinecap = "round";
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("vector-effect", "non-scaling-stroke");
    path.setAttribute("fill", "none");

    switch (style) {
        case "DASHED":
            path.setAttribute("stroke-dasharray", "10 7");
            break;
        case "DOTTED":
            path.setAttribute("stroke-dasharray", "2 8");
            path.style.strokeLinecap = "round";
            break;
        default:
            break;
    }
}

function buildConnectorPath(node, x1, y1, x2, y2) {
    const curveType = (node.branchCurve || "CUBIC").toUpperCase();
    const dx = x2 - x1;
    const dy = y2 - y1;

    if (curveType === "QUADRATIC") {
        const cx = (x1 + x2) / 2;
        const cy = (y1 + y2) / 2;
        return `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
    }

    const distance = Math.hypot(dx, dy);
    const horizontalFactor = Math.min(0.52, Math.max(0.34, distance / 900));
    const direction = x2 >= x1 ? 1 : -1;
    const arcBend = Math.min(120, Math.max(28, distance * 0.16));

    const c1x = x1 + (dx * horizontalFactor);
    const c1y = y1 + (dy * 0.18) - (arcBend * direction);
    const c2x = x2 - (dx * horizontalFactor);
    const c2y = y2 - (dy * 0.18) - (arcBend * direction);
    return `M ${x1} ${y1} C ${c1x} ${c1y} ${c2x} ${c2y} ${x2} ${y2}`;
}

function renderConnectors(depthMap, sketchPreset) {
    for (const node of state.map.nodes) {
        if (node.parentId == null) continue;
        const parent = getNodeById(node.parentId);
        if (!parent) continue;

        const parentSize = sketchPreset ? getSketchNodeSize(parent) : getNodeSize(parent);
        const nodeSize = sketchPreset ? getSketchNodeSize(node) : getNodeSize(node);
        const x1 = parent.x + parentSize.width / 2;
        const y1 = parent.y + parentSize.height / 2;
        const x2 = node.x + nodeSize.width / 2;
        const y2 = node.y + nodeSize.height / 2;
        const depth = depthMap.get(node.id) || 1;
        const path = document.createElementNS(SVG_NS, "path");
        path.setAttribute("class", "connector");
        path.setAttribute("d", buildConnectorPath(node, x1, y1, x2, y2));
        applyBranchStyle(path, node, depth);
        if (sketchPreset) {
            path.classList.add("connector-sketch");
            path.removeAttribute("marker-end");
            const sketchStrokeWidth = String(Math.max(2.5, 5.5 - Math.min(depth, 3)));
            path.style.strokeWidth = sketchStrokeWidth;
            path.setAttribute("stroke-width", sketchStrokeWidth);
        }
        svg.appendChild(path);
        renderBranchLabel(node, (x1 + x2) / 2, (y1 + y2) / 2, x1, y1, x2, y2);
    }
}

function appendNodeText(group, node, width, height, sketchPreset, emojiValue) {
    const text = document.createElementNS(SVG_NS, "text");
    const lines = getNodeDisplayLines(node, sketchPreset ? 24 : (hasNodeImage(node) ? 18 : 20));
    const fontSize = Number(node.fontSize) || 18;
    const lineHeight = Math.max(16, Math.round(fontSize * 1.2));
    const firstLineY = hasNodeImage(node) && !sketchPreset
        ? node.y + height - 16 - ((lines.length - 1) * lineHeight)
        : emojiValue && !sketchPreset
            ? node.y + ((height - ((lines.length - 1) * lineHeight)) / 2) + 14
            : node.y + ((height - ((lines.length - 1) * lineHeight)) / 2);
    text.setAttribute("class", "node-text");
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
    group.addEventListener("mousedown", startDrag);
    group.addEventListener("click", () => selectNode(node.id));
    group.addEventListener("dblclick", () => quickEdit(node.id));
    group.addEventListener("mouseenter", () => {
        if (state.hoverHideTimer) {
            clearTimeout(state.hoverHideTimer);
            state.hoverHideTimer = null;
        }
        if (state.hoveredNodeId === node.id) return;
        state.hoveredNodeId = node.id;
        render();
    });
    group.addEventListener("mouseleave", () => {
        if (state.hoveredNodeId !== node.id) return;
        if (state.hoverHideTimer) clearTimeout(state.hoverHideTimer);
        state.hoverHideTimer = setTimeout(() => {
            state.hoveredNodeId = null;
            state.hoverHideTimer = null;
            render();
        }, 1800);
    });
    group.addEventListener("contextmenu", event => openContextMenu(event, node.id));
}

function createNodeGroupElement(node, sketchPreset) {
    const group = document.createElementNS(SVG_NS, "g");
    const selectedClass = node.id === state.selectedNodeId ? " selected" : "";
    group.setAttribute("class", `node-group${selectedClass}${sketchPreset ? " sketch-node" : ""}`);
    group.dataset.id = node.id;
    return group;
}

function getNodeCornerRadius(node, depth, sketchPreset) {
    if (sketchPreset) return 16;
    if ((node.shape || "").toUpperCase() === "SQUARED") return 0;
    return depth === 0 ? 10 : 20;
}

function appendNodeBackground(group, node, width, height, depth, sketchPreset) {
    const rect = document.createElementNS(SVG_NS, "rect");
    const radius = getNodeCornerRadius(node, depth, sketchPreset);
    rect.setAttribute("x", node.x);
    rect.setAttribute("y", node.y);
    rect.setAttribute("rx", radius);
    rect.setAttribute("ry", radius);
    rect.setAttribute("width", width);
    rect.setAttribute("height", height);
    rect.setAttribute("fill", sketchPreset ? "rgba(255,255,255,0.001)" : getNodeColor(node));
    rect.setAttribute("stroke", sketchPreset ? "transparent" : "#546170");
    rect.setAttribute("stroke-width", sketchPreset ? "0" : "1.5");
    group.appendChild(rect);
}

function appendNodeImageContent(group, node, width, sketchPreset) {
    if (sketchPreset || !hasNodeImage(node)) return;
    renderNodeImage(group, node, width);
    if (node.id === state.selectedNodeId) renderImageResizeHandle(group, node, width);
}

function appendNodeInteractionControls(group, node, width, height, sketchPreset) {
    if (sketchPreset) return;
    if (node.id === state.hoveredNodeId) renderNodeActionButtons(group, node, width);
    if (node.id === state.selectedNodeId || node.id === state.hoveredNodeId) {
        renderNodeResizeHandle(group, node, width, height);
    }
}

function appendNodeEmoji(group, node, width, emojiValue, sketchPreset) {
    if (!emojiValue || sketchPreset) return;

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

function appendSketchUnderline(group, node, width, height, depth, sketchPreset) {
    if (!sketchPreset) return;

    const underline = document.createElementNS(SVG_NS, "path");
    const underlineY = node.y + height - 10;
    const left = node.x + 10;
    const right = node.x + width - 10;
    const mid = (left + right) / 2;
    underline.setAttribute("d", `M ${left} ${underlineY} Q ${mid} ${underlineY + 8} ${right} ${underlineY}`);
    underline.setAttribute("stroke", node.branchColor || "#2f855a");
    underline.setAttribute("stroke-width", depth === 0 ? "3.8" : "2.6");
    underline.setAttribute("fill", "none");
    underline.setAttribute("stroke-linecap", "round");
    group.appendChild(underline);
}

function renderNodeGroup(node, depth, sketchPreset) {
    const { width, height } = sketchPreset ? getSketchNodeSize(node) : getNodeSize(node);
    const group = createNodeGroupElement(node, sketchPreset);
    const emojiValue = hasNodeImage(node) ? "" : normalizeNodeEmoji(node.emoji);

    appendNodeBackground(group, node, width, height, depth, sketchPreset);
    appendNodeImageContent(group, node, width, sketchPreset);
    appendNodeInteractionControls(group, node, width, height, sketchPreset);
    appendNodeEmoji(group, node, width, emojiValue, sketchPreset);
    appendNodeText(group, node, width, height, sketchPreset, emojiValue);
    appendSketchUnderline(group, node, width, height, depth, sketchPreset);

    bindNodeGroupEvents(group, node);
    svg.appendChild(group);
}

function render() {
    svg.innerHTML = "";
    renderConnectorDefs();
    renderGrid(getViewportForRender());
    const depthMap = buildDepthMap(state.map.nodes);
    const sketchPreset = isSketchPreset();
    renderConnectors(depthMap, sketchPreset);
    for (const node of state.map.nodes) renderNodeGroup(node, depthMap.get(node.id) || 0, sketchPreset);
    applyCanvasViewport();
    const selectedNode = getNodeById(state.selectedNodeId);
    if (selectedNode) {
        updateNodeEditorOverlay(selectedNode);
    }
    const imageOverlayNode = getNodeById(state.imageOverlayNodeId);
    if (imageOverlayNode) {
        updateImageEditorOverlay(imageOverlayNode);
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

        if (action === "add-child") await addChildNode(nodeId);
        if (action === "edit-text") await quickEdit(nodeId);
        if (action === "edit-branch") await quickEditBranchText(nodeId);
        if (action === "upload-image") startImageUploadForNode(nodeId);
        if (action === "delete") await deleteNodeWithChecks(nodeId);

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
        const nodeSize = isSketchPreset() ? getSketchNodeSize(node) : getNodeSize(node);
        minX = Math.min(minX, node.x);
        minY = Math.min(minY, node.y);
        maxX = Math.max(maxX, node.x + nodeSize.width);
        maxY = Math.max(maxY, node.y + nodeSize.height);
    }
    const viewportX = Math.floor(minX - CANVAS_PADDING);
    const viewportY = Math.floor(minY - CANVAS_PADDING);
    const width = Math.max(BASE_CANVAS_WIDTH, Math.ceil(maxX - minX + (CANVAS_PADDING * 2)));
    const height = Math.max(BASE_CANVAS_HEIGHT, Math.ceil(maxY - minY + (CANVAS_PADDING * 2)));

    return { x: viewportX, y: viewportY, width, height };
}

function applyCanvasViewport() {
    const zoomPercent = Number(zoomInput?.value) || 100;
    const clampedZoomPercent = Math.min(MAX_ZOOM_PERCENT, Math.max(MIN_ZOOM_PERCENT, zoomPercent));
    if (zoomInput && Number(zoomInput.value) !== clampedZoomPercent) {
        zoomInput.value = String(clampedZoomPercent);
    }
    const zoomFactor = clampedZoomPercent / 100;
    const viewport = getViewportForRender();
    const { x, y, width, height } = viewport;

    svg.setAttribute("viewBox", `${x} ${y} ${width} ${height}`);
    svg.setAttribute("width", String(Math.round(width * zoomFactor)));
    svg.setAttribute("height", String(Math.round(height * zoomFactor)));
    if (zoomValue) {
        zoomValue.textContent = `${clampedZoomPercent}%`;
    }
}

function moveTowards(current, target, maxDelta) {
    if (Math.abs(target - current) <= maxDelta) return target;
    return current + (target > current ? maxDelta : -maxDelta);
}

function getViewportForRender() {
    if (!state.interactionViewport) {
        return getCanvasBounds();
    }
    const target = getCanvasBounds();
    const current = state.interactionViewport;
    const currentRight = current.x + current.width;
    const currentBottom = current.y + current.height;
    const targetRight = target.x + target.width;
    const targetBottom = target.y + target.height;

    const nonShrinkingTarget = {
        x: Math.min(current.x, target.x),
        y: Math.min(current.y, target.y),
        width: Math.max(currentRight, targetRight) - Math.min(current.x, target.x),
        height: Math.max(currentBottom, targetBottom) - Math.min(current.y, target.y),
    };

    const smoothed = {
        x: moveTowards(current.x, nonShrinkingTarget.x, INTERACTION_VIEWPORT_MAX_STEP),
        y: moveTowards(current.y, nonShrinkingTarget.y, INTERACTION_VIEWPORT_MAX_STEP),
        width: moveTowards(current.width, nonShrinkingTarget.width, INTERACTION_VIEWPORT_MAX_STEP),
        height: moveTowards(current.height, nonShrinkingTarget.height, INTERACTION_VIEWPORT_MAX_STEP),
    };
    state.interactionViewport = smoothed;
    return smoothed;
}

function captureInteractionViewport() {
    if (state.interactionViewport) return;
    const viewBox = (svg.getAttribute("viewBox") || "").trim().split(/\s+/).map(Number);
    if (viewBox.length === 4 && viewBox.every(Number.isFinite)) {
        const [x, y, width, height] = viewBox;
        state.interactionViewport = { x, y, width, height };
        return;
    }
    state.interactionViewport = getCanvasBounds();
}


function focusCanvasOnContent(node) {
    if (!canvasPanel) return;
    const viewport = getViewportForRender();
    const size = node ? getLayoutNodeSize(node) : null;
    const point = svg.createSVGPoint();
    point.x = node ? node.x + size.width / 2 : viewport.x + viewport.width / 2;
    point.y = node ? node.y + size.height / 2 : viewport.y + viewport.height / 2;
    const matrix = svg.getScreenCTM();
    if (!matrix) return;
    const center = point.matrixTransform(matrix);
    const panelRect = canvasPanel.getBoundingClientRect();

    canvasPanel.scrollLeft += center.x - panelRect.left - canvasPanel.clientLeft - canvasPanel.clientWidth / 2;
    canvasPanel.scrollTop += center.y - panelRect.top - canvasPanel.clientTop - canvasPanel.clientHeight / 2;
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
    image.addEventListener("mousedown", event => {
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
    handle.addEventListener("mousedown", startImageResize);
    group.appendChild(handle);
}

function renderNodeActionButtons(group, node, nodeWidth) {
    const actions = [
        {
            key: "add-child",
            label: "➕",
            title: "Aggiungi nodo figlio",
            onClick: () => addChildNode(node.id)
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
            onClick: () => quickEditEmoji(node.id)
        },
        {
            key: "delete-node",
            label: "🗑️",
            title: "Elimina nodo",
            onClick: () => deleteNodeWithChecks(node.id)
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
        button.addEventListener("mousedown", event => {
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
    handle.addEventListener("mousedown", startNodeResize);
    group.appendChild(handle);
}

function renderBranchLabel(node, cx, cy, x1, y1, x2, y2) {
    const branchText = (node.branchText || "").trim();
    if (!branchText) return;
    const label = document.createElementNS(SVG_NS, "text");
    label.setAttribute("class", "branch-label");
    label.setAttribute("x", String(cx));
    label.setAttribute("y", String(cy - 6));
    label.setAttribute("text-anchor", "middle");
    label.textContent = truncate(branchText, 26);
    if (isSketchPreset()) {
        label.classList.add("branch-label-sketch");
    }
    const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
    label.setAttribute("transform", `rotate(${Math.max(-24, Math.min(24, angle))}, ${cx}, ${cy - 6})`);
    label.addEventListener("mousedown", event => event.stopPropagation());
    label.addEventListener("click", async event => {
        event.stopPropagation();
        await quickEditBranchText(node.id);
    });
    svg.appendChild(label);
}

function getNodeImageBounds(node, nodeWidth) {
    const size = getNodeImageSize(node);
    return {
        x: node.x + (nodeWidth - size.width) / 2,
        y: node.y + 12,
        width: size.width,
        height: size.height
    };
}

function truncate(text, max) {
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function normalizeNodeText(value) {
    const normalized = sanitizePlainText((value || "")
        .replaceAll(/\r\n/g, "\n")
        .replaceAll(/\u00a0/g, " ")
        .trim());
    return normalized.length ? normalized : "Nodo";
}

function sanitizePlainText(value) {
    return (value || "")
        .replace(/[<>]/g, "")
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
}

function getNodeDisplayLines(node, maxLineLength) {
    const title = normalizeNodeText(node.text || "Nodo");
    const description = normalizeNodeText(node.description || "");
    const titleLines = wrapTextByWords(title, maxLineLength).map(line => ({ text: line, isDescription: false }));
    const descriptionLines = description
        ? wrapTextByWords(description, Math.max(12, maxLineLength + 6))
            .map(line => ({ text: line, isDescription: true }))
        : [];
    return [...titleLines, ...descriptionLines];
}

function wrapTextByWords(value, maxLineLength) {
    const words = (value || "").split(/\s+/).filter(Boolean);
    if (!words.length) return [" "];
    const lines = [];
    let current = words[0];
    for (let i = 1; i < words.length; i++) {
        const candidate = `${current} ${words[i]}`;
        if (candidate.length <= maxLineLength) {
            current = candidate;
        } else {
            lines.push(current);
            current = words[i];
        }
    }
    lines.push(current);
    return lines;
}

function normalizeNodeEmoji(value) {
    const emoji = (value || "").trim();
    return emoji.length ? [...emoji].slice(0, 2).join("") : "";
}

function selectNode(nodeId, options = {}) {
    const showNodeOverlay = options.showNodeOverlay !== false;
    state.selectedNodeId = nodeId;
    const node = getNodeById(nodeId);
    if (!node) return;
    textInput.value = node.text || "";
    descriptionInput.value = node.description || "";
    if (nodeEmojiInput) nodeEmojiInput.value = node.emoji || "";
    branchTextInput.value = node.branchText || "";
    colorInput.value = getNodeColor(node);
    branchColorInput.value = node.branchColor || "#7c8a9a";
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

function startDrag(event) {
    if (state.resize) return;
    event.stopPropagation();
    const nodeId = Number(event.currentTarget.dataset.id);
    beginInteractionSnapshot();
    selectNode(nodeId, { showNodeOverlay: false });
    const node = getNodeById(nodeId);
    if (!node) return;

    const point = toSvgPoint(event);
    captureInteractionViewport();
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
    event.stopPropagation();
    event.preventDefault();
    const nodeId = Number(event.currentTarget.dataset.nodeId);
    const node = getNodeById(nodeId);
    if (!node) return;

    beginInteractionSnapshot();
    selectNode(nodeId, { showNodeOverlay: false });
    const nodeSize = getNodeSize(node);
    const bounds = getNodeImageBounds(node, nodeSize.width);
    const point = toSvgPoint(event);
    captureInteractionViewport();
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
    event.stopPropagation();
    event.preventDefault();
    const nodeId = Number(event.currentTarget.dataset.nodeId);
    const node = getNodeById(nodeId);
    if (!node) return;

    beginInteractionSnapshot();
    selectNode(nodeId, { showNodeOverlay: false });
    const size = getNodeSize(node);
    const point = toSvgPoint(event);
    captureInteractionViewport();
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
    if (!canvasPanel || event.button !== 0) return;
    if (state.drag || state.resize) return;
    if (event.target.closest(".node-group") || event.target.closest(".node-action-button") || event.target.closest(".node-resize-handle") || event.target.closest(".image-resize-handle")) return;
    state.pan = {
        startClientX: event.clientX,
        startClientY: event.clientY,
        startScrollLeft: canvasPanel.scrollLeft,
        startScrollTop: canvasPanel.scrollTop,
    };
    svg.classList.add("is-panning");
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

document.addEventListener("mousemove", event => {
    if (!state.drag) return;
    const node = getNodeById(state.drag.nodeId);
    if (!node) return;
    const moved = Math.hypot(event.clientX - state.drag.startClientX, event.clientY - state.drag.startClientY);
    if (moved > 3) {
        state.drag.moved = true;
    }
    if (!state.drag.overlayHidden && state.drag.moved) {
        hideNodeEditorOverlay();
        state.drag.overlayHidden = true;
    }
    const point = toSvgPoint(event);
    node.x = snapToGrid(Math.round(point.x - state.drag.offsetX));
    node.y = snapToGrid(Math.round(point.y - state.drag.offsetY));
    render();
    scheduleAutosave(node);
});

document.addEventListener("mousemove", event => {
    if (!state.pan || !canvasPanel) return;
    const dx = event.clientX - state.pan.startClientX;
    const dy = event.clientY - state.pan.startClientY;
    canvasPanel.scrollLeft = state.pan.startScrollLeft - dx;
    canvasPanel.scrollTop = state.pan.startScrollTop - dy;
});

document.addEventListener("mousemove", event => {
    if (!state.resize) return;
    const node = getNodeById(state.resize.nodeId);
    if (!node) return;
    const point = toSvgPoint(event);
    if (state.resize.mode === "node") {
        const intrinsic = getIntrinsicNodeSize(node);
        node.nodeWidth = clampNodeWidth(snapToGrid(point.x - state.resize.startX + state.resize.pointerOffsetX));
        node.nodeHeight = clampNodeHeight(snapToGrid(point.y - state.resize.startY + state.resize.pointerOffsetY));
        node.nodeWidth = Math.max(node.nodeWidth, intrinsic.width);
        node.nodeHeight = Math.max(node.nodeHeight, intrinsic.height);
    } else {
        node.imageWidth = clampImageSize(snapToGrid(point.x - state.resize.anchorX + state.resize.pointerOffsetX));
        node.imageHeight = clampImageSize(snapToGrid(point.y - state.resize.anchorY + state.resize.pointerOffsetY));
        if (imageWidthInput) imageWidthInput.value = node.imageWidth;
        if (imageHeightInput) imageHeightInput.value = node.imageHeight;
        updateImageSizeLabels();
    }
    render();
    scheduleAutosave(node);
});

function shouldHideNodeEditorAfterMouseup(wasDragging, dragMoved, justOpenedContextMenu) {
    return (wasDragging && dragMoved) || justOpenedContextMenu;
}

function resetPointerInteractionState() {
    state.drag = null;
    state.resize = null;
    state.pan = null;
    state.interactionViewport = null;
    svg.classList.remove("is-panning");
    applyCanvasViewport();
}

function refreshOverlaysAfterMouseup(wasDragging, dragMoved) {
    const selectedNode = getNodeById(state.selectedNodeId);
    const justOpenedContextMenu = state.contextMenu && (Date.now() - state.contextMenu.openedAt) < 250;
    if (selectedNode) {
        if (shouldHideNodeEditorAfterMouseup(wasDragging, dragMoved, justOpenedContextMenu)) {
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
    clearTimeout(state.autosaveTimer);
    state.autosaveTimer = null;
    state.autosaveNodeId = null;
    runAutosave(resizedNode);
}

document.addEventListener("mouseup", () => {
    const wasDragging = !!state.drag;
    const dragMoved = !!state.drag?.moved;
    const resizeState = state.resize ? { ...state.resize } : null;

    if (state.drag || state.resize) commitInteractionSnapshot();

    resetPointerInteractionState();
    refreshOverlaysAfterMouseup(wasDragging, dragMoved);
    flushResizeAutosave(resizeState);
});

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

const autosubmitFields = [textInput, descriptionInput, nodeEmojiInput, branchTextInput, colorInput, branchColorInput, branchStyleInput, branchWidthInput, branchCurveInput, fontSizeInput, imageUrlInput].filter(Boolean);
const instantAutosubmitFields = new Set([textInput, imageUrlInput, branchColorInput, branchWidthInput, fontSizeInput]);
for (const field of autosubmitFields) {
    const eventName = instantAutosubmitFields.has(field) ? "input" : "change";
    field.addEventListener(eventName, () => queueAutoSubmitSelectedNode());
}
if (imageWidthInput) imageWidthInput.addEventListener("change", () => queueAutoSubmitSelectedNode());
if (imageHeightInput) imageHeightInput.addEventListener("change", () => queueAutoSubmitSelectedNode());
function updateImagePreview(uri) {
    if (uri) {
        imagePreview.src = uri;
        imagePreview.style.display = "block";
    } else {
        imagePreview.removeAttribute("src");
        imagePreview.style.display = "none";
    }
}

function applyFormToNode(node) {
    node.text = normalizeNodeText(textInput.value);
    node.description = normalizeNodeText(descriptionInput.value || "").slice(0, 280);
    node.emoji = normalizeNodeEmoji(nodeEmojiInput?.value || "");
    node.branchText = (branchTextInput.value || "").trim();
    node.color = colorInput.value;
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

function clampImageSize(value) {
    if (!Number.isFinite(value) || value <= 0) return DEFAULT_IMAGE_SIZE;
    return Math.min(MAX_IMAGE_SIZE, Math.max(MIN_IMAGE_SIZE, Math.round(value)));
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

function clampNodeWidth(value) {
    if (!Number.isFinite(value)) return BASE_NODE_WIDTH;
    return Math.min(MAX_NODE_WIDTH, Math.max(MIN_NODE_WIDTH, Math.round(value)));
}

function clampNodeHeight(value) {
    if (!Number.isFinite(value)) return BASE_NODE_HEIGHT;
    return Math.min(MAX_NODE_HEIGHT, Math.max(MIN_NODE_HEIGHT, Math.round(value)));
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
    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ svg: svgMarkup })
    });
    if (!response.ok) {
        throw new Error(`Export fallito (${response.status})`);
    }
    const blob = await response.blob();
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
    const clone = svg.cloneNode(true);
    const viewBox = (svg.getAttribute("viewBox") || "0 0 1400 900").split(/\s+/).map(Number);
    const width = Number.isFinite(viewBox[2]) ? viewBox[2] : 1400;
    const height = Number.isFinite(viewBox[3]) ? viewBox[3] : 900;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
    clone.setAttribute("width", String(width));
    clone.setAttribute("height", String(height));
    clone.setAttribute("viewBox", svg.getAttribute("viewBox") || `0 0 ${width} ${height}`);

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
        await exportCanvas("png");
    });
}
if (exportPdfButton) {
    exportPdfButton.addEventListener("click", async () => {
        await exportCanvas("pdf");
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
    renameMapBtn.addEventListener("click", () => renameMap());
}

if (canvasPanel) {
    svg.addEventListener("mousedown", startCanvasPan);

    canvasPanel.addEventListener("scroll", () => {
        const selectedNode = getNodeById(state.selectedNodeId);
        if (selectedNode) updateNodeEditorOverlay(selectedNode);
        const imageOverlayNode = getNodeById(state.imageOverlayNodeId);
        if (imageOverlayNode) updateImageEditorOverlay(imageOverlayNode);
    });

    globalThis.addEventListener("wheel", event => {
        const rect = canvasPanel.getBoundingClientRect();
        const isInsideCanvasByPointer = event.clientX >= rect.left && event.clientX <= rect.right
            && event.clientY >= rect.top && event.clientY <= rect.bottom;
        if (!isInsideCanvasByPointer) return;
        handleCanvasWheelZoom(event);
    }, { passive: false, capture: true });
}

autoLayoutBtn.addEventListener("click", async () => {
    pushUndoSnapshot();
    const root = applyOrganicLayout();
    render();
    focusCanvasOnContent(root);
    await persistAllNodePositions();
});

async function createNode(payload) {
    const response = await fetch(`/api/maps/${state.map.id}/nodes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });
    return response.json();
}

async function saveNode(node) {
    if (autosaveStatus) autosaveStatus.textContent = "Salvataggio in corso...";
    await fetch(`/api/nodes/${node.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(node)
    });
    if (autosaveStatus) autosaveStatus.textContent = "Modifiche salvate.";
}

function queueAutoSubmitSelectedNode() {
    const node = getNodeById(state.selectedNodeId);
    if (!node) return;
    pushUndoSnapshot();
    applyFormToNode(node);
    render();
    scheduleAutosave(node);
}

function scheduleAutosave(node) {
    if (autosaveStatus) autosaveStatus.textContent = "Modifiche non ancora salvate...";
    clearTimeout(state.autosaveTimer);
    state.autosaveNodeId = node.id;
    state.autosaveTimer = setTimeout(() => {
        const pendingNode = getNodeById(state.autosaveNodeId);
        state.autosaveTimer = null;
        state.autosaveNodeId = null;
        if (pendingNode) runAutosave(pendingNode);
    }, 500);
}

function runAutosave(node) {
    const nodeSnapshot = structuredClone(node);
    const startFrom = state.autosavePromise ?? Promise.resolve();
    const queuedPromise = startFrom
        .catch(() => {})
        .then(() => saveNode(nodeSnapshot));

    const trackedPromise = queuedPromise.finally(() => {
        if (state.autosavePromise === trackedPromise) {
            state.autosavePromise = null;
        }
    });
    state.autosavePromise = trackedPromise;

    return trackedPromise;
}


async function flushAutosave() {
    if (state.autosaveTimer && state.autosaveNodeId != null) {
        clearTimeout(state.autosaveTimer);
        const pendingNode = getNodeById(state.autosaveNodeId);
        state.autosaveTimer = null;
        state.autosaveNodeId = null;
        if (pendingNode) {
            await runAutosave(pendingNode);
        }
    }
    if (state.autosavePromise) {
        await state.autosavePromise;
    }
}

async function fetchMap() {
    const response = await fetch(`/api/maps/${state.map.id}`);
    return response.json();
}

async function updateMapTitle(title) {
    const response = await fetch(`/api/maps/${state.map.id}/title`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title })
    });
    return response.json();
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

function getSubtreeWeight(nodeId, childrenMap) {
    const children = childrenMap.get(nodeId) || [];
    if (!children.length) return 1;
    return children.reduce((sum, child) => sum + getSubtreeWeight(child.id, childrenMap), 0);
}

function applyOrganicLayout() {
    const nodes = state.map.nodes;
    if (!nodes.length) return;
    const roots = nodes
        .filter(node => node.parentId == null)
        .sort((a, b) => String(a.id).localeCompare(String(b.id), undefined, { numeric: true }));
    if (!roots.length) return;
    const childrenMap = buildChildrenMap(nodes);

    const placeChildren = (node, startAngle, endAngle, depth) => {
        const children = childrenMap.get(node.id) || [];
        if (!children.length) return;
        const totalWeight = children.reduce((sum, child) => sum + getSubtreeWeight(child.id, childrenMap), 0);
        let cursor = startAngle;
        const radius = 150 + (depth * 145);

        for (const child of children) {
            const share = getSubtreeWeight(child.id, childrenMap) / Math.max(totalWeight, 1);
            const span = (endAngle - startAngle) * share;
            const angle = cursor + span / 2;
            const size = getLayoutNodeSize(child);
            const jitter = isSketchPreset() ? (Math.sin(child.id * 11.13) * 12) : 0;
            child.x = Math.round(MAP_CENTER_X + (Math.cos(angle) * radius) + jitter - (size.width / 2));
            child.y = Math.round(MAP_CENTER_Y + (Math.sin(angle) * radius) + jitter - (size.height / 2));
            placeChildren(child, cursor + 0.06, cursor + span - 0.06, depth + 1);
            cursor += span;
        }
    };

    if (roots.length === 1) {
        const root = roots[0];
        const rootSize = getLayoutNodeSize(root);
        root.x = Math.round(MAP_CENTER_X - rootSize.width / 2);
        root.y = Math.round(MAP_CENTER_Y - rootSize.height / 2);
        placeChildren(root, -Math.PI + 0.2, Math.PI - 0.2, 1);
        resolveNodeOverlaps(nodes, root);
        return root;
    }

    const [centerRoot, ...otherRoots] = roots;
    const centerRootSize = getLayoutNodeSize(centerRoot);
    centerRoot.x = Math.round(MAP_CENTER_X - centerRootSize.width / 2);
    centerRoot.y = Math.round(MAP_CENTER_Y - centerRootSize.height / 2);
    placeChildren(centerRoot, -Math.PI + 0.2, Math.PI - 0.2, 1);

    if (otherRoots.length) {
        const step = (Math.PI * 2) / otherRoots.length;
        otherRoots.forEach((root, index) => {
            const angle = (index * step) - Math.PI / 2;
            const rootSize = getLayoutNodeSize(root);
            root.x = Math.round(MAP_CENTER_X + (Math.cos(angle) * 280) - rootSize.width / 2);
            root.y = Math.round(MAP_CENTER_Y + (Math.sin(angle) * 280) - rootSize.height / 2);
            placeChildren(root, angle - step / 2, angle + step / 2, 1);
        });
    }

    resolveNodeOverlaps(nodes, centerRoot);
    return centerRoot;
}

function getLayoutNodeSize(node) {
    return isSketchPreset() ? getSketchNodeSize(node) : getNodeSize(node);
}

function resolveNodeOverlaps(nodes, fixedNode) {
    const padding = 28;
    for (let iteration = 0; iteration < 240; iteration += 1) {
        if (!resolveOverlapIteration(nodes, padding, fixedNode)) break;
    }
}

function resolveOverlapIteration(nodes, padding, fixedNode) {
    let moved = false;
    for (let i = 0; i < nodes.length; i += 1) {
        for (let j = i + 1; j < nodes.length; j += 1) {
            moved = resolveNodePairOverlap(nodes[i], nodes[j], padding, fixedNode) || moved;
        }
    }
    return moved;
}

function resolveNodePairOverlap(first, second, padding, fixedNode) {
    const firstBox = getNodeLayoutBox(first);
    const secondBox = getNodeLayoutBox(second);
    const overlap = getNodeBoxOverlap(firstBox, secondBox, padding);
    if (!overlap) return false;

    const shift = getOverlapShift(first, second, firstBox, secondBox, overlap);
    applyOverlapShift(first, second, shift, fixedNode);
    return true;
}

function getNodeLayoutBox(node) {
    const size = getLayoutNodeSize(node);
    return {
        centerX: node.x + (size.width / 2),
        centerY: node.y + (size.height / 2),
        height: size.height,
        width: size.width
    };
}

function getNodeBoxOverlap(firstBox, secondBox, padding) {
    const overlapX = ((firstBox.width + secondBox.width) / 2) + padding - Math.abs(firstBox.centerX - secondBox.centerX);
    const overlapY = ((firstBox.height + secondBox.height) / 2) + padding - Math.abs(firstBox.centerY - secondBox.centerY);
    return overlapX > 0 && overlapY > 0 ? { x: overlapX, y: overlapY } : null;
}

function getOverlapShift(first, second, firstBox, secondBox, overlap) {
    return {
        x: getAxisOverlapShift(overlap.x, secondBox.centerX - firstBox.centerX, getOverlapFallback(first, second, 37, 19)),
        y: getAxisOverlapShift(overlap.y, secondBox.centerY - firstBox.centerY, getOverlapFallback(first, second, 13, 17))
    };
}

function getOverlapFallback(first, second, firstMultiplier, secondMultiplier) {
    return ((first.id * firstMultiplier + second.id * secondMultiplier) % 2 === 0) ? 1 : -1;
}

function getAxisOverlapShift(overlap, delta, fallback) {
    const direction = Math.abs(delta) < 0.001 ? fallback : Math.sign(delta);
    return Math.max(1, Math.ceil(overlap / 2)) * direction;
}

function applyOverlapShift(first, second, shift, fixedNode) {
    const firstFactor = first === fixedNode ? 0 : second === fixedNode ? 2 : 1;
    const secondFactor = second === fixedNode ? 0 : first === fixedNode ? 2 : 1;
    first.x -= shift.x * firstFactor;
    second.x += shift.x * secondFactor;
    first.y -= shift.y * firstFactor;
    second.y += shift.y * secondFactor;
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
        await applyStylePresetToMap(presetName);
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
    await fetch(`/api/nodes/${node.id}`, { method: "DELETE" });
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

function isTypingTarget(target) {
    if (!target) return false;
    const tag = target.tagName?.toLowerCase();
    return tag === "input" || tag === "textarea" || target.isContentEditable;
}

document.addEventListener("keydown", async event => {
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

    if (isTypingTarget(event.target)) return;
    if (!state.selectedNodeId) return;
    const node = getNodeById(state.selectedNodeId);
    if (!node) return;

    if (event.key === "Tab" && !event.shiftKey) {
        event.preventDefault();
        await addChildNode(node.id);
        return;
    }

    if ((event.key === "Delete" || event.key === "Backspace") && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        await deleteNodeWithChecks(node.id);
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
        await applyStylePresetToMap(stylePresetInput.value);
    };
    stylePresetInput.addEventListener("change", onPresetChange);
    stylePresetInput.addEventListener("input", onPresetChange);
}
selectNode(state.map.nodes[0]?.id ?? null);
render();
