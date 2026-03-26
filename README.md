## I Miei Orari

Applicazione web per **gestire gli orari di lavoro di un team**, pensata per piccole/medie realtà (negozi, bar, ristoranti, uffici) che hanno bisogno di:

- organizzare turni settimanali
- monitorare ore lavorate, ferie, permessi, straordinari
- avere una vista chiara per dipendente e per settimana/mese

Una delle novità centrali è l’**assistente conversazionale in italiano**: integrato nella dashboard per **amministratori e manager**, usa l’intelligenza artificiale collegata ai dati reali del team (turni, dipendenti, modelli di settimana) per rispondere a domande, consultare orari e supportare inserimenti o modifiche dei turni con conferma esplicita prima di applicare le modifiche.

---

## Funzionalità principali

### Assistente AI (dashboard)

- **Disponibilità**: widget di chat nella dashboard per utenti con ruolo **admin** o **manager** (gli altri ruoli non vedono l’assistente).
- **Linguaggio e modello**: risposte in italiano tramite API **OpenAI** (modello configurato nell’endpoint chat); risposta in **streaming** (SSE) per un’esperienza simile a una chat moderna.
- **Dati aggiornati**: l’assistente non “inventa” gli orari: usa **tool** lato server che interrogano Supabase (ricerca dipendenti, lettura turni, turni predefiniti, settimana tipo, statistiche, ecc.).
- **Sicurezza operativa**: per **inserire o modificare turni** segue un flusso in due fasi — prima mostra un riepilogo e chiede conferma; solo dopo una conferma esplicita esegue le operazioni sul database.
- **Cronologia**: conversazioni e messaggi salvati in Supabase (`chat_conversations`, `chat_messages`), con possibilità di riprendere le chat dal widget.

- **Autenticazione**:
  - Registrazione, login, reset e aggiornamento password
  - Gestione sessione con Supabase

- **Dashboard orari**:
  - Vista settimanale dei turni tramite componente `TeamSchedule`
  - Supporto a diversi tipi di turno: lavorativo, permesso, ferie, malattia, straordinario
  - Evidenziazione automatica di domeniche e festività italiane

- **Gestione dipendenti**:
  - Creazione e modifica dipendenti (nome, cognome, email, ruolo, ore settimanali)
  - Calcolo ore lavorate e riepiloghi per anno/mese

- **Incassi (sezione sperimentale)**:
  - Tracciamento incassi e reportistica base

- **Esportazione dati**:
  - Esportazione in **Excel (.xlsx)** di orari e riepiloghi

---

## Stack tecnico

- **Framework**: Next.js (App Router)
- **Linguaggio**: TypeScript
- **UI**:
  - React + componenti UI personalizzati (`button`, `card`, `dialog`, ecc.)
  - Tailwind CSS
  - Icone `lucide-react`
- **Backend-as-a-Service**: Supabase
  - Autenticazione
  - Database PostgreSQL (incluso persistenza chat assistente)
- **Assistente AI**: SDK `openai` (API route Next.js `/api/chat`, tool calling)
- **Altre librerie**:
  - `date-fns` (con locale italiana) per la gestione delle date
  - `xlsx` per l’esportazione dei dati
  - `react-markdown` / `remark-gfm` per la formattazione dei messaggi in chat

---

## Come eseguirlo in locale

### Prerequisiti

- **Node.js** (versione consigliata LTS)
- Un account **Supabase** con:
  - URL del progetto
  - chiave anon pubblica
- Una **chiave API OpenAI** (`OPENAI_API_KEY`) se vuoi usare l’assistente AI in dashboard

### Installazione

```bash
git clone https://github.com/geolep/i-miei-orari.git
cd i-miei-orari
npm install
```

Configura le variabili d’ambiente creando un file `.env.local` nella root del progetto, ad esempio:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
OPENAI_API_KEY=...
```

La chiave `OPENAI_API_KEY` è necessaria per l’assistente AI in dashboard; senza di essa la chat non può contattare il modello.

### Avvio ambiente di sviluppo

```bash
npm run dev
```

L’applicazione sarà disponibile su `http://localhost:3000`.

---

## Architettura del progetto

Struttura semplificata:

- `src/app`
  - `(auth)/login`, `register`, `reset-password`, `update-password`
  - `(dashboard)/dashboard`, `employees`, `incassi`, `profile`, `requests`
  - `complete-registration`, `privacy`, `termini`
- `src/components`
  - `TeamSchedule`, `ShiftDialog`
  - `chat/ChatWidget` — assistente AI (dashboard admin/manager)
  - `incassi/IncassiChart`, `IncassiForm`, `IncassiTable`
  - `auth/LoginForm`, `auth/AuthProvider`
  - componenti UI riutilizzabili (`button`, `card`, `dialog`, ecc.)
- `src/app/api/chat`
  - Route `POST`/`GET` per chat in streaming e gestione conversazioni
- `src/lib`
  - `supabase`, `supabaseClient`, `chat-tools` (tool per l’assistente), utilità varie

---
## Screenshots

### Dashboard
<img width="1775" height="926" alt="Screenshot 2026-01-28 alle 10 43 45" src="https://github.com/user-attachments/assets/49aa2691-95da-4b3f-9216-d5043cecaa97" />

### Gestione Dipendenti 
<img width="1608" height="613" alt="Screenshot 2026-01-28 alle 10 44 25" src="https://github.com/user-attachments/assets/d63f87d0-6086-48b3-89b9-3083d605456a" />

### Incassi
<img width="1200" height="1017" alt="Screenshot 2026-01-28 alle 10 46 25" src="https://github.com/user-attachments/assets/d9cf9d65-aa78-4693-8839-cef908b0aeaf" />

Licenza di rilascio: MIT

