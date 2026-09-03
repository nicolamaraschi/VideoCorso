# 📹 Guida Master Operativa: Pulizia Silenzi & Caricamento Video su AWS

> **📌 ISTRUZIONE PER L'AGENTE AI:**  
> Quando l'utente dice frasi del tipo:  
> **"metti i video nuovi della cliente cartella chiara morocutti"** o simili:  
> Devi consultare questa guida ed eseguire in autonomia:  
> 1. Ispezione dei file presenti sull'SSD esterno (`/Volumes/Sviluppo/Chiara Morocutti/`).  
> 2. Se i video non sono ancora tagliati, eseguire la pulizia automatica dei silenzi con lo script in `/Volumes/Sviluppo/pulitoreTraccia/`.  
> 3. Eseguire l'upload su S3 (`prod-videocorso-content`) e aggiornare DynamoDB (`prod-videocorso-lessons`) in **formato NATIVO a costo 0,00€** (ZERO transcodifiche MediaConvert).  
> 4. Aggiornare la mappa delle lezioni in questo file.

---

## 💰 1. REGOLA D'ORO: COSTI ZERO (NO AWS MEDIACONVERT)

* **Transcoding Disattivato:** Nel backend CloudFormation è configurato `EnableTranscoding = false`.
* **Costo Transcodifica:** **0,00€**.
* **Formato di Erogazione:** I video vengono caricati in MP4 già ottimizzati e compressi, e serviti **direttamente in formato NATIVO** tramite CloudFront e S3.
* **Stato DynamoDB:** Il campo `transcode_status` della lezione deve essere impostato su `'NATIVE'`.
* **DIVIETO ASSOLUTO:** Non attivare mai `EnableTranscoding = true` e non inviare job MediaConvert ad AWS per evitare costi imprevisti di transcodifica oraria.

---

## 📂 2. Percorsi e Risorse AWS

* **SSD Esterno (Originali):** `/Volumes/Sviluppo/Chiara Morocutti/`
* **Cartella Pipeline Silenzi:** `/Volumes/Sviluppo/pulitoreTraccia/`
* **Cartella Output Senza Silenzi:** `/Volumes/Sviluppo/Chiara Morocutti/VIDEO_SENZA_SILENZI_YYYY-MM-DD/`
* **Bucket S3 Video:** `prod-videocorso-content`
* **Tabella DynamoDB Lezioni:** `prod-videocorso-lessons` (GSI: `ChapterIndex` su `chapter_id`)
* **Tabella DynamoDB Capitoli:** `prod-videocorso-chapters`
* **Profilo & Regione AWS:** `--profile personale --region us-east-1`
* **Script Upload Unificato:** `scripts/upload_trimmed_videos.py`

---

## ✂️ 3. Pipeline di Rimozione Silenzi ed Esitazioni (Sull'SSD Esterno)

Tutti i tool di pulizia audio/video risiedono in `/Volumes/Sviluppo/pulitoreTraccia/`.  
**Sicurezza:** Gli originali non vengono **mai** modificati né eliminati. Le nuove copie vengono create in cartelle dedicate con suffisso `_senza_silenzi.mp4`.

### 1. Rimozione Automatica Pause e Silenzi (Auto-Editor)
Usa lo script dedicato:
```zsh
cd "/Volumes/Sviluppo/pulitoreTraccia"

# 1. Anteprima senza esportare file:
./processa-silenzi.zsh anteprima

# 2. Generazione copie pulite:
./processa-silenzi.zsh genera
```
* **Come funziona:** Esegue `auto-editor` con impostazioni calibrate per parlato italiano:
  `--edit audio:-28dB --margin 0.4s --smooth 0.3s,0.15s --faststart`
* **Output:** Salva automaticamente in `/Volumes/Sviluppo/Chiara Morocutti/VIDEO_SENZA_SILENZI_YYYY-MM-DD/` mantenendo la gerarchia delle cartelle dei moduli.

### 2. Rimozione Esitazioni Sonore (Ehm, Uhm, Mmm con Tightcut & Whisper)
Se necessario ripulire esitazioni sonore con trascrizione AI locale italiana:
```zsh
cd "/Volumes/Sviluppo/pulitoreTraccia"

# Anteprima su una singola lezione:
./processa-silenzi-intercalari.zsh anteprima "Nome Lezione"

# Generazione copia pulita:
./processa-silenzi-intercalari.zsh genera "Nome Lezione"
```
* **Output:** Salva in `/Volumes/Sviluppo/Chiara Morocutti/VIDEO_SENZA_SILENZI_E_INTERCALARI_YYYY-MM-DD/`.

---

## 📐 4. Regole di Orientamento Video (Dritti vs Storti)

La cliente ha registrato alcuni video con lo smartphone in verticale e altri in orizzontale. Nelle cartelle dell'SSD sono presenti diverse esportazioni:

1. **✅ FILE DA CARICARE (DRITTI):**
   * **Video verticali registrati da telefono:** Scegliere SEMPRE il file che termina con **`_9x16.mp4`** (es. `10_9x16.mp4`, `1Introduzione_9x16.mp4`, `4_9x16.mp4`).
   * **Video orizzontali nativi:** Scegliere i file con dicitura **`(gia in 16:9 non toccare).mp4`** (es. `16(gia in 16:9 non toccare).mp4`).
   * **Video della cartella `sabri`:** Scegliere i file all'interno di **`sabri editatate/`** (es. `sabri smetti+di+fare+consulenza+informativa...mp4`).
   * **Video processati dalla pipeline silenzi:** Scegliere i file in **`VIDEO_SENZA_SILENZI_...`** con suffisso **`_senza_silenzi.mp4`**.

2. **❌ FILE DA NON CARICARE (STORTI O GREZZI):**
   * **NON** prendere i file generici `X.mp4` esportati a 1920x1080 quando è presente la versione `_9x16.mp4` (in quei file l'immagine è ruotata di 90° sul fianco).
   * **NON** caricare i file grezzi della fotocamera `IMG_XXXX.MOV`.

---

## 🚀 5. Procedura di Caricamento e Registrazione su AWS (Zero Costi)

### Script Python Riutilizzabile (`scripts/upload_trimmed_videos.py`)
Lo script esegue tutto in automatico:
1. Calcola la durata esatta in secondi con `ffprobe`.
2. Genera un ID versione univoco: `asset_version = uuid.uuid4().hex`.
3. Carica il video su S3 (`prod-videocorso-content`) con chiave:
   `videos/{lesson_id}/{asset_version}/source.mp4`
   utilizzando multipart upload parallelo ad alta velocità con `ContentType: video/mp4`.
4. Aggiorna atomicamente il record in DynamoDB (`prod-videocorso-lessons`):
   ```python
   table.update_item(
       Key={'lesson_id': lesson_id},
       UpdateExpression=(
           "SET video_s3_key = :vkey, "
           "asset_version = :aver, "
           "duration_seconds = :dur, "
           "transcode_status = :status, "
           "title = :title "
           "REMOVE pending_video_s3_key, pending_asset_version, pending_transcode_status"
       ),
       ExpressionAttributeValues={
           ':vkey': f"videos/{lesson_id}/{asset_version}/source.mp4",
           ':aver': asset_version,
           ':dur': duration_seconds,
           ':status': 'NATIVE',
           ':title': title
       }
   )
   ```
5. La lezione diventa **immediatamente visibile e riproducibile** per tutte le corsiste senza alcun tempo di attesa o elaborazione cloud.

Per eseguire l'upload:
```bash
./testenv/bin/python scripts/upload_trimmed_videos.py
```

---

## 🗺️ 6. Mappa Completa dei 10 Moduli e Stato Attuale (54 Lezioni Totali)

### Modulo 1 Presentazione (ID Capitolo: `89d99685-6f1e-4ca0-81fb-04950410701e`) — 1/3 Caricate
* ✅ **Lezione 1:** Presentazione (`bd20c4e6-7622-4729-9152-873010337e0c`) — 0m 25s *(Caricato)*
* 🔴 **Lezione 2:** Chi sono e perchè dovresti ascoltarmii (`84f95ef9-dd67-47e0-b6fe-e6a8bd090f6c`) — 0s **MANCANTE**
* 🔴 **Lezione 3:** Mentalità (`74328195-c4be-4790-a366-c7cc9f5fd6a1`) — 0s **MANCANTE**

---

### Modulo 2 Teoria (ID Capitolo: `cf16160e-4493-495c-9f27-6beee83f48df`) — 21/21 Caricate (COMPLETO 🎉)
* ✅ **Lezione 1:** Introduzione (`2d4301ad-c191-4e8b-89fb-84801c8ea419`) — 6m 1s *(Caricato)*
* ✅ **Lezione 2:** Il microblading (`56225bb0-21b4-4851-b7de-7080d056554e`) — 4m 34s *(Caricato)*
* ✅ **Lezione 3:** Evoluzione del microblading (`5c66896e-a0bd-45ed-baa2-b9649d8c8834`) — 9m 39s *(Caricato)*
* ✅ **Lezione 4:** Norme igienico sanitarie (`2f8f0a4e-8d3d-412f-ba7c-19dc6fb9b367`) — 4m 48s *(Caricato)*
* ✅ **Lezione 5:** Controindicazioni e malattie (`513b95f7-2091-43d7-87ce-8247015c57a9`) — 5m 54s *(Caricato)*
* ✅ **Lezione 6:** Vecchi PMU e cover up (`a3482128-d1ee-4bed-a03a-c00a723aee1a`) — 6m 41s *(Caricato)*
* ✅ **Lezione 7:** Cicatrici (`ab1472dd-4b97-41e4-9ff9-bfd562b49a85`) — 4m 29s *(Caricato)*
* ✅ **Lezione 8:** Dolore e anestetici (`51a181e2-5b91-4532-9332-724d7430000f`) — 6m 35s *(Caricato)*
* ✅ **Lezione 9:** Lavori su diversi tipi di pelle (`4681b974-3b9c-4b98-a663-70b873ca2855`) — 6m 18s *(Caricato)*
* ✅ **Lezione 10:** Pressione Corretta (`f56cbfb0-a215-41f2-b832-6341e758e232`) — 4m 28s *(Caricato)*
* ✅ **Lezione 11:** Esecuzione del trattamento (`13cd6479-d2cb-490c-937b-a3b483d62c12`) — 5m 37s *(Caricato)*
* ✅ **Lezione 12:** Ripasso dei peli, brush e maschera (`d9d27607-8060-40c1-901d-92141ae168c4`) — 7m 4s *(Caricato)*
* ✅ **Lezione 13:** Durata nel tempo del pigmento (`7ca2d88b-94ae-4f9f-b7bb-1fb3718cbb0d`) — 7m 52s *(Caricato)*
* ✅ **Lezione 14:** Perché scegliere Pigmenti Phibrows (`a2e2aee4-8e72-4bcf-8524-e4c0057c4e4f`) — 2m 39s *(Caricato)*
* ✅ **Lezione 15:** Pigmenti primari (`2989f7a8-3d4a-4503-8b30-f6de53132fba`) — 2m 41s *(Caricato)*
* ✅ **Lezione 16:** Miscela dei pigmenti (`6ce1ab16-b895-421d-b6f2-90a7069134c3`) — 10m 11s *(Caricato)*
* ✅ **Lezione 17:** Come scegliere il pigmento (`eb74eea3-600b-4f2c-bee1-237d5a2052ed`) — 7m 9s *(Caricato)*
* ✅ **Lezione 18:** Neutralizzazione vecchi PMU (`78f28f11-b240-4376-a27c-0e7b7bce4ae5`) — 5m 11s *(Caricato)*
* ✅ **Lezione 19:** Guarigione post trattamento (`7a13ef96-b97e-4f27-a7a1-d2412c938a9e`) — 6m 49s *(Caricato)*
* ✅ **Lezione 20:** Cura post trattamento (`fa844927-2188-4796-a90a-1ee252211c54`) — 7m 19s *(Caricato)*
* ✅ **Lezione 21:** Ritocco mensile e ritocco annuale (`6dac2dba-913e-4b6b-b806-8c536045b4f3`) — 7m 34s *(Caricato)*

---

### Modulo 3 Forma e Anatomia del Sopracciglio (ID Capitolo: `e2941c9c-29e5-413d-a84d-0d1a968084a3`) — 4/7 Caricate
* ✅ **Lezione 1:** Forma e anatomia del sopracciglio (`5eac6ae3-58d4-4a7d-a8e6-31b79f9be0a6`) — 1m 57s *(Caricato)*
* 🔴 **Lezione 2:** Sistemare senza stravolgere (`627c46a9-23d6-486b-a881-f018f9f878dd`) — 0s **MANCANTE**
* 🔴 **Lezione 3:** Rapporto aureo e morfologia del viso (`011bab5c-0f23-405b-bfb5-7bdf791c4266`) — 0s **MANCANTE**
* 🔴 **Lezione 4:** Gestione delle asimmetrie (`77a03776-e310-4011-ae26-abb0a7c66153`) — 0s **MANCANTE**
* ✅ **Lezione 5:** Forma su carta con righello (`d614bd1c-667c-4304-9318-3d7a7c3359e6`) — 9m 1s *(Caricato)*
* ✅ **Lezione 6:** Forma su carta con righello (più realistica) (`63ca429e-c05f-46f2-b02e-f110607fafab`) — 7m 55s *(Caricato)*
* ✅ **Lezione 7:** Forma su carta con compasso Phi (`206ac413-6088-4c3d-b758-fd0ceb9e04f4`) — 10m 25s *(Caricato)*

---

### Modulo 4 Forma su Modella (ID Capitolo: `ecf131c8-aab4-45d2-9fc3-6098ae809c82`) — 0/3 Caricate
* 🔴 **Lezione 1:** Strumenti per la forma (`b6a2ef5b-9a5c-4eb5-8c29-692e61d0e0f2`) — 0s **MANCANTE**
* 🔴 **Lezione 2:** Affilare la matita (`8f72378d-5de8-49f8-be47-6522163387ec`) — 0s **MANCANTE**
* 🔴 **Lezione 3:** Forma su modella (`6096ec26-70db-461c-bdbb-685cdeffa6e5`) — 0s **MANCANTE**

---

### Modulo 5 Schemi e Spine (ID Capitolo: `6a43afd0-ab94-4e29-8217-666d596de32d`) — 2/6 Caricate
* ✅ **Lezione 1:** Introduzione (`504a922c-daf0-4753-994c-4b041712ff99`) — 6m 1s *(Caricato)*
* ✅ **Lezione 2:** Seguire il pelo naturale (`7fb2cdce-3b3c-4f26-a08e-db99dd1784b4`) — 9m 32s *(Caricato)*
* 🔴 **Lezione 3:** La testa (`6cdad452-0d73-42ec-a54f-c24c3c5528fc`) — 0s **MANCANTE**
* 🔴 **Lezione 4:** Transizione (`4f663c0e-728b-4f06-aea3-df2dd7967d76`) — 0s **MANCANTE**
* 🔴 **Lezione 5:** Peli inferiori (`c857ce63-1694-4cf5-bbac-14cfeba1bbab`) — 0s **MANCANTE**
* 🔴 **Lezione 6:** Peli superiori (`4359d26f-133d-443f-86f9-d6141a03ffe9`) — 0s **MANCANTE**

---

### Modulo 6 Latex (ID Capitolo: `dac458f9-ff54-4934-9e40-c3aa41c77270`) — 5/7 Caricate
* ✅ **Lezione 1:** Come impugnare il tool e primi peli (`1a22afdc-b02b-4b52-a842-3a5aee114993`) — 4m 14s *(Caricato)*
* ✅ **Lezione 2:** La testa (`9362d12c-5a3d-4b63-9c9a-e383356f1f4a`) — 7m 48s *(Caricato)*
* ✅ **Lezione 3:** Transizione (`7db2f914-de0e-4404-923c-ef838b7884bb`) — 2m 12s *(Caricato)*
* 🔴 **Lezione 4:** Peli inferiori (`07b0fec4-b8f9-470c-a045-fc5142185b4c`) — 0s **MANCANTE**
* 🔴 **Lezione 5:** Peli superiori (`c40df06d-33b1-4d28-b6fb-f8253f6327a0`) — 0s **MANCANTE**
* ✅ **Lezione 6:** Sopracciglio completo spine 3 (`5c1f7b7d-bd31-4f77-842c-4b9547c2a885`) — 8m 13s *(Caricato)*
* ✅ **Lezione 7:** Sopracciglio completo spine 6 (`fb821a67-0801-40c7-aba8-30187876f3bf`) — 6m 34s *(Caricato)*

---

### Modulo 7 Lavoro su Modella (ID Capitolo: `3aa1ed1c-5d42-4bf2-8cd1-089ba225ced2`) — 0/5 Caricate
* 🔴 **Lezione 1:** Preparare il carrellino di lavoro (`2af87613-429f-4365-af79-bbd63ce87384`) — 0s **MANCANTE**
* 🔴 **Lezione 2:** Primo passaggio sopracciglio destro (`e8ad6dcc-bf29-463e-9192-16cc8b3f9e11`) — 0s **MANCANTE**
* 🔴 **Lezione 3:** Primo passaggio sopracciglio sinistro (`f7ca1389-885f-4fc7-90bf-01fa37e6f06d`) — 0s **MANCANTE**
* 🔴 **Lezione 4:** Ripasso dei peli (`fc38ebd8-4857-4b4a-86ad-0b0abd68e4aa`) — 0s **MANCANTE**
* 🔴 **Lezione 5:** Lavoro completo (`5f0be39d-c920-4dd6-8b77-199b8a6e5fed`) — 0s **MANCANTE**

---

### Modulo 8 Normative (ID Capitolo: `bde1301e-1dab-406b-a9ab-b4a320114356`) — 0/4 Caricate
* 🔴 **Lezione 1:** Codice Ateco, quale scegliere? (`3de9e269-7d9c-41e2-b389-b010c81ab605`) — 0s **MANCANTE**
* 🔴 **Lezione 2:** Affitto cabina o percentuale (`ac0860cf-40d4-43b1-84da-6dcd6fe3825f`) — 0s **MANCANTE**
* 🔴 **Lezione 3:** Come cercare gli studi e come proporsi (`4755fb24-fb99-423e-a248-99955efedfd1`) — 0s **MANCANTE**
* 🔴 **Lezione 4:** Consenso informato (`1569fed1-b9ac-4211-8471-5bb295687de7`) — 0s **MANCANTE**

---

### Modulo 9 Consulenza (ID Capitolo: `8533ff33-9cd8-46c9-8515-260996875987`) — 4/9 Caricate
* 🔴 **Lezione 1:** Introduzione (`14a8d861-7908-4f7e-b57d-ebb328c2fc4b`) — 0s **MANCANTE**
* ✅ **Lezione 2:** Smetti di fare consulenza informativa (`8eac8228-a097-43a7-a9ea-2c3645c82ba6`) — 2m 50s *(Caricato Nativo)*
* ✅ **Lezione 3:** Come fare una consulenza di vendita (`236964d5-27f5-4631-a0d3-8698179d1560`) — 11m 52s *(Caricato)*
* ✅ **Lezione 4:** Gestire le obiezioni (`b59cbda6-d9a0-4440-b046-aa6e4dda47fd`) — 83m 38s *(Caricato Nativo)*
* 🔴 **Lezione 5:** Risoluzione obiezioni (`6d8644a2-ee4e-48d0-8af7-d8ec6a8b3cf5`) — 0s **MANCANTE**
* 🔴 **Lezione 6:** Consulenza in studio (`8a78c288-35f1-42cb-89a1-75add3c3f7a1`) — 0s **MANCANTE**
* 🔴 **Lezione 7:** Consulenza di vendita in studio vs chiamata di vendita (`e433a57e-3e11-45ba-8700-2f45d0ca280f`) — 0s **MANCANTE**
* 🔴 **Lezione 8:** Registrazione chiamata di vendita (`6e556b7d-8332-4d71-89fe-7aebc586a788`) — 0s **MANCANTE**
* ✅ **Lezione 9:** Come impostare il giusto prezzo per partire (`298960a8-9fc4-46ef-bf2f-ef53592fa02a`) — 10m 4s *(Caricato Nativo)*

---

### Modulo 10 Come Trovare i Tuoi Primi Clienti (ID Capitolo: `64da6b31-8eba-42cd-aaf1-2568807ad8fe`) — 6/9 Caricate
* ✅ **Lezione 1:** Vendere e fare dermopigmentazione sono due cose diverse (`ebb896ea-b4e1-448a-a8b8-1fdc88c966ee`) — 4m 3s *(Caricato Nativo)*
* 🔴 **Lezione 2:** Come superare i blocchi iniziali (`95a68ec7-dbba-433e-8372-eddfb2e446cb`) — 0s **MANCANTE**
* 🔴 **Lezione 3:** Come impostare correttamente una pagina social professionale (`11e04d40-7c30-48d9-9f9a-48ffbb825af3`) — 0s **MANCANTE**
* ✅ **Lezione 4:** I tre contenuti da creare (`9891d871-641e-4d52-82f4-7ceb6adaec2e`) — 5m 0s *(Caricato Nativo)*
* ✅ **Lezione 5:** Strategie di contenuto (`14c83ae4-2e9b-40b6-a703-88bb057f621d`) — 8m 42s *(Caricato Nativo)*
* ✅ **Lezione 6:** Contenuti di attrazione, fidelizzazione e vendita (`20efab06-f709-47f5-842c-efd0993d05d7`) — 18m 56s *(Caricato Nativo)*
* ✅ **Lezione 7:** Che tipi di stories fare (`16eba908-6e69-4b90-8ea8-12cba0a7da46`) — 6m 29s *(Caricato Nativo)*
* ✅ **Lezione 8:** Cosa sono i contenuti personali (`c737d161-ba00-4a4c-aaad-606c8fd99e4a`) — 6m 59s *(Caricato Nativo)*
* 🔴 **Lezione 9:** Quando è necessario fare la call strategica (`a2680f7a-f049-4716-98b8-1021213dd328`) — 0s **MANCANTE**
