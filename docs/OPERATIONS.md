# Operatività produzione — VideoCorso Chiara Morocutti

## Segreti applicativi

I segreti della produzione sono in AWS Systems Manager Parameter Store, come `SecureString`:

- `/videocorso/prod/stripe/secret-key` — chiave privata Stripe usata dal checkout VideoCorso.
- `/videocorso/prod/stripe/webhook-secret` — segreto di firma del webhook Stripe VideoCorso.
- `/videocorso/prod/resend/api-key` — chiave Resend per le email transazionali VideoCorso.

Le Lambda leggono questi parametri al cold start. I valori non devono essere inseriti in CloudFormation, Amplify, file `.env` versionati o comandi `sam deploy`.

## Rotazione di un segreto

1. Aggiorna il parametro corrispondente in Systems Manager Parameter Store mantenendo nome e tipo `SecureString`.
2. Pubblica il backend per forzare nuove istanze Lambda, oppure attendi il successivo cold start.
3. Esegui un checkout di prova o una chiamata webhook di test, secondo il segreto aggiornato.

## Deploy backend

```bash
cd backend/infrastructure
sam build --profile personale
sam deploy --stack-name corso-video-chiara \
  --parameter-overrides Environment=prod AllowedCheckoutOrigins=https://IL-TUO-DOMINIO \
  --capabilities CAPABILITY_IAM \
  --resolve-s3 \
  --profile personale
```
