# TODO

1. [ ] Verificare il trascinamento dei nodi, lo spostamento della vista (pan) e il ridimensionamento automatico dell’area di lavoro.
6. [ ] Aggiungere un gioco con una linea del tempo in cui collocare le immagini nelle tappe corrette.

## Migliorie dalla revisione del codice — 27 ottobre 2026

Revisione statica ricontrollata sul codice attuale. I punti 13, 15 e 17 descrivono problemi o lacune individuati nel codice; il punto 18 richiede anche una verifica della policy della libreria, il 21 riguarda solo la configurazione locale. Il punto 30 è una proposta di manutenzione facoltativa. Prestazioni e comportamento nei browser non sono stati misurati. Numerazione mantenuta; nessuna modifica applicativa o test eseguito.

### Backend e configurazione

13. [ ] Spostare ricerche Wikimedia e ranking semantico fuori dalla transazione di scrittura. `createFromGeneratedMap` salva la mappa prima delle chiamate esterne e mantiene aperta la transazione per tutti i nodi; con SQLite questo può trattenere il blocco di scrittura durante le attese di rete (`MindMapService`).
39. [ ] Disaccoppiare la creazione della mappa dalla ricerca delle immagini: mostrare l’editor appena la struttura è pronta e proseguire le ricerche in background, in parallelo. Nei nodi in attesa mostrare un placeholder con il coniglietto animato dello spinner, sostituendolo progressivamente con l’immagine trovata. Gli aggiornamenti devono preservare le modifiche dell’utente e gestire anche ricerche senza risultati o fallite.
15. [ ] Completare i limiti e la validazione lato server per titolo/testo, dimensione e schemi delle immagini `data:`/URL, numero di nodi generati, colori dei nodi e valori di font/stile. Conservare i controlli già presenti: dimensioni dei nodi/immagini limitate, profondità limitata, normalizzazione di indizi/descrizioni e validazione del colore dello sfondo della mappa (`dto`, `MindMapService`, `MapGenerationApplicationService`).
17. [ ] Ripristinare la protezione CSRF per le operazioni autenticate e passare il token nei form e nelle richieste JavaScript; definire separatamente il trattamento degli endpoint pubblici del gioco. Attualmente CSRF è disabilitato globalmente (`SecurityConfig`).
18. [ ] Limitare dimensione del payload SVG e numero di pixel raster nell’esportazione. Verificare e rendere esplicita la policy effettiva di Batik per risorse esterne e script, senza presumere che siano tutti consentiti: il codice applicativo si limita a risolvere le variabili CSS e usa un `PNGTranscoder` con configurazione predefinita. L’accesso al file locale o alla rete tramite SVG non è stato dimostrato nella revisione (`MindMapRestController`, `MindMapExportRenderer`).
21. [ ] Spostare i valori sensibili della configurazione locale in variabili d’ambiente o file esterni non versionati, per non includerli nei JAR generati. Verificato che i fallback sensibili sono nella modifica locale di `application.yml`, mentre il file in `HEAD` ha fallback vuoti: non risulta da questa verifica un segreto committato. Non riportare i valori nella documentazione.

### CSS — consolidamento e ottimizzazione

30. [ ] Pulizia facoltativa: estrarre variabili CSS per colori effettivamente condivisi fra pannelli, bordi e controlli dell’editor. Non accorpare automaticamente colori simili che rappresentano stati diversi: è una miglioria di manutenzione, non un problema prestazionale dimostrato (`mindmap-editor.css`).
