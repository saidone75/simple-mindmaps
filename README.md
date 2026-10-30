# 🧠✨ Alice's Simple Mind Maps

Un'applicazione per creare mappe mentali e trasformarle in giochi divertenti.

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Java CI](https://github.com/saidone75/simple-mindmap/actions/workflows/build.yml/badge.svg)](https://github.com/saidone75/simple-mindmap/actions/workflows/build.yml)
[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=saidone75_alice-s-simple-mind-maps&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=saidone75_alice-s-simple-mind-maps)
[![Reliability Rating](https://sonarcloud.io/api/project_badges/measure?project=saidone75_alice-s-simple-mind-maps&metric=reliability_rating)](https://sonarcloud.io/summary/new_code?id=saidone75_alice-s-simple-mind-maps)
[![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=saidone75_alice-s-simple-mind-maps&metric=sqale_rating)](https://sonarcloud.io/summary/new_code?id=saidone75_alice-s-simple-mind-maps)

Versione in sviluppo: **0.3.3-SNAPSHOT**. Ultima release: **0.3.2**. Le novità sono raccolte nel [changelog](CHANGELOG.md).

## Funzionalità

- Mappe create da zero, da template o generate con AI. Durante la generazione, lo spinner mostra l’attività corrente: creazione della mappa, controllo dei collegamenti, ricerca di un’immagine per ciascun nodo e salvataggio.
- Editor SVG con trascinamento dei nodi, riordino compatto senza sovrapposizioni, zoom, pan, griglia e salvataggio automatico. **Adatta alla griglia** allinea posizioni e dimensioni dei nodi, rispettando lo spazio necessario al contenuto. Le modifiche si possono annullare e ripristinare.
- Personalizzazione di testi, descrizioni, emoji, immagini, colori e collegamenti.
- Immagini caricate da file, tramite URL o cercate su Wikimedia durante la generazione AI. Le ricerche Wikimedia escludono le immagini già assegnate nella stessa mappa; se non viene trovata un’alternativa, il nodo rimane senza immagine.
- Nell’editor immagini, *Cerca* apre un campo con il testo del nodo modificabile prima della conferma, poi avvia la ricerca semantica su Wikimedia usando le parole scelte e il titolo della mappa come contesto: applica il primo risultato e mostra fino a nove alternative.
- Nelle nuove mappe AI vengono salvate fino a nove immagini Wikimedia candidate per nodo. Clicca sull’immagine nell’editor per vedere le anteprime e scegliere un’alternativa; quelle già usate da altri nodi non sono selezionabili.
- Lo switch *Salva immagini*, nella toolbar dell’editor, è attivo per impostazione predefinita: conserva le immagini esterne nella cartella del server `./upload` e salva nel database il riferimento al file. I file scaricati possono pesare fino a 25 MB e vengono adattati entro 1024 × 1024 px senza ingrandirli; le GIF animate mantengono l’animazione. La scelta è salvata per mappa. Se un download non riesce, resta il link originale; spegni e riaccendi lo switch per riprovare.
- Duplicazione ed eliminazione delle mappe.
- Esportazione in PNG e PDF, con formati A4 e A3 per il PDF; importazione ed esportazione delle mappe in JSON.
- Accesso con account e mappe private per ciascun proprietario.
- Pubblicazione di giochi delle immagini tramite link pubblico revocabile.
- Interfacce adattate a computer, tablet e dispositivi mobili.

## Requisiti

- *JDK 21*.
- *Linux x86_64* per il runtime nativo PyTorch incluso nel POM; altre piattaforme richiedono dipendenze native compatibili.
- *Maven 3.6.3 o successivo*; consigliato Maven 3.9+.
- Un browser moderno.
- Connessione a Internet al primo avvio per scaricare il modello di embedding e le librerie native richieste da DJL/PyTorch. La generazione AI e la ricerca Wikimedia richiedono inoltre accesso ai rispettivi servizi.

Lo stack comprende *Spring Boot 4.1.2*, Spring Security, Spring Data JPA, Thymeleaf, SQLite e JavaScript senza framework frontend.

## Avvio locale

Clona il repository e crea la directory dei dati:

```bash
git clone https://github.com/saidone75/simple-mindmap.git
cd simple-mindmap
mkdir -p data
```

Configura l'account iniziale e avvia l'applicazione con il profilo `dev`:

```bash
export INITIAL_USER_LOGIN=alice
read -rsp 'Password iniziale: ' INITIAL_USER_PASSWORD; echo
export INITIAL_USER_PASSWORD
export SPRING_PROFILES_ACTIVE=dev
mvn spring-boot:run
```

Apri *http://localhost:9080/maps* ed effettua l'accesso. L'utente iniziale viene creato solo se entrambe le variabili sono valorizzate e l'account non esiste già. Cambiare le variabili non modifica la password di un account esistente.

In alternativa, dopo avere configurato le credenziali, `bash run.sh` avvia il profilo `dev` con il debugger Java sulla porta `9000`.

### Configurazione

| Variabile                | Uso                                          | Valore predefinito            |
|--------------------------|----------------------------------------------|-------------------------------|
| `INITIAL_USER_LOGIN`     | Nome dell'utente da creare al primo avvio    | Vuoto                         |
| `INITIAL_USER_PASSWORD`  | Password dell'utente iniziale                | Vuoto                         |
| `OPENAI_API_KEY`         | Chiave per la generazione delle mappe con AI | Vuoto                         |
| `OPENAI_MODEL`           | Modello usato per la generazione             | `gpt-6-luna`                  |
| `SPRING_PROFILES_ACTIVE` | Profilo di esecuzione                        | Nessun profilo esplicito      |
| `SERVER_PORT`            | Porta HTTP                                   | `9080`                        |
| `WIKIMEDIA_USER_AGENT`   | Identificazione delle richieste a Wikimedia  | Definita in `application.yml` |

La chiave OpenAI serve alla generazione AI; la creazione manuale delle mappe non la richiede.

Il prompt di sistema è in `src/main/resources/prompts/mindmap-system.md`. Per usare un file esterno al JAR, imposta `APP_OPENAI_SYSTEM_PROMPT=file:/percorso/mindmap-system.md`. Il file viene letto in UTF-8 all’avvio: `%d` indica la profondità massima e `%s` la regola delle etichette dei collegamenti; eventuali percentuali letterali vanno scritte come `%%`. Riavvia l’applicazione dopo averlo modificato.

Per abilitare la generazione AI, imposta `OPENAI_API_KEY` nell’ambiente prima dell’avvio:

```bash
read -rsp 'Chiave API OpenAI: ' OPENAI_API_KEY; echo
export OPENAI_API_KEY
```

### Build e avvio del JAR

Per compilare e verificare il progetto con i test già presenti:

```bash
mvn -B clean verify
```

L'artefatto eseguibile è `target/mindmaps-0.3.3-SNAPSHOT.jar`. Con credenziali e directory dei dati già configurate:

```bash
java -jar target/mindmaps-0.3.3-SNAPSHOT.jar --spring.profiles.active=prod
```

Il profilo `dev` scrive i log in console e su file, mentre `prod` li scrive in `./log/mindmaps.log`. I profili sono di Spring: non occorre un profilo Maven `-Pprod`.

Per costruire il JAR saltando l'esecuzione dei test è disponibile `bash build.sh`.

## Gioco delle immagini

### Pubblicare una mappa

1. Nell'editor, aggiungi almeno un'immagine ai nodi.
2. Apri la card *Da mappa a gioco*, chiusa per impostazione predefinita, e premi *Pubblica come gioco*.
3. Copia il link pubblico e condividilo con i bambini: non occorre un account per giocare.

La pubblicazione salva una copia della mappa con gli stessi testi, collegamenti, colori, disposizione e dimensioni dei nodi. Le modifiche successive nell'editor non cambiano il gioco già pubblicato.

*Aggiorna gioco pubblicato* crea una nuova copia e un nuovo link, disattivando quello precedente. *Ritira pubblicazione* disabilita il link e impedisce ulteriori tentativi nelle partite già avviate.

Ogni insegnante ha anche una *pagina pubblica dei giochi*, con il nome utente nell’indirizzo (per esempio `/play/teachers/alice`), raggiungibile dall’elenco delle mappe e dall’editor. Il suo indirizzo resta lo stesso quando aggiungi, aggiorni o ritiri un gioco. Mostra un pulsante grande per ogni mappa pubblicata, con l’immagine del nodo principale o un’icona di riserva: basta sceglierne uno per iniziare. Il link mostrato dopo la pubblicazione continua ad aprire il singolo gioco.

### Giocare

Premi *Giochiamo!* e trascina ogni immagine nella sua casella, oppure selezionala e tocca la destinazione. Dopo un errore compare uno degli indizi associati all’immagine trascinata, scelto a caso, oppure un incoraggiamento se non ce ne sono. Puoi scrivere fino a tre indizi per nodo nell’editor; nelle nuove mappe AI vengono generati automaticamente.

Su dispositivi touch puoi avvicinare o allontanare due dita per regolare lo zoom, sia nell’editor sia nel gioco. Usa *−* per rimpicciolire e *+* per ingrandire la mappa; trascina lo sfondo con la manina per spostarti. *Vedi tutta la mappa* la adatta alla finestra.

Ogni immagine sistemata fa avanzare verso uno dei cinque titoli premio, personalizzabili dall’insegnante. Errori e tempo non penalizzano il bambino. Alla fine puoi premere *Giochiamo ancora ↻* oppure *Scegli un altro gioco* per tornare alla pagina dell’insegnante. Il pulsante *Suoni attivi* permette di attivare o disattivare l’audio.

## Persistenza ed esportazione

Il database SQLite è salvato in *`./data/mindmaps.db`*, rispetto alla directory da cui viene avviata l'applicazione. Non è richiesto un server database esterno. Conserva le directory `data` e `upload` tra gli avvii e includile entrambe nei backup: contengono database e immagini salvate. La cartella delle immagini è configurabile con `app.upload.directory` (o `APP_UPLOAD_DIRECTORY`).

Il job di pulizia delle immagini orfane viene eseguito ogni notte alle 03:00: considera mappe, alternative e copie pubblicate, ed elimina i file solo dopo il commit della rimozione dei metadati. Un’immagine deve risultare orfana da almeno sette giorni prima di essere eliminata. Il job rimuove anche i file senza metadati più vecchi del periodo di conservazione. Configurazione: `app.image-cleanup.enabled`, `app.image-cleanup.cron` e `app.image-cleanup.retention-days`.

Le password degli utenti sono memorizzate come hash BCrypt. Le mappe private sono accessibili solo al proprietario; i link pubblici consentono di giocare senza accedere all'editor.

Per trasferire o conservare una mappa modificabile, usa *Esporta* in fondo alla toolbar dell’editor: scarica un file JSON con struttura, aspetto, indizi, titoli premio e immagini salvate sul server. I link alle immagini esterne restano link. Da *Modelli pronti → Importa mappa*, seleziona il file per creare una nuova mappa privata e aprirla nell’editor, senza modificare le mappe esistenti. Sono supportati file fino a 100 MB con un massimo di 1000 nodi; le immagini incorporate vengono salvate e normalizzate sul server, mantenendo le GIF animate. La pubblicazione del gioco va eseguita nuovamente dalla mappa importata.

Per esportare un’immagine della mappa, il browser invia l'SVG corrente al backend, che produce il file PNG o PDF scaricabile. Il PDF supporta A4 e A3.

## Endpoint principali

Le pagine usano Thymeleaf e l'editor comunica con le API interne. Gli endpoint di gestione richiedono l'autenticazione.

| Metodo | Percorso                    | Funzione                                                                      |
|--------|-----------------------------|-------------------------------------------------------------------------------|
| `GET`  | `/login`                    | Accesso                                                                       |
| `GET`  | `/maps`                     | Elenco delle proprie mappe                                                    |
| `GET`  | `/maps/{id}`                | Editor                                                                        |
| `GET`  | `/api/maps/{id}`            | Dati della mappa privata                                                      |
| `POST` | `/api/map-generations`      | Avvia una creazione AI in background e restituisce l’identificativo           |
| `GET`  | `/api/map-generations/{id}` | Restituisce stato, attività corrente e nodi preparati della propria richiesta |
| `POST` | `/maps/{id}/publish`        | Pubblicazione del gioco                                                       |
| `POST` | `/maps/{id}/unpublish`      | Ritiro della pubblicazione                                                    |
| `GET` | `/api/maps/{id}/export/json` | File JSON della mappa con immagini locali incorporate |
| `POST` | `/api/maps/import` | Importazione di un file JSON in una nuova mappa privata |
| `POST` | `/api/maps/{id}/export/png` | Esportazione PNG dall'SVG                                                     |
| `POST` | `/api/maps/{id}/export/pdf` | Esportazione PDF dall'SVG                                                     |
| `GET`  | `/play/teachers/{teacherName}` | Pagina pubblica dei giochi dell’insegnante                                     |
| `GET`  | `/play/{token}`             | Pagina pubblica del gioco                                                     |
| `POST` | `/play/{token}/start`       | Avvio di una partita pubblica                                                 |
| `POST` | `/play/{token}/attempt`     | Verifica di un abbinamento                                                    |

## Contributi e licenza

Per proporre miglioramenti, apri una issue o una pull request nel repository.

Il progetto è distribuito con licenza *GNU GPL v3 o successiva*.
