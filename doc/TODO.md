# TODO

Punti aperti raggruppati per area logica. Le verifiche tecniche derivano dalla revisione statica del 27 ottobre 2026: prestazioni e comportamento nei browser richiedono una verifica sul campo.

## Editor e giochi


## Importazione ed esportazione

2. [ ] Limitare dimensione del payload SVG e numero di pixel raster nell’esportazione. Verificare e rendere esplicita la policy effettiva di Batik per risorse esterne e script, senza presumere che siano tutti consentiti: il codice applicativo si limita a risolvere le variabili CSS e usa un `PNGTranscoder` con configurazione predefinita. L’accesso al file locale o alla rete tramite SVG non è stato dimostrato nella revisione (`MindMapRestController`, `MindMapExportRenderer`).

## Generazione delle mappe e ricerca immagini

3. [ ] Spostare ricerche Wikimedia e ranking semantico fuori dalla transazione di scrittura. `createFromGeneratedMap` salva la mappa prima delle chiamate esterne e mantiene aperta la transazione per tutti i nodi; con SQLite questo può trattenere il blocco di scrittura durante le attese di rete (`MindMapService`).

4. [ ] Disaccoppiare la creazione della mappa dalla ricerca delle immagini: mostrare l’editor appena la struttura è pronta e proseguire le ricerche in background, in parallelo. Nei nodi in attesa mostrare un placeholder con il coniglietto animato dello spinner, sostituendolo progressivamente con l’immagine trovata. Gli aggiornamenti devono preservare le modifiche dell’utente e gestire anche ricerche senza risultati o fallite.

## Validazione, sicurezza e configurazione

5. [ ] Completare i limiti e la validazione lato server per titolo/testo, dimensione e schemi delle immagini `data:`/URL, numero di nodi generati, colori dei nodi e valori di font/stile. Conservare i controlli già presenti: dimensioni dei nodi/immagini limitate, profondità limitata, normalizzazione di indizi/descrizioni e validazione del colore dello sfondo della mappa (`dto`, `MindMapService`, `MapGenerationApplicationService`).


7. [ ] Spostare i valori sensibili della configurazione locale in variabili d’ambiente o file esterni non versionati, per non includerli nei JAR generati. Verificato che i fallback sensibili sono nella modifica locale di `application.yml`, mentre il file in `HEAD` ha fallback vuoti: non risulta da questa verifica un segreto committato. Non riportare i valori nella documentazione.

## Preferenze utente

8. [ ] Aggiungere una pagina delle preferenze utente con possibilità di cambiare la password.

