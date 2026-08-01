# VideoCorso

Piattaforma per la vendita e la fruizione di corsi video. Il frontend React è pubblicato con AWS Amplify; il backend è una applicazione AWS SAM con API Gateway, Lambda, DynamoDB, Cognito, S3/CloudFront e Stripe.

## Stato degli ambienti

| Ramo Git | Uso | URL Amplify |
| --- | --- | --- |
| `main` | Produzione | https://main.d26u0xz2smmxfz.amplifyapp.com |
| `development` | Sviluppo e collaudo prima della PR | https://development.d26u0xz2smmxfz.amplifyapp.com |

- Repository: `github.com/nicolamaraschi/VideoCorso`
- Amplify app id: `d26u0xz2smmxfz`
- Stack backend di produzione: `corso-video-chiara`
- API produzione: `https://nyer89lvbj.execute-api.us-east-1.amazonaws.com/prod`
- Regione: `us-east-1`

> Il ramo `development` è un ambiente frontend separato, ma oggi usa lo stesso backend `prod`. Non eseguire prove distruttive, ordini reali o modifiche a dati di clienti da `development`. Un backend realmente isolato richiede uno stack `Environment=dev`, parametri SSM `/videocorso/dev/...` e variabili `VITE_*` del ramo aggiornate con i suoi output.

## Regola AWS obbligatoria

**Ogni comando AWS e SAM deve usare il profilo `personale`.** È l'account corretto per questo progetto: `170884089098` (`videocorso-admin`). Non usare il profilo predefinito.

```bash
# Da eseguire prima di una qualunque operazione AWS
aws --profile personale sts get-caller-identity

# Esempio: anche SAM deve ricevere esplicitamente il profilo
sam build --profile personale
```

Tutti gli esempi di questa documentazione includono `--profile personale` per questo motivo.

## Struttura del progetto

```text
frontend/                 applicazione React + TypeScript + Vite
backend/infrastructure/   template AWS SAM/CloudFormation
backend/lambda/           Lambda per catalogo, admin, pagamenti, video e progressi
backend/tests/            test backend e smoke test API
docs/OPERATIONS.md        runbook di produzione e procedure d'incidente
```

## Flusso di sviluppo e rilascio

1. Lavora su `development`.
2. Esegui i test locali e la build del frontend.
3. Fai push: Amplify pubblica il ramo di sviluppo e CodeBuild può eseguire la suite backend.
4. Verifica i flussi interessati sul sito di sviluppo senza alterare dati reali.
5. Apri una Pull Request `development` → `main` e fai il merge solo dopo le verifiche.
6. Il merge su `main` attiva il deploy Amplify in produzione. Per una modifica al backend, distribuisci SAM con change set ispezionato.

Il ramo storico `claude/video-course-platform-aws-011CUzH6FBHgyYLq2PrHPAvFf` è stato rimosso: non va più usato né ricreato.

## Pagamenti: contratto operativo

I pagamenti sono la parte più critica dell'applicazione. La UI non deve mai dedurre che un pagamento sia riuscito soltanto perché l'utente è tornato dalla pagina Stripe.

1. Il frontend chiede il preventivo con `POST /payment/quote` e crea una sessione con `POST /payment/create-checkout`.
2. Stripe reindirizza solo verso gli URL esplicitamente consentiti da `AllowedCheckoutOrigins`.
3. La pagina di ritorno passa il `session_id` a `GET /payment/verify/{sessionId}`.
4. La conferma restituisce separatamente lo stato Stripe (`payment_state`) e lo stato di accesso (`access_state`). L'accesso al corso è valido solo quando risulta attivo nel backend.
5. Il webhook Stripe (`POST /payment/webhook`) è la fonte di riconciliazione; è idempotente e le purchase sono indicizzate tramite `StripeSessionIndex`.

Gli stati mostrati al cliente devono restare chiari:

- pagamento confermato e accesso attivo;
- pagamento ricevuto ma attivazione in elaborazione;
- pagamento non confermato o accesso non disponibile;
- pagamento rimborsato, contestato o revocato: accesso non attivo.

L'area amministrativa visualizza il record di acquisto e una vista cliente che indica se account e corso sono effettivamente disponibili. Non correggere acquisti modificando direttamente DynamoDB: usare i flussi admin o la procedura di incidente in [docs/OPERATIONS.md](docs/OPERATIONS.md).

### Prezzi

Il catalogo memorizza e restituisce i prezzi in euro, non in centesimi. Al momento della redazione di questa documentazione il preventivo del corso `mai-fatto-microblading-inizio` restituisce `2500`, cioè **€ 2.500,00**. Ogni variazione commerciale del prezzo richiede una conferma esplicita prima del rilascio.

## Deploy backend in produzione

Non passare chiavi Stripe, webhook secret o chiavi Resend a `sam deploy`: le Lambda li leggono da SSM Parameter Store. I nomi di produzione sono:

- `/videocorso/prod/stripe/secret-key`
- `/videocorso/prod/stripe/webhook-secret`
- `/videocorso/prod/resend/api-key`

I valori non devono mai comparire in Git, `.env` versionati, log o comandi shell.

Da root del repository:

```bash
aws --profile personale sts get-caller-identity

sam build \
  --template-file backend/infrastructure/template.yaml \
  --profile personale \
  --region us-east-1

sam deploy \
  --template-file .aws-sam/build/template.yaml \
  --stack-name corso-video-chiara \
  --parameter-overrides \
    Environment=prod \
    AllowedCheckoutOrigins='https://main.d26u0xz2smmxfz.amplifyapp.com,https://development.d26u0xz2smmxfz.amplifyapp.com' \
    AllowedCorsOrigin='*' \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
  --resolve-s3 \
  --no-execute-changeset \
  --no-confirm-changeset \
  --profile personale \
  --region us-east-1
```

Prima dell'esecuzione, ispeziona il change set e fermati se una risorsa persistente risulta sostituita o rimossa:

```bash
aws --profile personale cloudformation list-change-sets \
  --stack-name corso-video-chiara \
  --region us-east-1

aws --profile personale cloudformation describe-change-set \
  --stack-name corso-video-chiara \
  --change-set-name NOME_DEL_CHANGE_SET \
  --region us-east-1

aws --profile personale cloudformation execute-change-set \
  --stack-name corso-video-chiara \
  --change-set-name NOME_DEL_CHANGE_SET \
  --region us-east-1
```

`AllowedCheckoutOrigins` è una allowlist per i soli redirect Stripe e **non** deve essere `*`. `AllowedCorsOrigin` è separato e controlla il CORS del browser. La procedura completa, comprese le verifiche dopo il deploy, è in [docs/OPERATIONS.md](docs/OPERATIONS.md).

## Test richiesti

Frontend:

```bash
cd frontend
npm ci
npx tsc -b
npm run lint
npm run build
```

Backend e test di integrazione non distruttivi:

```bash
aws --profile personale codebuild start-build \
  --project-name corso-video-chiara-api-tests \
  --source-version development \
  --region us-east-1
```

La suite deve coprire in particolare checkout, webhook idempotenti, verifica del ritorno Stripe, acquisti/admin, accesso ai corsi, coupon, upload/transcode video e validazione delle operazioni admin. Per i controlli manuali e gli scenari di incidente seguire il runbook, non tentativi casuali in produzione.

## Configurazione frontend

Le variabili pubbliche richieste sono documentate in [frontend/.env.example](frontend/.env.example). In particolare `VITE_API_BASE_URL` deve puntare all'API dell'ambiente previsto. Le chiavi `VITE_*` sono incorporate nel bundle: non inserirvi mai segreti privati Stripe, AWS o Resend.

Amplify costruisce e pubblica il frontend dai rami Git collegati; non c'è una procedura manuale di upload del bundle su S3 da usare per i rilasci normali.

## Operazioni e diagnosi

- Runbook di produzione, segreti, deploy, smoke check e incidenti: [docs/OPERATIONS.md](docs/OPERATIONS.md)
- Guida di sviluppo frontend: [frontend/README.md](frontend/README.md)
- Stato dell'ultimo deploy Amplify:

  ```bash
  aws --profile personale amplify list-jobs \
    --app-id d26u0xz2smmxfz \
    --branch-name main \
    --max-results 1 \
    --region us-east-1
  ```
