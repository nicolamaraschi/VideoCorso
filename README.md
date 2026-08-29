# Chiara Morocutti Academy — Piattaforma VideoCorso Pro

Piattaforma cloud proprietaria ad alte prestazioni per la vendita, fruizione e protezione di video corsi professionali (Masterclass Microblading).  
Il frontend React è distribuito a livello globale tramite **AWS Amplify**; il backend è un'infrastruttura serverless su **AWS SAM** con API Gateway, Lambda, DynamoDB, Cognito, S3/CloudFront, AWS MediaConvert e Stripe.

---

## 🌐 Stato degli Ambienti

| Ramo Git | Uso | URL Web |
| --- | --- | --- |
| `main` | **Produzione** | [https://main.d26u0xz2smmxfz.amplifyapp.com](https://main.d26u0xz2smmxfz.amplifyapp.com) |
| `development` | Collaudo prima del merge | [https://development.d26u0xz2smmxfz.amplifyapp.com](https://development.d26u0xz2smmxfz.amplifyapp.com) |

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
│   ├── layers/shared/         # Layer Python condiviso (purchase_access, audit_logger)
│   ├── lambda/                # I microservizi serverless:
│   │   ├── admin_handler/     # Gestione studenti, acquisti, catalogo, statistiche, log
│   │   ├── payment_handler/   # Checkout Stripe, webhook idempotenti, coupon
│   │   ├── provisioning_outbox_handler/ # Provisioning automatico Cognito & email
│   │   ├── video_handler/     # URL firmati streaming, controllo permessi, watermark
│   │   ├── progress_handler/  # Tracciamento avanzamento lezioni corsiste
│   │   ├── course_handler/    # Catalogo corsi, capitoli e lezioni pubbliche
│   │   ├── coupon_reservation_recovery_handler/ # Cron recupero coupon scaduti
│   │   └── video_transcode_handler/ # Pipeline MediaConvert per rendizioni 1080p-360p
│   └── tests/                 # Suite di test pytest unitari e di integrazione
├── docs/
│   ├── OPERATIONS.md          # Runbook operativo, incident recovery, gestione Cognito
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

## 🛡️ Motore Video & Protezione Anti-Pirateria

* **Streaming Adattivo Multi-Risoluzione**: Pipeline AWS MediaConvert che genera risoluzioni ottimizzate `1080p`, `720p`, `480p` e `360p` in QVBR.
* **Watermark Dinamico Anti-Rec**: Player video personalizzato con impronta semi-trasparente mobile contenente l'email del corsista e l'ID sessione (rende impossibile la diffusione anonima su Telegram/Drive).
* **URL Firmati a Scadenza**: Token crittografati CloudFront con validità 10 minuti per prevenire l'hotlinking.
* **Write-Only Video Access Logs**: Tabella `prod-videocorso-video-access-logs` che archivia in modo immutabile ogni singola lezione vista per 2 anni a fini probatori.

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
    AllowedCheckoutOrigins='https://main.d26u0xz2smmxfz.amplifyapp.com,https://development.d26u0xz2smmxfz.amplifyapp.com' \
    AllowedCorsOrigin='*' \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
  --resolve-s3 \
  --profile personale \
  --region us-east-1
```
