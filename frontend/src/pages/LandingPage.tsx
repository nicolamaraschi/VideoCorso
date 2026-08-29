import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Sparkles, 
  ArrowRight, 
  ShieldCheck, 
  Check, 
  Award
} from 'lucide-react';
import { TrustindexWidget } from '../components/common/TrustindexWidget';

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
      <section id="hero" className="relative pt-24 pb-20 md:pt-36 md:pb-28 overflow-hidden">
        <div className="container mx-auto px-6">
          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
            <div className="lg:w-7/12">
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
                className="text-4xl sm:text-5xl lg:text-6xl font-serif font-bold text-gray-900 leading-[1.15] tracking-tight"
              >
                Diventa la dermopigmentista che <span className="text-primary-700 italic font-normal">tutti si contendono.</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.2 }}
                className="mt-6 text-lg sm:text-xl text-gray-600 leading-relaxed max-w-2xl font-light"
              >
                Il percorso che unisce <strong className="text-gray-900 font-semibold">tecnica del microblading</strong> e <strong className="text-gray-900 font-semibold">mentalità imprenditoriale</strong> per costruire un'agenda piena, con margini alti e meno ore in cabina.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.3 }}
                className="mt-10 flex flex-col sm:flex-row items-stretch sm:items-center gap-4"
              >
                <a 
                  href="#corso" 
                  className="px-8 py-4 bg-primary-950 text-white text-center rounded-full font-medium hover:bg-primary-900 transition-all shadow-md hover:shadow-xl active:scale-[0.99] flex items-center justify-center gap-2 group"
                >
                  <span>Scegli il tuo percorso</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </a>
                <a 
                  href="#vantaggi" 
                  className="px-8 py-4 bg-white text-primary-900 text-center border border-primary-200 rounded-full font-medium hover:bg-primary-50/60 transition shadow-sm"
                >
                  Scopri i 2 Pilastri
                </a>
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.3 }}
              className="lg:w-5/12 w-full max-w-md lg:max-w-none"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-primary-200/60 rounded-3xl transform -rotate-3 blur-sm"></div>
                <div className="relative overflow-hidden rounded-3xl shadow-2xl border-4 border-white aspect-[4/5] bg-primary-950 group">
                  <video
                    className="w-full h-full object-cover"
                    src="/welcome.mp4"
                    controls
                    playsInline
                    poster="/hero-microblading.webp"
                  >
                    Il tuo browser non supporta il tag video.
                  </video>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* 2. IL PUNTO DI PARTENZA (PAIN POINTS) */}
      <section className="py-20 bg-white border-y border-primary-100/60">
        <div className="container mx-auto px-6 max-w-5xl">
          <div className="text-center mb-14">
            <span className="text-xs font-bold tracking-widest uppercase text-primary-600 bg-primary-50 px-3.5 py-1.5 rounded-full border border-primary-100">
              Il Punto di Partenza
            </span>
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-gray-900 mt-4">
              Sei brava con le mani.<br className="hidden sm:inline" /> Ma questo basta a riempire l'agenda?
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <motion.div 
              whileHover={{ y: -4 }} 
              className="bg-primary-50/50 p-8 rounded-2xl border border-primary-100 flex flex-col justify-between"
            >
              <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center text-primary-800 font-bold mb-4 font-serif">
                1
              </div>
              <p className="text-gray-700 text-base leading-relaxed">
                Vedi il microblading crescere, ma non sai come inserirti senza una formazione strutturata e autorevole.
              </p>
            </motion.div>

            <motion.div 
              whileHover={{ y: -4 }} 
              className="bg-primary-50/50 p-8 rounded-2xl border border-primary-100 flex flex-col justify-between"
            >
              <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center text-primary-800 font-bold mb-4 font-serif">
                2
              </div>
              <p className="text-gray-700 text-base leading-relaxed">
                Sai fare trattamenti estetici generici, ma non un servizio ad altissima marginalità come il PMU.
              </p>
            </motion.div>

            <motion.div 
              whileHover={{ y: -4 }} 
              className="bg-primary-900 text-white p-8 rounded-2xl shadow-md flex flex-col justify-between"
            >
              <div className="w-10 h-10 rounded-xl bg-primary-800 flex items-center justify-center text-primary-200 font-bold mb-4 font-serif">
                ★
              </div>
              <p className="text-primary-100 text-base leading-relaxed font-medium">
                Non è un problema di talento.<br />
                <strong>È un problema di metodo — tecnico e commerciale.</strong>
              </p>
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

      {/* 6. VIDEO IN AZIONE SECTION */}
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
            {['/video-1.mp4', '/video-2.mp4', '/video-3.mp4', '/video-4.mp4'].map((src, i) => (
              <div key={i} className="w-full rounded-2xl overflow-hidden shadow-md border-4 border-white bg-primary-50 aspect-video relative group">
                <video 
                  className="w-full h-full object-cover" 
                  controls 
                  playsInline
                  src={src}
                >
                  Il tuo browser non supporta i video.
                </video>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 7. AUTHORITY QUOTE SECTION */}
      <section className="py-20 bg-primary-950 text-white relative">
        <div className="container mx-auto px-6 max-w-4xl text-center">
          <div className="inline-block p-3 rounded-full bg-primary-900 text-primary-300 mb-6">
            <Award className="w-8 h-8" />
          </div>
          <blockquote className="text-2xl sm:text-3xl md:text-4xl font-serif italic leading-snug text-primary-100">
            “Ho costruito un business da <span className="text-amber-300 not-italic font-bold">15.000€ al mese</span> con il microblading. Ora ti insegno come farlo anche a te.”
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
                  <span className="text-4xl font-serif font-bold text-gray-900">890 €</span>
                  <span className="text-xs text-gray-500 block mt-1">+ IVA — rateizzabile</span>
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

              <Link
                to="/checkout?courseId=mai-fatto-microblading-inizio"
                className="w-full py-3.5 px-6 rounded-xl border border-gray-300 text-gray-900 font-semibold text-center hover:bg-gray-50 transition"
              >
                Iscriviti a Base
              </Link>
            </div>

            {/* 2. PLUS */}
            <div className="bg-white rounded-3xl p-8 border-2 border-primary-300 shadow-md flex flex-col justify-between relative">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-primary-600 text-white text-xs font-bold px-4 py-1 rounded-full uppercase tracking-wider shadow">
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
                  <span className="text-4xl font-serif font-bold text-gray-900">1.490 €</span>
                  <span className="text-xs text-gray-500 block mt-1">+ IVA — rateizzabile</span>
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

              <Link
                to="/checkout?courseId=mai-fatto-microblading-inizio"
                className="w-full py-3.5 px-6 rounded-xl bg-primary-700 text-white font-semibold text-center hover:bg-primary-800 transition shadow-md"
              >
                Iscriviti a Plus
              </Link>
            </div>

            {/* 3. FULL */}
            <div className="bg-primary-950 text-white rounded-3xl p-8 shadow-2xl flex flex-col justify-between relative border border-amber-400/30 overflow-hidden">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-400 to-amber-500 text-gray-950 text-xs font-extrabold px-4 py-1 rounded-full uppercase tracking-wider shadow">
                Offerta Lancio: -500€
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
                  <div className="flex items-baseline gap-3">
                    <span className="text-xl text-gray-400 line-through font-serif">2.200 €</span>
                    <span className="text-4xl font-serif font-bold text-amber-300">1.690 €</span>
                  </div>
                  <span className="text-xs text-primary-200 block mt-1">Sconto lancio di 500€ — + IVA, rateizzabile</span>
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
                    <span>Call strategica dedicata con <strong>Sabrina Perrotta</strong></span>
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

              <Link
                to="/checkout?courseId=mai-fatto-microblading-inizio"
                className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-gray-950 font-bold text-center hover:from-amber-300 hover:to-amber-400 transition shadow-lg"
              >
                Approfitta dell'Offerta Full
              </Link>
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
                    <th className="py-4 px-4 font-bold text-center text-gray-700 bg-gray-50/50 rounded-t-xl">BASE (890€)</th>
                    <th className="py-4 px-4 font-bold text-center text-primary-900 bg-primary-50/60 rounded-t-xl">PLUS (1.490€)</th>
                    <th className="py-4 px-4 font-bold text-center text-amber-950 bg-amber-50 rounded-t-xl">FULL (1.690€)</th>
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
                    <td className="py-3.5 px-4 text-gray-800">Call strategica con Sabrina Perrotta</td>
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

          {/* Trustindex Live Reviews Widget */}
          <div className="max-w-6xl mx-auto bg-primary-50/40 rounded-3xl p-4 sm:p-8 border border-primary-100/80 shadow-sm">
            <TrustindexWidget scriptSrc="https://cdn.trustindex.io/loader.js?6d4fbfe80b0925814246238f8e4" className="w-full" />
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
                answer: "Il kit prodotti professionale completo è incluso nel pacchetto Full e ti verrà spedito direttamente a casa. Per i pacchetti Base e Plus, all'interno del corso troverai la lista esatta dei materiali consigliati e i link per acquistarli al miglior prezzo."
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
              href="#corso" 
              className="px-10 py-5 bg-gradient-to-r from-amber-400 to-amber-500 text-gray-950 font-bold text-lg rounded-full hover:from-amber-300 hover:to-amber-400 transition shadow-2xl inline-block active:scale-95"
            >
              Iscriviti alla Masterclass Ora
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
