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
    function create({state, snapshot, restore, waitForSaves, setBusy, onError, onEditBoundary}) {
        function pushUndoSnapshot() {
            onEditBoundary();
            if (state.isApplyingHistory) return;
            state.undoStack.push(snapshot());
            if (state.undoStack.length > 100) state.undoStack.shift();
            state.redoStack = [];
        }

        function beginInteractionSnapshot() {
            onEditBoundary();
            if (state.interactionSnapshot || state.isApplyingHistory) return;
            state.interactionSnapshot = snapshot();
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

        async function applyHistory(source, destination) {
            if (!source.length || state.isApplyingHistory || state.drag || state.resize || state.pan) return;
            state.isApplyingHistory = true;
            onEditBoundary();
            setBusy(true);
            try {
                await waitForSaves();
                const current = snapshot();
                // Clone: ID reconciliation must not mutate the snapshot being restored.
                const target = structuredClone(source[source.length - 1]);
                const ids = await restore(target);
                current.selectedNodeId = ids[current.selectedNodeId] ?? current.selectedNodeId;
                for (const node of current.map.nodes) {
                    node.id = ids[node.id] ?? node.id;
                    node.parentId = ids[node.parentId] ?? node.parentId;
                }
                source.pop();
                destination.push(current);
            } catch (error) {
                onError(error);
            } finally {
                state.isApplyingHistory = false;
                setBusy(false);
            }
        }

        function undoChange() {
            return applyHistory(state.undoStack, state.redoStack);
        }

        function redoChange() {
            return applyHistory(state.redoStack, state.undoStack);
        }
        return { pushUndoSnapshot, beginInteractionSnapshot, commitInteractionSnapshot, clearInteractionSnapshot, undoChange, redoChange };
    }
    globalThis.MindMapHistory = { create };
})();
