# 🧠✨ Alice's Simple Mind Maps

Un'applicazione per creare mappe mentali e trasformarle in giochi delle immagini per la scuola primaria.

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Java CI](https://github.com/saidone75/simple-mindmap/actions/workflows/build.yml/badge.svg)](https://github.com/saidone75/simple-mindmap/actions/workflows/build.yml)
[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=saidone75_alice-s-simple-mind-maps&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=saidone75_alice-s-simple-mind-maps)
[![Reliability Rating](https://sonarcloud.io/api/project_badges/measure?project=saidone75_alice-s-simple-mind-maps&metric=reliability_rating)](https://sonarcloud.io/summary/new_code?id=saidone75_alice-s-simple-mind-maps)
[![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=saidone75_alice-s-simple-mind-maps&metric=sqale_rating)](https://sonarcloud.io/summary/new_code?id=saidone75_alice-s-simple-mind-maps)

Versione in sviluppo: **0.1.1-SNAPSHOT**. Ultima release: **0.1.0**. Le novità sono raccolte nel [changelog](CHANGELOG.md).

## Funzionalità

- Mappe create da zero, da template o generate con AI.
- Editor SVG con trascinamento dei nodi, disposizione automatica, zoom e salvataggio automatico.
- Personalizzazione di testi, descrizioni, emoji, immagini, colori e collegamenti.
- Immagini caricate da file, tramite URL o cercate su Wikimedia durante la generazione AI.
- Duplicazione ed eliminazione delle mappe.
- Esportazione in PNG e PDF nei formati A4 e A3.
- Accesso con account e mappe private per ciascun proprietario.
- Pubblicazione di giochi delle immagini tramite link pubblico revocabile.
- Interfacce adattate a computer, tablet e dispositivi mobili.

## Requisiti

- **JDK 21**.
- **Maven 3.6.3 o successivo**; consigliato Maven 3.9+.
- Un browser moderno.
- Connessione a Internet al primo avvio per scaricare il modello di embedding e le librerie native richieste da DJL/PyTorch. La generazione AI e la ricerca Wikimedia richiedono inoltre accesso ai rispettivi servizi.

Lo stack comprende **Spring Boot 4.1.1**, Spring Security, Spring Data JPA, Thymeleaf, SQLite e JavaScript senza framework frontend.

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

Apri **http://localhost:9080/maps** ed effettua l'accesso. L'utente iniziale viene creato solo se entrambe le variabili sono valorizzate e l'account non esiste già. Cambiare le variabili non modifica la password di un account esistente.

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

### Build e avvio del JAR

Per compilare e verificare il progetto con i test già presenti:

```bash
mvn -B clean verify
```

L'artefatto eseguibile è `target/mindmaps-0.1.1-SNAPSHOT.jar`. Con credenziali e directory dei dati già configurate:

```bash
java -jar target/mindmaps-0.1.1-SNAPSHOT.jar --spring.profiles.active=prod
```

Il profilo `dev` scrive i log in console e su file, mentre `prod` li scrive in `./log/mindmaps.log`. I profili sono di Spring: non occorre un profilo Maven `-Pprod`.

Per costruire il JAR saltando l'esecuzione dei test è disponibile `bash build.sh`.

## Gioco delle immagini

### Pubblicare una mappa

1. Nell'editor, aggiungi almeno un'immagine ai nodi.
2. Premi **Pubblica come gioco**.
3. Copia il link pubblico e condividilo con i bambini: non occorre un account per giocare.

La pubblicazione salva una copia della mappa con gli stessi testi, collegamenti, colori, disposizione e dimensioni dei nodi. Le modifiche successive nell'editor non cambiano il gioco già pubblicato.

**Aggiorna gioco pubblicato** crea una nuova copia e un nuovo link, disattivando quello precedente. **Ritira pubblicazione** disabilita il link e impedisce ulteriori tentativi nelle partite già avviate.

### Giocare

Premi **Giochiamo!** e prendi un'immagine dallo zainetto. Trascinala nella casella corretta, oppure selezionala e poi tocca la casella; da tastiera puoi usare Invio o Spazio sui controlli. Ogni nodo può avere **tre indizi per il gioco**, modificabili nell’editor. Dopo ogni errore il server ne sceglie uno a caso tra quelli compilati, ignorando eventuali duplicati. Scrivi aiuti diversi che facciano ragionare, senza svelare la risposta. Se tutti i campi sono vuoti, compare un incoraggiamento generico; descrizione e titolo non vengono usati come indizi. Le nuove mappe AI includono tre indizi diversi e modificabili. I nodi già esistenti conservano il loro primo indizio; puoi aggiungere gli altri due nell’editor. Per applicare gli indizi a un gioco già condiviso, premi **Aggiorna gioco pubblicato** e condividi il nuovo link.

I pulsanti **− / +** e il cursore regolano lo zoom dal **10% al 250%**. **Vedi tutta la mappa** adatta la vista alla finestra. Trascina lo sfondo con la manina per esplorare la mappa ingrandita, anche con il tocco.

Durante il gioco si vedono i progressi, senza cronometro o conteggio degli errori. **Giochiamo ancora ↻** avvia una nuova partita. Ogni sessione del browser mantiene una sola partita attiva; i risultati vengono mostrati alla fine e non sono archiviati in una classifica.

## Persistenza ed esportazione

Il database SQLite è salvato in **`./data/mindmaps.db`**, rispetto alla directory da cui viene avviata l'applicazione. Non è richiesto un server database esterno. Conserva la directory `data` tra gli avvii: contiene utenti, mappe e copie pubblicate.

Le password degli utenti sono memorizzate come hash BCrypt. Le mappe private sono accessibili solo al proprietario; i link pubblici consentono di giocare senza accedere all'editor.

Per esportare una mappa, il browser invia l'SVG corrente al backend, che produce il file PNG o PDF scaricabile. Il PDF supporta A4 e A3.

## Endpoint principali

Le pagine usano Thymeleaf e l'editor comunica con le API interne. Gli endpoint di gestione richiedono l'autenticazione.

| Metodo | Percorso                    | Funzione                      |
|--------|-----------------------------|-------------------------------|
| `GET`  | `/login`                    | Accesso                       |
| `GET`  | `/maps`                     | Elenco delle proprie mappe    |
| `GET`  | `/maps/{id}`                | Editor                        |
| `GET`  | `/api/maps/{id}`            | Dati della mappa privata      |
| `POST` | `/maps/{id}/publish`        | Pubblicazione del gioco       |
| `POST` | `/maps/{id}/unpublish`      | Ritiro della pubblicazione    |
| `POST` | `/api/maps/{id}/export/png` | Esportazione PNG dall'SVG     |
| `POST` | `/api/maps/{id}/export/pdf` | Esportazione PDF dall'SVG     |
| `GET`  | `/play/{token}`             | Pagina pubblica del gioco     |
| `POST` | `/play/{token}/start`       | Avvio di una partita pubblica |
| `POST` | `/play/{token}/attempt`     | Verifica di un abbinamento    |

## Contributi e licenza

Per proporre miglioramenti, apri una issue o una pull request nel repository.

Il progetto è distribuito con licenza **GNU GPL v3 o successiva**.
