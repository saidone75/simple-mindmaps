# TODO

1. [ ] Verificare il trascinamento dei nodi, lo spostamento della vista (pan) e il ridimensionamento automatico dell’area di lavoro.
3. [ ] Esportare le mappe su file, valutando il formato JSON.
4. [ ] Importare mappe da file.
5. [ ] Salvare sul server, come asset, le immagini collegate tramite URL nei nodi.
6. [ ] Aggiungere un gioco con una linea del tempo in cui collocare le immagini nelle tappe corrette.

## Migliorie dalla revisione del codice — 27 ottobre 2026

Revisione statica ricontrollata sul codice attuale. I punti 11–17 e 29 descrivono problemi o lacune individuati nel codice; il punto 18 richiede anche una verifica della policy della libreria, il 21 riguarda solo la configurazione locale. I punti 19 e 23 includono scelte funzionali; 24–28 e 30 sono proposte di ottimizzazione o manutenzione, non tutte correzioni necessarie. Prestazioni e comportamento nei browser non sono stati misurati. Numerazione mantenuta; nessuna modifica applicativa o test eseguito.

### Correttezza e salvataggio — priorità alta

11. [ ] Salvare il preset della mappa tramite l’endpoint `/style`: `applyStylePresetToMap` cambia `state.map.stylePreset` e salva i nodi, ma non il preset sul server. Unificare inoltre `onchange` inline e listener `input`/`change`, che possono applicare lo stesso stile più volte (`editor.html`, `mindmap-editor.js`).
12. [ ] Completare la persistenza di `branchWidth` e `branchCurve`: i controlli e il rendering li utilizzano, ma mancano in entità, DTO e richieste backend; spessore e curva personalizzati si perdono al ricaricamento e nella pubblicazione (`Node`, `NodeDto`, `CreateNodeRequest`, `UpdateNodeRequest`, `MindMapService`).

### Backend e configurazione

13. [ ] Spostare ricerche Wikimedia e ranking semantico fuori dalla transazione di scrittura. `createFromGeneratedMap` salva la mappa prima delle chiamate esterne e mantiene aperta la transazione per tutti i nodi; con SQLite questo può trattenere il blocco di scrittura durante le attese di rete (`MindMapService`).
14. [ ] Preservare i riferimenti ai genitori quando vengono scartati nodi AI non validi: `sanitize` compatta la lista senza rimappare gli indici `parentId`. Rimappare i riferimenti e definire cosa fare dei figli di nodi scartati, oppure rifiutare la generazione incoerente prima di salvarla (`MapGenerationApplicationService`).
15. [ ] Completare i limiti e la validazione lato server per titolo/testo, dimensione e schemi delle immagini `data:`/URL, numero di nodi generati, colori dei nodi e valori di font/stile. Conservare i controlli già presenti: dimensioni dei nodi/immagini limitate, profondità limitata, normalizzazione di indizi/descrizioni e validazione del colore dello sfondo della mappa (`dto`, `MindMapService`, `MapGenerationApplicationService`).
16. [ ] Proteggere anche sul backend l’ultimo nodo principale dall’eliminazione: il controllo è attualmente in `deleteNodeWithChecks`, mentre l’API può eliminare direttamente la radice e tutti i discendenti (`MindMapService.deleteNode`).
17. [ ] Ripristinare la protezione CSRF per le operazioni autenticate e passare il token nei form e nelle richieste JavaScript; definire separatamente il trattamento degli endpoint pubblici del gioco. Attualmente CSRF è disabilitato globalmente (`SecurityConfig`).
18. [ ] Limitare dimensione del payload SVG e numero di pixel raster nell’esportazione. Verificare e rendere esplicita la policy effettiva di Batik per risorse esterne e script, senza presumere che siano tutti consentiti: il codice applicativo si limita a risolvere le variabili CSS e usa un `PNGTranscoder` con configurazione predefinita. L’accesso al file locale o alla rete tramite SVG non è stato dimostrato nella revisione (`MindMapRestController`, `MindMapExportRenderer`).
19. [ ] Valutare il supporto a partite indipendenti in più schede: `MapGameController` conserva un solo `GameRun` per sessione, quindi avviare un altro gioco sostituisce la partita precedente. È una limitazione funzionale, non un problema di isolamento fra utenti; se si introduce una raccolta per `runId`, limitarne dimensione e durata.
21. [ ] Spostare i valori sensibili della configurazione locale in variabili d’ambiente o file esterni non versionati, per non includerli nei JAR generati. Verificato che i fallback sensibili sono nella modifica locale di `application.yml`, mentre il file in `HEAD` ha fallback vuoti: non risulta da questa verifica un segreto committato. Non riportare i valori nella documentazione.

### JavaScript — struttura, prestazioni e accessibilità

23. [ ] Gestire le scorciatoie in base al controllo che ha il focus: `isTypingTarget` non include `select` e i pulsanti, quindi Tab/Invio possono attivare comandi sul nodo invece della normale interazione col controllo. Definire inoltre esplicitamente se Annulla/Ripristina nei campi di testo debbano essere nativi o riferiti alla mappa: oggi i comandi globali precedono il controllo del focus (`mindmap-editor.js`).
24. [ ] Valutare aggiornamenti incrementali dell’SVG del gioco: a ogni risposta corretta `renderMap` svuota e ricrea tutti i nodi, immagini e listener; aggiornare solo la casella completata e mantenere il focus della tastiera (`map-game.js`).
25. [ ] Pulizia facoltativa: estrarre progressivamente rete/salvataggio, cronologia e dialoghi in moduli condivisi, evitando una riscrittura generale dell’editor. Eliminare il secondo controllo consecutivo identico di `renderFrame` in `buildExportSvg`: il primo `render()` azzera già il frame pendente. La modularizzazione migliora la manutenzione, ma non implica da sola un guadagno prestazionale (`mindmap-editor.js`, `maps-list.js`).

### CSS — consolidamento e ottimizzazione

26. [ ] Consolidamento facoltativo: riunire gli stili specifici dell’editor in `mindmap-editor.css`, mantenendo in `app.css` quelli usati anche dal gioco o da altre pagine. Toolbar, pannelli e layout sono distribuiti fra i file, ma la presenza di override non è di per sé un errore: preservare ordine della cascata e resa responsive.
27. [ ] Pulizia delle dimensioni responsive del canvas, collegata al punto 1: `app.css` impone larghezze minime e altezze per mobile/tablet, mentre `applyCanvasViewport` imposta poi larghezza, altezza e `min-width: 0` inline. Stabilire quali regole servono come stato iniziale e rimuovere soltanto quelle ridondanti; questa sovrascrittura da sola non dimostra un difetto di pan.
28. [ ] Rimuovere o isolare il percorso grafico sketch non attivo: `isSketchPreset` restituisce sempre `false`, ma restano rendering condizionali e selettori `.sketch-node`, `.connector-sketch` e `.branch-label-sketch`. Conservare le risorse ancora condivise: per esempio `--sketch-ink` è usata anche dal testo dello spinner (`mindmap-editor.js`, `app.css`).
29. [ ] Estendere `prefers-reduced-motion` al coniglietto dello spinner: in `app.css` la regola disattiva soltanto le animazioni del login, mentre `#loading-overlay .loading-icon` continua ad animarsi.
30. [ ] Pulizia facoltativa: estrarre variabili CSS per colori effettivamente condivisi fra pannelli, bordi e controlli dell’editor. Non accorpare automaticamente colori simili che rappresentano stati diversi: è una miglioria di manutenzione, non un problema prestazionale dimostrato (`mindmap-editor.css`).
