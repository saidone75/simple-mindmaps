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
    const appDialog = document.getElementById("app-dialog");
    const appDialogTitle = document.getElementById("app-dialog-title");
    const appDialogMessage = document.getElementById("app-dialog-message");
    const appDialogInput = document.getElementById("app-dialog-input");
    const appDialogCancel = document.getElementById("app-dialog-cancel");
    const appDialogConfirm = document.getElementById("app-dialog-confirm");

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

    globalThis.MindMapDialogs = { open: openDialog };
})();
