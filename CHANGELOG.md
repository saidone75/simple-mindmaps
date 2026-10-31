# Changelog

Tutte le modifiche rilevanti di questo progetto sono documentate in questo file.

Il formato segue [Keep a Changelog](https://keepachangelog.com/it-IT/1.1.0/)
e il progetto adotta il [versionamento semantico](https://semver.org/lang/it/).

## [Unreleased]

### Added

- Card di *Le mie mappe* riordinabili tramite maniglia con mouse, touch o frecce della tastiera; ordine salvato per insegnante nel campo `display_order`, senza alterare la data di modifica delle mappe.
- Backup notturno SQLite con la classe di Quizmaker: `VACUUM INTO`, verifica d’integrità, file temporaneo e spostamento atomico. Cron configurabile in `application.yml` (default alle 02:00), con 30 copie conservate in `./backups` e configurazione tramite variabili d’ambiente.
- **Pinch-to-zoom a due dita** nell’editor e nel gioco, centrato tra le dita e coordinato con pan e trascinamento.
- **Zoom dell’immagine nel riquadro del nodo** dal 100% al 400%, regolabile nell’editor immagini e salvato nel campo `image_zoom`, con supporto Annulla/Ripristina e mantenimento nel gioco, nelle copie e nei file esportati.

- **Trascinamento dell’immagine dentro il riquadro del nodo** per regolarne il ritaglio, con inquadratura salvata e mantenuta nel gioco, nelle copie e nei file esportati. Aggiunte le colonne `image_position_x` e `image_position_y` ai nodi.

### Fixed

- Un tap o clic sullo sfondo della mappa deseleziona il nodo e chiude entrambi i pannelli dell’editor.
- Trascinamento touch dei nodi ripristinato nell’editor: il nodo selezionato si può spostare, mentre il gesto sui nodi non selezionati continua a trascinare la mappa.
- Ripristinato il pan touch dell’immagine nel riquadro quando il relativo pannello è aperto; sugli altri nodi o sulle immagini senza ritaglio resta disponibile il pan della mappa.
- Il pan della mappa non riapre più automaticamente il pannello del nodo selezionato al termine del trascinamento.
- Riavvio della capriola del coniglietto nel login tramite l’animazione corrente, senza `void` né ricalcoli forzati del layout.
- Pan touch nel gioco non più interrotto dal trasferimento della cattura del puntatore da un nodo al contenitore della mappa.
- Pan touch della mappa disponibile anche sopra nodi e immagini; trascinamento distinto dal tocco per evitare selezioni o risposte involontarie nel gioco.
- Area della mappa su mobile limitata all’altezza visibile e portata in vista all’avvio del pan, evitando di dover alternare trascinamento interno e scorrimento della pagina; contenuto il passaggio dello scroll alla pagina ai bordi.
- Immagini nello zainetto del gioco mostrate con lo stesso zoom, spostamento e inquadratura impostati nell’editor.
- Pannelli del nodo e dell’immagine mutuamente esclusivi: aprirne uno chiude l’altro e i controlli dell’immagine mantengono aperto il relativo pannello.
- L’indirizzo principale `/` reindirizza a `/maps`, evitando la pagina 404.
- Stato accessibile degli switch di creazione mappa e salvataggio immagini sincronizzato con la selezione effettiva.
- Gestione esplicita dei metadati GIF mancanti durante il ridimensionamento delle animazioni, evitando dereferenziazioni di valori nulli.

- Apertura del pannello immagini anche cliccando su un’immagine ritagliata o ingrandita, mantenendo il trascinamento per regolarne l’inquadratura.
- Messaggio di download immagine non riuscito con il nome del nodo interessato.
- Messaggi della ricerca immagini azzerati al cambio di nodo; risposte e errori tardivi non mostrano più lo stato del nodo precedente.

### Changed

- Intestazione di *Le mie mappe* uniformata alle altre sezioni, con kicker, titolo e conteggio delle mappe.
- JavaScript del gioco semplificato eliminando ternari annidati e il parametro predefinito intermedio dell’helper SVG, senza modificare il comportamento.

### Security

- Abilitata la protezione CSRF con token di sessione per form e API, compresi avvio e tentativi dei giochi pubblici; token trasmesso dalle pagine Thymeleaf alle richieste JavaScript.

## [0.3.2] - 2026-10-29

### Changed

- Durante la ricerca immagini, il pulsante mostra lo stesso coniglietto animato dello spinner, con salti e capriola rimpiccioliti, al posto della clessidra.
- Comandi dell’editor immagini rappresentati da icone per ricerca e rimozione, con etichette accessibili e descrizioni al passaggio del mouse. Rimosso il pulsante di applicazione del link, già salvato automaticamente, e uniformato il selettore dei file allo stile dell’editor.
- Il pulsante *Cerca* dell’editor immagini chiede conferma delle parole di ricerca in un campo precompilato con il testo del nodo e modificabile, prima di avviare la ricerca semantica Wikimedia.
- **Prompt di sistema AI** estratto in un file Markdown UTF-8 nelle risorse, caricato e verificato all’avvio; file esterno configurabile tramite `APP_OPENAI_SYSTEM_PROMPT`.
- Prompt AI riorganizzato con regole nel messaggio di sistema e dati utente separati in JSON; linguaggio per la primaria, titoli anche di una parola, dimensioni indicative e massimo 30 nodi, indizi concreti, contesto essenziale nelle parole chiave delle immagini e uso esplicito del testo di riferimento. Schema JSON allineato con stili consentiti, immagini inizialmente vuote e limiti sui contenuti.

### Removed

- Rimossa `LegacyMapImageMigration`, usata per trasferire le immagini BLOB della vecchia implementazione nella cartella del server.

### Fixed

- Migliorata l’accessibilità: rimosso il focus automatico dal login, associati titolo e descrizione agli input dei dialoghi nell’editor e nell’elenco mappe e aggiunto un testo iniziale al titolo premio del gioco.
- Gestione esplicita delle Promise nelle operazioni dell’editor per politica immagini, sfondo, navigazione, invio dei form ed esportazione, preservando le code di salvataggio e la gestione degli errori.
- Stile `TRUE_SUMMER` dell’editor riconosciuto anche dal backend, mantenendo la compatibilità con i preset precedenti.
- Record dei download immagini con `equals`, `hashCode` e `toString` basati sul contenuto degli array di byte.

### Security

- Anteprime e alternative delle immagini validate prima dell’assegnazione al DOM: consentiti solo HTTP/HTTPS senza credenziali, riferimenti locali con UUID valido e immagini incorporate in base64 nei formati supportati. Le risposte del salvataggio immagini vengono convertite in riferimenti locali, senza utilizzare URI arbitrari restituiti dal server.

## [0.3.1] - 2026-10-28

### Added

- Pulsante *Cerca* nell’editor immagini per cercare immagini Wikimedia con la ricerca semantica usando il testo del nodo e il titolo della mappa come contesto. Applicazione del primo risultato, fino a nove alternative salvate, avanzamento visibile e supporto Annulla/Ripristina; i risultati non sovrascrivono un nodo modificato nel frattempo.

### Fixed

- Errori di importazione ed esportazione JSON registrati esplicitamente nei log, con stack trace per gli errori server e risposta leggibile nel browser; conferma nei log delle importazioni completate.

## [0.3.0] - 2026-10-28

### Changed

- **Riordino iniziale e manuale più compatto**: ogni nodo viene collocato nel punto libero più vicino lungo il proprio ramo, usando le dimensioni effettive e un margine di separazione, senza espandere uniformemente tutta la mappa. La disposizione salvata viene mantenuta nel gioco pubblicato.
- Card dei modelli pronti spostata sotto *Le mie mappe*, pulsante della pagina pubblica dei giochi distanziato dal testo introduttivo e pubblicazione del gioco richiudibile, chiusa per impostazione predefinita e aperta dopo la pubblicazione o l’aggiornamento, anche in caso di errore.
- Toolbar dell’editor riordinata con lo switch *Salva immagini* a destra, dopo la griglia.
- Limite di download delle immagini esterne aumentato a 25 MB prima della normalizzazione.
- JavaScript organizzato in componenti dedicati per dialoghi, richieste HTTP e cronologia Annulla/Ripristina, con riuso fra editor ed elenco mappe e rimozione del controllo di rendering duplicato nell’esportazione SVG.
- Il gioco aggiorna solo l’immagine della casella completata, riusando nodi, collegamenti e listener e mantenendo il focus della tastiera; selezione e rimozione delle immagini usano indici dedicati.
- Stili specifici dell’editor raccolti in `mindmap-editor.css`, colori condivisi di pannelli e controlli estratti in variabili, regole duplicate e override responsive superflui rimossi. Dimensioni responsive del canvas semplificate e codice grafico sketch inattivo rimosso da CSS e JavaScript.
- Trascinamento, ridimensionamento e pan dell’editor unificati tramite Pointer Events per mouse, penna e touch, con cattura del puntatore, gestione dei gesti interrotti e distinzione tra tocco e trascinamento.

### Added

- Pulsante *Adatta alla griglia* nella toolbar: allinea tutti i nodi alla posizione più vicina e arrotonda larghezza e altezza a multipli della griglia, rispettando lo spazio minimo del contenuto; salvataggio automatico e supporto Annulla/Ripristina.
- **Importazione ed esportazione delle mappe in JSON**, con nodi, collegamenti, stile, indizi, titoli premio e immagini locali incorporate nel file. L’importazione crea una nuova mappa privata con nuovi riferimenti alle immagini; controllo del formato e dei collegamenti, limite di 100 MB per file e 1000 nodi. Comando *Importa mappa* al primo posto a sinistra nella griglia dei modelli pronti, con le stesse dimensioni e un colore distinto, ed *Esporta* in fondo alla toolbar dell’editor, dopo lo switch delle immagini.
- **Job notturno configurabile per le immagini orfane**, con controllo dei riferimenti in mappe, alternative e copie pubblicate, sette giorni di conservazione dall’individuazione e cancellazione dei file dopo il commit del database.
- Switch nella toolbar dell’editor, attivo per impostazione predefinita e salvato per mappa, per scaricare e conservare le immagini esterne nella cartella del server, con metadati e riferimenti nel database. Normalizzazione entro 1024 × 1024 px senza ingrandimento, JPEG per immagini opache, PNG per trasparenze e conversione SVG; le GIF animate mantengono fotogrammi, tempi e ripetizione. Elaborazione in background, compatibilità con giochi, copie ed esportazioni e nuova tabella `map_image` per i metadati; cartella configurabile tramite `app.upload.directory`.
- Fino a nove URL Wikimedia candidati salvati per nodo nelle nuove mappe AI, con anteprime e scelta nell’editor. Supporto alle ricerche semplice e semantica, mantenimento nelle copie e in Annulla/Ripristina, controllo delle immagini già usate da altri nodi. Aggiunta della colonna `image_candidates` alla tabella dei nodi.
- **Pagina pubblica univoca per insegnante** con pulsanti illustrati dall’immagine del nodo principale della copia pubblicata, con icona di riserva se assente o non disponibile, per avviare i giochi; dalla festa finale si può rigiocare o tornare alla selezione. Il link di pubblicazione continua ad aprire il singolo gioco.

### Fixed

- Salvataggio del riordino iniziale e manuale inserito nella coda di autosalvataggio, evitando scritture concorrenti con modifiche pendenti e permettendo a pubblicazione, navigazione e Annulla/Ripristina di attenderne il completamento.
- **Immagini statiche Wikimedia oltre 40 megapixel** ridotte tramite sottocampionamento prima del controllo sul raster decodificato, evitando il rifiuto degli originali ad alta risoluzione e mantenendo il limite finale di 1024 px.
- **Normalizzazione degli SVG Wikimedia** con dichiarazione DOCTYPE standard, senza caricare DTD esterni né consentire definizioni XML interne; aggiunto il motivo tecnico nei log quando la preparazione di un’immagine fallisce.
- Anteprime dei giochi pubblici con spazio fisso riservato e immagini contenute entro 96 × 96 px, per evitare sovrapposizioni con il titolo anche durante il caricamento.
- Ricerca Wikimedia meno restrittiva: parole senza virgolette per includere varianti grammaticali, soggetti AI più brevi e ampliamento progressivo delle espressioni troppo lunghe. Foto e illustrazioni precedono copertine, frontespizi e anteprime DjVu in entrambe le modalità; nella ricerca semantica i documenti non interrompono prematuramente la raccolta delle immagini.
- Riferimenti ai genitori dei nodi AI rimappati dopo gli scarti; i figli dei nodi scartati vengono collegati al primo antenato valido, mentre radici mancanti e riferimenti incoerenti fanno ripetere la generazione.
- Eliminazione dell’ultimo nodo principale impedita anche sul server, prima di rimuovere i discendenti.
- Immagini conservate su file anziché come Blob, con trasferimento automatico degli eventuali contenuti binari già salvati nel database SQLite.
- Preset della mappa salvato sul server con un solo gestore del cambio di stile e attesa dei salvataggi anche prima della pubblicazione. Spessore e curva dei rami persistiti, validati e conservati al ricaricamento, nella duplicazione, in Annulla/Ripristina e nei giochi pubblicati; aggiunte le colonne `branch_width` e `branch_curve` alla tabella dei nodi.
- Scorciatoie dell’editor rispettose del controllo selezionato e delle finestre di dialogo: Tab e Invio mantengono il comportamento dei controlli, Annulla/Ripristina nei campi di testo resta nativo del browser.
- Pubblicazione e navigazione dall’editor attendono i salvataggi pendenti di nodi e sfondo; gli errori bloccano l’uscita e la chiusura o il ricaricamento della scheda avvisa se restano modifiche non salvate. Dopo il salvataggio i form vengono inviati direttamente, evitando blocchi nell’aggiornamento e nel ritiro del gioco.

## [0.2.1] - 2026-10-27

### Changed

- Spring Boot aggiornato alla versione 4.1.2.
- Ricerca immagini attiva per impostazione predefinita nella creazione AI e opzioni rappresentate come interruttori.
- Pulsante *Giochiamo!* grande e centrato nell’area iniziale della mappa delle scoperte; dopo l’avvio, il comando per ricominciare resta nell’intestazione della mappa.
- Scheda del livello distanziata dalla barra del gioco e pulsante dei suoni allineato a destra.
- Ricerche Wikimedia semplice e semantica con query progressive: soggetto principale sempre presente, dettagli aggiunti uno alla volta e ampliamento senza alternative generiche in `OR`.

### Fixed

- Annulla/Ripristina dell’editor sincronizzato con il server, con ripristino atomico dei nodi e riconciliazione degli ID dopo creazioni ed eliminazioni.

- Avanzamento della generazione in background gestito tramite riferimento atomico, anche in caso di errore.
- Associazione esplicita tra etichette e campi dei titoli premio nel template dell’editor, mantenendo identificativi univoci per livello.
- Conteggio dei livelli nella generazione AI comprensivo del nodo principale: scegliendo 2 livelli si ottengono solo radice e figli, con controllo del limite anche sul server.

### Added

- Selettori affiancati per colore del testo, sfondo del nodo e ramo; colore dello sfondo della mappa nella barra degli strumenti, con salvataggio e mantenimento nei giochi pubblicati e nelle esportazioni.

- Overlay di festeggiamento a ogni nuovo livello intermedio, con il titolo conquistato.
- Suoni del gioco con pulsante per disattivarli e preferenza salvata.
- Supporto dei risultati Wikimedia DjVu tramite anteprima della prima pagina, nelle ricerche semplice e semantica; i documenti senza anteprima supportata vengono scartati.

## [0.2.0] - 2026-10-26

### Added

- Overlay di festeggiamento al completamento della mappa e al raggiungimento del quinto livello, con titolo premio, coriandoli e pulsanti per rigiocare o vedere la mappa completata.
- Barra di avanzamento nello spinner, affiancata al conteggio dei nodi: indeterminata durante la generazione AI e aggiornata sui nodi effettivamente preparati quando il totale è noto.
- Creazione AI in background con API di avanzamento riservata al proprietario e spinner aggiornato ogni due secondi: attività corrente, nodo per cui si cerca un’immagine, numero di nodi preparati sul totale.
- Log sul caricamento e sull’uso di `textEmbeddingModel`, con durata del ranking semantico, dimensione dei vettori e statistiche della cache.
- Tre campi *Indizio per il gioco* per ogni nodo, con salvataggio automatico nell’editor e generazione di tre indizi diversi per le nuove mappe AI.
- Cinque titoli premio (`prizes`) legati al tema, generati dall’AI nella stessa richiesta della mappa e modificabili singolarmente dall’insegnante. Per le mappe manuali, da template o già esistenti senza titoli premio vengono proposti valori iniziali modificabili.

### Changed

- JavaScript dell’editor ottimizzato: riuso del nodo SVG anche durante il trascinamento, elaborazione dei movimenti una volta per fotogramma, meno ricalcoli della vista e undo raggruppato durante la digitazione. Cache di testi e dimensioni, griglia disegnata tramite pattern SVG e indici dei nodi preparati una sola volta per partita nel gioco.
- Modello di embedding predefinito sostituito con `all-MiniLM-L6-v2`, più leggero e pensato per testi inglesi; resta configurabile tramite `AI_EMBEDDING_MODEL_URL`.
- Messaggi dei log della ricerca Wikimedia e del modello riscritti in linguaggio più semplice, con i dettagli tecnici delle richieste riservati al livello `TRACE`.
- Dopo ogni errore il gioco sceglie casualmente uno degli indizi dedicati compilati, ignorando i duplicati, oppure mostra un incoraggiamento generico, senza rivelare descrizione e titolo del nodo. Gli indizi vengono inviati al giocatore solo quando necessari.
- CSS di editor, gioco, spinner e overlay di festeggiamento semplificati eliminando regole inutilizzate, dichiarazioni sovrascritte e duplicazioni, mantenendo lo stile e i layout responsive.
- Punteggio sostituito da cinque livelli incoraggianti basati sull’avanzamento: errori e tempo non fanno perdere livelli e completare la mappa assegna il quinto titolo premio.
- Riordino automatico e salvataggio delle posizioni alla prima apertura delle nuove mappe, anche da template e generate con AI.
- Disposizione radiale più compatta, con nodo principale al centro anche dell’area di disegno e livelli successivi progressivamente più esterni, tenendo conto delle dimensioni dei nodi e delle immagini.
- Apertura dell’editor senza nodi selezionati, anche per le mappe appena generate.

### Fixed

- Regole della barra di avanzamento del gioco separate per Chrome/Safari e Firefox, evitando selettori specifici dei browser nella stessa regola.
- Configurazione del modello di embedding allineata a `ai.embedding.model-url` e logger di sviluppo corretto per il package `org.saidone.mindmaps`.
- Ricerca Wikimedia semplice e semantica con esclusione delle immagini già assegnate nella stessa mappa, per evitare duplicati tra i nodi.
- Pan dell’editor collegato al contenitore scorrevole e attivabile trascinando l’area vuota. Lo spostamento dei nodi mantiene ferma la vista, anche al rilascio: scorrimento automatico solo vicino al bordo visibile ed espansione sul lato necessario, mantenendo lo zoom.
- Stato della partita e dati contenuti resi serializzabili per il salvataggio nella sessione HTTP, con ripristino dell’orologio alla deserializzazione.
- Attesa esplicita delle richieste di abbinamento nei gestori di tastiera e trascinamento del gioco.
- Espressioni regolari per le variabili CSS nelle esportazioni semplificate per ridurre il backtracking.

## [0.1.0] - 2026-10-25

### Added

- Banner di avvio a tema coniglietto e mappe, con colori e informazioni su applicazione, profili attivi e runtime Java.
- Creazione di mappe mentali da zero, da template e tramite generazione AI.
- Editor visuale con nodi e collegamenti personalizzabili, immagini, emoji e descrizioni.
- Salvataggio automatico, duplicazione delle mappe e disposizione automatica dei nodi.
- Ricerca automatica di immagini pertinenti su Wikimedia per le mappe generate con AI.
- Esportazione delle mappe in PNG e PDF, con formati di stampa A4 e A3.
- Accesso multiutente con mappe private e creazione dell'utente iniziale da configurazione.
- Pubblicazione delle mappe come giochi delle immagini tramite link pubblico, senza account per i giocatori.
- Copia della mappa al momento della pubblicazione, aggiornamento del gioco e ritiro del link pubblico.
- Abbinamento delle immagini alle caselle tramite trascinamento, tocco o tastiera, con suggerimenti dopo ogni errore.
- Calcolo sul server di risposte corrette, tentativi, errori, tempo e punteggio.
- Barra dei progressi e animazioni con stelline per festeggiare gli abbinamenti corretti.
- Controlli dello zoom sempre visibili, adattamento della mappa alla finestra e trascinamento dello sfondo con la manina.
- Supporto alle preferenze di movimento ridotto per gli effetti del gioco.

### Changed

- Controllo di convergenza Maven Enforcer vincolante: la build si interrompe in caso di dipendenze con versioni incompatibili.
- Interfaccia dell'editor riorganizzata con strumenti raggruppati e una scheda dedicata alla pubblicazione.
- Grafica del gioco pensata per la scuola primaria, con zainetto delle immagini, istruzioni semplici e messaggi incoraggianti.
- Punteggio indulgente: primi tre errori senza penalità, poi cinque punti in meno per errore, con almeno 900 punti completando la mappa.
- Nessuna penalità sul tempo e nessun cronometro o conteggio degli errori mostrato durante il gioco.
- Layout adattati a dispositivi mobili e tablet.
- Persistenza delle mappe migrata da H2 a SQLite; H2 mantenuto per le verifiche di persistenza esistenti.
- Aggiornamento di Spring Boot, delle dipendenze e delle GitHub Actions.
- Geometria dei nodi condivisa tra editor e gioco per conservare disposizione e dimensioni della mappa.
- Uso di `lombok.val` per le variabili locali dove possibile.

### Fixed

- Conflitti di convergenza delle dipendenze Batik, Commons Compress, Commons IO ed Error Prone, con versioni allineate nel POM.
- Allineamento e presenza di immagini e testi nelle esportazioni PNG e PDF.
- Risoluzione dei colori CSS e rimozione dei controlli di ridimensionamento nelle esportazioni.
- Gestione delle sovrapposizioni tra nodi durante la disposizione automatica.
- Associazione delle immagini quando più caselle usano la stessa immagine.
- Aggiornamento dei database SQLite esistenti con i campi necessari alla pubblicazione.

### Security

- **Isolamento delle mappe per proprietario** e protezione delle operazioni di modifica e pubblicazione.
- **Limitazione dei tentativi di accesso falliti**.
- **Link pubblici casuali e revocabili**; aggiornare o ritirare una pubblicazione interrompe anche l'accesso al gioco precedente.
- Validazione delle risposte e calcolo del punteggio sul server.
- Verifica dell'integrità delle risorse esterne caricate da CDN.

[Unreleased]: https://github.com/saidone75/simple-mindmap/compare/v0.3.2...HEAD
[0.3.2]: https://github.com/saidone75/simple-mindmap/compare/v0.3.1...v0.3.2
[0.3.1]: https://github.com/saidone75/simple-mindmap/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/saidone75/simple-mindmap/compare/v0.2.1...v0.3.0
[0.2.1]: https://github.com/saidone75/simple-mindmap/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/saidone75/simple-mindmap/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/saidone75/simple-mindmap/releases/tag/v0.1.0
