# Documentazione Progetto: Corso Video Chiara

Questo documento raccoglie tutte le informazioni sull'architettura, i flussi, e le procedure di sviluppo e messa in produzione per la piattaforma del corso video. È la guida principale (master) da cui partire per orientarsi nel progetto.

## Indice

1. [Architettura del Sistema](#1-architettura-del-sistema)
2. [Flussi Principali](#2-flussi-principali)
3. [Configurazione e Sviluppo Locale](#3-configurazione-e-sviluppo-locale)
4. [Deploy Backend (AWS)](#4-deploy-backend-aws)
5. [Messa in Produzione (Go Live)](#5-messa-in-produzione-go-live)
6. [Credenziali e Output Utili](#6-credenziali-e-output-utili)

---

## 1. Architettura del Sistema

Il progetto è diviso in due macro-componenti:

*   **Frontend**: Sviluppato in React 18, TypeScript, Vite, Tailwind CSS. Ospitato su AWS Amplify.
*   **Backend (Serverless)**: Architettura su AWS definita tramite AWS SAM (Serverless Application Model).
    *   **API**: AWS API Gateway
    *   **Compute**: AWS Lambda (in Python 3.11)
    *   **Database**: Amazon DynamoDB
    *   **Storage & CDN**: Amazon S3 + CloudFront (per lo storage dei video e la distribuzione sicura)
    *   **Autenticazione**: Amazon Cognito
    *   **Email**: Resend (via API) per l'invio delle email di benvenuto e di sistema.
    *   **Pagamenti**: Stripe (Checkout e Webhook)

---

## 2. Flussi Principali


### 2.1 Flusso Utente (Acquisto e Fruizione)
1. **Esplorazione Catalogo**: L'utente atterra sulla landing page pubblica, che ora interroga dinamicamente il backend per mostrare in vetrina tutti i corsi con stato "Pubblicato".
2. **Checkout**: L'utente seleziona un corso e atterra nel carrello. Il frontend chiama `POST /payment/create-checkout` che restituisce il link al Checkout di Stripe. L'utente viene reindirizzato e inserisce la carta di credito.
3. **Pagamento ed Evento**: A pagamento completato con successo, Stripe invia un Webhook asincrono (`checkout.session.completed`) all'endpoint API Gateway `/payment/webhook`.
4. **Elaborazione Webhook (Lambda)**: La funzione `payment_handler` riceve l'evento da Stripe ed effettua queste operazioni critiche:
   * Registra l'acquisto in DynamoDB (tabella Purchases).
   * Crea l'utente in AWS Cognito.
   * Genera una **Password Temporanea** (che ha una validità massima estesa a **365 giorni**).
   * Invia l'email di benvenuto con la password temporanea utilizzando l'API di **Resend** (bypassa la Sandbox di AWS SES per evitare blocchi).
5. **Login e Cambio Password**: L'utente accede tramite Cognito (con la propria email e la password temporanea). Cognito forza il cambio password (`NEW_PASSWORD_REQUIRED`) e il frontend chiede all'utente di inserire la sua password personale e definitiva.
6. **Fruizione Video**: Il frontend richiede la visione di un video (`GET /course/video/{lesson_id}`). La Lambda del backend verifica che l'utente abbia acquistato il corso e restituisce un **URL pre-firmato (Presigned URL)** per CloudFront, garantendo che i video siano protetti e non possano essere scaricati illegalmente.

### 2.2 Flusso Amministratore (Caricamento e Gestione)
1. **Login Admin**: Un account flaggato come amministratore (tramite Cognito Group) effettua l'accesso.
2. **Upload Video**: L'admin chiede un link di upload sicuro (`POST /admin/video/upload`). Il frontend carica poi il file video (anche di grosse dimensioni) direttamente dal browser al bucket S3 usando questo link firmato (S3 Presigned URL for PutObject).
3. **Gestione Corsi**: L'admin può usare gli endpoint dedicati per creare, modificare e riordinare i Capitoli e le Lezioni (salvati su DynamoDB). Può anche consultare l'elenco degli iscritti e le metriche di base.
4. **Assegnazione Manuale (Enrollment)**: L'admin può assegnare un corso a uno studente manualmente dalla dashboard (`POST /admin/student/{studentId}/grant-course`). Questo genera un acquisto fittizio a importo 0, sbloccando i contenuti (utile per regali o bonifici).
5. **Recupero Password / Assistenza**: Se uno studente perde l'email di benvenuto, l'admin può andare nella scheda "Studenti", cliccare su "Invia di nuovo email di benvenuto", e il backend genererà una *nuova* password temporanea reinviando l'email in automatico.

---


## 3. Configurazione e Sviluppo Locale

### Frontend
Per avviare il frontend in locale per lo sviluppo:
```bash
# Entra nella cartella frontend
cd frontend

# Assicurati di usare Node v20 (come indicato nel file avvio.txt)
nvm use 20

# Installazione dipendenze
npm install

# Avvio server di sviluppo sulla porta 5173
npm run dev
```

Nel file `.env` del frontend devono essere impostate le variabili che AWS genera dopo aver deployato il backend:
```env
VITE_COGNITO_USER_POOL_ID=us-east-1_YMVsKScIc
VITE_COGNITO_USER_POOL_CLIENT_ID=4uppkbmvv3e2sinb8gpgauv32c
VITE_API_BASE_URL=https://nyer89lvbj.execute-api.us-east-1.amazonaws.com/prod
VITE_AWS_REGION=us-east-1
# Aggiungere anche VITE_STRIPE_PUBLIC_KEY
```

---

## 4. Deploy Backend (AWS)

Il backend è gestito interamente come "Infrastructure as Code" tramite AWS SAM. Tutte le operazioni vanno eseguite dalla cartella `backend/infrastructure`, utilizzando il profilo AWS locale `personale`.

**Comandi per Build e Deploy:**
```bash
cd backend/infrastructure

# 1. Costruisci il progetto (Pacchettizza il codice Lambda e le dipendenze Python)
sam build

# 2. Deploy rapido per sviluppi e modifiche al codice (Usa valori fittizi per saltare i controlli delle chiavi)
sam deploy --stack-name corso-video-chiara \
  --parameter-overrides \
    Environment=prod \
    StripeSecretKey=dummy \
    StripeWebhookSecret=dummy \
    ResendApiKey=dummy \
  --capabilities CAPABILITY_IAM \
  --resolve-s3 \
  --profile personale

# (Nota: se devi configurare i secrets VERI per la prima volta in produzione, sostituisci i valori "dummy" con le chiavi reali)
```

> [!TIP]
> Dopo ogni esecuzione di `sam deploy`, il terminale restituisce una tabella "Outputs". Qui troverai gli identificatori chiave (ApiEndpoint, UserPoolId, ecc.) da inserire nel file `.env` del frontend.

---

## 5. Messa in Produzione (Go Live)

Per lanciare realmente il progetto al pubblico e incassare denaro reale, è necessario seguire questi tre step:

### 5.1 Configurare Resend (Anti Spam)
1. Vai su Resend.com -> **Domains**.
2. Aggiungi il dominio ufficiale (es. `chiarapmu.it`) e ottieni i record DNS (`TXT`, `MX`, `CNAME`).
3. Inserisci questi record nel pannello del provider (Aruba, GoDaddy, ecc.) e attendi lo stato "Verified" (tutto verde).
4. **Modifica il Codice**: In `backend/lambda/payment_handler/app.py` e `admin_handler/app.py`, sostituisci il mittente di test con quello ufficiale, ad es. `"Chiara Morocutti <info@chiarapmu.it>"`.

### 5.2 Passare Stripe in Modalità Live
1. Dalla dashboard di Stripe, disattiva l'interruttore **"Test Mode"** (in alto a destra).
2. Vai su **Developers -> API Keys** e copia la **Secret Key Live** (`sk_live_...`).
3. Vai su **Developers -> Webhooks** e clicca "Add endpoint".
4. Inserisci l'URL dell'API: `https://nyer89lvbj.execute-api.us-east-1.amazonaws.com/prod/payment/webhook`.
5. Seleziona l'evento `checkout.session.completed` (e aggiungi l'endpoint).
6. Copia il nuovo **Signing secret Live** (`whsec_...`).

### 5.3 Deploy Finale (Live Keys)
Torna nel terminale e fai l'ultimo deploy passando le nuove chiavi Live:

```bash
cd backend/infrastructure
sam build

sam deploy --stack-name corso-video-chiara \
  --parameter-overrides \
    Environment=prod \
    StripeSecretKey=sk_live_TUA_CHIAVE_SEGRETA_QUI \
    StripeWebhookSecret=whsec_TUA_CHIAVE_WEBHOOK_QUI \
    ResendApiKey=re_TUA_CHIAVE_RESEND \
  --capabilities CAPABILITY_IAM \
  --resolve-s3
```

> [!CAUTION]
> Quando esegui questo comando, il tuo server inizierà ad accettare pagamenti reali (e rifiuterà quelli con le carte di test). Controlla che le chiavi non contengano refusi.

---

## 6. Credenziali e Output Attuali

Di seguito gli "Outputs" dell'infrastruttura attualmente rilasciata (ambiente prod). Questi valori sono vitali per la configurazione del Frontend:

*   **API Gateway URL**: `https://nyer89lvbj.execute-api.us-east-1.amazonaws.com/prod`
*   **Cognito User Pool ID**: `us-east-1_YMVsKScIc`
*   **Cognito User Pool Client ID**: `4uppkbmvv3e2sinb8gpgauv32c`
*   **CloudFront Domain**: `d39fyhcntf368y.cloudfront.net`
