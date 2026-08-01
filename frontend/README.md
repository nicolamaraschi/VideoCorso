# Frontend VideoCorso

Applicazione React + TypeScript + Vite pubblicata da AWS Amplify. I rami `main` e `development` sono collegati all'app Amplify `d26u0xz2smmxfz`; i rilasci ordinari avvengono con il push Git, non caricando manualmente file su S3.

## Avvio locale

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Per il controllo che replica CodeBuild:

```bash
npx tsc -b
npm run lint
npm run build
```

## Variabili di ambiente

Usare `.env.example` solo come schema. Le variabili richieste sono:

- `VITE_COGNITO_USER_POOL_ID`
- `VITE_COGNITO_USER_POOL_CLIENT_ID`
- `VITE_COGNITO_IDENTITY_POOL_ID`
- `VITE_API_BASE_URL`
- `VITE_STRIPE_PUBLIC_KEY`
- `VITE_AWS_REGION`

Le variabili `VITE_*` diventano pubbliche nel bundle. Possono contenere endpoint, identificatori Cognito e la chiave pubblica Stripe `pk_*`, ma mai chiavi Stripe private, webhook secret, credenziali AWS o chiavi Resend.

`VITE_API_BASE_URL` deve puntare all'API dell'ambiente previsto. Al momento il sito `development` usa ancora l'API `prod`: non considerarlo un backend isolato e non usare il sito per prove distruttive.

## Pagamento e conferma

Il checkout usa Stripe Checkout. Il ritorno da Stripe non basta per visualizzare un pagamento come concluso: la pagina di esito passa il `session_id` a `GET /payment/verify/{sessionId}` e mostra separatamente stato del pagamento e stato dell'accesso. Non modificare questo flusso per mostrare una conferma ottimistica o per proporre un secondo pagamento mentre la verifica è in corso.

Gli origin di ritorno Stripe sono autorizzati dal backend, non dal frontend. Gli ambienti autorizzati sono i due domini Amplify documentati nel README principale.

## Rilascio

1. Sviluppare e validare su `development`.
2. Aprire una Pull Request verso `main`.
3. Dopo il merge, controllare l'ultimo job Amplify del ramo `main`.

Per la configurazione AWS, il deploy backend e le procedure di incidente, usare il [runbook operativo](../docs/OPERATIONS.md). Ogni comando AWS/SAM va eseguito con il profilo `personale`.
