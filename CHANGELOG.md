# Changelog

Tutte le modifiche rilevanti di questo progetto sono documentate in questo file.

Il formato segue [Keep a Changelog](https://keepachangelog.com/it-IT/1.1.0/)
e il progetto adotta il [versionamento semantico](https://semver.org/lang/it/).

## [Unreleased]

Modifiche previste per la versione **0.1.1**.

### Changed

- CSS semplificato eliminando regole inutilizzate, dichiarazioni sovrascritte e duplicazioni, mantenendo lo stile e i layout responsive.

### Fixed

- Pan dell'editor collegato al contenitore scorrevole della mappa e attivabile trascinando tutta l'area vuota.

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

[Unreleased]: https://github.com/saidone75/simple-mindmap/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/saidone75/simple-mindmap/releases/tag/v0.1.0
