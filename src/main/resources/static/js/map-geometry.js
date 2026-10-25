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

// Shared map geometry: editor and public game keep identical node sizes and connectors.
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


function hasNodeImage(node) {
    return !!(node.imageUri && node.imageUri.trim());
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

function clampImageSize(value) {
    if (!Number.isFinite(value) || value <= 0) return DEFAULT_IMAGE_SIZE;
    return Math.min(MAX_IMAGE_SIZE, Math.max(MIN_IMAGE_SIZE, Math.round(value)));
}

function clampNodeWidth(value) {
    if (!Number.isFinite(value)) return BASE_NODE_WIDTH;
    return Math.min(MAX_NODE_WIDTH, Math.max(MIN_NODE_WIDTH, Math.round(value)));
}

function clampNodeHeight(value) {
    if (!Number.isFinite(value)) return BASE_NODE_HEIGHT;
    return Math.min(MAX_NODE_HEIGHT, Math.max(MIN_NODE_HEIGHT, Math.round(value)));
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

function getNodeImageBounds(node, nodeWidth) {
    const size = getNodeImageSize(node);
    return {
        x: node.x + (nodeWidth - size.width) / 2,
        y: node.y + 12,
        width: size.width,
        height: size.height
    };
}

function getNodeCornerRadius(node, depth, sketchPreset) {
    if (sketchPreset) return 16;
    if ((node.shape || "").toUpperCase() === "SQUARED") return 0;
    return depth === 0 ? 10 : 20;
}

function truncate(text, max) {
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
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
