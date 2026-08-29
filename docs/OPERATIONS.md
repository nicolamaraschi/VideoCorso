# Runbook Operativo & Incident Recovery — Chiara Morocutti Academy

Questo documento descrive le procedure operative, di diagnostica incidenti, gestione utenti e ripristino per lo stack di produzione `corso-video-chiara` in `us-east-1` (API: `https://nyer89lvbj.execute-api.us-east-1.amazonaws.com/prod`).

---

## 🔒 1. Identità AWS & Regola di Sicurezza

Usare **sempre** il profilo AWS `personale`, account `170884089098` (`videocorso-admin`) e region `us-east-1`.  
Se il comando restituito non è `170884089098`, fermarsi immediatamente:

```bash
export PATH=$PATH:/usr/local/aws-cli
aws --profile personale sts get-caller-identity
```

---

## 🛠️ 2. Console di Sistema & Risoluzione Errori in Tempo Reale

L'applicazione dispone di una console operativa dedicata accessibile dall'area amministrativa su **`/admin/system-logs`**.

### 🔍 Monitoraggio & Diagnosi Guasti:
1. **Se una corsista segnala un problema (es. non riesce a pagare, non vede un video, non ha ricevuto l'accesso):**
   * Apri `/admin/system-logs`.
   * Incolla la sua **email** o l'ID acquisto (`pi_...`) nella barra di ricerca.
   * La console ti mostra l'intera cronologia temporale dell'utente.
2. **Ispezione Tecnica:**
   * Clicca su **"Ispeziona"** per aprire il drawer diagnostico.
   * Trovi il messaggio di errore in chiaro, il payload JSON e lo **Stack Trace Python** con la riga di codice esatta.
3. **Pulsante "Copia Report per Assistenza":**
   * Genera una sintesi in formato markdown pronta da copiare e incollare per far intervenire il supporto tecnico in meno di un minuto.

---

## ⚖️ 3. Procedura Contestazioni Bancarie & Chargeback (Dossier Legale)

Quando un cliente apre un chargeback o una contestazione fraudolenta con la propria banca:

1. Accedi a **Pannello Admin → Acquisti** e seleziona l'acquisto contestato.
2. Nella pagina di dettaglio (`/admin/purchases/:id`), trovi:
   * **Consenso Legale**: Timestamp UTC di accettazione termini e **rinuncia espressa al diritto di recesso di 14 giorni** (Art. 59 Codice del Consumo).
   * **Autenticazione Stripe**: ID `pi_...`, `ch_...`, stato 3D Secure / SCA.
   * **Registro Fruizione Video (`video-access-logs`)**: Elenco certificato con data/ora di ogni singola lezione visualizzata dal cliente.
3. Clicca su **"Esporta Dossier Contestazione"**:
   * Ti scarica la memoria difensiva strutturata con tutti i log probatori da caricare nel portale Stripe Dispute.

---

## 👥 4. Gestione Utenti & AWS Cognito

* **User Pool Produzione (`prod`)**: `us-east-1_YMVsKScIc`
* **App Client ID**: configurato nelle variabili Amplify.

### Comandi Rapidi per Gestione Corsiste:

#### 1. Verificare lo stato di un account:
```bash
aws --profile personale --region us-east-1 cognito-idp admin-get-user \
  --user-pool-id us-east-1_YMVsKScIc \
  --username corsista@email.it
```

#### 2. Reimpostare la password in modo definitivo (`CONFIRMED`):
```bash
aws --profile personale --region us-east-1 cognito-idp admin-set-user-password \
  --user-pool-id us-east-1_YMVsKScIc \
  --username corsista@email.it \
  --password "PasswordTemporanea123!" \
  --permanent
```

#### 3. Promuovere un account ad Amministratore:
```bash
aws --profile personale --region us-east-1 cognito-idp admin-add-user-to-group \
  --user-pool-id us-east-1_YMVsKScIc \
  --username admin@email.it \
  --group-name admin
```

---

## 🔑 5. Gestione Segreti (SSM Parameter Store)

Tutti i segreti di produzione sono memorizzati come `SecureString` in AWS SSM Parameter Store e non compaiono mai nel codice Git:

| Parametro SSM | Funzione |
| --- | --- |
| `/videocorso/prod/stripe/secret-key` | Chiave API segreta Stripe per incasso pagamenti |
| `/videocorso/prod/stripe/webhook-secret` | Firma crittografica per validazione webhook Stripe |
| `/videocorso/prod/resend/api-key` | Chiave API Resend per invio email transazionali |

### Aggiornamento di un Segreto:
```bash
aws --profile personale --region us-east-1 ssm put-parameter \
  --name "/videocorso/prod/stripe/secret-key" \
  --value "sk_live_..." \
  --type "SecureString" \
  --overwrite
```

---

## 📦 6. Gestione Lambda Layer Condiviso (`prod-videocorso-shared`)

Tutte le 8 funzioni Lambda importano le logiche critiche (`purchase_access`, `audit_logger`, `stripe`, `resend`) dal layer condiviso.

Per aggiornare e ripubblicare il layer:
```bash
cd backend/layers/shared
rm -f /tmp/shared_layer.zip
zip -r /tmp/shared_layer.zip python > /dev/null

LAYER_ARN=$(aws --profile personale --region us-east-1 lambda publish-layer-version \
  --layer-name prod-videocorso-shared \
  --zip-file fileb:///tmp/shared_layer.zip \
  --compatible-runtimes python3.11 \
  --query "LayerVersionArn" --output text)

echo "Nuovo Layer ARN: $LAYER_ARN"

# Aggiornamento automatico su tutte le 8 Lambda
for FN in prod-videocorso-admin-handler prod-videocorso-payment-handler prod-videocorso-provisioning-outbox prod-videocorso-video-handler prod-videocorso-course-handler prod-videocorso-progress-handler prod-videocorso-coupon-reservation-recovery prod-videocorso-video-transcode; do
  aws --profile personale --region us-east-1 lambda update-function-configuration --function-name $FN --layers $LAYER_ARN > /dev/null
  aws --profile personale --region us-east-1 lambda wait function-updated --function-name $FN
done
```

---

## 📹 7. Elaborazione Video MediaConvert & Storage S3

* **Bucket Video Sorgente & Streaming**: `prod-videocorso-content`
* **Bucket Copertine / Thumbnail**: `prod-videocorso-thumbnails`
* I video caricati nel prefisso `videos/` attivano automaticamente la Lambda `prod-videocorso-video-transcode` che avvia un job AWS MediaConvert con profili QVBR a 4 risoluzioni (`1080p`, `720p`, `480p`, `360p`).
* Al termine, lo stato della lezione in `prod-videocorso-lessons` viene aggiornato automaticamente a `COMPLETE`.
