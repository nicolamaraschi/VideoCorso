# 📹 Guida e Mappa Operativa: Caricamento Video da SSD

Questo documento serve da **istruzione operativa autonoma per le future sessioni con l'AI**: basta indicare all'assistente di consultare questo file (`docs/GUIDA_CARICAMENTO_VIDEO_SSD.md`) per riprendere il caricamento dei video mancanti dall'SSD senza dover rispiegare la struttura, i percorsi o le regole di orientamento.

---

## 📂 1. Posizione dei File Video sull'SSD Esterno

* **Percorso Base SSD:** `/Volumes/Sviluppo/Chiara Morocutti/`
* **Bucket S3 di Destinazione:** `prod-videocorso-content`
* **Tabella DynamoDB Lezioni:** `prod-videocorso-lessons`
* **Tabella DynamoDB Capitoli:** `prod-videocorso-chapters`
* **Profilo AWS:** `--profile personale --region us-east-1`

---

## 📐 2. Regola d'Oro sull'Orientamento Video (Dritti vs Storti)

La cliente ha registrato alcuni video con lo smartphone in verticale e altri in orizzontale. Nelle cartelle dell'SSD sono presenti diverse esportazioni:

1. **✅ FILE DA CARICARE (DRITTI):**
   * **Per i video verticali registrati da telefono:** Scegliere SEMPRE il file che termina con **`_9x16.mp4`** (es. `10_9x16.mp4`, `1Introduzione_9x16.mp4`, `4_9x16.mp4`). Questi file sono orientati **dritti**.
   * **Per i video orizzontali nativi:** Scegliere i file con dicitura **`(gia in 16:9 non toccare).mp4`** (es. `16(gia in 16:9 non toccare).mp4`).
   * **Per i video della cartella `sabri`:** Scegliere i file all'interno della sottocartella **`sabri editatate/`** (es. `sabri smetti+di+fare+consulenza+informativa...mp4`).

2. **❌ FILE DA NON CARICARE (STORTI):**
   * **NON** prendere i file generici `X.mp4` esportati a 1920x1080 quando è presente la versione `_9x16.mp4` (in quei file l'immagine è ruotata di 90° sul fianco).
   * **NON** caricare i file grezzi della fotocamera `IMG_XXXX.MOV`.

---

## 📊 3. Mappa Completa dei 10 Moduli e Stato Attuale

### 🟢 Modulo 1: Presentazione
* [x] **Lezione 1:** Presentazione (`bd20c4e6-7622-4729-9152-873010337e0c`) — *Caricato*
* [ ] **Lezione 2:** Chi sono e perchè dovresti ascoltarmi (`84f95ef9-dd67-47e0-b6fe-e6a8bd090f6c`) — **MANCANTE** *(In attesa di registrazione/edit)*
* [ ] **Lezione 3:** Mentalità (`74328195-c4be-4790-a366-c7cc9f5fd6a1`) — **MANCANTE** *(In attesa di registrazione/edit)*

---

### 🟢 Modulo 2: Teoria (COMPLETO 21/21)
* [x] **Lezione 1:** Introduzione (`1Introduzione_9x16.mp4`) — *Caricato*
* [x] **Lezione 2:** Il microblading (`2 il microblanding_9x16.mp4`) — *Caricato*
* [x] **Lezione 3:** Evoluzione del microblading (`My Movie_9x16.mp4`) — *Caricato*
* [x] **Lezione 4:** Norme igienico sanitarie (`4_9x16.mp4`) — *Caricato*
* [x] **Lezione 5:** Controindicazioni e malattie (`5_9x16.mp4`) — *Caricato*
* [x] **Lezione 6:** Vecchi PMU e cover up (`6_9x16.mp4`) — *Caricato*
* [x] **Lezione 7:** Cicatrici (`7_9x16.mp4`) — *Caricato*
* [x] **Lezione 8:** Dolore e anestetici (`8_9x16.mp4`) — *Caricato*
* [x] **Lezione 9:** Lavori su diversi tipi di pelle (`9_9x16.mp4`) — *Caricato*
* [x] **Lezione 10:** Pressione Corretta (`10_9x16.mp4`) — *Caricato*
* [x] **Lezione 11:** Esecuzione del trattamento (`11_9x16.mp4`) — *Caricato*
* [x] **Lezione 12:** Ripasso dei peli, brush e maschera (`12_9x16.mp4`) — *Caricato*
* [x] **Lezione 13:** Durata nel tempo del pigmento (`13_9x16.mp4`) — *Caricato*
* [x] **Lezione 14:** Perché scegliere Pigmenti Phibrows (`14_9x16.mp4`) — *Caricato*
* [x] **Lezione 15:** Pigmenti primari (`15_9x16.mp4`) — *Caricato*
* [x] **Lezione 16:** Miscela dei pigmenti (`16(gia in 16:9 non toccare).mp4`) — *Caricato*
* [x] **Lezione 17:** Come scegliere il pigmento (`17(gia in 16:9 non toccare).mp4`) — *Caricato*
* [x] **Lezione 18:** Neutralizzazione vecchi PMU (`18_9x16.mp4`) — *Caricato*
* [x] **Lezione 19:** Guarigione post trattamento (`19_9x16.mp4`) — *Caricato*
* [x] **Lezione 20:** Cura post trattamento (`20_9x16.mp4`) — *Caricato*
* [x] **Lezione 21:** Ritocco mensile e ritocco annuale (`21_9x16.mp4`) — *Caricato*

---

### 🟡 Modulo 3: Forma e Anatomia del Sopracciglio (4/7)
* [x] **Lezione 1:** Forma e anatomia del sopracciglio (`mod3 L’importanza delle sopracciglia _9x16.mp4`) — *Caricato*
* [ ] **Lezione 2:** Sistemare senza stravolgere — **MANCANTE**
* [ ] **Lezione 3:** Rapporto aureo e morfologia del viso — **MANCANTE**
* [ ] **Lezione 4:** Gestione delle asimmetrie — **MANCANTE**
* [x] **Lezione 5:** Forma su carta con righello (`Forma su carta con righello(gia in 16:9 non toccare).mp4`) — *Caricato*
* [x] **Lezione 6:** Forma su carta con righello (più realistica) (`mod3 forma su carta piu realistica...mp4`) — *Caricato*
* [x] **Lezione 7:** Forma su carta con compasso Phi (`mod3 Forma su carta con compasso Phi...mp4`) — *Caricato*

---

### 🔴 Modulo 4: Forma su Modella (0/3)
* [ ] **Lezione 1:** Strumenti per la forma — **MANCANTE**
* [ ] **Lezione 2:** Affilare la matita — **MANCANTE**
* [ ] **Lezione 3:** Forma su modella — **MANCANTE**

---

### 🟡 Modulo 5: Schemi e Spine (4/6)
* [x] **Lezione 1:** Introduzione (`mod5 Introduzione(gia in 16:9 non toccare).mp4`) — *Caricato*
* [x] **Lezione 2:** Seguire il pelo naturale (`mod5 2 Seguire il pelo naturale_9x16.mp4`) — *Caricato*
* [x] **Lezione 3:** La testa (`3 La testa(gia in 16:9 non toccarlo).mp4`) — *Caricato*
* [x] **Lezione 4:** Transizione (`mod5 transizione( gia 16:9 non toccarlo).mp4`) — *Caricato*
* [ ] **Lezione 5:** Peli inferiori — **MANCANTE**
* [ ] **Lezione 6:** Peli superiori — **MANCANTE**

---

### 🟡 Modulo 6: Latex (5/7)
* [x] **Lezione 1:** Come impugnare il tool e primi peli (`mod5 Come impugnare il tool e primi peli...mp4`) — *Caricato*
* [x] **Lezione 2:** La testa — *Caricato*
* [x] **Lezione 3:** Transizione — *Caricato*
* [ ] **Lezione 4:** Peli inferiori — **MANCANTE**
* [ ] **Lezione 5:** Peli superiori — **MANCANTE**
* [x] **Lezione 6:** Sopracciglio completo spine 3 (`mod6 Sopracciglio completo su latex spine 3...mp4`) — *Caricato*
* [x] **Lezione 7:** Sopracciglio completo spine 6 (`Sopracciglio completo su latex spine 6...mp4`) — *Caricato*

---

### 🔴 Modulo 7: Lavoro su Modella (0/5)
* [ ] **Lezione 1:** Preparare il carrellino di lavoro — **MANCANTE**
* [ ] **Lezione 2:** Primo passaggio sopracciglio destro — **MANCANTE**
* [ ] **Lezione 3:** Primo passaggio sopracciglio sinistro — **MANCANTE**
* [ ] **Lezione 4:** Ripasso dei peli — **MANCANTE**
* [ ] **Lezione 5:** Lavoro completo — **MANCANTE**

---

### 🔴 Modulo 8: Normative (0/4)
* [ ] **Lezione 1:** Codice Ateco, quale scegliere? — **MANCANTE**
* [ ] **Lezione 2:** Affitto cabina o percentuale — **MANCANTE**
* [ ] **Lezione 3:** Come cercare gli studi e come proporsi — **MANCANTE**
* [ ] **Lezione 4:** Consenso informato — **MANCANTE**

---

### 🟡 Modulo 9: Consulenza (2/9)
* [ ] **Lezione 1:** Introduzione — **MANCANTE**
* [x] **Lezione 2:** Smetti di fare consulenza informativa (`sabri smetti+di+fare...mp4`) — *Caricato*
* [x] **Lezione 3:** Come fare una consulenza di vendita (`sabri consulenza+di+vendita...mp4`) — *Caricato*
* [ ] **Lezione 4:** Gestire le obiezioni — **MANCANTE**
* [ ] **Lezione 5:** Risoluzione obiezioni — **MANCANTE**
* [ ] **Lezione 6:** Consulenza in studio — **MANCANTE**
* [ ] **Lezione 7:** Consulenza di vendita in studio vs chiamata di vendita — **MANCANTE**
* [ ] **Lezione 8:** Registrazione chiamata di vendita — **MANCANTE**
* [ ] **Lezione 9:** Come impostare il giusto prezzo per partire — **MANCANTE**

---

### 🟡 Modulo 10: Come Trovare i Tuoi Primi Clienti (3/9)
* [ ] **Lezione 1:** Vendere e fare dermopigmentazione sono due cose diverse — **MANCANTE**
* [ ] **Lezione 2:** Come superare i blocchi iniziali — **MANCANTE**
* [ ] **Lezione 3:** Come impostare correttamente una pagina social professionale — **MANCANTE**
* [ ] **Lezione 4:** Da dove partono le idee di contenuto — **MANCANTE**
* [x] **Lezione 5:** Strategie di contenuto (`strategie di contenuto.mp4`) — *Caricato*
* [x] **Lezione 6:** Come realizzare i contenuti (`sabri contenuti di attrazione...mp4`) — *Caricato*
* [x] **Lezione 7:** Che tipi di stories fare (`sabri Come organizzare le stories...mp4`) — *Caricato*
* [ ] **Lezione 8:** Come ho costruito un business da 15k al mese — **MANCANTE**
* [ ] **Lezione 9:** Quando è necessario fare la call strategica — **MANCANTE**

---

## 🛠️ 4. Procedura di Caricamento Nuove Lezioni Mancanti

Quando la cliente registra e consegna i file delle lezioni mancanti:

1. **Lettura durata con `ffprobe` e generazione hash versione:**
   ```python
   import subprocess, json, uuid, boto3

   # 1. Calcolo durata esatta
   cmd = ['ffprobe', '-v', 'quiet', '-print_format', 'json', '-show_format', filepath]
   res = subprocess.run(cmd, capture_output=True, text=True)
   duration = int(float(json.loads(res.stdout)['format'].get('duration', 0)))

   # 2. Generazione chiave versione univoca
   asset_version = uuid.uuid4().hex
   s3_key = f"videos/{lesson_id}/{asset_version}/source.mp4"

   # 3. Upload S3
   s3 = boto3.client('s3')
   s3.upload_file(Filename=filepath, Bucket='prod-videocorso-content', Key=s3_key, ExtraArgs={'ContentType': 'video/mp4'})

   # 4. Registrazione DynamoDB
   dynamodb = boto3.resource('dynamodb')
   lessons_table = dynamodb.Table('prod-videocorso-lessons')
   lessons_table.update_item(
       Key={'lesson_id': lesson_id},
       UpdateExpression='SET pending_asset_version = :av, pending_video_s3_key = :key, pending_transcode_status = :status, duration_seconds = :dur',
       ExpressionAttributeValues={':av': asset_version, ':key': s3_key, ':status': 'PENDING_UPLOAD', ':dur': duration}
   )
   ```
2. AWS EventBridge + MediaConvert transcodificherà il video a 1080p, 720p, 480p e 360p impostando lo stato a `COMPLETE`.

---

## 🔄 5. Procedura di Aggiornamento / Sostituzione Video Editato (Hot-Swap Zero Downtime)

Quando la cliente invia un **video ri-editato, corretto o migliorato** per sostituire una lezione già pubblicata:

1. **Nessun Downtime per le Corsiste**:
   Grazie all'architettura a due fasi (`pending_asset_version` → `asset_version`), mentre AWS MediaConvert elabora il nuovo video in background, le corsiste continuano a vedere la versione precedente senza interruzioni o schermate nere.
2. **Promozione Atomica**:
   Non appena la transcodifica delle 4 risoluzioni (1080p, 720p, 480p, 360p) termina con successo (`COMPLETE`), la Lambda `video_transcode_handler` promuove atomicamente il nuovo video come attivo ed elimina automaticamente i vecchi file obsoleti da S3 per non occupare spazio inutile.
3. **Come Eseguirlo**:
   Basta eseguire la stessa procedura del punto 4 passando il nuovo file: il sistema assegnerà un nuovo `asset_version`, farà il rendering HD e sostituirà il video vecchio in modo trasparente.


