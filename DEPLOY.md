# Deploy di produzione

Questo è il punto di ingresso obbligatorio per ogni deploy. Per il dettaglio
operativo e la gestione degli incidenti consultare anche
[`docs/OPERATIONS.md`](docs/OPERATIONS.md).

## Regole non negoziabili

1. Usare esclusivamente il profilo AWS `personale`, account `170884089098`,
   region `us-east-1`.
2. Non passare segreti di Stripe o Resend sulla riga di comando.
3. Per il backend creare sempre un change set, ispezionarlo e non eseguirlo se
   sostituisce o rimuove risorse persistenti (Cognito, API Gateway, bucket,
   CloudFront o DynamoDB).
4. Dopo il deploy eseguire le verifiche indicate nel runbook prima di
   comunicare il rilascio.

## Backend SAM

Dalla root del repository:

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

Poi ispezionare il change set con i comandi in `docs/OPERATIONS.md`; solo se
non contiene sostituzioni/rimozioni non previste, eseguirlo e attendere il
completamento dello stack.
