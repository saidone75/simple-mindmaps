/*
 * Alice's Simple Quiz Maker / Alice's Simple Mind Maps
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

// Shared verbatim by quizmaker-springboot and simple-mindmap: keep both copies in sync.
globalThis.createGameSounds = function createGameSounds({ button: soundButton, storageKey = 'game-sound' } = {}) {
    let context, enabled = true;
    const voices = new Set();
    const fanfares = [
        { id: 'trionfo', name: 'Trionfo', beat: .125, melody: [
            [72, 1], [72, 1], [79, 2], [76, 1], [79, 1], [84, 3],
            [83, 1], [81, 1], [79, 1], [81, 2], [77, 2],
            [79, 1], [81, 1], [83, 1], [86, 1], [84, 7]
        ] },
        { id: 'incanto', name: 'Incanto', beat: .115, melody: [
            [76, 1], [79, 1], [84, 2], [79, 1], [84, 1], [88, 3],
            [89, 1], [88, 1], [84, 1], [81, 2], [84, 2],
            [83, 1], [86, 1], [79, 1], [83, 1], [84, 7]
        ] },
        { id: 'fantasia', name: 'Fantasia', beat: .115, melody: [
            [67, 1], [72, 1], [76, 1], [79, 2], [76, 1], [72, 3],
            [77, 2], [81, 1], [84, 1], [81, 1], [77, 2],
            [79, 2], [83, 1], [86, 1], [79, 1], [84, 7]
        ] }
    ];
    let nextFanfare = Math.floor(Math.random() * fanfares.length);
    try { if (storageKey) enabled = localStorage.getItem(storageKey) !== 'off'; } catch { /* The optional sound preference must not prevent playback. */ }
    function refreshButton() {
        if (!soundButton) return;
        soundButton.textContent = enabled ? '🔊 Suoni attivi' : '🔇 Suoni spenti';
        soundButton.setAttribute('aria-pressed', String(enabled));
    }
    function stop() {
        for (const voice of voices) {
            try { voice.stop(); }
            catch (error) { console.warn('Impossibile interrompere un suono', error); }
        }
        voices.clear();
    }
    function unlock() {
        if (!enabled) return;
        try {
            const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
            if (!AudioContext) return;
            context ||= new AudioContext();
            if (context.state === 'suspended') context.resume().catch(error => console.warn('Audio non attivato dal browser', error));
        } catch (error) {
            console.warn('Audio non disponibile: il gioco può continuare senza suoni', error);
        }
    }
    function note(frequency, offset, duration, type = 'triangle', endFrequency = frequency, volume = .09) {
        const voice = context.createOscillator();
        const envelope = context.createGain();
        const time = context.currentTime + offset;
        voice.type = type;
        voice.frequency.setValueAtTime(frequency, time);
        voice.frequency.exponentialRampToValueAtTime(endFrequency, time + duration);
        envelope.gain.setValueAtTime(0, time);
        envelope.gain.linearRampToValueAtTime(volume, time + (type === 'square' ? .002 : .008));
        if (type === 'square') envelope.gain.setValueAtTime(volume * .8, time + duration - .015);
        envelope.gain.exponentialRampToValueAtTime(.001, time + duration);
        voice.connect(envelope);
        envelope.connect(context.destination);
        voices.add(voice);
        voice.onended = () => { voices.delete(voice); voice.disconnect(); envelope.disconnect(); };
        voice.start(time);
        voice.stop(time + duration + .02);
    }
    function playCompletionFanfare({ beat, melody }) {
        // Original three-voice arcade fanfares with sustained pulse notes.
        const frequency = midi => 440 * 2 ** ((midi - 69) / 12);
        let offset = .12;
        for (const [pitch, beats] of melody) {
            const hz = frequency(pitch);
            note(hz, offset, beats * beat * .8, 'square', hz, .028);
            offset += beats * beat;
        }
        const cadence = offset - 7 * beat;
        for (let step = 0; .12 + step * beat < cadence - .001; step++) {
            let chord = [55, 67, 71];
            if (step < 9) chord = [48, 64, 67];
            else if (step < 15) chord = [53, 65, 69];
            const bass = frequency(step % 2 ? chord[0] + 12 : chord[0]);
            note(bass, .12 + step * beat, beat * .65, 'square', bass, .012);
            const harmony = frequency(chord[1 + step % 2]);
            note(harmony, .12 + step * beat, beat * .7, 'square', harmony, .014);
        }
        for (const pitch of [48, 64, 67]) {
            const hz = frequency(pitch);
            note(hz, cadence, 7 * beat * .8, 'square', hz, .016);
        }
    }
    function play(kind, fanfareId) {
        if (!enabled || context?.state !== 'running') return;
        try {
            stop();
            if (kind !== 'error') {
                note(1300, 0, .065, 'triangle', 320);
                note(600, .015, .045, 'sine', 220);
            }
            if (kind === 'error') {
                note(330, 0, .13, 'sine', 280);
                note(280, .14, .18, 'sine', 240);
            } else if (kind === 'level') {
                note(523.25, .12, .14);
                note(659.25, .25, .14);
                for (const frequency of [523.25, 659.25, 783.99]) note(frequency, .39, .65);
            } else if (kind === 'complete') {
                const selected = fanfares.find(fanfare => fanfare.id === fanfareId) || fanfares[nextFanfare];
                playCompletionFanfare(selected);
                nextFanfare = (fanfares.indexOf(selected) + 1) % fanfares.length;
            }
        } catch (error) {
            console.warn('Impossibile riprodurre il suono: il feedback visivo resta disponibile', error);
            stop();
        }
    }
    if (soundButton) soundButton.addEventListener('click', () => {
        enabled = !enabled;
        stop();
        refreshButton();
        try { if (storageKey) localStorage.setItem(storageKey, enabled ? 'on' : 'off'); } catch { /* Sound preferences are optional when storage is unavailable. */ }
        unlock();
    });
    refreshButton();
    return {unlock, play, stop, fanfares: fanfares.map(({ id, name }) => ({ id, name }))};
};
