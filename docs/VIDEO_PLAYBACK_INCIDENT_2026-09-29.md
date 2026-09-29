# Incidente riproduzione video — 29 settembre 2026

Documento post-mortem e guida operativa. Spiega **cosa si è rotto**, **perché**, **cosa è stato
corretto** e **come ripetere/verificare** gli interventi in futuro.

Stack di riferimento (produzione):

- Account AWS: `170884089098` (profilo CLI `personale`), region `us-east-1`
- Bucket video: `prod-videocorso-content`
- Tabella lezioni: `prod-videocorso-lessons`
- CDN video: CloudFront `d39fyhcntf368y.cloudfront.net` (distribution `E3RGTK4NRBCHH1`)
- Frontend: React/Vite (player in `frontend/src/components/course/VideoPlayer.tsx`)

---

## 1. Sintomo segnalato dalla cliente

> "Ogni tanto si blocca tutto. Riaggiornando la pagina riprende. Mi è capitato più volte in
> mezz'ora/40 minuti, poi riparte. Guardando solo uno o due video non succede."

Non era un guasto generale del server (CloudFront e Lambda senza errori 5xx): era la
riproduzione in **progressive download** di file pesanti che, con un calo del Wi-Fi, svuota il
buffer. In più, alcune lezioni servivano file **non compatibili** con molti browser.

---

## 2. Diagnosi (tre cause distinte)

### 2.1 Rendition mancanti e default troppo pesante
Molte lezioni avevano solo il master/originale 1080p ad alto bitrate (picchi oltre 20 Mbps).
Il player partiva dalla qualità più alta e il buffer si svuotava.

**Corretto da:** commit `f21586f` (recupero stalli player), `504046c` (backfill 720p),
`feb09ed` (hardening ciclo di playback), e dal backfill 1080p
(`scripts/backfill_web_1080p_from_s3.py`, `scripts/backfill_web_720p_from_s3.py`).

### 2.2 Il player non si riprendeva da solo dopo uno stallo
Se il buffer si svuotava, restava bloccato finché l'utente non ricaricava la pagina.

**Corretto da:** `f21586f` + `feb09ed`:
- default di qualità **720p**;
- watchdog di stallo (dopo ~8 s di blocco) che rigenera l'URL firmato e ricarica la sorgente
  **mantenendo il secondo corrente**;
- dopo stalli ripetuti, passaggio automatico a una qualità inferiore;
- se si esauriscono i tentativi, messaggio "riprova dal punto raggiunto".

### 2.3 Codec/colore non web-safe (la vera "grana" del 29/09)
- **4 lezioni MODELLA** avevano la `source_4k.mp4` in **HEVC Main10 10-bit** (export del render):
  **non decodifica** su Chrome/Firefox/Edge. Le rendition 4K pesavano fino a **2,5 GB**.
- La lezione **"Vendere e fare dermopigmentazione sono 2 cose diverse"** era **full-range
  (`yuvj420p`, `color_range=pc`)** → colori potenzialmente alterati su alcuni browser.

**Corretto da:** `scripts/fix_renditions_from_master.py` (nuovo, 29/09) + invalidazione CloudFront.

---

## 3. Interventi applicati e stato

| # | Intervento | File/Commit | Stato |
|---|-----------|-------------|-------|
| 1 | Recupero stalli nel player + default 720p | `f21586f` | push |
| 2 | Backfill rendition 720p web-safe | `504046c` | push |
| 3 | Hardening ciclo playback/errori | `feb09ed` | push |
| 4 | Backfill rendition 1080p web-safe (legacy) | `scripts/backfill_web_1080p_from_s3.py` | eseguito |
| 5 | 4K HEVC → H.264 web-safe (4 lezioni MODELLA) | `scripts/fix_renditions_from_master.py` | eseguito |
| 6 | Range full → tv (lezione "Vendere…") | `scripts/fix_renditions_from_master.py` | eseguito |
| 7 | Invalidazione cache CloudFront | distribution `E3RGTK4NRBCHH1` | `Completed` |
| 8 | Log di accesso CloudFront (v2) | delivery `aAd2epH3k5NmPx7o` | attivo |
| 9 | Documentazione | `docs/VIDEO_PLAYBACK_INCIDENT_2026-09-29.md` | questo file |

### 3.1 Dettaglio 4K MODELLA (intervento #5)

Ricodificate **da master 4K** (`/Volumes/Sviluppo/MODELLA`, copiato su disco interno durante
l'operazione) in **H.264 High Level 5.1, yuv420p, range tv, faststart**:

| Lezione | `source_4k.mp4` |
|---------|-----------------|
| Forma su modella | 520 MB |
| Primo passaggio | 688 MB |
| Ripasso dei peli | 752 MB |
| Maschera e pulizia finale | 76 MB |

Le rendition 2K/1440p, 1080p, 720p, 480p, 360p erano **già** H.264 web-safe e sono state
**lasciate invariate** (nessun re-encode inutile).

### 3.2 Lezione full-range (#6)

`source_1080p/720p/480p/360p` ricodificate con conversione `in_range=pc → out_range=tv`,
`format=yuv420p`, tag `bt709`.

---

## 4. Perché è servita l'invalidazione CloudFront

Le rendition sono caricate con `Cache-Control: public, max-age=31536000, immutable`.
Sostituire l'oggetto S3 **non** aggiorna la cache degli edge: senza invalidazione il CDN
continua a servire il vecchio file HEVC. Dopo ogni sostituzione di un oggetto video **va
sempre invalidato** il percorso:

```bash
aws cloudfront create-invalidation --distribution-id E3RGTK4NRBCHH1 \
  --paths "/streaming/<lesson_id>/<asset_version>/source_<quale>.mp4" \
  --profile personale
```

(Lezione imparata: lo stesso `max-age` vale pure per la `source_720p` dei backfill precedenti.)

---

## 5. Script operativi

Tutti gli script stanno in `scripts/`. Leggono lo stato reale da S3/DynamoDB e sono
**resumable**; **non modificano mai gli originali** in `videos/…/source.mp4`.

- `audit_course_videos.py` — inventario completo (moduli, lezioni, rendition presenti in S3).
- `backfill_web_720p_from_s3.py` / `backfill_web_1080p_from_s3.py` — creano rendition
  web-safe mancanti partendo dall'originale (via presigned URL).
- `fix_renditions_from_master.py` — ricodifica dai **master locali** le qualità di una lista di
  lezioni e converte il range full→tv. Uso:

  ```bash
  # dry-run (mostra il piano, non scrive)
  python3 scripts/fix_renditions_from_master.py

  # esecuzione, saltando ciò che è già web-safe
  python3 scripts/fix_renditions_from_master.py --apply --resume

  # limitare a una lezione / una qualità
  python3 scripts/fix_renditions_from_master.py --apply --lesson-id <id> --quality 4k
  ```

  Override (utile se i master sono su disco interno):

  ```bash
  MODELLA_DIR=/percorso/master OUTPUT_DIR=/percorso/out \
    python3 scripts/fix_renditions_from_master.py --apply --resume
  ```

### Verifica rapida di un oggetto S3

```bash
python3 - <<'PY'
import boto3, subprocess, json
s=boto3.Session(profile_name='personale', region_name='us-east-1')
k='streaming/<lesson_id>/<asset_version>/source_4k.mp4'
url=s.client('s3').generate_presigned_url('get_object',
    Params={'Bucket':'prod-videocorso-content','Key':k}, ExpiresIn=300)
print(subprocess.run(['ffprobe','-v','error','-select_streams','v:0',
    '-show_entries','stream=codec_name,level,width,height,pix_fmt,color_range',
    '-of','json',url], capture_output=True, text=True).stdout)
PY
```

Atteso: `codec_name=h264`, `pix_fmt=yuv420p`, `color_range=tv`, dimensioni corrette.

---

## 6. Log di accesso CloudFront (attivati il 29/09)

Attivata la **standard logging v2** (via CloudWatch Logs deliveries), che scrive su:

- Bucket: `prod-videocorso-cloudfront-logs-170884089098`
- Prefisso: `AWSLogs/170884089098/CloudFront/`
- Campi utili: `cs-uri-stem` (percorso file, es. `…/source_4k.mp4`), `sc-status`,
  `x-edge-result-type`, `time-to-first-byte`, `sc-range-start/end`.

Questo permette di rispondere a "quale file/qualità ha davvero richiesto lo studente".
La logging **legacy** (Logging nel DistributionConfig) non è usata.

> Nota: i log iniziano a comparire dopo qualche minuto dall'attivazione.

---

## 7. Cosa **non** è stato toccato / resta latente

- I master originali in `videos/<lesson_id>/<version>/source.mp4` **non sono stati modificati né
  cancellati** (archivio). Per le 4 lezioni MODELLA restano in HEVC: oggi non vengono mai
  serviti perché esistono le rendition, ma se un giorno una rendition sparisse tornerebbe il
  problema. Non cancellarli senza motivo.
- **2 lezioni** con sorgente HEVC 1080p e **19 lezioni** con sorgente H.264 Level 5.0: sorgenti
  "latenti" non web-safe, ma **coperte** dalle rendition 1080p/720p corrette già servite.
  Non impattano gli studenti.
- Duplicato `source_1440p.mp4` + `source_2k.mp4`: il backend controlla solo `2k`; il file
  `1440p` è ridondante. Innocuo. Valutare rimozione solo se si vuole risparmiare spazio.

---

## 8. Checklist in caso di nuovo blocco video

1. `python3 scripts/audit_course_videos.py` → vedere quali rendition mancano.
2. Controllare i log CloudFront (sezione 6) per il file esatto richiesto.
3. Se manca una rendition: `backfill_web_*_from_s3.py --apply`.
4. Se l'originale è HEVC/L5.0/full-range: `fix_renditions_from_master.py --apply --resume`.
5. **Invalidare CloudFront** per i percorsi cambiati (sezione 4).
6. Verificare con `ffprobe` (sezione 5) e con un URL firmato CloudFront.
