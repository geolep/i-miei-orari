## I Miei Orari

Applicazione web per **gestire gli orari di lavoro di un team**, pensata per piccole/medie realtà (negozi, bar, ristoranti, uffici) che hanno bisogno di:

- organizzare turni settimanali
- monitorare ore lavorate, ferie, permessi, straordinari
- avere una vista chiara per dipendente e per settimana/mese


---

## Funzionalità principali

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
  - Database PostgreSQL
- **Altre librerie**:
  - `date-fns` (con locale italiana) per la gestione delle date
  - `xlsx` per l’esportazione dei dati

---

## Come eseguirlo in locale

### Prerequisiti

- **Node.js** (versione consigliata LTS)
- Un account **Supabase** con:
  - URL del progetto
  - chiave anon pubblica

### Installazione

```bash
git clone https://github.com/<tu-utente-github>/i-miei-orari.git
cd i-miei-orari
npm install
```

Configura le variabili d’ambiente creando un file `.env.local` nella root del progetto, ad esempio:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

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
  - `incassi/IncassiChart`, `IncassiForm`, `IncassiTable`
  - `auth/LoginForm`, `auth/AuthProvider`
  - componenti UI riutilizzabili (`button`, `card`, `dialog`, ecc.)
- `src/lib`
  - `supabase`, `supabaseClient`, utilità varie

---
