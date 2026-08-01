# Runbook operativo — VideoCorso

Questo documento riguarda lo stack di produzione `corso-video-chiara` in `us-east-1` e l'API `https://nyer89lvbj.execute-api.us-east-1.amazonaws.com/prod`.

## Identità AWS e regola di sicurezza

Usare **sempre** il profilo AWS `personale`, account `170884089098` (`videocorso-admin`). Non usare mai il profilo AWS predefinito.

```bash
aws --profile personale sts get-caller-identity
```

Se l'account restituito non è `170884089098`, fermarsi: non fare deploy, modifiche a parametri né diagnosi su un altro account.

## Ambienti e rami

| Ramo | Scopo | URL |
| --- | --- | --- |
| `main` | Produzione | https://main.d26u0xz2smmxfz.amplifyapp.com |
| `development` | Verifica prima del merge | https://development.d26u0xz2smmxfz.amplifyapp.com |

Entrambi i rami Amplify sono attivi. Attualmente il frontend `development` usa ancora l'API di produzione: trattarlo come un ambiente UI di verifica, non come sandbox dati. La messa in produzione ordinaria segue `development` → Pull Request → `main`.

## Segreti

I valori sono `SecureString` in SSM Parameter Store:

| Parametro | Utilizzo |
| --- | --- |
| `/videocorso/prod/stripe/secret-key` | API privata Stripe |
| `/videocorso/prod/stripe/webhook-secret` | verifica della firma del webhook Stripe |
| `/videocorso/prod/resend/api-key` | email transazionali opzionali |

Non scrivere mai i valori in CloudFormation, Amplify, file `.env` versionati, ticket, chat, output di shell o argomenti di `sam deploy`.

### Rotazione

1. Aggiornare il `SecureString` mantenendo esattamente il suo nome.
2. Per Stripe, aggiornare prima la configurazione Stripe e poi il parametro corrispondente.
3. Eseguire un deploy del backend oppure attendere nuovi cold start delle Lambda.
4. Eseguire uno smoke check appropriato senza esporre il segreto.

## Deploy SAM sicuro

Eseguire dalla root del repository.

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

Non eseguire un change set senza prima ispezionarlo:

```bash
aws --profile personale cloudformation list-change-sets \
  --stack-name corso-video-chiara \
  --region us-east-1

aws --profile personale cloudformation describe-change-set \
  --stack-name corso-video-chiara \
  --change-set-name NOME_DEL_CHANGE_SET \
  --region us-east-1
```

Fermarsi se Cognito, API Gateway, bucket, distribuzione CloudFront o tabelle DynamoDB persistenti hanno una sostituzione/rimozione non prevista. Dopo l'approvazione:

```bash
aws --profile personale cloudformation execute-change-set \
  --stack-name corso-video-chiara \
  --change-set-name NOME_DEL_CHANGE_SET \
  --region us-east-1

aws --profile personale cloudformation wait stack-update-complete \
  --stack-name corso-video-chiara \
  --region us-east-1
```

### Parametri di redirect e CORS

`AllowedCheckoutOrigins` non è CORS: è la lista, separata da virgole, degli origin consentiti per gli URL `success_url` e `cancel_url` generati per Stripe Checkout. Deve contenere esattamente gli origin Amplify autorizzati e non può essere `*`.

`AllowedCorsOrigin` regola invece il CORS dell'API per il browser. Tenerli separati evita di permettere redirect Stripe verso siti terzi.

## Verifiche dopo un deploy

```bash
# Lo stack è aggiornato?
aws --profile personale cloudformation describe-stacks \
  --stack-name corso-video-chiara \
  --region us-east-1

# La Lambda pagamenti ha la allowlist effettiva attesa?
aws --profile personale lambda get-function-configuration \
  --function-name prod-videocorso-payment-handler \
  --region us-east-1 \
  --query 'Environment.Variables.ALLOWED_CHECKOUT_ORIGINS' \
  --output text

# Il deploy Amplify del frontend è concluso?
aws --profile personale amplify list-jobs \
  --app-id d26u0xz2smmxfz \
  --branch-name main \
  --max-results 1 \
  --region us-east-1
```

Eseguire anche CodeBuild prima del merge per una modifica funzionale:

```bash
aws --profile personale codebuild start-build \
  --project-name corso-video-chiara-api-tests \
  --source-version development \
  --region us-east-1
```

## Pagamenti: verifica e incidente

Il redirect Stripe non equivale a una conferma. Il flusso corretto è:

1. checkout creato tramite `POST /payment/create-checkout`;
2. Stripe invia il webhook a `POST /payment/webhook`;
3. il frontend interroga `GET /payment/verify/{sessionId}`;
4. accesso al corso solo con `access_state` attivo.

Il backend conserva `payment_state` e `access_state` separati. La UI deve distinguere pagamento confermato, elaborazione dell'attivazione, pagamento non confermato e accesso revocato/rimborsato/contestato. Il webhook è idempotente e usa `StripeSessionIndex` per riconciliare il ritorno di Stripe senza scansioni.

Se un cliente segnala un problema:

1. non chiedere di pagare una seconda volta e non creare manualmente un record DynamoDB;
2. cercare l'acquisto nell'area amministrativa e leggere stato pagamento, stato accesso e cronologia;
3. confrontare sessione/pagamento Stripe con il record di acquisto;
4. verificare che il webhook sia arrivato e che non sia in ritardo;
5. se l'addebito è confermato ma l'attivazione è in elaborazione, comunicare chiaramente lo stato e completare la riconciliazione secondo il flusso admin previsto;
6. se risulta rimborso, contestazione o revoca, non riattivare l'accesso senza autorizzazione commerciale esplicita.

I prezzi sono espressi in euro. Prima di cambiare un prezzo o di pubblicare una variazione, fare confermare il valore commerciale: `2500` viene presentato dal checkout come € 2.500,00, non € 25,00.

## Corsi, video e operazioni admin

- L'accesso ai corsi è fail-closed: uno stato di acquisto sconosciuto o revocato non dà accesso.
- Le modifiche admin validano campi, stato, riordini, coupon e grant manuali; non aggirare tali API con modifiche dirette alle tabelle.
- Il transcode video è asincrono. Prima di comunicare che una lezione è disponibile, verificare che l'asset sia stato promosso e che il player lo possa caricare.
- I grant manuali non devono sovrascrivere o simulare una sessione Stripe e non devono duplicare un accesso già attivo.

## Test locali

Frontend:

```bash
cd frontend
npm ci
npx tsc -b
npm run lint
npm run build
```

Backend: usare la suite e CodeBuild per verificare catalogo, checkout, webhook, acquisti/accesso, coupon, video e tutte le operazioni admin autorizzate. Non eseguire test con effetti reali su dati o pagamenti di clienti.
