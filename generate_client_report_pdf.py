import os
import sys
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm, mm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.pdfgen import canvas

# Palette Colori Chiara Morocutti Luxury
COLOR_PRIMARY = colors.HexColor('#4A0E2E')      # Bordeaux Nobile
COLOR_SECONDARY = colors.HexColor('#9C7178')    # Oro Rosa / Antico
COLOR_ACCENT = colors.HexColor('#D1A4B1')       # Rosa Satinato Chiaro
COLOR_DARK = colors.HexColor('#1F2937')         # Antracite Scuro (Testo)
COLOR_MUTED = colors.HexColor('#4B5563')        # Grigio Medio
COLOR_LIGHT_BG = colors.HexColor('#FAF5F7')     # Sfondo Card Satinato
COLOR_BORDER = colors.HexColor('#F3DCE3')       # Bordo Card
COLOR_GOLD = colors.HexColor('#C59B27')         # Oro Dettagli
COLOR_WHITE = colors.HexColor('#FFFFFF')
COLOR_GREEN = colors.HexColor('#059669')        # Verde Spunta

class NumberedCanvas(canvas.Canvas):
    """Canvas personalizzato per gestire header e footer con numerazione pagina 'X di Y'."""
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        
        # Non disegnare header sulla prima pagina (copertina)
        if self._pageNumber > 1:
            # Header Superiore
            self.setFont("Helvetica-Bold", 8)
            self.setFillColor(COLOR_PRIMARY)
            self.drawString(2 * cm, A4[1] - 1.5 * cm, "CHIARA MOROCUTTI ACADEMY")
            self.setFont("Helvetica", 8)
            self.setFillColor(COLOR_SECONDARY)
            self.drawRightString(A4[0] - 2 * cm, A4[1] - 1.5 * cm, "Relazione Finale Opere & Piattaforma E-Learning")
            
            # Linea divisoria header
            self.setStrokeColor(COLOR_BORDER)
            self.setLineWidth(0.75)
            self.line(2 * cm, A4[1] - 1.65 * cm, A4[0] - 2 * cm, A4[1] - 1.65 * cm)

        # Footer (su tutte le pagine)
        self.setStrokeColor(COLOR_BORDER)
        self.setLineWidth(0.75)
        self.line(2 * cm, 1.8 * cm, A4[0] - 2 * cm, 1.8 * cm)

        self.setFont("Helvetica", 8)
        self.setFillColor(COLOR_MUTED)
        self.drawString(2 * cm, 1.2 * cm, "Documento Riservato • Rilascio Piattaforma Masterclass Microblading")
        page_str = f"Pagina {self._pageNumber} di {page_count}"
        self.drawRightString(A4[0] - 2 * cm, 1.2 * cm, page_str)

        self.restoreState()


def build_pdf(filename="Relazione_Opere_Chiara_Morocutti_Academy.pdf"):
    doc = SimpleDocTemplate(
        filename,
        pagesize=A4,
        leftMargin=2 * cm,
        rightMargin=2 * cm,
        topMargin=2.2 * cm,
        bottomMargin=2.2 * cm,
    )

    styles = getSampleStyleSheet()

    # Stili Personalizzati
    style_cover_title = ParagraphStyle(
        'CoverTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=24,
        leading=30,
        textColor=COLOR_PRIMARY,
        alignment=1, # Center
        spaceAfter=8,
    )

    style_cover_sub = ParagraphStyle(
        'CoverSub',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=COLOR_SECONDARY,
        alignment=1,
        textTransform='uppercase',
        spaceAfter=20,
    )

    style_cover_desc = ParagraphStyle(
        'CoverDesc',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=15,
        textColor=COLOR_DARK,
        alignment=1,
    )

    style_h1 = ParagraphStyle(
        'SectionH1',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=15,
        leading=19,
        textColor=COLOR_PRIMARY,
        spaceBefore=14,
        spaceAfter=8,
        keepWithNext=True,
    )

    style_h2 = ParagraphStyle(
        'SectionH2',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=15,
        textColor=COLOR_PRIMARY,
        spaceBefore=8,
        spaceAfter=4,
        keepWithNext=True,
    )

    style_body = ParagraphStyle(
        'CustomBody',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9.5,
        leading=14.5,
        textColor=COLOR_DARK,
        spaceAfter=6,
    )

    style_bullet = ParagraphStyle(
        'CustomBullet',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9.5,
        leading=14,
        textColor=COLOR_DARK,
        leftIndent=15,
        firstLineIndent=-10,
        spaceAfter=4,
    )

    style_card_title = ParagraphStyle(
        'CardTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=15,
        textColor=COLOR_PRIMARY,
        spaceAfter=4,
    )

    style_card_text = ParagraphStyle(
        'CardText',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13.5,
        textColor=COLOR_DARK,
    )

    style_meta_label = ParagraphStyle(
        'MetaLabel',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=13,
        textColor=COLOR_PRIMARY,
    )

    style_meta_val = ParagraphStyle(
        'MetaVal',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=COLOR_DARK,
    )

    story = []

    # =========================================================================
    # 1. COPERTINA / FRONTESPIZIO ELEGANTE
    # =========================================================================
    story.append(Spacer(1, 1.5 * cm))
    story.append(Paragraph("CHIARA MOROCUTTI ACADEMY", style_cover_sub))
    story.append(Paragraph("RELAZIONE FINALE DELLE OPERE SVOLTE", style_cover_title))
    story.append(Paragraph("Rilascio Ufficiale Piattaforma E-Learning Masterclass & Sistema Integrato di Vendita", style_cover_desc))
    
    story.append(Spacer(1, 1 * cm))
    story.append(HRFlowable(width="100%", thickness=1.5, color=COLOR_PRIMARY, spaceAfter=20, spaceBefore=0))

    # Box Riepilogo Dati di Consegna
    meta_data = [
        [Paragraph("Cliente / Committente:", style_meta_label), Paragraph("Chiara Morocutti • Chiara Morocutti Academy", style_meta_val)],
        [Paragraph("Progetto:", style_meta_label), Paragraph("Piattaforma E-Learning Proprietaria & Masterclass Microblading", style_meta_val)],
        [Paragraph("Data Rilascio:", style_meta_label), Paragraph("Agosto 2026", style_meta_val)],
        [Paragraph("Stato Progetto:", style_meta_label), Paragraph("<font color='#4A0E2E'><b>Piattaforma Operativa • Versione 1.0 (Lancio Ufficiale & Assistenza Attiva)</b></font>", style_meta_val)],
        [Paragraph("Dominio Web Ufficiale:", style_meta_label), Paragraph("https://main.d26u0xz2smmxfz.amplifyapp.com", style_meta_val)],
    ]
    meta_table = Table(meta_data, colWidths=[5 * cm, 12 * cm])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), COLOR_LIGHT_BG),
        ('BOX', (0, 0), (-1, -1), 1, COLOR_BORDER),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, COLOR_BORDER),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 12),
        ('RIGHTPADDING', (0, 0), (-1, -1), 12),
    ]))
    story.append(meta_table)

    story.append(Spacer(1, 1.2 * cm))

    # Breve sintesi introduttiva
    intro_p = (
        "Il presente documento riassume in modo chiaro e dettagliato l'intero complesso di opere, creazioni grafiche, "
        "produzione multimediale, sviluppo software ed infrastruttura digitale realizzate per il lancio e la gestione "
        "della <b>Masterclass di Microblading di Chiara Morocutti</b>.<br/><br/>"
        "La soluzione realizzata è un'applicazione proprietaria ad altissimo valore tecnologico ed estetico, studiata su misura "
        "per offrire alle studentesse un'esperienza formativa di lusso e consentire una gestione delle vendite e delle iscrizioni "
        "totalmente automatizzata, sicura e senza pensieri."
    )
    story.append(Paragraph(intro_p, style_body))

    story.append(PageBreak())

    # =========================================================================
    # 2. PRODUZIONE MULTIMEDIALE, VIDEO EDITING & GRAFICA
    # =========================================================================
    story.append(Paragraph("1. Produzione Multimediale, Video Editing & Brand Identity", style_h1))
    story.append(Paragraph(
        "Tutto il materiale formativo e visivo è stato interamente elaborato, montato, ottimizzato e curato per rispecchiare "
        "i più elevati standard estetici di un'Academy di bellezza di prestigio.",
        style_body
    ))

    works_multimedia = [
        "<b>Elaborazione & Montaggio di oltre 60 Lezioni Video:</b> Ogni singolo filmato registrato è stato ripulito, sincronizzato, ottimizzato nell'audio e renderizzato in alta definizione <b>1080p Full HD</b> con bilanciamento cromatico per garantire una visione perfetta dei dettagli del pelo e della tecnica.",
        "<b>Creazione Copertina Ufficiale Masterclass:</b> Progettazione del visual principale dell'Academy con branding luxury, tonalità oro/bordeaux e fotografia di Chiara in primo piano.",
        "<b>Creazione di 10 Copertine Ufficiali di Modulo:</b> Realizzazione di copertine dedicate per ciascuno dei 10 moduli tematici, mantenendo uno stile visivo prestigioso ed armonico.",
        "<b>Creazione di oltre 60 Copertine Personalizzate per Singola Lezione:</b> Grafica coordinata per ogni video della piattaforma, con titolazione chiara e numerazione ordinata per rendere l'esperienza di navigazione intuitiva e appagante.",
        "<b>Organizzazione Didattica Completa in 10 Moduli:</b> Strutturazione logica del percorso: Presentazione, Teoria Fondamentale, Anatomia & Pelle, Progettazione Forma su Modella, Schemi Spine, Esercitazioni su Latex, Dimostrazione Completa su Modella Reale, Normative & Igiene, Consulenza e Strategie di Acquisizione Clienti.",
    ]

    for item in works_multimedia:
        story.append(Paragraph(f"• {item}", style_bullet))

    story.append(Spacer(1, 0.4 * cm))

    # =========================================================================
    # 3. LA PIATTAFORMA WEB & L'ESPERIENZA DELLA STUDENTESSA
    # =========================================================================
    story.append(Paragraph("2. La Piattaforma Web & L'Esperienza della Studentessa", style_h1))
    story.append(Paragraph(
        "Il sito web e l'area riservata sono stati sviluppati con un design esclusivo, moderno, reattivo e perfettamente "
        "fruibile sia da smartphone (iPhone/Android) che da tablet e computer.",
        style_body
    ))

    works_frontend = [
        "<b>Landing Page Ufficiale di Vendita ad Alta Conversione:</b> Pagina di presentazione d'impatto con presentazione del corso, anteprime dei moduli, biografia, FAQ interattive e widget delle <b>recensioni reali Trustpilot verificate</b> per massimizzare la fiducia dell'utente.",
        "<b>Video Player di Nuova Generazione ad Avvio Istantaneo:</b> Player video sviluppato su misura con tecnologia di transcodifica adattiva (i video partono subito anche con connessione debole) e <i>scrubbing istantaneo</i> a zero secondi di ritardo per consentire alla studentessa di saltare avanti e indietro nel filmato senza attese meccaniche o blocchi.",
        "<b>Area Personale Riservata (Dashboard):</b> Accesso protetto per ogni studentessa con visualizzazione dello stato di avanzamento della Masterclass.",
        "<b>Tracciamento Automatico dei Progressi:</b> Il sistema memorizza automaticamente le lezioni già guardate (contrassegnandole con una spunta verde) e permette alla studentessa di riprendere la visione esattamente dal punto in cui si era interrotta.",
    ]

    for item in works_frontend:
        story.append(Paragraph(f"• {item}", style_bullet))

    story.append(Spacer(1, 0.4 * cm))

    # =========================================================================
    # 4. SISTEMA DI VENDITA & INCASSO AUTOMATICO
    # =========================================================================
    story.append(Paragraph("3. Sistema di Vendita, Checkout & Incasso Automatico", style_h1))
    story.append(Paragraph(
        "Tutto il flusso di vendita è stato completamente digitalizzato ed automatizzato: dal momento in cui la cliente clicca "
        "'Acquista' fino all'erogazione del corso e alla consegna della ricevuta.",
        style_body
    ))

    works_sales = [
        "<b>Integrazione Sicura con Stripe (Circuito Bancario Ufficiale):</b> Ricezione pagamenti con Carte di Credito, Debito, Prepagate, Apple Pay e Google Pay nel rispetto delle normative europee PSD2 e <b>autenticazione a due fattori 3D Secure</b>.",
        "<b>Supporto Pagamenti a Rate (Klarna / Scalapay / Afterpay):</b> La rateizzazione è già supportata nativamente da Stripe: le tue clienti possono pagare in 3 o 4 rate comode, ma <b>tu incassi il 100% del prezzo subito al momento dell'acquisto</b> senza alcun rischio di insolvenza (il rischio di credito è interamente a carico di Klarna/Stripe).",
        "<b>Gestione Avanzata Coupon & Codici Sconto:</b> Sistema per creare sconti promozionali a percentuale (es. 20%) o a importo fisso (es. 100€), con controllo automatico delle date di scadenza e del limite massimo di utilizzi.",
        "<b>Creazione Automatica Istantanea dell'Account:</b> Non appena il pagamento va a buon fine, il server crea l'utente in background in frazioni di secondo senza richiedere alcun intervento manuale da parte dello staff.",
        "<b>Invio Automatico Credenziali via Email:</b> La cliente riceve all'istante l'email di benvenuto ufficiale con username, password temporanea e link di accesso diretto alla Masterclass.",
        "<b>Protezione Anti-Doppio Acquisto & Tolleranza Errori:</b> Architettura transazionale di livello bancario che previene addebiti duplicati e garantisce la registrazione dell'ordine anche in caso di caduta improvvisa della connessione.",
    ]

    for item in works_sales:
        story.append(Paragraph(f"• {item}", style_bullet))

    story.append(PageBreak())

    # =========================================================================
    # 5. PANNELLO DI CONTROLLO AMMINISTRATORE (BACKOFFICE)
    # =========================================================================
    story.append(Paragraph("4. Pannello di Controllo & Gestione Riservata (Admin)", style_h1))
    story.append(Paragraph(
        "È stato creato un backoffice dedicato e protetto attraverso il quale Chiara e i suoi collaboratori possono avere "
        "il pieno controllo su ogni aspetto della piattaforma senza toccare una riga di codice:",
        style_body
    ))

    works_admin = [
        "<b>Cruscotto Statistiche & KPI:</b> Monitoraggio in tempo reale del fatturato lordo/netto, totale ordini registrati, studentesse iscritte e andamento complessivo.",
        "<b>Gestione Catalogo Corsi & Lezioni (CMS):</b> Possibilità di modificare titoli, descrizioni, capitoli, ordinamento delle lezioni e caricare nuovi video o copertine con un semplice trascinamento (Drag & Drop).",
        "<b>Anagrafica Studentesse:</b> Elenco completo delle corsiste con storico acquisti, stato di attivazione, possibilità di reinviare l'email di invito, resettare la password con un clic o assegnare corsi manualmente in omaggio.",
        "<b>Gestione Acquisti & Rimborsi con 1 Clic:</b> Visualizzazione analitica di ogni transazione con dati cliente, data e metodo di pagamento. Funzione di <b>rimborso automatico su Stripe</b> direttamente dal pannello con rilascio immediato della ricevuta e revoca dell'accesso.",
        "<b>Gestione Coupon Sconto:</b> Creazione e disattivazione immediata di codici sconto promozionali per campagne marketing, eventi o collaborazioni influencer.",
        "<b>Gestione Collaboratori (Account Admin):</b> Creazione di account dedicati con permessi amministrativi per il team di supporto o i docenti dell'Academy.",
        "<b>Registro di Controllo & Audit Log:</b> Salvataggio automatico di ogni operazione amministrativa svolta (modifiche, rimborsi, concessioni corsi) a tutela della trasparenza e sicurezza contabile.",
    ]

    for item in works_admin:
        story.append(Paragraph(f"• {item}", style_bullet))

    story.append(Spacer(1, 0.4 * cm))

    # =========================================================================
    # 6. INFRASTRUTTURA CLOUD, SICUREZZA ANTI-PIRATERIA & EMAIL
    # =========================================================================
    story.append(Paragraph("5. Infrastruttura Cloud, Sicurezza Anti-Pirateria & Email", style_h1))
    story.append(Paragraph(
        "La piattaforma è ospitata sui server <b>Amazon Web Services (AWS)</b>, gli stessi utilizzati dalle più grandi aziende "
        "mondiali, garantendo affidabilità totale, velocità e sicurezza:",
        style_body
    ))

    works_infra = [
        "<b>Protezione Anti-Copia & Anti-Pirateria dei Video:</b> I video della Masterclass non sono file pubblici scaricabili. Vengono erogati attraverso link crittografati a scadenza automatica (AWS Signed URLs). Nessun utente può scaricare, copiare o condividere i video con persone non autorizzate.",
        "<b>Rete di Distribuzione Globale (CDN CloudFront):</b> I video e i contenuti del sito vengono memorizzati su nodi ultraveloci in tutto il mondo: le lezioni partono istantaneamente in alta qualità senza mai andare in buffering.",
        "<b>Template Email di Lusso Personalizzato:</b> Tutte le comunicazioni automatiche inviate (email di benvenuto, credenziali di accesso, recupero password) sono state graficamente impaginate con l'identità visiva dell'Academy, box satinato per le credenziali e pulsante di login diretto.",
        "<b>Connessione Sicura & Certificati SSL:</b> Tutto il traffico tra studentessa e piattaforma viaggia su canale protetto crittografato HTTPS (lucchetto di sicurezza nel browser).",
        "<b>Sistema di Ripristino Automatico:</b> Meccanismo intelligente integrato che, in caso di aggiornamenti della piattaforma, ricarica automaticamente le pagine per le utenti senza mai mostrare schermate di errore.",
    ]

    for item in works_infra:
        story.append(Paragraph(f"• {item}", style_bullet))

    story.append(PageBreak())

    # =========================================================================
    # 6. MANUALE OPERATIVO: RISOLUZIONE CON 1 CLIC DELLE PROBLEMATICHE CLIENTI
    # =========================================================================
    story.append(Paragraph("6. Manuale Operativo: Risoluzione con 1 Clic di Ogni Problematica Cliente", style_h1))
    story.append(Paragraph(
        "Per garantire la massima serenità operativa a Chiara e al suo team, sono state anticipate e implementate "
        "soluzioni automatiche e pulsanti dedicati a 1 clic per gestire qualsiasi errore umano o contestazione delle corsiste:",
        style_body
    ))

    troubleshooting_data = [
        [
            Paragraph("<b>Scenario / Problema del Cliente</b>", style_meta_label),
            Paragraph("<b>Cosa Può Fare la Corsista da Sola</b>", style_meta_label),
            Paragraph("<b>Soluzione con 1 Clic per Chiara (Admin)</b>", style_meta_label),
        ],
        [
            Paragraph("<b>1. Password Persa o Non Ricordata</b>", style_card_text),
            Paragraph("Clicca su <i>'Password dimenticata?'</i>, riceve un codice via email e la reimposta in 30 secondi.", style_card_text),
            Paragraph("Entra in <i>Corsiste</i> e clicca <b>'Resetta Password'</b>: il server le invia all'istante una nuova password temporanea via email.", style_card_text),
        ],
        [
            Paragraph("<b>2. Email Sbagliata al Checkout</b><br/><font color='#6B7280' size='8'>(es. scrive <i>gmai.com</i>)</font>", style_card_text),
            Paragraph("Non riceve l'invito e contatta l'assistenza di Chiara.", style_card_text),
            Paragraph("Apre l'acquisto e clicca <b>'Correggi Email'</b>: il sistema trasferisce l'acquisto sul nuovo indirizzo corretto e invia subito l'accesso.", style_card_text),
        ],
        [
            Paragraph("<b>3. Errore Indirizzo Spedizione Kit</b>", style_card_text),
            Paragraph("Segnala la modifica dell'indirizzo di consegna prima della spedizione.", style_card_text),
            Paragraph("Nella scheda acquisto trova la sezione <b>'Dati di Spedizione'</b> con CAP, città e note corriere fornite al checkout.", style_card_text),
        ],
        [
            Paragraph("<b>4. Richiesta di Rimborso Volontario</b>", style_card_text),
            Paragraph("Invia richiesta di annullamento o recesso.", style_card_text),
            Paragraph("Clicca <b>'Effettua Rimborso'</b> (Totale o Parziale): Stripe accredita i fondi su carta e l'accesso al corso viene revocato all'istante.", style_card_text),
        ],
        [
            Paragraph("<b>5. Contestazione Bancaria Furbetta</b><br/><font color='#6B7280' size='8'>(Vuole i soldi dopo aver visto i video)</font>", style_card_text),
            Paragraph("Apre contestazione in banca asserendo di non aver autorizzato l'ordine.", style_card_text),
            Paragraph("Clicca <b>'Esporta Dossier Contestazione'</b>: genera la memoria difensiva certificata con rinuncia legale al recesso e registro delle lezioni già viste.", style_card_text),
        ],
        [
            Paragraph("<b>6. Corso 'Non Visibile' dopo l'Acquisto</b>", style_card_text),
            Paragraph("Accede con email diversa o richiede verifica.", style_card_text),
            Paragraph("Clicca <b>'Sblocca Accesso Manualmente'</b> o <b>'Risincronizza con Stripe'</b> per forzare l'attivazione immediata.", style_card_text),
        ],
        [
            Paragraph("<b>7. Verifica Carta Respinta / Errore</b>", style_card_text),
            Paragraph("Sostiene di aver pagato ma il checkout è fallito.", style_card_text),
            Paragraph("Nel <i>Log di Sistema</i> visualizza il motivo esatto della banca (es. <i>fondi insufficienti</i> o <i>3DS fallito</i>) per rispondere con precisione.", style_card_text),
        ],
        [
            Paragraph("<b>8. Condivisione Abusiva o Pirateria</b>", style_card_text),
            Paragraph("Cerca di diffondere o registrare i video.", style_card_text),
            Paragraph("Il video proietta a schermo l'email dell'utente come <b>Watermark dinamico</b>. Chiara può cliccare <b>'Revoca Accesso'</b> per bloccarla.", style_card_text),
        ],
    ]

    trouble_table = Table(troubleshooting_data, colWidths=[4.2 * cm, 6.4 * cm, 6.4 * cm])
    trouble_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), COLOR_LIGHT_BG),
        ('BOX', (0, 0), (-1, -1), 1, COLOR_BORDER),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, COLOR_BORDER),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(trouble_table)

    story.append(Spacer(1, 0.4 * cm))

    # =========================================================================
    # 7. PERCHÉ UNA SOLUZIONE PROPRIETARIA VS PIATTAFORME ESTERNE
    # =========================================================================
    story.append(Paragraph("7. Analisi Economica: Soluzione Proprietaria vs Piattaforme Esterne a Noleggio", style_h1))
    story.append(Paragraph(
        "Prima di sviluppare l'infrastruttura, è stata valutata l'alternativa di utilizzare piattaforme terze già pronte "
        "(come <b>Kajabi, Teachable o Hotmart</b>). Il confronto economico e strategico dimostra chiaramente perché la soluzione "
        "proprietaria realizzata rappresenta un risparmio enorme e una sicurezza senza paragoni per l'Academy:",
        style_body
    ))

    # Tabella Confronto Competitor
    comp_data = [
        [
            Paragraph("<b>Caratteristica / Servizio</b>", style_meta_label),
            Paragraph("<b>Piattaforme Esterne (Kajabi, Teachable, Hotmart)</b>", style_meta_label),
            Paragraph("<b>Piattaforma Proprietaria Chiara Morocutti Academy</b>", style_meta_label),
        ],
        [
            Paragraph("<b>Canone Software</b>", style_card_text),
            Paragraph("<font color='#DC2626'><b>Da 150€ a 399€ al mese</b></font><br/>(Costo fisso pesante da 1.800€ a oltre 4.500€ ogni anno solo per usare il loro programma).", style_card_text),
            Paragraph("<font color='#059669'><b>Zero Canoni Software Pesanti</b></font><br/>Nessun abbonamento da centinaia di euro a terzi: la piattaforma è già interamente tua.", style_card_text),
        ],
        [
            Paragraph("<b>Percentuale sulle Vendite</b>", style_card_text),
            Paragraph("<font color='#DC2626'><b>Trattengono dal 5% al 10% di commissioni</b></font><br/>(Se vendi 20.000€ di corsi, si intascano fino a 2.000€ di sole percentuali trattenute sui tuoi guadagni!).", style_card_text),
            Paragraph("<font color='#059669'><b>0% Commissioni sul Fatturato</b></font><br/>Il 100% dell'incasso delle vendite entra direttamente e per intero sul conto bancario di Chiara.", style_card_text),
        ],
        [
            Paragraph("<b>Proprietà & Dati</b>", style_card_text),
            Paragraph("<font color='#DC2626'><b>Non possiedi nulla</b></font><br/>Se un giorno decidi di non pagare più l'abbonamento mensile, spengono tutto e perdi corsi e studentesse.", style_card_text),
            Paragraph("<font color='#059669'><b>Proprietà Esclusiva al 100%</b></font><br/>Codice, grafica, video e anagrafica studentesse appartengono per sempre ed esclusivamente a te.", style_card_text),
        ],
        [
            Paragraph("<b>Assistenza Tecnica</b>", style_card_text),
            Paragraph("<font color='#DC2626'><b>Ticket generici in inglese</b></font><br/>Tempi di attesa di giorni senza nessuno che intervenga sul codice in caso di problemi sui pagamenti.", style_card_text),
            Paragraph("<font color='#059669'><b>Tecnico Dedicato & Diretto</b></font><br/>Un referente tecnico reale sempre a disposizione per supportare te e le tue corsiste all'istante.", style_card_text),
        ],
    ]

    comp_table = Table(comp_data, colWidths=[4 * cm, 6.5 * cm, 6.5 * cm])
    comp_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), COLOR_LIGHT_BG),
        ('BOX', (0, 0), (-1, -1), 1, COLOR_BORDER),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, COLOR_BORDER),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(comp_table)

    story.append(Spacer(1, 0.4 * cm))

    # =========================================================================
    # 8. SCOMPOSIZIONE DEI COSTI DEL CANONE (100 € / MESE)
    # =========================================================================
    story.append(Paragraph("8. Scomposizione Analitica del Canone Tutto Incluso (100 € / Mese)", style_h1))
    story.append(Paragraph(
        "Il canone forfettario di <b>100 € al mese</b> copre integralmente tutte le spese vive di server, banda e assistenza, "
        "ripartito in modo trasparente nelle seguenti 4 voci operative:",
        style_body
    ))

    # Tabella Voci di Costo Dettagliate che sommano esattamente a 100€
    breakdown_data = [
        [
            Paragraph("<b>Voce di Costo Inclusa nel Canone</b>", style_meta_label),
            Paragraph("<b>Quota Mensile</b>", style_meta_label),
            Paragraph("<b>Cosa Copre Esattamente</b>", style_meta_label),
        ],
        [
            Paragraph("<b>1. Streaming Video HD & Anti-Copia</b>", style_card_text),
            Paragraph("<b>30 € / mese</b>", style_card_text),
            Paragraph("Copertura di tutto il traffico dati per lo streaming delle oltre 60 lezioni in Full HD e chiavi di sicurezza anti-pirateria.", style_card_text)
        ],
        [
            Paragraph("<b>2. Hosting Cloud, Database & SSL</b>", style_card_text),
            Paragraph("<b>25 € / mese</b>", style_card_text),
            Paragraph("Canoni server AWS ad alta velocità, database sicuro protetto per anagrafiche/ordini e certificati crittografici bancari HTTPS.", style_card_text)
        ],
        [
            Paragraph("<b>3. Monitoraggio Stripe & Backup</b>", style_card_text),
            Paragraph("<b>20 € / mese</b>", style_card_text),
            Paragraph("Controllo continuo dei pagamenti online per prevenire blocchi e salvataggio programmato di tutti i dati e progressi.", style_card_text)
        ],
        [
            Paragraph("<b>4. Assistenza & Reperibilità Lanci</b>", style_card_text),
            Paragraph("<b>25 € / mese</b>", style_card_text),
            Paragraph("Supporto tecnico diretto per risolvere qualsiasi imprevisto, assistere le corsiste nei login e supportare i lanci promozionali.", style_card_text)
        ],
        [
            Paragraph("<b>TOTALE CANONE TUTTO COMPRESO</b>", style_meta_label),
            Paragraph("<font color='#4A0E2E'><b>100 € / mese</b></font>", style_meta_label),
            Paragraph("<b>Nessuna spesa extra o fattura tecnica aggiuntiva a carico di Chiara</b>", style_meta_label)
        ]
    ]

    breakdown_table = Table(breakdown_data, colWidths=[5 * cm, 3 * cm, 9 * cm])
    breakdown_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), COLOR_LIGHT_BG),
        ('BACKGROUND', (0, -1), (-1, -1), COLOR_LIGHT_BG),
        ('BOX', (0, 0), (-1, -1), 1, COLOR_BORDER),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, COLOR_BORDER),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(breakdown_table)

    story.append(Spacer(1, 0.4 * cm))

    # Box Piani Economici Semestrale / Annuale
    maint_data = [
        [
            Paragraph("<b>Formula Semestrale (Ogni 6 Mesi)</b><br/><font color='#4A0E2E' size='13'><b>590 € / 6 mesi</b></font><br/><font color='#4B5563' size='8'>Pari a <b>~98 € / mese</b>. Include gestione completa server, streaming video, sicurezza e supporto tecnico prioritario.</font>", style_card_text),
            Paragraph("<b>Formula Annuale (Ogni 12 Mesi)</b><br/><font color='#4A0E2E' size='13'><b>1.190 € / anno</b></font><br/><font color='#059669' size='8'><b>Blocco del Canone & Priorità Assoluta</b> (Pari a <b>~99 € / mese</b> con fatturazione annuale unica senza pensieri).</font>", style_card_text),
        ]
    ]

    maint_table = Table(maint_data, colWidths=[8.5 * cm, 8.5 * cm])
    maint_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), COLOR_LIGHT_BG),
        ('BOX', (0, 0), (-1, -1), 1.2, COLOR_PRIMARY),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, COLOR_BORDER),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
    ]))
    story.append(maint_table)

    story.append(Spacer(1, 0.4 * cm))

    # Firma finale di consegna
    sign_data = [
        [
            Paragraph("<b>Stato Lavori:</b><br/>Rilascio Ufficiale V1.0 • Assistenza & Monitoraggio", style_card_text),
            Paragraph("<b>Data di Rilascio:</b><br/>29 Agosto 2026", style_card_text),
            Paragraph("<b>Sviluppo & Architettura:</b><br/>Nicola Maraschi", style_card_text),
        ]
    ]
    sign_table = Table(sign_data, colWidths=[5.5 * cm, 5.5 * cm, 6 * cm])
    sign_table.setStyle(TableStyle([
        ('LINEABOVE', (0, 0), (-1, -1), 1, COLOR_PRIMARY),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(sign_table)

    # Costruzione del PDF
    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"PDF generato con successo: {filename}")

if __name__ == "__main__":
    out_pdf = "Relazione_Opere_Chiara_Morocutti_Academy.pdf"
    if len(sys.argv) > 1:
        out_pdf = sys.argv[1]
    build_pdf(out_pdf)
