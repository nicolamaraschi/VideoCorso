import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Sparkles, 
  ArrowRight, 
  ShieldCheck, 
  Check, 
  Award,
  Clock,
  AlertTriangle,
  TrendingUp,
  XCircle,
  CheckCircle2
} from 'lucide-react';
import { GoogleReviewsCarousel } from '../components/common/GoogleReviewsCarousel';
import { MarqueeBanner } from "../components/common/MarqueeBanner";


export const LandingPage: React.FC = () => {
  const location = useLocation();

  useEffect(() => {
    if (location.hash) {
      const id = location.hash.replace('#', '');
      const element = document.getElementById(id);
      if (element) {
        setTimeout(() => {
          const yOffset = -70;
          const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
          window.scrollTo({ top: y, behavior: 'smooth' });
        }, 100);
      }
    }
  }, [location]);
  return (
    <div className="bg-gradient-to-b from-primary-50/60 via-white to-primary-50/40 min-h-screen text-gray-800">
      
      {/* 1. HERO SECTION */}
      <section id="hero" className="relative pt-12 pb-14 sm:pt-16 sm:pb-20 lg:pt-28 lg:pb-24 overflow-hidden">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-16">
            <div className="lg:w-7/12 text-center lg:text-left flex flex-col items-center lg:items-start">
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary-100/70 border border-primary-200 text-primary-900 text-xs sm:text-sm font-semibold mb-6 tracking-wide uppercase"
              >
                <Sparkles className="w-4 h-4 text-primary-600" />
                <span>Chiara Morocutti Academy</span>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.1 }}
                className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-serif font-bold text-gray-900 leading-[1.15] tracking-tight max-w-2xl"
              >
                Diventa la dermopigmentista che <span className="text-primary-700 italic font-normal">tutti si contendono.</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.2 }}
                className="mt-6 text-base sm:text-lg lg:text-xl text-gray-600 leading-relaxed max-w-2xl font-light"
              >
                Il percorso che unisce <strong className="text-gray-900 font-semibold">tecnica del microblading</strong> e <strong className="text-gray-900 font-semibold">mentalità imprenditoriale</strong> per costruire un'agenda piena, con margini alti e meno ore in cabina.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.3 }}
                className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto justify-center lg:justify-start"
              >
                <a 
                  href="#corso" 
                  className="w-full sm:w-auto px-8 py-4 bg-primary-950 text-white text-center rounded-full font-medium hover:bg-primary-900 transition-all shadow-md hover:shadow-xl active:scale-[0.99] flex items-center justify-center gap-2 group"
                >
                  <span>Scegli il tuo percorso</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </a>
                <a 
                  href="#vantaggi" 
                  className="w-full sm:w-auto px-8 py-4 bg-white text-primary-900 text-center border border-primary-200 rounded-full font-medium hover:bg-primary-50/60 transition shadow-sm"
                >
                  Scopri i 2 Pilastri
                </a>
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.3 }}
              className="lg:w-5/12 w-full max-w-md lg:max-w-none mx-auto"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-primary-200/60 rounded-3xl transform -rotate-3 blur-sm"></div>
                <div className="relative overflow-hidden rounded-3xl shadow-2xl border-4 border-white aspect-[4/5] bg-primary-950 group">
                  <video
                    className="w-full h-full object-cover"
                    src="/welcome-opt.mp4"
                    controls
                    playsInline
                    preload="none"
                    poster="/poster-welcome.webp"
                  >
                    Il tuo browser non supporta il tag video.
                  </video>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <MarqueeBanner />

      {/* 2. IL PUNTO DI PARTENZA (EDITORIAL LUXURY BENTO GRID) */}
      <section className="py-24 bg-gradient-to-b from-white via-primary-50/30 to-white border-y border-primary-100/60 relative overflow-hidden">
        {/* Subtle background ambient glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-primary-100/40 rounded-full blur-3xl pointer-events-none -z-10"></div>

        <div className="container mx-auto px-4 sm:px-6 max-w-6xl relative z-10">
          {/* Section Header */}
          <div className="text-center max-w-3xl mx-auto mb-16">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-primary-700 bg-primary-100/80 px-4 py-1.5 rounded-full border border-primary-200/80 mb-5 shadow-xs"
            >
              <Sparkles className="w-3.5 h-3.5 text-primary-600" />
              Il Punto di Partenza
            </motion.div>
            <motion.h2 
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-3xl sm:text-4xl lg:text-5xl font-serif font-bold text-gray-900 leading-tight"
            >
              Sei brava con le mani.<br className="hidden sm:inline" />
              <span className="italic font-normal text-primary-800"> Ma questo basta a riempire l'agenda?</span>
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="mt-5 text-gray-600 text-base sm:text-lg leading-relaxed"
            >
              La maggior parte delle operatrici pensa che per guadagnare di più serva lavorare più ore. La realtà è che senza un servizio ad altissima marginalità e un protocollo geometrico sicuro, resti prigioniera della cabina.
            </motion.p>
          </div>

          {/* Bento Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Card 1: Tempo vs Margine */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
              whileHover={{ y: -5 }}
              className="lg:col-span-6 bg-gradient-to-br from-white via-white to-primary-50/40 p-7 sm:p-9 rounded-3xl border border-primary-100/90 shadow-soft hover:shadow-elegant transition-all flex flex-col justify-between relative overflow-hidden group"
            >
              <div className="absolute top-2 right-4 text-7xl sm:text-8xl font-serif font-bold text-primary-900/[0.04] select-none pointer-events-none group-hover:text-primary-900/[0.08] transition-colors">
                01
              </div>

              <div>
                <div className="flex items-center justify-between gap-3 mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200/60 flex items-center justify-center text-rose-700 shadow-xs">
                    <Clock className="w-6 h-6 text-rose-600" />
                  </div>
                  <span className="text-[11px] font-bold tracking-wider uppercase px-3 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200/70">
                    La Trappola del Tempo
                  </span>
                </div>

                <h3 className="text-xl sm:text-2xl font-serif font-bold text-gray-900 mb-3">
                  8 ore in cabina per coprire solo le spese fisse
                </h3>
                <p className="text-gray-600 text-sm sm:text-base leading-relaxed mb-6">
                  Passi la giornata a incastrare appuntamenti da 20€–45€: cerette, manicure, trattamenti base. A fine mese l'agenda sembra satura e le braccia bruciano, ma il margine netto dopo affitto, collaboratrici e consumabili è deludente.
                </p>
              </div>

              {/* Visual Contrast Pill */}
              <div className="pt-4 border-t border-primary-100/80 bg-primary-50/40 -mx-7 sm:-mx-9 -mb-7 sm:-mb-9 p-5 sm:px-8 rounded-b-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-[11px] text-gray-500 uppercase tracking-wider block font-semibold">Trattamento Base Medio</span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xl font-bold text-gray-900">~25€ - 40€</span>
                    <span className="text-xs text-gray-500">/ 60-90 minuti</span>
                  </div>
                </div>
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700 bg-white/90 px-3 py-1.5 rounded-xl border border-rose-200/60 shadow-xs self-start sm:self-center">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                  Marginalità oraria ridotta
                </div>
              </div>
            </motion.div>

            {/* Card 2: Paura Tecnica */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.1 }}
              whileHover={{ y: -5 }}
              className="lg:col-span-6 bg-gradient-to-br from-white via-white to-amber-50/30 p-7 sm:p-9 rounded-3xl border border-amber-100/80 shadow-soft hover:shadow-elegant transition-all flex flex-col justify-between relative overflow-hidden group"
            >
              <div className="absolute top-2 right-4 text-7xl sm:text-8xl font-serif font-bold text-amber-900/[0.04] select-none pointer-events-none group-hover:text-amber-900/[0.08] transition-colors">
                02
              </div>

              <div>
                <div className="flex items-center justify-between gap-3 mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200/60 flex items-center justify-center text-amber-800 shadow-xs">
                    <AlertTriangle className="w-6 h-6 text-amber-600" />
                  </div>
                  <span className="text-[11px] font-bold tracking-wider uppercase px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200/70">
                    Il Blocco della Paura
                  </span>
                </div>

                <h3 className="text-xl sm:text-2xl font-serif font-bold text-gray-900 mb-3">
                  La paura di rovinare per sempre il viso di una cliente
                </h3>
                <p className="text-gray-600 text-sm sm:text-base leading-relaxed mb-6">
                  Vedi il Microblading esplodere ovunque, ma i corsi del weekend da 2 giorni ti hanno lasciata sola: paura della profondità errata, viraggi al grigio o al rosso, asimmetrie indelebili. Senza un metodo rigoroso, preferisci non rischiare.
                </p>
              </div>

              {/* Visual Reality Stat */}
              <div className="pt-4 border-t border-amber-100/80 bg-amber-50/40 -mx-7 sm:-mx-9 -mb-7 sm:-mb-9 p-5 sm:px-8 rounded-b-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-[11px] text-gray-500 uppercase tracking-wider block font-semibold">Abbandono Post-Corsi Brevi</span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xl font-bold text-gray-900">&gt; 80%</span>
                    <span className="text-xs text-gray-500">non inizia a lavorare</span>
                  </div>
                </div>
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800 bg-white/90 px-3 py-1.5 rounded-xl border border-amber-200/60 shadow-xs self-start sm:self-center">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                  Mancanza di protocollo scientifico
                </div>
              </div>
            </motion.div>

            {/* Card 3: FULL WIDTH 12 cols - Hero Luxury Bento Masterpiece */}
            <motion.div
              initial={{ opacity: 0, y: 25 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
              whileHover={{ y: -3 }}
              className="lg:col-span-12 rounded-3xl p-7 sm:p-10 lg:p-12 relative overflow-hidden bg-gradient-to-br from-[#1c0c11] via-[#280f17] to-[#120508] text-white shadow-2xl border border-[#E5C378]/35"
            >
              {/* Ambient Background Glows */}
              <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#E5C378]/10 rounded-full blur-3xl pointer-events-none"></div>
              <div className="absolute bottom-0 left-10 w-80 h-80 bg-primary-600/20 rounded-full blur-3xl pointer-events-none"></div>

              <div className="relative z-10">
                {/* Top Badge & Positioning */}
                <div className="flex flex-wrap items-center justify-between gap-4 mb-7">
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#E5C378]/15 border border-[#E5C378]/40 text-[#F3DE9C] text-xs font-bold tracking-wider uppercase shadow-inner">
                    <Sparkles className="w-3.5 h-3.5 text-[#E5C378]" />
                    Il Cambio di Paradigma
                  </div>
                  <span className="text-xs text-primary-200/80 font-medium tracking-wide">
                    Da esecutrice oraria a Specialista PMU Autorevole
                  </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
                  {/* Left Column: The Core Philosophy */}
                  <div className="lg:col-span-6 space-y-5">
                    <h3 className="text-2xl sm:text-3xl lg:text-4xl font-serif font-bold text-white leading-tight">
                      Non è mai stato un problema di talento.<br />
                      <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#F7E7B4] via-[#E5C378] to-[#d4af37] italic font-serif">
                        È un problema di metodo
                      </span>{' '}
                      — tecnico ed economico.
                    </h3>
                    <p className="text-primary-100/90 text-sm sm:text-base leading-relaxed">
                      Il Microblading è il trattamento viso a più alta marginalità nell'estetica avanzata. Quando possiedi un protocollo geometrico millimetrico, non ti trema la mano: le clienti riconoscono l'autorevolezza e non contrattano sul prezzo.
                    </p>
                    <div className="pt-2 flex items-center gap-3 text-xs sm:text-sm text-[#F3DE9C] font-medium">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#E5C378] shadow-[0_0_8px_#E5C378]"></span>
                      Protocollo geometrico codificato replicabile su ogni forma di viso
                    </div>
                  </div>

                  {/* Right Column: Comparative Transformation Matrix (PRIMA vs DOPO) */}
                  <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Box Prima */}
                    <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-5 backdrop-blur-sm flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-3.5 pb-2.5 border-b border-white/10">
                          <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                          <span className="text-xs font-bold uppercase tracking-wider text-rose-300">Modello Tradizionale</span>
                        </div>
                        <ul className="space-y-2.5 text-xs text-gray-300">
                          <li className="flex items-start gap-2">
                            <span className="text-rose-400 font-bold">•</span>
                            <span>8 ore al giorno continue in cabina</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-rose-400 font-bold">•</span>
                            <span>Prezzi bassi per paura della concorrenza</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-rose-400 font-bold">•</span>
                            <span>Ansia continua su simmetrie e viraggi</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-rose-400 font-bold">•</span>
                            <span>Margine eroso da costi vivi e tempo</span>
                          </li>
                        </ul>
                      </div>
                      <div className="mt-4 pt-3 border-t border-white/10 text-[11px] text-gray-400">
                        Fatturato vincolato alle sole ore lavorate
                      </div>
                    </div>

                    {/* Box Dopo: Metodo Morocutti */}
                    <div className="bg-gradient-to-b from-[#E5C378]/20 to-white/[0.06] border border-[#E5C378]/50 rounded-2xl p-5 backdrop-blur-sm relative overflow-hidden shadow-xl flex flex-col justify-between">
                      <div className="absolute top-2.5 right-2.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#E5C378] text-[#1a0c10] shadow-sm">
                          TOP MARGINE
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-3.5 pb-2.5 border-b border-[#E5C378]/30">
                          <CheckCircle2 className="w-4 h-4 text-[#E5C378] shrink-0" />
                          <span className="text-xs font-bold uppercase tracking-wider text-[#F3DE9C]">Con Metodo Morocutti</span>
                        </div>
                        <ul className="space-y-2.5 text-xs text-primary-50">
                          <li className="flex items-start gap-2">
                            <span className="text-[#E5C378] font-bold">✓</span>
                            <span><strong>1 seduta (2h) = 350€ – 500€</strong></span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-[#E5C378] font-bold">✓</span>
                            <span>Marginalità netta reale <strong>&gt; 85%</strong></span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-[#E5C378] font-bold">✓</span>
                            <span>Sicurezza assoluta: zero ansia sul risultato</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-[#E5C378] font-bold">✓</span>
                            <span>Posizionamento da specialista autorevole</span>
                          </li>
                        </ul>
                      </div>
                      <div className="mt-4 pt-3 border-t border-[#E5C378]/30 text-[11px] text-[#F3DE9C] font-semibold flex items-center justify-between">
                        <span>1 cliente PMU = 2 giorni di cabina</span>
                        <TrendingUp className="w-3.5 h-3.5 text-[#E5C378]" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* 3. QUELLO CHE TI COSTA RESTARE COSÌ (COSTO DELL'INAZIONE) */}
      <section className="py-20 bg-gray-900 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-tr from-primary-950 via-gray-900 to-primary-950 opacity-90"></div>
        <div className="container mx-auto px-6 relative z-10 max-w-5xl">
          <div className="text-center mb-16">
            <span className="text-xs font-bold tracking-widest uppercase text-primary-300 bg-white/10 px-3.5 py-1.5 rounded-full border border-white/10">
              Quello che ti costa restare così
            </span>
            <h2 className="text-3xl md:text-4xl font-serif font-bold mt-4 leading-snug">
              Ogni mese senza una specializzazione ad alto margine<br className="hidden md:inline" /> è fatturato che non torna indietro.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white/5 border border-white/10 p-8 rounded-2xl backdrop-blur-sm">
              <span className="text-3xl font-serif font-bold text-primary-300">01</span>
              <h3 className="text-xl font-bold text-white mt-3 mb-3">Tempo</h3>
              <p className="text-gray-300 text-sm leading-relaxed">
                Ore in cabina su trattamenti a bassa marginalità, invece di un servizio che vale molto di più a parità di tempo investito.
              </p>
            </div>

            <div className="bg-white/5 border border-white/10 p-8 rounded-2xl backdrop-blur-sm">
              <span className="text-3xl font-serif font-bold text-primary-300">02</span>
              <h3 className="text-xl font-bold text-white mt-3 mb-3">Guadagno limitato</h3>
              <p className="text-gray-300 text-sm leading-relaxed">
                Il tuo fatturato mensile resta bloccato e legato unicamente al numero di ore che riesci fisicamente a lavorare ogni giorno.
              </p>
            </div>

            <div className="bg-white/5 border border-white/10 p-8 rounded-2xl backdrop-blur-sm">
              <span className="text-3xl font-serif font-bold text-primary-300">03</span>
              <h3 className="text-xl font-bold text-white mt-3 mb-3">Occasione persa</h3>
              <p className="text-gray-300 text-sm leading-relaxed">
                Il microblading è tra i servizi più richiesti e pagati del settore beauty, con una domanda in costante crescita ogni anno.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. LA TRASFORMAZIONE (PRIMA VS DOPO) */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-6 max-w-5xl">
          <div className="text-center mb-16">
            <span className="text-xs font-bold tracking-widest uppercase text-primary-600 bg-primary-50 px-3.5 py-1.5 rounded-full border border-primary-100">
              La Trasformazione
            </span>
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-gray-900 mt-4">
              Immagina di aprire l'agenda e vederla già piena<br className="hidden sm:inline" /> — di clienti PMU.
            </h2>
          </div>

          <div className="space-y-5">
            {[
              {
                before: "Fai solo trattamenti tradizionali, a basso margine.",
                after: "Offri il servizio più pagato del beauty, con margini alti e valore percepito."
              },
              {
                before: "Ogni mese ricominci da zero con l'acquisizione clienti.",
                after: "Hai un metodo collaudato per comunicare e vendere la consulenza."
              },
              {
                before: "Conosci la tecnica ma non come proporla e venderla.",
                after: "Padroneggi tecnica, consulenza e gestione del cliente dalla A alla Z."
              }
            ].map((row, i) => (
              <div key={i} className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                <div className="bg-red-50/60 border border-red-100 p-6 rounded-2xl flex items-start gap-4">
                  <span className="px-2.5 py-1 rounded-md bg-red-100 text-red-700 text-xs font-bold uppercase tracking-wider shrink-0">
                    Prima
                  </span>
                  <p className="text-gray-700 text-sm sm:text-base leading-relaxed">{row.before}</p>
                </div>
                <div className="bg-emerald-50/70 border border-emerald-100 p-6 rounded-2xl flex items-start gap-4 shadow-sm">
                  <span className="px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-800 text-xs font-bold uppercase tracking-wider shrink-0">
                    Dopo
                  </span>
                  <p className="text-gray-900 text-sm sm:text-base font-medium leading-relaxed">{row.after}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. I DUE PILASTRI (TECNICA + BUSINESS) / VANTAGGI */}
      <section id="vantaggi" className="py-24 bg-gradient-to-b from-primary-50/40 via-white to-primary-50/50 border-t border-primary-100 relative">
        <span id="pilastri" className="absolute -top-20" aria-hidden="true" />
        <div className="container mx-auto px-6 max-w-6xl">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-bold tracking-widest uppercase text-primary-600 bg-primary-50 px-3.5 py-1.5 rounded-full border border-primary-100">
              Come Ci Arriviamo
            </span>
            <h2 className="text-3xl md:text-5xl font-serif font-bold text-gray-900 mt-4">
              Due pilastri, un solo risultato.
            </h2>
            <p className="mt-4 text-lg text-gray-600 font-light leading-relaxed">
              Non impari solo una tecnica. Impari a trasformarla in un <strong className="text-gray-900 font-semibold">business ad alta marginalità</strong>, con meno ore in cabina e clienti più profilati.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
            {/* Pilastro 1 - TECNICA */}
            <div className="bg-white p-8 sm:p-10 rounded-3xl border border-primary-100 shadow-md flex flex-col justify-between">
              <div>
                <div className="inline-block px-4 py-1.5 rounded-full bg-primary-950 text-white text-xs font-bold tracking-wider uppercase mb-4">
                  Pilastro 1 — Tecnica
                </div>
                <h3 className="text-2xl font-serif font-bold text-gray-900 mb-2">
                  Dalla teoria alla pratica su modella, passo dopo passo
                </h3>
                <p className="text-gray-500 text-sm mb-8">
                  Tutto quello che serve per eseguire un trattamento perfetto in totale sicurezza.
                </p>

                <div className="space-y-6">
                  <div className="flex gap-4">
                    <span className="w-8 h-8 rounded-full bg-primary-100 text-primary-800 flex items-center justify-center font-bold text-sm font-serif shrink-0">01</span>
                    <div>
                      <h4 className="font-semibold text-gray-900">Teoria e igiene</h4>
                      <p className="text-sm text-gray-600 mt-0.5">Norme igienico-sanitarie, controindicazioni, pigmenti, guarigione e cura post trattamento.</p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <span className="w-8 h-8 rounded-full bg-primary-100 text-primary-800 flex items-center justify-center font-bold text-sm font-serif shrink-0">02</span>
                    <div>
                      <h4 className="font-semibold text-gray-900">Forma e anatomia</h4>
                      <p className="text-sm text-gray-600 mt-0.5">Rapporto aureo, morfologia del viso, gestione delle asimmetrie e progettazione su carta.</p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <span className="w-8 h-8 rounded-full bg-primary-100 text-primary-800 flex items-center justify-center font-bold text-sm font-serif shrink-0">03</span>
                    <div>
                      <h4 className="font-semibold text-gray-900">Schemi e spine</h4>
                      <p className="text-sm text-gray-600 mt-0.5">Come seguire il pelo naturale, transizioni perfette, peli superiori e inferiori.</p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <span className="w-8 h-8 rounded-full bg-primary-100 text-primary-800 flex items-center justify-center font-bold text-sm font-serif shrink-0">04</span>
                    <div>
                      <h4 className="font-semibold text-gray-900">Lavoro su modella</h4>
                      <p className="text-sm text-gray-600 mt-0.5">Pratica supervisionata dal primo passaggio al lavoro completo e simmetrico su sopracciglio reale.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Pilastro 2 - BUSINESS */}
            <div className="bg-primary-950 text-white p-8 sm:p-10 rounded-3xl shadow-xl flex flex-col justify-between relative overflow-hidden">
              <div className="relative z-10">
                <div className="inline-block px-4 py-1.5 rounded-full bg-primary-800 text-primary-200 text-xs font-bold tracking-wider uppercase mb-4">
                  Pilastro 2 — Business
                </div>
                <h3 className="text-2xl font-serif font-bold text-white mb-2">
                  Sai fare il trattamento. Ora impari a venderlo e a costruirci un business
                </h3>
                <p className="text-primary-200/80 text-sm mb-8">
                  Dalla prima richiesta su Instagram all'incasso e alla fidelizzazione annuale.
                </p>

                <div className="space-y-6">
                  <div className="flex gap-4">
                    <span className="w-8 h-8 rounded-full bg-primary-800 text-primary-200 flex items-center justify-center font-bold text-sm font-serif shrink-0">01</span>
                    <div>
                      <h4 className="font-semibold text-white">Consulenza di vendita</h4>
                      <p className="text-sm text-primary-200/80 mt-0.5">Smetti di fare consulenza solo informativa: impari a gestire le obiezioni e chiudere la vendita.</p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <span className="w-8 h-8 rounded-full bg-primary-800 text-primary-200 flex items-center justify-center font-bold text-sm font-serif shrink-0">02</span>
                    <div>
                      <h4 className="font-semibold text-white">Prezzo e posizionamento</h4>
                      <p className="text-sm text-primary-200/80 mt-0.5">Come impostare il giusto listino prezzi per partire subito con margine e posizionarti sul mercato.</p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <span className="w-8 h-8 rounded-full bg-primary-800 text-primary-200 flex items-center justify-center font-bold text-sm font-serif shrink-0">03</span>
                    <div>
                      <h4 className="font-semibold text-white">Primi clienti</h4>
                      <p className="text-sm text-primary-200/80 mt-0.5">Come impostare i social, creare contenuti che attraggono e trovare le prime clienti paganti.</p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <span className="w-8 h-8 rounded-full bg-primary-800 text-primary-200 flex items-center justify-center font-bold text-sm font-serif shrink-0">04</span>
                    <div>
                      <h4 className="font-semibold text-white">Gestione del cliente</h4>
                      <p className="text-sm text-primary-200/80 mt-0.5">Dalla richiesta iniziale al ritocco annuale, con un metodo replicabile che crea clienti a vita.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. VIDEO IN AZIONE SECTION - Temporaneamente rimossa su richiesta (in attesa delle prime recensioni delle studentesse) */}
      {/* 
      <section id="anteprima" className="py-20 bg-white">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-bold tracking-widest uppercase text-primary-600 bg-primary-50 px-3.5 py-1.5 rounded-full border border-primary-100">
              Pratica e Precisione
            </span>
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-gray-900 mt-4">Il Microblading in Azione</h2>
            <p className="mt-4 text-lg text-gray-600">Guarda la precisione e l'effetto UltraRealistic Brows prendere vita nelle lezioni.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 justify-center max-w-5xl mx-auto">
            {[
              { src: '/video-1-opt.mp4', poster: '/poster-video-1.webp' },
              { src: '/video-2-opt.mp4', poster: '/poster-video-2.webp' },
              { src: '/video-3-opt.mp4', poster: '/poster-video-3.webp' },
              { src: '/video-4-opt.mp4', poster: '/poster-video-4.webp' },
            ].map((item, i) => (
              <div key={i} className="w-full rounded-2xl overflow-hidden shadow-md border-4 border-white bg-primary-950 aspect-video relative group">
                <video 
                  className="w-full h-full object-cover" 
                  controls 
                  playsInline
                  preload="none"
                  poster={item.poster}
                  src={item.src}
                >
                  Il tuo browser non supporta i video.
                </video>
              </div>
            ))}
          </div>
        </div>
      </section>
      */}

      {/* 7. AUTHORITY QUOTE SECTION */}
      <section className="py-20 bg-primary-950 text-white relative">
        <div className="container mx-auto px-6 max-w-4xl text-center">
          <div className="inline-block p-3 rounded-full bg-primary-900 text-primary-300 mb-6">
            <Award className="w-8 h-8" />
          </div>
          <blockquote className="text-2xl sm:text-3xl md:text-4xl font-serif italic leading-snug text-primary-100">
            “Ho costruito un business da <span className="text-amber-300 not-italic font-bold">15.000€ al mese</span> con il microblading. Ora insegno a farlo anche a te.”
          </blockquote>
          <div className="mt-8 flex flex-col items-center">
            <span className="text-lg font-bold tracking-wider uppercase text-white font-serif">Chiara Morocutti</span>
            <span className="text-sm text-primary-300 font-light mt-1">Master Dermopigmentista & Fondatrice Academy</span>
          </div>

          <div className="mt-12 grid grid-cols-2 gap-6 max-w-md mx-auto">
            <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
              <span className="block text-3xl font-serif font-bold text-amber-300">700+</span>
              <span className="text-xs text-primary-200 uppercase tracking-wider">Donne Trattate a Milano</span>
            </div>
            <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
              <span className="block text-3xl font-serif font-bold text-amber-300">400+</span>
              <span className="text-xs text-primary-200 uppercase tracking-wider">Clienti Soddisfatte</span>
            </div>
          </div>
        </div>
      </section>

      {/* 8. CATALOGO CORSI & I 3 PACCHETTI / IL CORSO */}
      <section id="corso" className="py-24 bg-primary-50/50 relative">
        <span id="catalogo" className="absolute -top-20" aria-hidden="true" />
        <div className="container mx-auto px-6 max-w-6xl">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-bold tracking-widest uppercase text-primary-600 bg-primary-50 px-3.5 py-1.5 rounded-full border border-primary-100">
              Modalità di Accesso al Percorso
            </span>
            <h2 className="text-3xl md:text-5xl font-serif font-bold text-gray-900 mt-4">
              Tre modi per arrivare allo stesso risultato.
            </h2>
            <p className="mt-4 text-base sm:text-lg text-gray-600 leading-relaxed font-light">
              La differenza non è “se funziona” — funziona in tutti e tre.<br className="hidden sm:inline" />
              La differenza è quanto sei accompagnata, e quanta pratica in presenza hai.
            </p>
          </div>

          {/* PRICING CARDS */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch mb-16">
            
            {/* 1. BASE */}
            <div className="bg-white rounded-3xl p-8 border border-gray-200 shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold tracking-widest uppercase text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                  Base
                </span>
                <h3 className="text-2xl font-serif font-bold text-gray-900 mt-4">Percorso Base</h3>
                <p className="text-gray-600 text-sm mt-2 font-light">
                  Per chi vuole formarsi in totale autonomia, ai propri ritmi.
                </p>
                <div className="my-6 bg-primary-50/60 p-3.5 rounded-xl border border-primary-100 text-xs text-primary-900 italic">
                  “Testa il metodo. Ideale per iniziare a studiare subito, senza vincoli di calendario.”
                </div>

                <div className="mb-6">
                  <span className="text-xl sm:text-2xl font-serif font-bold text-gray-900">Accesso su Candidatura</span>
                  <span className="text-xs text-gray-500 block mt-1">Dettagli e disponibilità in call conoscitiva</span>
                </div>

                <ul className="space-y-3 text-sm text-gray-700 mb-8">
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Accesso completo a tutti i <strong>10 moduli video</strong> on demand</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Teoria, forma e anatomia, schemi e lavoro su modella</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Normative, consulenza e acquisizione clienti</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Materiali scaricabili (schemi, checklist, consenso informato)</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Accesso illimitato e <strong>a vita</strong> ai contenuti</span>
                  </li>
                </ul>
              </div>

              <a
                href="https://wa.me/393282247737?text=Ciao%20Chiara,%20vorrei%20informazioni%20e%20prenotare%20una%20call%20per%20il%20Percorso%20Base"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3.5 px-6 rounded-xl border border-gray-300 text-gray-900 font-semibold text-center hover:bg-gray-50 transition block"
              >
                Candidati per il Percorso Base
              </a>
            </div>

            {/* 2. PLUS */}
            <div className="bg-white rounded-3xl p-8 border-2 border-primary-300 shadow-md flex flex-col justify-between relative">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-primary-600 text-white text-xs font-bold px-4 py-1 rounded-full uppercase tracking-wider shadow whitespace-nowrap">
                Più Richiesto
              </div>
              <div>
                <span className="text-xs font-bold tracking-widest uppercase text-primary-700 bg-primary-50 px-3 py-1 rounded-full">
                  Plus
                </span>
                <h3 className="text-2xl font-serif font-bold text-gray-900 mt-4">Percorso Plus</h3>
                <p className="text-gray-600 text-sm mt-2 font-light">
                  Per chi vuole formarsi con un accompagnamento costante ogni settimana.
                </p>
                <div className="my-6 bg-primary-50/60 p-3.5 rounded-xl border border-primary-100 text-xs text-primary-900 italic">
                  “Non sei mai sola davanti a un dubbio. Il passo in più per chi vuole sentirsi seguita ogni settimana.”
                </div>

                <div className="mb-6">
                  <span className="text-xl sm:text-2xl font-serif font-bold text-primary-950">Accesso con Affiancamento</span>
                  <span className="text-xs text-gray-500 block mt-1">Posti limitati mensili — dettagli in call</span>
                </div>

                <ul className="space-y-3 text-sm text-gray-700 mb-8">
                  <li className="flex items-start gap-2.5 font-medium text-gray-900">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Tutto il contenuto della versione Base</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span><strong>Sessione live di gruppo</strong> ogni settimana</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Q&A, revisione esercizi e <strong>correzione della forma</strong></span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Feedback personalizzato sui lavori pratici caricati</span>
                  </li>
                </ul>
              </div>

              <a
                href="https://wa.me/393282247737?text=Ciao%20Chiara,%20vorrei%20candidarmi%20e%20prenotare%20una%20call%20per%20il%20Percorso%20Plus"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3.5 px-6 rounded-xl bg-primary-700 text-white font-semibold text-center hover:bg-primary-800 transition shadow-md block"
              >
                Candidati per il Percorso Plus
              </a>
            </div>

            {/* 3. FULL */}
            <div className="bg-primary-950 text-white rounded-3xl p-8 shadow-2xl flex flex-col justify-between relative border-2 border-amber-400/50">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-400 text-gray-950 text-[10.5px] sm:text-xs font-extrabold px-3.5 sm:px-4 py-1 rounded-full uppercase tracking-wider shadow-md whitespace-nowrap border border-amber-200/60">
                Esperienza Completa in Studio
              </div>

              <div>
                <span className="text-xs font-bold tracking-widest uppercase text-amber-300 bg-white/10 px-3 py-1 rounded-full border border-white/10">
                  Full
                </span>
                <h3 className="text-2xl font-serif font-bold text-white mt-4">Percorso Full</h3>
                <p className="text-primary-200/80 text-sm mt-2 font-light">
                  Il percorso completo, con pratica reale in studio e certificazione.
                </p>
                <div className="my-6 bg-white/10 p-3.5 rounded-xl border border-white/10 text-xs text-amber-200 italic">
                  “Il massimo livello di accompagnamento. L'unico percorso con pratica reale in studio e garanzia inclusa.”
                </div>

                <div className="mb-6">
                  <span className="text-xl sm:text-2xl font-serif font-bold text-amber-300">Masterclass con Pratica Live</span>
                  <span className="text-xs text-primary-200 block mt-1">Disponibilità esclusiva — selezione e posti in call</span>
                </div>

                <ul className="space-y-3 text-sm text-primary-100 mb-8">
                  <li className="flex items-start gap-2.5 font-medium text-white">
                    <Check className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span>Tutto il contenuto della versione Plus</span>
                  </li>
                  <li className="flex items-start gap-2.5 text-amber-200 font-medium">
                    <Check className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span><strong>3 giornate in studio con Chiara</strong> dedicate alla pratica</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span><strong>Chat di supporto diretta 1:1</strong> con Chiara per 6 mesi</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span>Call strategica dedicata con <strong>Sabrina Perrotta</strong>, esperta di marketing nel settore dermopigmentazione</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span><strong>Kit prodotti professionale incluso</strong> + Attestato finale</span>
                  </li>
                  <li className="flex items-start gap-2.5 text-xs text-amber-300 font-semibold bg-white/10 p-2.5 rounded-lg border border-white/10">
                    <ShieldCheck className="w-4 h-4 text-amber-300 shrink-0" />
                    <span>Garanzia: giornata pratica extra se non ti senti pronta</span>
                  </li>
                </ul>
              </div>

              <a
                href="https://wa.me/393282247737?text=Ciao%20Chiara,%20vorrei%20prenotare%20la%20call%20strategica%20per%20il%20Percorso%20Full%20in%20studio"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-gray-950 font-bold text-center hover:from-amber-300 hover:to-amber-400 transition shadow-lg block"
              >
                Prenota la tua Call Strategica
              </a>
            </div>

          </div>

          {/* 9. TABELLA DI CONFRONTO COMPLETA */}
          <div className="bg-white rounded-3xl p-6 sm:p-10 border border-primary-100 shadow-md">
            <div className="text-center mb-8">
              <h3 className="text-2xl font-serif font-bold text-gray-900">Confronto tra le opzioni</h3>
              <p className="text-gray-500 text-sm mt-1">Trova la formula ideale per le tue esigenze</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="py-4 px-4 font-semibold text-gray-900">Caratteristica</th>
                    <th className="py-4 px-4 font-bold text-center text-gray-700 bg-gray-50/50 rounded-t-xl">BASE</th>
                    <th className="py-4 px-4 font-bold text-center text-primary-900 bg-primary-50/60 rounded-t-xl">PLUS</th>
                    <th className="py-4 px-4 font-bold text-center text-amber-950 bg-amber-50 rounded-t-xl">FULL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="py-3.5 px-4 text-gray-800">Moduli video on demand (10 moduli)</td>
                    <td className="py-3.5 px-4 text-center font-semibold text-emerald-600 bg-gray-50/30">Sì</td>
                    <td className="py-3.5 px-4 text-center font-semibold text-emerald-600 bg-primary-50/30">Sì</td>
                    <td className="py-3.5 px-4 text-center font-semibold text-emerald-600 bg-amber-50/30">Sì</td>
                  </tr>
                  <tr>
                    <td className="py-3.5 px-4 text-gray-800">Materiali scaricabili (schemi, checklist)</td>
                    <td className="py-3.5 px-4 text-center font-semibold text-emerald-600 bg-gray-50/30">Sì</td>
                    <td className="py-3.5 px-4 text-center font-semibold text-emerald-600 bg-primary-50/30">Sì</td>
                    <td className="py-3.5 px-4 text-center font-semibold text-emerald-600 bg-amber-50/30">Sì</td>
                  </tr>
                  <tr>
                    <td className="py-3.5 px-4 text-gray-800">Live di gruppo settimanale</td>
                    <td className="py-3.5 px-4 text-center text-gray-400 bg-gray-50/30">—</td>
                    <td className="py-3.5 px-4 text-center font-semibold text-emerald-600 bg-primary-50/30">Sì</td>
                    <td className="py-3.5 px-4 text-center font-semibold text-emerald-600 bg-amber-50/30">Sì</td>
                  </tr>
                  <tr>
                    <td className="py-3.5 px-4 text-gray-800">Feedback sui lavori caricati</td>
                    <td className="py-3.5 px-4 text-center text-gray-400 bg-gray-50/30">—</td>
                    <td className="py-3.5 px-4 text-center font-semibold text-emerald-600 bg-primary-50/30">Sì</td>
                    <td className="py-3.5 px-4 text-center font-semibold text-emerald-600 bg-amber-50/30">Sì</td>
                  </tr>
                  <tr>
                    <td className="py-3.5 px-4 text-gray-800">Chat di supporto 1:1 con Chiara (6 mesi)</td>
                    <td className="py-3.5 px-4 text-center text-gray-400 bg-gray-50/30">—</td>
                    <td className="py-3.5 px-4 text-center text-gray-400 bg-primary-50/30">—</td>
                    <td className="py-3.5 px-4 text-center font-semibold text-emerald-600 bg-amber-50/30">Sì</td>
                  </tr>
                  <tr>
                    <td className="py-3.5 px-4 text-gray-800">3 giornate in studio con Chiara</td>
                    <td className="py-3.5 px-4 text-center text-gray-400 bg-gray-50/30">—</td>
                    <td className="py-3.5 px-4 text-center text-gray-400 bg-primary-50/30">—</td>
                    <td className="py-3.5 px-4 text-center font-semibold text-emerald-600 bg-amber-50/30">Sì</td>
                  </tr>
                  <tr>
                    <td className="py-3.5 px-4 text-gray-800">Call strategica con Sabrina Perrotta, esperta di marketing nel settore dermopigmentazione</td>
                    <td className="py-3.5 px-4 text-center text-gray-400 bg-gray-50/30">—</td>
                    <td className="py-3.5 px-4 text-center text-gray-400 bg-primary-50/30">—</td>
                    <td className="py-3.5 px-4 text-center font-semibold text-emerald-600 bg-amber-50/30">Sì</td>
                  </tr>
                  <tr>
                    <td className="py-3.5 px-4 text-gray-800">Kit prodotti professionale incluso</td>
                    <td className="py-3.5 px-4 text-center text-gray-400 bg-gray-50/30">—</td>
                    <td className="py-3.5 px-4 text-center text-gray-400 bg-primary-50/30">—</td>
                    <td className="py-3.5 px-4 text-center font-semibold text-emerald-600 bg-amber-50/30">Sì</td>
                  </tr>
                  <tr>
                    <td className="py-3.5 px-4 text-gray-800">Garanzia giornata extra</td>
                    <td className="py-3.5 px-4 text-center text-gray-400 bg-gray-50/30">—</td>
                    <td className="py-3.5 px-4 text-center text-gray-400 bg-primary-50/30">—</td>
                    <td className="py-3.5 px-4 text-center font-semibold text-emerald-600 bg-amber-50/30">Sì</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </section>

      {/* 10. RECENSIONI GOOGLE VERIFICATE (TRUSTINDEX) */}
      <section id="testimonianze" className="py-20 bg-white border-t border-primary-50">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-50 border border-primary-100 text-primary-800 text-sm font-semibold mb-4 shadow-sm">
              <svg className="w-4 h-4 text-amber-500 fill-current" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <span>Recensioni Verificate da Google</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-gray-900">Cosa dicono del lavoro di Chiara Morocutti</h2>
            <p className="mt-4 text-lg text-gray-600 leading-relaxed font-light">
              Prima ancora di insegnare, la tua Master è una professionista affermata sul campo: queste sono le recensioni reali e verificate delle clienti del suo studio di <strong>Microblading a Milano</strong>. Chi impara questo metodo impara da chi lavora ai massimi livelli ogni giorno.
            </p>
          </div>

          {/* Native Verified Google Reviews Carousel (100% Italian, 0 external scripts, 0 ad-block issues) */}
          <div className="max-w-6xl mx-auto bg-primary-50/40 rounded-3xl p-4 sm:p-8 border border-primary-100/80 shadow-sm">
            <GoogleReviewsCarousel className="w-full" />
          </div>
        </div>
      </section>

      {/* 11. FAQ */}
      <section className="py-20 bg-gray-50 border-t border-gray-100">
        <div className="container mx-auto px-6 max-w-4xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-gray-900">Domande Frequenti</h2>
            <p className="mt-4 text-lg text-gray-600 font-light">Tutto quello che devi sapere prima di iniziare.</p>
          </div>

          <div className="space-y-4">
            {[
              {
                question: "Devo avere già esperienza come estetista per iniziare?",
                answer: "Assolutamente no. Il percorso parte dalle basi assolute, spiegando dalla struttura della pelle alle norme igieniche. È adatto sia alle principianti sia a chi ha già esperienza e vuole perfezionare la tecnica e imparare a vendere ad alto margine."
              },
              {
                question: "Qual è la differenza tra i pacchetti Base, Plus e Full?",
                answer: "Tutti i percorsi contengono l'intero programma video dei 10 moduli. La differenza sta nel livello di accompagnamento: Base è in autonomia, Plus include le live settimanali con revisione esercizi, mentre Full include 3 giornate pratiche in studio con Chiara, chat 1:1, kit prodotti e garanzia extra."
              },
              {
                question: "Il kit prodotti per la pratica è incluso?",
                answer: "Il kit prodotti professionale completo è incluso nel pacchetto Full e ti verrà consegnato a mano direttamente durante le giornate di formazione pratica in sede con Chiara. Per i pacchetti Base e Plus, all'interno del corso troverai la lista esatta dei materiali consigliati e i link per acquistarli al miglior prezzo."
              },
              {
                question: "Per quanto tempo avrò accesso ai video?",
                answer: "L'accesso ai 10 moduli video è a vita (Life-time). Potrai riguardare le lezioni tutte le volte che vorrai, da computer, tablet o smartphone."
              },
              {
                question: "I pagamenti sono rateizzabili?",
                answer: "Sì, tutti i pacchetti possono essere rateizzati per rendere l'investimento ancora più comodo e accessibile."
              }
            ].map((faq, index) => (
              <div key={index} className="bg-white rounded-2xl p-6 border border-gray-200/80 shadow-sm">
                <h3 className="text-lg font-serif font-semibold text-gray-900 mb-2">{faq.question}</h3>
                <p className="text-gray-600 text-sm sm:text-base leading-relaxed font-light">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 12. FINAL CTA */}
      <section className="py-24 bg-primary-950 text-white text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"></div>
        <div className="container mx-auto px-6 relative z-10 max-w-3xl">
          <h2 className="text-4xl sm:text-6xl font-serif font-bold text-white tracking-tight">
            TI ASPETTO DENTRO!
          </h2>
          <p className="mt-6 text-xl text-primary-200 font-light leading-relaxed">
            Non aspettare che altre prendano il tuo posto. Impara a posizionarti come la dermopigmentista di riferimento nel tuo territorio.
          </p>

          <div className="mt-10">
            <a 
              href="https://wa.me/393282247737?text=Ciao%20Chiara,%20vorrei%20prenotare%20una%20call%20conoscitiva%20per%20il%20corso%20di%20Microblading" 
              target="_blank"
              rel="noopener noreferrer"
              className="px-10 py-5 bg-gradient-to-r from-amber-400 to-amber-500 text-gray-950 font-bold text-lg rounded-full hover:from-amber-300 hover:to-amber-400 transition shadow-2xl inline-block active:scale-95"
            >
              Prenota la tua Call con Chiara
            </a>
          </div>

          <div className="mt-8">
            <span className="font-serif italic text-lg text-primary-300">Chiara Morocutti</span>
          </div>
        </div>
      </section>

    </div>
  );
};

export default LandingPage;
