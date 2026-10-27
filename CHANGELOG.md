# Changelog

Tutte le modifiche rilevanti di questo progetto sono documentate in questo file.

Il formato segue [Keep a Changelog](https://keepachangelog.com/it-IT/1.1.0/)
e il progetto adotta il [versionamento semantico](https://semver.org/lang/it/).

## [Unreleased]

## [0.2.1] - 2026-10-27

### Changed

- Spring Boot aggiornato alla versione 4.1.2.
- Ricerca immagini attiva per impostazione predefinita nella creazione AI e opzioni rappresentate come interruttori.
- Pulsante «Giochiamo!» grande e centrato nell’area iniziale della mappa delle scoperte; dopo l’avvio, il comando per ricominciare resta nell’intestazione della mappa.
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
- Tre campi «Indizio per il gioco» per ogni nodo, con salvataggio automatico nell’editor e generazione di tre indizi diversi per le nuove mappe AI.
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

- Isolamento delle mappe per proprietario e protezione delle operazioni di modifica e pubblicazione.
- Limitazione dei tentativi di accesso falliti.
- Link pubblici casuali e revocabili; aggiornare o ritirare una pubblicazione interrompe anche l'accesso al gioco precedente.
- Validazione delle risposte e calcolo del punteggio sul server.
- Verifica dell'integrità delle risorse esterne caricate da CDN.

[Unreleased]: https://github.com/saidone75/simple-mindmaps/compare/v0.2.1...HEAD
[0.2.1]: https://github.com/saidone75/simple-mindmaps/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/saidone75/simple-mindmaps/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/saidone75/simple-mindmaps/releases/tag/v0.1.0
