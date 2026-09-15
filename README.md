# Chiara Morocutti Academy — Piattaforma VideoCorso Pro

Piattaforma cloud proprietaria ad alte prestazioni per la vendita, fruizione e protezione di video corsi professionali (Masterclass Microblading).  
Il frontend React è distribuito a livello globale tramite **AWS Amplify**; il backend è un'infrastruttura serverless su **AWS SAM** con API Gateway, Lambda, DynamoDB, Cognito, S3/CloudFront e Stripe. La pipeline MediaConvert esiste ma resta disabilitata in produzione per evitare costi di transcodifica.

---

## 🌐 Stato degli Ambienti

| Ramo Git | Uso | URL Web |
| --- | --- | --- |
| `main` | **Produzione** | [https://main.d26u0xz2smmxfz.amplifyapp.com](https://main.d26u0xz2smmxfz.amplifyapp.com) |
| `development` | Collaudo prima del merge | [https://development.d26u0xz2smmxfz.amplifyapp.com](https://development.d26u0xz2smmxfz.amplifyapp.com) |

* **Dominio Ufficiale**: `chiaramorocuttiacademy.it` (Hosted Zone Route 53 `Z05326521WTI2F8WSWCGI`)
* **Email Transazionale Ufficiale**: `Chiara Morocutti Academy <noreply@chiaramorocuttiacademy.it>` (AWS SES `us-east-1`, DKIM + SPF + DMARC)
* **Repository**: `github.com/nicolamaraschi/VideoCorso`
* **Amplify App ID**: `d26u0xz2smmxfz`
* **Stack CloudFormation Backend**: `corso-video-chiara`
* **API Gateway Produzione**: `https://nyer89lvbj.execute-api.us-east-1.amazonaws.com/prod`
* **Regione AWS**: `us-east-1` (N. Virginia)

---

## ⚡ Regola AWS Obbligatoria

**Tutti i comandi AWS CLI e SAM devono utilizzare il profilo `--profile personale`.**  
Account AWS associato: `170884089098` (`videocorso-admin`).

```bash
# Verifica identità prima di qualsiasi operazione
aws --profile personale sts get-caller-identity
```

---

## 📁 Struttura del Progetto

```text
VideoCorso/
├── frontend/                  # Applicazione React 18 + TypeScript + Vite + Tailwind/CSS
│   ├── src/pages/             # Pagine (Dashboard, Player, Checkout, Admin, System Logs)
│   ├── src/components/        # Componenti UI (Player con Watermark, Sidebar, Modali)
│   └── src/services/          # Client API, authService, adminService, courseService
├── backend/
│   ├── infrastructure/        # template.yaml (AWS SAM CloudFormation con 8 Lambda)
│   ├── layers/shared/         # Layer Python condiviso (purchase_access, audit_logger, email_sender)
│   ├── lambda/                # I microservizi serverless:
│   │   ├── admin_handler/     # Gestione studenti, acquisti, catalogo, statistiche, log
│   │   ├── payment_handler/   # Checkout Stripe, webhook idempotenti, coupon, email SES
│   │   ├── provisioning_outbox_handler/ # Provisioning automatico Cognito & email
│   │   ├── video_handler/     # Controllo permessi e URL CloudFront firmati SHA-256
│   │   ├── progress_handler/  # Tracciamento avanzamento lezioni corsiste
│   │   ├── course_handler/    # Catalogo corsi, capitoli e lezioni pubbliche
│   │   ├── coupon_reservation_recovery_handler/ # Cron recupero coupon scaduti
│   │   └── video_transcode_handler/ # Pipeline MediaConvert per rendizioni 1080p-360p
│   └── tests/                 # Suite pytest di test unitari e di integrazione
├── docs/
│   ├── OPERATIONS.md          # Runbook operativo, incident recovery, gestione Cognito & SES
│   └── GUIDA_CARICAMENTO_VIDEO_SSD.md # Istruzioni transcodifica e caricamento S3
└── Relazione_Opere_Chiara_Morocutti_Academy.pdf # Documentazione tecnico-economica per il cliente
```

---

## 🎓 Corso & Contenuti Caricati

La piattaforma ospita il corso completo **Masterclass Microblading** suddiviso in **10 Moduli** e **54 Lezioni video Full HD** con 64 copertine personalizzate su AWS S3:
1. **Modulo 1**: Presentazione e Benvenuto
2. **Modulo 2**: Teoria e Fondamenti del Microblading (21 lezioni)
3. **Modulo 3**: Anatomia, Tipi di Pelle e Controindicazioni (7 lezioni)
4. **Modulo 4**: Studio delle Forme e Progettazione su Modella (3 lezioni)
5. **Modulo 5**: Schemi e Direzione Peli / Spine (6 lezioni)
6. **Modulo 6**: Esercitazioni Pratiche su Lattice (7 lezioni)
7. **Modulo 7**: Trattamento Completo su Modella Live (5 lezioni)
8. **Modulo 8**: Normative Igienico-Sanitarie e Consenso (4 lezioni)
9. **Modulo 9**: Consulenza, Vendita e Fidelizzazione Clienti (9 lezioni)
10. **Modulo 10**: Strategie di Marketing e Acquisizione Clienti (9 lezioni)

---

## 🎬 Distribuzione e ottimizzazione video

Stato aggiornato al **7 settembre 2026**. L'ottimizzazione mantiene il bucket
video in `us-east-1` e usa CloudFront come livello di distribuzione globale. Non
è necessario spostare il bucket: gli studenti italiani ricevono i byte dal POP
CloudFront di Milano quando presenti in cache, mentre OAC mantiene S3 privato.

### Flusso di accesso

```text
Corsista autenticata
        │ JWT Cognito
        ▼
API Gateway → VideoHandler → verifica acquisto/accesso corso
                                │
                                └─ URL CloudFront firmato SHA-256 (2 ore)
                                                   │
                                                   ▼
Browser → CloudFront Trusted Key Group → OAC → bucket S3 privato
```

Un percorso S3 o CloudFront conosciuto non è sufficiente per scaricare una
lezione. CloudFront convalida firma e scadenza anche quando il contenuto è già
presente nella cache edge.

### Sicurezza attiva in produzione

* **Signed URLs SHA-256**: `VideoHandler` firma ogni singolo oggetto soltanto
  dopo il controllo dell'accesso al corso. Se chiave o configurazione non sono
  disponibili, il backend fallisce in modo sicuro e non restituisce un URL
  pubblico.
* **Trusted Key Group CloudFront**: `EnforceSignedVideoUrls=true` rende la firma
  obbligatoria. Un URL anonimo restituisce `403`; un URL valido supporta le
  richieste parziali `206` necessarie al seek.
* **Chiave privata fuori dal repository**: è conservata nel parametro SSM
  Standard SecureString `/videocorso/prod/cloudfront/private-key`. Nel template
  è presente esclusivamente la chiave pubblica.
* **S3 privato tramite OAC**: CloudFront firma le richieste verso S3 con SigV4.
  La vecchia OAI è mantenuta temporaneamente soltanto come percorso di rollback
  e non è usata dall'origine attiva.
* **Registro accessi video write-only**: ogni emissione autorizzata viene
  registrata in `prod-videocorso-video-access-logs`, con IP e User-Agent
  esclusivamente in forma hash e TTL di due anni.
* **Watermark di brand**: il player mostra il marchio CM Academy nelle aree
  laterali dei video verticali. Non viene presentato come protezione DRM.

### Ottimizzazioni di rete e backend

* **HTTP/2 e HTTP/3 attivi** tra browser e CloudFront.
* **POP edge di Milano verificato** (`MXP63-P8`) con supporto Range e risposta
  `206 Partial Content`.
* **Cache CloudFront di un anno** (`DefaultTTL` e `MaxTTL` pari a `31536000`)
  perché ogni upload usa un percorso versionato e immutabile:
  `videos/<lesson_id>/<asset_version>/source.mp4`.
* **OAI sostituita da OAC**, configurazione AWS corrente e compatibile con
  firma SigV4.
* **Zero lookup S3 superflui per gli asset `NATIVE`**: il backend non esegue più
  quattro chiamate `HeadObject` per cercare rendition che, per definizione, non
  esistono.
* **Fallback controllato**: se sono disponibili rendition locali, il backend
  seleziona la qualità richiesta; altrimenti serve l'originale senza fingere
  che esistano versioni alternative.

### Ottimizzazioni del player React

* Un solo elemento `<video>`: l'alone cinematografico usa un gradiente CSS e
  non scarica una seconda copia del filmato.
* Rimossa la vecchia sonda iniziale da 4 MB usata per leggere la rotazione.
* `preload="metadata"`: evita di scaricare centinaia di MB prima che la
  corsista prema Play.
* Ripresa effettiva dal secondo salvato tramite `seekToSeconds`.
* Cambio qualità senza perdere posizione e stato Play/Pausa.
* Il pannello mostra **Qualità originale** quando non esistono rendition, senza
  proporre pulsanti 1080p/720p/480p/360p non reali.
* Frecce semplici = salto di 10 secondi; `Shift`/`Alt` + freccia = cambio
  lezione. I due comandi non si attivano più contemporaneamente.
* Gestione coerente degli errori e riavvio esplicito del player.

### Vincoli di costo

Queste impostazioni sono intenzionali e non devono essere cambiate senza una
verifica economica:

| Impostazione | Valore produzione | Motivo |
| --- | --- | --- |
| `EnableTranscoding` | `false` | Nessun job MediaConvert a pagamento |
| `EnforceSignedVideoUrls` | `true` | Nessun accesso anonimo ai video |
| SSM private key | Tier `Standard` | Nessun costo Parameter Store aggiuntivo |
| CloudFront logging persistente | Disabilitato | Evita costi di delivery e storage dei log |
| CloudFront Price Class | `PriceClass_100` | Copre Europa e limita le edge location più costose |

Signed URLs, Trusted Key Group, OAC, HTTP/2 e HTTP/3 non introducono un nuovo
canone. Il TTL più lungo e la rimozione dei download duplicati riducono invece
richieste all'origine e traffico sprecato.

### Compressione locale e rendition

MediaConvert deve restare disattivato. Quando l'SSD con i sorgenti è collegato,
le versioni `1080p`, `720p`, `480p` e `360p` si generano sul Mac con:

```bash
python3 scripts/generate_local_video_renditions.py \
  --output-dir "/Volumes/Sviluppo/Chiara Morocutti/RENDITIONS_OTTIMIZZATE" \
  "/percorso/al/video-sorgente.mp4"
```

Lo script:

1. non accede ad AWS e non elimina il sorgente;
2. limita a 30 fps i filmati registrati a 60 fps;
3. genera MP4 H.264/AAC compatibili con browser e iPhone;
4. posiziona il box `moov` all'inizio per l'avvio rapido;
5. verifica che la durata di ogni output corrisponda al sorgente;
6. produce `renditions-report.json` con dimensioni e variazione di storage.

Non caricare le rendition se `safe_to_replace_cloud_copy` è `false`. Prima di
sostituire un originale cloud sono obbligatori backup su SSD e controllo visivo.
La procedura completa è in
[`docs/GUIDA_CARICAMENTO_VIDEO_SSD.md`](docs/GUIDA_CARICAMENTO_VIDEO_SSD.md).

### Verifiche dell'ultimo rilascio

Rilascio `5a69768`, Amplify job `207`:

* backend: **243 test superati**, 6 saltati perché dipendenti da credenziali di
  integrazione opzionali;
* frontend: lint, TypeScript e build Vite superati senza errori;
* stack CloudFormation: `UPDATE_COMPLETE`;
* richiesta CloudFront anonima: `403`;
* richiesta firmata con `Range`: `206` da Milano in HTTP/2;
* prova autenticata del player live: URL firmato, scorciatoie corrette,
  qualità reale e nessun errore console.

---

## 💳 Pacchetti Commerciali & Checkout Stripe

Configurati 3 livelli di acquisto con checkout dinamico:
1. **Corso Base (€ 590,00)**: Accesso completo a tutti i 10 moduli video.
2. **Masterclass Pro (€ 890,00)**: Corso completo + Kit Attrezzatura Professionale + Assistenza Dedicata.
3. **VIP Mentorship (€ 1.490,00)**: Corso + Kit Pro + 3 Mesi di Coaching 1-to-1 con Chiara.

* **Motore Coupon**: Supporto per sconti a percentuale (`%`), sconti fissi (`€`) e coupon di accesso gratuito al 100% con assegnazione deterministica dell'ID acquisto.
* **Accettazione Legale & Rinuncia al Recesso**: Registrazione del consenso contrattuale e rinuncia espressa ai 14 giorni di recesso (Art. 59 Codice del Consumo) memorizzata all'istante del pagamento.

---

## 🔍 Console Tecnica & Audit Log Backend (`/admin/system-logs`)

Tutte le **8 funzioni Lambda** scrivono in modo asincrono e non bloccante nella tabella `prod-videocorso-audit-logs`:
* **Filtri Rapidi**: `Tutti`, `🔴 Solo Errori / Criticità`, `🟡 Warning`, `💳 Pagamenti & Stripe`, `👤 Azioni Admin`.
* **Ricerca Istantanea**: Ricerca full-text su email, `pi_...`, tipo di azione, target o dettagli JSON.
* **Ispezione Diagnostica**: Visualizzazione istantanea del payload JSON e dello Stack Trace Python dell'errore.
* **Pulsante "Copia Report per Assistenza"**: Generazione in 1 clic del report di debug per risoluzione immediata dei problemi.
* **Protezione Automatica PII/PCI (Layer v4)**: Sanitizzazione automatica di password, carte, token e chiavi API prima della scrittura a database.

---

## 📧 Infrastruttura Email Transazionale & AWS SES (`chiaramorocuttiacademy.it`)

Tutte le comunicazioni transazionali (credenziali corsiste, ricevute acquisto, recupero password, inviti admin) sono gestite tramite **AWS Simple Email Service (SES)** in `us-east-1` con firma digitale e allineamento SPF:
* **Mittente Ufficiale**: `Chiara Morocutti Academy <noreply@chiaramorocuttiacademy.it>`
* **Reply-To**: `info@chiaramorocuttiacademy.it`
* **Easy DKIM (RSA 2048-bit)**: 3 record CNAME gestiti su Route 53.
* **Custom MAIL FROM**: Sottodominio `mail.chiaramorocuttiacademy.it` con MX `feedback-smtp.us-east-1.amazonses.com` e SPF `v=spf1 include:amazonses.com ~all` (garantisce il 100% di deliverability su Gmail, Yahoo, Apple Mail).
* **DMARC**: Policy attiva su `_dmarc.chiaramorocuttiacademy.it`.
* **Cognito User Pool Integration**: Cognito configurato in modalità `DEVELOPER` collegato all'ARN dell'identità SES per invio nativo del template HTML personalizzato.
* **Modulo Lambda Condiviso**: [`email_sender.py`](backend/layers/shared/python/shared/email_sender.py) con template HTML responsive e invio nativo con `boto3`.

---

## 🚀 Procedure di Deploy

### 1. Frontend (Amplify)
Il deploy frontend è automatizzato tramite CI/CD su Git:
```bash
cd frontend
npx tsc -b
npm run build
git add . && git commit -m "feat: aggiornamenti" && git push origin main
```

### 2. Backend (AWS SAM)
```bash
aws --profile personale sts get-caller-identity

sam build --template-file backend/infrastructure/template.yaml --profile personale --region us-east-1

sam deploy \
  --template-file .aws-sam/build/template.yaml \
  --stack-name corso-video-chiara \
  --parameter-overrides \
    Environment=prod \
    EnableTranscoding=false \
    EnforceSignedVideoUrls=true \
    AllowedCheckoutOrigins='https://chiaramorocuttiacademy.it,https://www.chiaramorocuttiacademy.it,https://main.d26u0xz2smmxfz.amplifyapp.com,https://development.d26u0xz2smmxfz.amplifyapp.com' \
    AllowedCorsOrigin='*' \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
  --resolve-s3 \
  --profile personale \
  --region us-east-1
```
