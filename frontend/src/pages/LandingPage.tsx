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
                Padroneggia l'arte delle <span className="text-primary-600">Micro Tecniche</span>
              </motion.h1>
              <motion.p 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.2 }}
                className="mt-6 text-lg md:text-xl text-gray-600 leading-relaxed"
              >
                Un percorso formativo esclusivo per chi desidera portare le proprie abilità al livello successivo. Attraverso lezioni concise ed efficaci, scoprirai come padroneggiare tecniche avanzate e trasformare la tua passione in eccellenza.
              </motion.p>
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.4 }}
                className="mt-8 flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4"
              >
                {/* FIX: Usare bg-gray-800 come fallback affidabile */}
                <Link to="/checkout" className="px-8 py-4 bg-gray-800 text-white text-center rounded-full font-medium hover:bg-gray-900 transition shadow-md hover:shadow-lg active:shadow-sm">
                  Inizia il tuo percorso
                </Link>
                <a href="#anteprima" className="px-8 py-4 bg-white text-primary-600 text-center border border-primary-600 rounded-full font-medium hover:bg-gray-50 transition">
                  Guarda l'anteprima
                </a>
              </motion.div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1, delay: 0.6 }}
                className="mt-10 flex items-center text-gray-600"
              >
                <div className="flex -space-x-2">
                  {[1, 2, 3, 4].map(i => (
                    <img key={i} className="inline-block h-10 w-10 rounded-full ring-2 ring-white" src={`/avatar-${i}.jpg`} alt="" />
                  ))}
                </div>
                <div className="ml-4">
                  <span className="font-medium">Più di 200 persone</span> hanno già completato il corso
                </div>
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
                  <img 
                    className="w-full h-auto" 
                    src="/hero-image.jpg" 
                    alt="Corso Micro Tecniche" 
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
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-gray-900">Un percorso completo e strutturato</h2>
            <p className="mt-4 text-lg text-gray-600">Il corso è organizzato in capitoli progressivi che ti guideranno passo dopo passo verso la padronanza delle micro tecniche.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: "🎯",
                title: "Fondamenti Essenziali",
                description: "Lezioni introduttive per costruire solide basi tecniche attraverso esercizi pratici e concetti fondamentali."
              },
              {
                icon: "🔍",
                title: "Tecniche Avanzate",
                description: "Approfondimento di metodologie sofisticate con dimostrazioni dettagliate e applicazioni pratiche."
              },
              {
                icon: "💎",
                title: "Perfezionamento",
                description: "Rifinitura delle competenze acquisite con feedback personalizzati e suggerimenti per l'eccellenza."
              },
              {
                icon: "🚀",
                title: "Progressione Graduale",
                description: "Ogni lezione si basa sulla precedente, garantendo un apprendimento fluido e naturale."
              },
              {
                icon: "🧠",
                title: "Approccio Pratico",
                description: "Concentrazione su esercizi concreti e situazioni reali per un'applicazione immediata."
              },
              {
                icon: "🌟",
                title: "Risorse Esclusive",
                description: "Materiali supplementari e strumenti di supporto per accelerare il tuo apprendimento."
              }
            ].map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="bg-gray-50 rounded-xl p-8 shadow-sm hover:shadow-md transition"
              >
                <div className="text-4xl mb-4">{feature.icon}</div>
                <h3 className="text-xl font-serif font-semibold text-gray-900 mb-3">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
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
              <img src="/benefits-image.png" alt="Vantaggi del corso" className="rounded-lg shadow-xl max-w-full" />
            </motion.div>
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="md:w-1/2"
            >
              <h2 className="text-3xl md:text-4xl font-serif font-bold text-gray-900 mb-6">Perché scegliere questo corso</h2>
              
              <div className="space-y-5">
                {[
                  {
                    title: "Apprendimento flessibile",
                    description: "Accedi alle lezioni quando e dove preferisci. Il corso è disponibile 24/7 sulla nostra piattaforma."
                  },
                  {
                    title: "Micro lezioni ottimizzate",
                    description: "Video brevi e mirati di 10-12 minuti che mantengono alta l'attenzione e facilitano l'assimilazione."
                  },
                  {
                    title: "Struttura progressiva",
                    description: "Un percorso logico che ti guida dalla teoria alla pratica avanzata con crescente complessità."
                  },
                  {
                    title: "Qualità superiore",
                    description: "Contenuti curati nei minimi dettagli con riprese professionali in alta definizione."
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
                {/* FIX: Usare bg-gray-800 come fallback affidabile */}
                <Link to="/checkout" className="px-8 py-3 bg-gray-800 text-white rounded-full font-medium hover:bg-gray-900 transition shadow-md hover:shadow-lg inline-block">
                  Scopri il corso completo
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
            <h2 className="text-3xl md:text-4xl font-serif font-bold">Anteprima delle lezioni</h2>
            <p className="mt-4 text-lg text-gray-300">Guarda questi estratti dal corso per avere un'idea della qualità e dello stile delle lezioni.</p>
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
                  <h3 className="text-xl font-serif font-semibold mb-2">Lezione di Anteprima {video}</h3>
                  <p className="text-gray-400">Una breve introduzione alle micro tecniche fondamentali che imparerai durante il corso.</p>
                  <div className="mt-4 flex items-center text-sm text-gray-400">
                    <svg className="h-4 w-4 mr-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                    </svg>
                    <span>10:45 minuti</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
          
          <div className="mt-12 text-center">
            <p className="text-lg text-gray-300 mb-6">Queste sono solo alcune delle oltre 40 lezioni dettagliate incluse nel corso completo.</p>
            {/* FIX: Usare bg-gray-800 come fallback affidabile */}
            <Link to="/checkout" className="px-8 py-3 bg-gray-800 text-white rounded-full font-medium hover:bg-gray-900 transition shadow-md hover:shadow-lg inline-block">
              Accedi al corso completo
            </Link>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonianze" className="py-20 bg-white">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-gray-900">Cosa dicono i nostri studenti</h2>
            <p className="mt-4 text-lg text-gray-600">Scopri le esperienze di chi ha già completato il percorso formativo.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                name: "Marco Bianchi",
                role: "Professionista",
                image: "/testimonial-1.jpg",
                quote: "Questo corso ha trasformato completamente il mio approccio. Le micro tecniche presentate sono straordinariamente efficaci e immediatamente applicabili."
              },
              {
                name: "Laura Rossi",
                role: "Appassionata",
                image: "/testimonial-2.jpg",
                quote: "La struttura progressiva del corso è perfetta. Ogni lezione si costruisce naturalmente sulla precedente, rendendo l'apprendimento fluido e gratificante."
              },
              {
                name: "Andrea Verdi",
                role: "Studente avanzato",
                image: "/testimonial-3.jpg",
                quote: "La qualità delle spiegazioni è eccezionale. Concetti complessi vengono presentati con una chiarezza sorprendente, rivelando sfumature che non avevo mai notato prima."
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
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-gray-900">Domande frequenti</h2>
            <p className="mt-4 text-lg text-gray-600">Tutto ciò che devi sapere prima di iniziare il tuo percorso formativo.</p>
          </div>
          
          <div className="max-w-3xl mx-auto">
            {[
              {
                question: "Per quanto tempo avrò accesso al corso?",
                answer: "Una volta completato l'acquisto, avrai accesso a tutte le lezioni per 12 mesi. Potrai accedere illimitatamente a tutti i contenuti durante questo periodo."
              },
              {
                question: "Il corso è adatto ai principianti?",
                answer: "Il corso è strutturato per accogliere sia principianti che esperti. Le lezioni iniziali costruiscono una base solida, mentre i moduli avanzati soddisfano anche i professionisti più esigenti."
              },
              {
                question: "Posso accedere al corso da dispositivi mobili?",
                answer: "Assolutamente sì. La piattaforma è completamente responsive e ottimizzata per l'utilizzo su smartphone e tablet, permettendoti di studiare ovunque ti trovi."
              },
              {
                question: "Ci sono prerequisiti per seguire il corso?",
                answer: "Non sono richiesti prerequisiti specifici. Ogni concetto viene spiegato in modo chiaro e accessibile, garantendo un percorso di apprendimento fluido per tutti."
              },
              {
                question: "Come funziona il processo di iscrizione?",
                answer: "Dopo aver completato il pagamento, riceverai immediatamente un'email con le tue credenziali di accesso. Potrai accedere alla piattaforma e iniziare il tuo percorso formativo in pochi minuti."
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
          <h2 className="text-3xl md:text-4xl font-serif font-bold text-white mb-6">Pronto a trasformare la tua passione in eccellenza?</h2>
          <p className="text-xl text-primary-100 mb-10 max-w-3xl mx-auto">Unisciti agli oltre 200 studenti che hanno già scoperto il potere delle micro tecniche e hanno portato le loro abilità a un livello superiore.</p>
          
          <motion.div 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="inline-block"
          >
            {/* FIX: Usare bg-gray-800 come fallback affidabile */}
            <Link to="/checkout" className="px-10 py-4 bg-gray-800 text-white rounded-full font-bold text-lg hover:bg-gray-900 transition shadow-lg">
              Iscriviti al corso ora
            </Link>
          </motion.div>
          
          <p className="mt-6 text-primary-100">Soddisfazione garantita o rimborso entro 30 giorni</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between">
            <div className="mb-8 md:mb-0">
              <div className="flex items-center">
                <img src="/logo-white.png" alt="Logo" className="h-8 mr-3" />
                <span className="font-serif text-xl">MicroTecniche</span>
              </div>
              <p className="mt-4 text-gray-400 max-w-md">
                Un percorso formativo innovativo dedicato a chi desidera padroneggiare le più raffinate micro tecniche del settore.
              </p>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
              <div>
                <h3 className="text-lg font-medium mb-4">Navigazione</h3>
                <ul className="space-y-2">
                  <li><a href="#corso" className="text-gray-400 hover:text-white transition">Il Corso</a></li>
                  <li><a href="#vantaggi" className="text-gray-400 hover:text-white transition">Vantaggi</a></li>
                  <li><a href="#anteprima" className="text-gray-400 hover:text-white transition">Anteprima</a></li>
                  <li><a href="#testimonianze" className="text-gray-400 hover:text-white transition">Testimonianze</a></li>
                </ul>
              </div>
              
              <div>
                <h3 className="text-lg font-medium mb-4">Risorse</h3>
                <ul className="space-y-2">
                  <li><a href="#" className="text-gray-400 hover:text-white transition">Blog</a></li>
                  <li><a href="#" className="text-gray-400 hover:text-white transition">Supporto</a></li>
                  <li><a href="#" className="text-gray-400 hover:text-white transition">FAQ</a></li>
                  <li><a href="#" className="text-gray-400 hover:text-white transition">Contatti</a></li>
                </ul>
              </div>
              
              <div>
                <h3 className="text-lg font-medium mb-4">Seguici</h3>
                <div className="flex space-x-4">
                  <a href="#" className="text-gray-400 hover:text-white transition">
                    <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clipRule="evenodd" />
                    </svg>
                  </a>
                  <a href="#" className="text-gray-400 hover:text-white transition">
                    <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path fillRule="evenodd" d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z" clipRule="evenodd" />
                    </svg>
                  </a>
                  <a href="#" className="text-gray-400 hover:text-white transition">
                    <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          </div>
          
          <div className="border-t border-gray-800 mt-10 pt-8 flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-400 text-sm">© {new Date().getFullYear()} MicroTecniche. Tutti i diritti riservati.</p>
            <div className="mt-4 md:mt-0">
              <ul className="flex space-x-6">
                <li><a href="#" className="text-gray-400 hover:text-white transition text-sm">Privacy Policy</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition text-sm">Termini di Servizio</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition text-sm">Cookie Policy</a></li>
              </ul>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;