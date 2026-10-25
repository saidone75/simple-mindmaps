# 🧠✨ Alice's Simple Mind Maps

Benvenuto in **Alice's Simple Mind Maps**, una web app leggera e immediata per creare mappe mentali in pochi click.
Pensata per essere intuitiva anche per chi non è tecnico e costruita con uno stack solido e moderno.

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
![Java CI](https://github.com/saidone75/simple-mindmaps/actions/workflows/build.yml/badge.svg)
[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=saidone75_alice-s-simple-mind-maps&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=saidone75_alice-s-simple-mind-maps)
[![Reliability Rating](https://sonarcloud.io/api/project_badges/measure?project=saidone75_alice-s-simple-mind-maps&metric=reliability_rating)](https://sonarcloud.io/summary/new_code?id=saidone75_alice-s-simple-mind-maps)
[![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=saidone75_alice-s-simple-mind-maps&metric=sqale_rating)](https://sonarcloud.io/summary/new_code?saidone75_alice-s-simple-mind-maps)

## 🚀 Cos'è

Simple MindMaps è un'applicazione Java/Spring Boot con interfaccia Thymeleaf che permette di:

- creare una nuova mappa,
- aggiungere rami e sotto-rami,
- personalizzare testo e stile,
- esportare il risultato.

Obiettivo: **trasformare idee in una struttura visiva chiara**.

---

## 🌟 Caratteristiche principali

- ✅ Creazione mappa rapida
- ✅ Template pronti
- ✅ Generazione mappe con AI
- ✅ Drag & drop dei nodi
- ✅ Modifica testo, colore e dimensione font
- ✅ Autosave dei nodi
- ✅ Export PNG
- ✅ Export PDF stampabile
- ✅ Login multiutente con mappe isolate per utente
- ✅ Eliminazione mappe e nodi
- ✅ Pubblicazione di giochi delle immagini con link pubblico revocabile

---

## 🧱 Stack tecnologico

### Backend
- **Java 21**
- **Spring Boot 4.0.7**
- **Spring Data JPA**
- **Spring Security**
- **SQLite** (persistito su file)

### Frontend
- **Thymeleaf**
- **JavaScript vanilla**
- **SVG** per rendering visuale della mappa

### Build & Tooling
- **Maven**

---

## 📋 Prerequisiti

Prima di avviare il progetto assicurati di avere:

- **JDK 21** installato
- **Maven 3.9+** disponibile da terminale
- Un browser moderno (Chrome, Edge, Firefox)

Verifica veloce:

```bash
java -version
mvn -version
```

---

## 🛠️ Avvio locale

1. Clona il repository
2. Avvia l'app:

```bash
INITIAL_USER_LOGIN=alice INITIAL_USER_PASSWORD=password-segreta mvn spring-boot:run
```

Se le variabili `INITIAL_USER_LOGIN` e `INITIAL_USER_PASSWORD` sono valorizzate, l'app crea automaticamente l'utente iniziale se non esiste già.

3. Apri nel browser:

```text
http://localhost:8080/maps
```

---

## 🔌 API / Endpoints principali

> Nota: l'app usa pagine server-side Thymeleaf + chiamate AJAX per i nodi.

### UI routes
- `GET /maps` → elenco mappe
- `GET /maps/{id}` → editor della mappa

### Operazioni mappe (backend)
- Creazione nuova mappa
- Eliminazione mappa
- Export PNG da canvas SVG
- Export PDF stampabile in formato A4/A3

### Operazioni nodi (backend/API interne)
- Creazione nodo (principale/figlio)
- Aggiornamento nodo (testo, colore, font, posizione)
- Eliminazione nodo
- Salvataggio automatico modifiche

---

## 💾 Persistenza dati

- Database locale SQLite persistito su file in:
  - `./data/mindmapdb.sqlite`
- Nessuna dipendenza da DB esterno per lo sviluppo iniziale.
- Gli utenti sono salvati nella tabella `users` con password cifrate.
- Ogni mappa è collegata all’utente proprietario e l’app mostra/modifica solo le mappe dell’utente autenticato.

---

## 📤 Export

- **PNG**: il browser invia l'SVG corrente al backend, che lo renderizza e restituisce un file PNG scaricabile.
- **PDF**: il browser invia l'SVG corrente al backend, che genera un PDF stampabile in formato A4 o A3.

---

## 🧪 Idee per evoluzioni future

- Export PDF server-side
- Undo/Redo completo
- Libreria icone e sticker
- Condivisione mappe via link

---

## 🤝 Contributi

Hai idee per rendere l'app ancora più utile o divertente?
Apri una issue o proponi una PR: ogni contributo è il benvenuto. 🚀


## Gioco delle immagini

Nell’editor, aggiungi almeno un’immagine e premi **Pubblica come gioco**. Copia il link pubblico mostrato: i ragazzi possono aprirlo senza account. La pubblicazione conserva una copia della mappa, con gli stessi testi, collegamenti, colori e dimensioni dei nodi. Le immagini vengono mescolate in un pannello laterale: si possono trascinare oppure selezionare e poi inserire toccando una casella (anche con Invio o Spazio da tastiera).

Ogni risposta errata mostra la descrizione del nodo corretto come suggerimento; quando manca, viene indicato il titolo. Il server conta tentativi, errori e tempo. Il punteggio premia il completamento della mappa fino a **1.000 punti**: i primi **3 errori sono gratuiti**, poi si perdono solo **5 punti per errore**, con una riduzione massima di **100 punti**. Chi completa la mappa ottiene quindi almeno **900 punti**. Il tempo non comporta penalità: viene registrato dall’inizio alla fine e mostrato solo a partita conclusa. Durante il gioco si vedono i progressi, senza cronometro o conteggio degli errori, e ogni risposta riceve un messaggio incoraggiante. **Ricomincia** avvia una nuova partita; ogni sessione del browser mantiene una sola partita attiva. I risultati sono mostrati a fine partita e non vengono archiviati.

**Aggiorna gioco pubblicato** crea una nuova copia e un nuovo link, disattivando il precedente. **Ritira pubblicazione** disabilita il link e le partite in corso. Le modifiche alla mappa privata non cambiano la copia pubblicata finché non viene aggiornata.

I test dell’interazione e della geometria condivisa si eseguono con Node.js:

```bash
node --test src/test/js/map-game.test.cjs
```
