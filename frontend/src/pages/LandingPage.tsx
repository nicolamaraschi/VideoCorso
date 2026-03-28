import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

export const LandingPage: React.FC = () => {
  return (
    <div className="bg-gradient-to-b from-gray-50 to-white min-h-screen">
      {/* Hero Section */}
      <section id="hero" className="relative pt-20 pb-20 md:pt-32 md:pb-28">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center">
            <div className="md:w-1/2 md:pr-12">
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7 }}
                className="text-4xl md:text-5xl lg:text-6xl font-serif font-bold text-gray-900 leading-tight"
              >
                Costruisci la tua <span className="text-primary-600">Impresa da Zero</span>
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.2 }}
                className="mt-6 text-lg md:text-xl text-gray-600 leading-relaxed"
              >
                Il percorso definitivo per trasformare la tua idea in un business di successo. Impara le strategie pratiche, il mindset imprenditoriale e gli strumenti essenziali per lanciare, gestire e scalare la tua azienda senza commettere errori costosi.
              </motion.p>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.4 }}
                className="mt-8 flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4"
              >
                <Link to="/checkout" className="px-8 py-4 bg-gray-800 text-white text-center rounded-full font-medium hover:bg-gray-900 transition shadow-md hover:shadow-lg active:shadow-sm">
                  Inizia a Fare Impresa
                </Link>
                <a href="#anteprima" className="px-8 py-4 bg-white text-primary-600 text-center border border-primary-600 rounded-full font-medium hover:bg-gray-50 transition">
                  Guarda il programma
                </a>
              </motion.div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1, delay: 0.6 }}
                className="mt-10 flex items-center text-gray-600"
              >

              </motion.div>
            </div>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.3 }}
              className="mt-12 md:mt-0 md:w-1/2"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-primary-200 rounded-lg transform -rotate-6"></div>
                <div className="relative overflow-hidden rounded-lg shadow-xl">
                  {/* Nota: Assicurati di cambiare l'immagine in public/hero-image.jpg con una a tema business */}
                  <img
                    className="w-full h-auto"
                    src="/hero-image.jpg"
                    alt="Corso Business Mastery"
                  />
                  <div className="absolute inset-0 bg-gradient-to-tr from-primary-900/30 to-transparent flex items-center justify-center">
                    <button className="bg-white/90 rounded-full p-4 shadow-lg hover:bg-white transition transform hover:scale-105">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-primary-600" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Decorative background elements */}
        <div className="hidden lg:block absolute right-0 top-1/4 -z-10">
          <svg width="404" height="404" fill="none" viewBox="0 0 404 404" aria-hidden="true">
            <defs>
              <pattern id="pattern-squares" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                <rect x="0" y="0" width="4" height="4" fill="rgba(99, 102, 241, 0.08)" />
              </pattern>
            </defs>
            <rect width="404" height="404" fill="url(#pattern-squares)" />
          </svg>
        </div>
        <div className="hidden lg:block absolute left-0 bottom-1/4 -z-10">
          <svg width="404" height="404" fill="none" viewBox="0 0 404 404" aria-hidden="true">
            <defs>
              <pattern id="pattern-circles" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                <circle cx="10" cy="10" r="3" fill="rgba(99, 102, 241, 0.1)" />
              </pattern>
            </defs>
            <rect width="404" height="404" fill="url(#pattern-circles)" />
          </svg>
        </div>
      </section>

      {/* Features Section */}
      <section id="corso" className="py-16 bg-white">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-gray-900">Cosa imparerai nel Master</h2>
            <p className="mt-4 text-lg text-gray-600">Un percorso strutturato in moduli strategici per guidarti dalla validazione dell'idea fino alla scalabilità aziendale.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                image: "/mindset.jpg",
                title: "Mindset Imprenditoriale",
                description: "Impara a pensare come un CEO. Gestione dello stress, focus, resilienza e come prendere decisioni difficili sotto pressione."
              },
              {
                image: "/validazione.jpg",
                title: "Validazione & Strategia",
                description: "Come capire se la tua idea ha mercato prima di investire. Creazione del Business Model Canvas e analisi dei competitor."
              },
              {
                image: "/finanziaria.jpg",
                title: "Gestione Finanziaria",
                description: "Cash flow, margini, P&L e tasse. Tutto ciò che devi sapere per non far fallire la tua azienda nei primi 12 mesi."
              },
              {
                image: "/marketing.jpg",
                title: "Marketing & Branding",
                description: "Come posizionare il tuo brand, acquisire clienti a basso costo e creare un'offerta irresistibile."
              },
              {
                image: "/vendite.jpg",
                title: "Vendite & Negoziazione",
                description: "Tecniche avanzate per chiudere contratti, gestire obiezioni e aumentare il valore medio per cliente."
              },
              {
                image: "/team.jpg",
                title: "Team & Scalabilità",
                description: "Come delegare, assumere i talenti giusti e creare processi per far crescere l'azienda senza la tua presenza costante."
              }
            ].map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="bg-gray-50 rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-shadow duration-300"
              >
                <div className="h-48 overflow-hidden">
                  <img src={feature.image} alt={feature.title} className="w-full h-full object-cover transform hover:scale-105 transition-transform duration-500" />
                </div>
                <div className="p-8">
                  <h3 className="text-xl font-serif font-semibold text-gray-900 mb-3">{feature.title}</h3>
                  <p className="text-gray-600 leading-relaxed">{feature.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section id="vantaggi" className="py-20 bg-gradient-to-br from-primary-50 to-white">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="md:w-1/2 md:pr-12 mb-12 md:mb-0"
            >
              {/* Nota: Aggiorna questa immagine con un grafico di crescita o un meeting aziendale */}
              <img src="/benefifts-image.jpg" alt="Crescita Aziendale" className="rounded-lg shadow-xl max-w-full" />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="md:w-1/2"
            >
              <h2 className="text-3xl md:text-4xl font-serif font-bold text-gray-900 mb-6">Perché questo non è il solito corso</h2>

              <div className="space-y-5">
                {[

                  {
                    title: "Strumenti Pronti all'Uso",
                    description: "Accesso a template, fogli di calcolo finanziari, contratti tipo e script di vendita che usiamo noi stessi."
                  },
                  {
                    title: "Networking di Alto Livello",
                    description: "Entra in contatto con altri imprenditori ambiziosi. Il tuo network è il tuo patrimonio netto."
                  },
                  {
                    title: "Aggiornamenti Costanti",
                    description: "Il mercato cambia velocemente. Il corso viene aggiornato regolarmente con le nuove strategie di business."
                  }
                ].map((benefit, index) => (
                  <div key={index} className="flex items-start">
                    <div className="flex-shrink-0 mt-1">
                      <div className="flex items-center justify-center h-8 w-8 rounded-md bg-primary-600 text-white">
                        <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                    <div className="ml-4">
                      <h3 className="text-lg font-medium text-gray-900">{benefit.title}</h3>
                      <p className="mt-1 text-gray-600">{benefit.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8">
                <Link to="/checkout" className="px-8 py-3 bg-gray-800 text-white rounded-full font-medium hover:bg-gray-900 transition shadow-md hover:shadow-lg inline-block">
                  Accedi al Master Completo
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Preview Section */}
      <section id="anteprima" className="py-20 bg-gray-900 text-white">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-serif font-bold">Anteprima delle Lezioni</h2>
            <p className="mt-4 text-lg text-gray-300">Dai un'occhiata al contenuto pratico e diretto che troverai all'interno della piattaforma.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3].map((video) => (
              <motion.div
                key={video}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: video * 0.1 }}
                viewport={{ once: true }}
                className="bg-gray-800 rounded-lg overflow-hidden shadow-lg"
              >
                <div className="relative aspect-video">
                  <img src={`/preview-${video}.jpg`} alt={`Anteprima video ${video}`} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <button className="bg-primary-600/90 rounded-full p-4 shadow-lg hover:bg-primary-600 transition transform hover:scale-105">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-serif font-semibold mb-2">
                    {video === 1 ? "Come trovare l'idea giusta" : video === 2 ? "Analisi dei Competitor" : "Il Business Plan in 1 Pagina"}
                  </h3>
                  <p className="text-gray-400">
                    {video === 1
                      ? "Metodo pratico per validare la tua idea di business in 24 ore."
                      : video === 2
                        ? "Scopri i punti deboli dei tuoi concorrenti e usali a tuo favore."
                        : "Dimentica i documenti lunghi: impara a pianificare in modo snello."}
                  </p>
                  <div className="mt-4 flex items-center text-sm text-gray-400">
                    <svg className="h-4 w-4 mr-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                    </svg>
                    <span>15:00 minuti</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <p className="text-lg text-gray-300 mb-6">Oltre 50 ore di formazione, case studies e interviste a esperti del settore.</p>
            <Link to="/checkout" className="px-8 py-3 bg-gray-800 text-white rounded-full font-medium hover:bg-gray-900 transition shadow-md hover:shadow-lg inline-block">
              Sblocca tutte le lezioni
            </Link>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonianze" className="py-20 bg-white">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-gray-900">Cosa dicono i nostri studenti</h2>
            <p className="mt-4 text-lg text-gray-600">Storie di chi è partito da zero e oggi gestisce un'attività profittevole.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                name: "Marco Bianchi",
                role: "Fondatore di E-commerce",
                image: "/testimonial-1.jpg",
                quote: "Partivo da zero e avevo paura di fallire. Questo corso mi ha dato la struttura mentale e pratica. In 6 mesi ho lasciato il mio lavoro fisso."
              },
              {
                name: "Laura Rossi",
                role: "Consulente Marketing",
                image: "/testimonial-2.jpg",
                quote: "La sezione sulla gestione finanziaria vale da sola il prezzo del corso. Ho finalmente capito come gestire i margini e scalare la mia agenzia."
              },
              {
                name: "Andrea Verdi",
                role: "Startupper Tech",
                image: "/testimonial-3.jpg",
                quote: "Non è il solito corso motivazionale. Qui ci sono strategie 'sporche' e reali da applicare subito. Ho trovato i miei primi 10 clienti grazie al modulo vendite."
              }
            ].map((testimonial, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="bg-gray-50 rounded-xl p-8 shadow-sm hover:shadow-md transition"
              >
                <div className="flex items-center mb-6">
                  <img className="h-14 w-14 rounded-full object-cover" src={testimonial.image} alt={testimonial.name} />
                  <div className="ml-4">
                    <h3 className="text-lg font-serif font-semibold text-gray-900">{testimonial.name}</h3>
                    <p className="text-gray-600">{testimonial.role}</p>
                  </div>
                </div>
                <p className="text-gray-700 italic">{testimonial.quote}</p>
                <div className="mt-4 flex">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <svg key={star} className="h-5 w-5 text-yellow-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-gray-900">Domande Frequenti</h2>
            <p className="mt-4 text-lg text-gray-600">Rispondiamo ai dubbi più comuni di chi vuole avviare un'impresa.</p>
          </div>

          <div className="max-w-3xl mx-auto">
            {[
              {
                question: "Ho bisogno di grandi capitali per iniziare?",
                answer: "Assolutamente no. Il corso insegna il metodo 'Lean Startup': come partire con il minimo indispensabile, validare l'idea e investire solo quando hai i primi clienti paganti."
              },
              {
                question: "Il corso è adatto se non ho ancora un'idea?",
                answer: "Sì. Il primo modulo è interamente dedicato al 'Brainstorming Strutturato' e all'analisi di mercato per aiutarti a trovare un'idea profittevole basata sulle tue passioni e competenze."
              },
              {
                question: "Serve avere competenze tecniche o di programmazione?",
                answer: "No. Ti insegneremo come utilizzare strumenti 'No-Code' e come delegare le parti tecniche. Il tuo ruolo è quello dell'imprenditore, non del tecnico."
              },
              {
                question: "Riceverò un attestato di partecipazione?",
                answer: "Sì, al completamento del percorso riceverai un certificato. Ma il vero 'pezzo di carta' sarà la tua azienda operativa e fatturante."
              },
              {
                question: "Come funziona il supporto se ho domande?",
                answer: "Avrai accesso alla nostra community privata di imprenditori e potrai partecipare alle sessioni di Q&A mensili dal vivo con i mentor."
              }
            ].map((faq, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="mb-5 border-b border-gray-200 pb-5"
              >
                <h3 className="text-xl font-serif font-medium text-gray-900 mb-2">{faq.question}</h3>
                <p className="text-gray-600">{faq.answer}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-primary-600">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-serif font-bold text-white mb-6">Sei pronto a prendere il controllo del tuo futuro?</h2>
          <p className="text-xl text-primary-100 mb-10 max-w-3xl mx-auto">Unisciti agli oltre 500 studenti che hanno smesso di sognare e hanno iniziato a costruire. Il momento migliore per piantare un albero era 20 anni fa. Il secondo momento migliore è oggi.</p>

          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="inline-block"
          >
            <Link to="/checkout" className="px-10 py-4 bg-gray-800 text-white rounded-full font-bold text-lg hover:bg-gray-900 transition shadow-lg">
              Iscriviti ora e inizia il business
            </Link>
          </motion.div>

          <p className="mt-6 text-primary-100">Soddisfazione garantita o rimborso entro 30 giorni</p>
        </div>
      </section>

    </div>
  );
};

export default LandingPage;