import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { courseService } from '../services/courseService';
import type { CourseListItem } from '../types';

export const LandingPage: React.FC = () => {
  const [courses, setCourses] = useState<CourseListItem[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const data = await courseService.getCatalog();
        setCourses(data.filter(c => c.is_purchasable !== false));
      } catch (err) {
        console.error("Failed to load catalog", err);
      } finally {
        setLoadingCourses(false);
      }
    };
    fetchCourses();
  }, []);
  return (
    <div className="bg-gradient-to-b from-primary-50 to-white min-h-screen">
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
                Masterclass <span className="text-primary-600">Microblading</span> Professionale
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.2 }}
                className="mt-6 text-lg md:text-xl text-gray-600 leading-relaxed"
              >
                Impara il metodo <strong className="text-gray-900 font-bold">UltraRealistic Brows</strong> per realizzare sopracciglia più folte, definite e con un effetto iper-realistico. Dalla teoria dei pigmenti alla pratica passo dopo passo, acquisisci le competenze per lanciare la tua carriera nel mondo del PMU e diventare una professionista di successo.
              </motion.p>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.4 }}
                className="mt-8 flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4"
              >
                <a href="#catalogo" className="px-8 py-4 bg-primary-950 text-white text-center rounded-full font-medium hover:bg-primary-900 transition shadow-md hover:shadow-lg active:shadow-sm">
                  Iscriviti alla Masterclass
                </a>
                <a href="#corso" className="px-8 py-4 bg-white text-primary-600 text-center border border-primary-600 rounded-full font-medium hover:bg-primary-50 transition">
                  Scopri il programma
                </a>
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
                <div className="relative overflow-hidden rounded-lg shadow-xl border-4 border-white aspect-[4/5] bg-primary-100 group">
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

        {/* Decorative background elements */}
        <div className="hidden lg:block absolute right-0 top-1/4 -z-10">
          <svg width="404" height="404" fill="none" viewBox="0 0 404 404" aria-hidden="true">
            <defs>
              <pattern id="pattern-squares" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                <rect x="0" y="0" width="4" height="4" fill="currentColor" className="text-primary-100" />
              </pattern>
            </defs>
            <rect width="404" height="404" fill="url(#pattern-squares)" />
          </svg>
        </div>
      </section>

      {/* Features Section */}
      <section id="corso" className="py-16 bg-white">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-gray-900">Cosa imparerai nel Master</h2>
            <p className="mt-4 text-lg text-gray-600">Un percorso completo passo dopo passo per formarti e farti lavorare con sicurezza fin dal primo giorno.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                image: "/feature-igiene.webp",
                title: "Igiene e Sicurezza",
                description: "Fondamentale per lavorare professionalmente. Normative vigenti, allestimento della postazione e corretto smaltimento degli aghi."
              },
              {
                image: "/feature-colorimetria.webp",
                title: "Colorimetria e Pigmenti",
                description: "Come scegliere il pigmento perfetto studiando il fototipo di pelle (scala Fitzpatrick). Prevenire viraggi di colore indesiderati."
              },
              {
                image: "/feature-visagismo.webp",
                title: "Visagismo e Progettazione",
                description: "Mappatura del viso e utilizzo del filo per creare la forma delle sopracciglia perfetta per i lineamenti di ogni singola cliente."
              },
              {
                image: "/feature-tecnica.webp",
                title: "Tecnica Pelo a Pelo",
                description: "L'uso corretto del manipolo: inclinazione a 90 gradi, profondità della pressione e schemi di disegno per un effetto iper-realistico."
              },
              {
                image: "/feature-pratica.webp",
                title: "Pratica su Sintetico",
                description: "Esercitazioni dettagliate su pelle sintetica (latex) per padroneggiare la manualità e la sicurezza prima di lavorare sulla modella."
              },
              {
                image: "/feature-consulenza.webp",
                title: "Consulenza e Post-Cura",
                description: "Come gestire l'appuntamento, il consenso informato e spiegare alla cliente come curare il trattamento nei giorni successivi."
              }
            ].map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="bg-primary-50 rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-shadow duration-300 border border-primary-100"
              >
                <div className="h-48 overflow-hidden bg-white">
                  <img src={feature.image} alt={feature.title} loading="lazy" className="w-full h-full object-cover transform hover:scale-105 transition-transform duration-500 opacity-90 hover:opacity-100" />
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

      {/* Il Metodo 3+1 Step */}
      <section className="py-16 bg-gradient-to-r from-primary-50 to-white">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-gray-900 text-center mb-12">Il Metodo in 3 + 1 Step che imparerai</h2>
            <div className="space-y-8">
              {[
                {
                  step: "1",
                  title: "Consulenza Iniziale e Progetto",
                  desc: "Imparerai a fare un vero e proprio studio delle sopracciglia, della pelle, della mimica facciale e dei lineamenti della cliente, necessario per garantire un trattamento esclusivo e completamente personalizzato."
                },
                {
                  step: "2",
                  title: "Prima Seduta",
                  desc: "Come analizzare il viso per decidere insieme la forma esatta. Dopo la progettazione iniziale si parte con il trattamento pratico che getterà le basi per l'effetto UltraRealistic Brows."
                },
                {
                  step: "3",
                  title: "Seconda Seduta (a 30/40 giorni)",
                  desc: "Capirai esattamente come reagisce la pelle (es. le pelli grasse espurgano più colore di quelle secche) e come effettuare la seconda seduta di perfezionamento."
                },
                {
                  step: "+1",
                  title: "Ritocco Annuale",
                  desc: "Come gestire le tue clienti nel lungo termine. Il Microblading è una tecnica reversibile e semipermanente, necessita quindi di essere ripassato una volta all'anno per fidelizzare la cliente."
                }
              ].map((item, idx) => (
                <motion.div 
                  key={idx}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: idx * 0.1 }}
                  viewport={{ once: true }}
                  className="flex bg-white rounded-xl p-6 shadow-sm border border-primary-100"
                >
                  <div className="flex-shrink-0 mr-6">
                    <div className="w-12 h-12 bg-primary-600 text-white rounded-full flex items-center justify-center font-bold text-xl font-serif">
                      {item.step}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">{item.title}</h3>
                    <p className="text-gray-600 leading-relaxed">{item.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Video in Azione Section */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-gray-900">Il Microblading in Azione</h2>
            <p className="mt-4 text-lg text-gray-600">Guarda la precisione e l'effetto UltraRealistic Brows prendere vita.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 justify-center max-w-5xl mx-auto">
            <div className="w-full rounded-2xl overflow-hidden shadow-elegant border-4 border-white bg-primary-50 aspect-video relative group">
              <video 
                className="w-full h-full object-cover" 
                controls 
                playsInline
                src="/video-1.mp4"
              >
                Il tuo browser non supporta i video.
              </video>
            </div>
            <div className="w-full rounded-2xl overflow-hidden shadow-elegant border-4 border-white bg-primary-50 aspect-video relative group">
              <video 
                className="w-full h-full object-cover" 
                controls 
                playsInline
                src="/video-2.mp4"
              >
                Il tuo browser non supporta i video.
              </video>
            </div>
            <div className="w-full rounded-2xl overflow-hidden shadow-elegant border-4 border-white bg-primary-50 aspect-video relative group">
              <video 
                className="w-full h-full object-cover" 
                controls 
                playsInline
                src="/video-3.mp4"
              >
                Il tuo browser non supporta i video.
              </video>
            </div>
            <div className="w-full rounded-2xl overflow-hidden shadow-elegant border-4 border-white bg-primary-50 aspect-video relative group">
              <video 
                className="w-full h-full object-cover" 
                controls 
                playsInline
                src="/video-4.mp4"
              >
                Il tuo browser non supporta i video.
              </video>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section id="vantaggi" className="py-20 bg-gradient-to-br from-primary-900 to-primary-950">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="md:w-1/2 md:pr-12 mb-12 md:mb-0"
            >
              <div className="relative p-2 bg-white/10 rounded-2xl backdrop-blur-sm">
                <img src="/corso-materiale.webp" alt="Materiale Corso" loading="lazy" className="rounded-xl shadow-2xl max-w-full" />
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="md:w-1/2 text-white"
            >
              <h2 className="text-3xl md:text-4xl font-serif font-bold mb-6">Perché scegliere la nostra accademia</h2>

              <div className="space-y-6 mt-8">
                {[
                  {
                    title: "Riprese Macro Altissima Risoluzione",
                    description: "Non ti perderai un singolo dettaglio. Grazie alle riprese 4k molto ravvicinate, vedrai esattamente la pressione e l'inclinazione dell'ago come se fossi lì."
                  },
                  {
                    title: "Materiale Didattico Completo",
                    description: "Avrai accesso per sempre a protocolli operativi, template per il consenso informato e dispense tecniche da scaricare e consultare."
                  },
                  {
                    title: "Supporto della Master",
                    description: "Non sarai lasciata sola. Potrai condividere i tuoi lavori su pelle sintetica e ricevere correzioni preziose per migliorare la tua tecnica."
                  }
                ].map((benefit, index) => (
                  <div key={index} className="flex items-start">
                    <div className="flex-shrink-0 mt-1">
                      <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary-500 text-white shadow-lg">
                        <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                    <div className="ml-5">
                      <h3 className="text-xl font-serif font-medium text-white">{benefit.title}</h3>
                      <p className="mt-2 text-primary-100/80 leading-relaxed">{benefit.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-10">
                <a href="#catalogo" className="px-8 py-4 bg-primary-500 text-white rounded-full font-medium hover:bg-primary-400 transition shadow-lg inline-block border border-primary-400/50">
                  Scopri i percorsi disponibili
                </a>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Chi è Chiara Morocutti */}
      <section className="py-20 bg-white overflow-hidden">
        <div className="container mx-auto px-6">
          <div className="flex flex-col lg:flex-row items-center gap-12 max-w-6xl mx-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="lg:w-5/12 relative"
            >
              <div className="absolute inset-0 bg-primary-100 rounded-full transform translate-x-4 translate-y-4 -z-10"></div>
              <img src="/chiara morocutti.webp" alt="Chiara Morocutti" className="rounded-full w-64 h-64 md:w-80 md:h-80 object-cover mx-auto border-4 border-white shadow-xl" />
            </motion.div>
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="lg:w-7/12"
            >
              <h2 className="text-3xl md:text-4xl font-serif font-bold text-gray-900 mb-4">Chiara Morocutti</h2>
              <p className="text-primary-600 font-semibold text-lg mb-6 uppercase tracking-wider">Specialista di Microblading e Dermopigmentazione Labbra e Occhi</p>
              
              <div className="space-y-4 text-gray-600 text-lg leading-relaxed mb-8">
                <p>
                  "Io sono Chiara Morocutti e sono una Dermopigmentista. Scommetto che se sei arrivata in questa pagina è perché vorresti imparare a creare sopracciglia più folte e definite, con un effetto iper-realistico e naturale che valorizzi lo sguardo delle tue clienti."
                </p>
                <p>
                  Ad oggi ho aiutato oltre <strong>700 Donne a Milano</strong> a dare pienezza, definizione e forma alle loro sopracciglia mantenendo uno stile super naturale, e vantiamo <strong>+400 Clienti Soddisfatte</strong> del trattamento <em>UltraRealistic Brows</em>.
                </p>
                <p>
                  Qualsiasi sia la tua situazione o il tuo livello di partenza, in questa accademia sono pronta ad aiutarti a padroneggiare la tecnica!
                </p>
              </div>
              
              <div className="flex gap-4 items-center">
                <div className="bg-primary-50 px-6 py-4 rounded-xl border border-primary-100 text-center">
                  <span className="block text-3xl font-bold text-primary-700 font-serif">700+</span>
                  <span className="text-sm text-gray-600 font-medium">Donne Aiutate</span>
                </div>
                <div className="bg-primary-50 px-6 py-4 rounded-xl border border-primary-100 text-center">
                  <span className="block text-3xl font-bold text-primary-700 font-serif">400+</span>
                  <span className="text-sm text-gray-600 font-medium">Testimonianze</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Catalogo Corsi Section */}
      <section id="catalogo" className="py-20 bg-primary-50">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-gray-900">Catalogo Masterclass</h2>
            <p className="mt-4 text-lg text-gray-600">Scegli il percorso formativo più adatto al tuo livello ed entra subito nell'accademia.</p>
          </div>

          {loadingCourses ? (
            <div className="text-center py-12 text-primary-600 font-medium">Caricamento in corso...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {courses.map((course, index) => (
                <motion.div
                  key={course.course_id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  viewport={{ once: true }}
                  className="bg-white rounded-2xl overflow-hidden shadow-lg flex flex-col transform hover:-translate-y-2 transition duration-300 border border-primary-100"
                >
                  <div className="relative h-56">
                    {course.cover_image_url ? (
                      <img src={course.cover_image_url} alt={course.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-primary-100 flex items-center justify-center text-primary-400 font-serif">
                        Corso Beauty
                      </div>
                    )}
                    {course.badge && (
                       <div className="absolute top-4 right-4 bg-primary-600 text-white text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-wide shadow-md">
                         {course.badge}
                       </div>
                    )}
                  </div>
                  <div className="p-8 flex flex-col flex-1">
                    <h3 className="text-2xl font-serif font-semibold text-gray-900 mb-3">{course.title}</h3>
                    <p className="text-gray-600 mb-8 flex-1 leading-relaxed">
                      {course.short_description || course.description || "Nessuna descrizione disponibile."}
                    </p>
                    <div className="flex items-end justify-between mt-auto pt-6 border-t border-primary-50">
                      <div>
                        {course.discounted_price && Number(course.discounted_price) < Number(course.price) && (
                          <span className="block text-sm text-gray-400 line-through mb-1">€ {Number(course.price).toFixed(2)}</span>
                        )}
                        <span className="text-3xl font-bold text-gray-900 font-serif">
                          € {Number(course.discounted_price ?? course.price).toFixed(2)}
                        </span>
                      </div>
                      <Link 
                        to={`/checkout?courseId=${course.public_slug || course.course_id}`} 
                        className="px-6 py-3 bg-primary-600 text-white text-sm font-medium rounded-xl hover:bg-primary-700 transition shadow-md hover:shadow-lg"
                      >
                        Acquista Ora
                      </Link>
                    </div>
                  </div>
                </motion.div>
              ))}
              
              {courses.length === 0 && (
                <div className="col-span-full text-center text-gray-500 py-12 bg-white rounded-xl shadow-sm">
                  Stiamo aggiornando il nostro catalogo. Torna a trovarci presto!
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonianze" className="py-20 bg-white">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-gray-900">Le nostre studentesse</h2>
            <p className="mt-4 text-lg text-gray-600">Leggi i risultati di chi ha deciso di specializzarsi e cambiare carriera.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                name: "Giulia M.",
                role: "Dermopigmentista",
                image: "/testimonial-1.png",
                quote: "Facevo l'estetista base da 5 anni. Dopo questo corso ho finalmente inserito il PMU nel mio centro e ho raddoppiato le entrate. Spiegazioni cristalline e inquadrature perfette."
              },
              {
                name: "Francesca T.",
                role: "Titolare Beauty Salon",
                image: "/testimonial-2.png",
                quote: "Avevo già fatto un corso in aula pagato oro, ma mi sentivo insicura. Con questi video ho potuto rivedere i passaggi critici decine di volte. Lo consiglio a tutte."
              },
              {
                name: "Elena C.",
                role: "Make-up Artist",
                image: "/testimonial-3.png",
                quote: "La parte sulla colorimetria e lo studio dei fototipi è la più completa che abbia mai visto. Non ho più paura di causare viraggi di colore sulle mie clienti."
              }
            ].map((testimonial, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="bg-primary-50/50 rounded-2xl p-6 shadow-sm hover:shadow-md transition border border-primary-100 flex flex-col"
              >
                <div className="mb-6 rounded-xl overflow-hidden shadow-sm border border-primary-100 bg-white">
                  <img className="w-full h-auto object-contain hover:scale-105 transition-transform duration-500" src={testimonial.image} alt="Prima e Dopo Microblading" />
                </div>
                <div className="flex flex-col mb-4">
                  <h3 className="text-lg font-serif font-semibold text-gray-900">{testimonial.name}</h3>
                  <p className="text-primary-600 text-sm">{testimonial.role}</p>
                </div>
                <p className="text-gray-700 italic leading-relaxed">"{testimonial.quote}"</p>
                <div className="mt-6 flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <svg key={star} className="h-5 w-5 text-primary-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
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
      <section className="py-20 bg-gray-50 border-t border-gray-100">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-gray-900">Domande Frequenti</h2>
            <p className="mt-4 text-lg text-gray-600">Tutto quello che devi sapere prima di iscriverti.</p>
          </div>

          <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm p-8 border border-gray-100">
            {[
              {
                question: "Devo avere già esperienza come estetista per iniziare?",
                answer: "Assolutamente no. Il percorso parte dalle basi assolute, spiegando dalla struttura della pelle alle norme igieniche. È adatto sia ai principianti che a chi vuole perfezionare la tecnica."
              },
              {
                question: "Il kit per la pratica è incluso nel prezzo del corso?",
                answer: "No, il corso comprende tutta la formazione teorica e pratica in video altissima definizione. All'interno del corso ti forniremo però la lista esatta dei materiali raccomandati e i link dove acquistarli al miglior prezzo."
              },
              {
                question: "Per quanto tempo avrò accesso ai video?",
                answer: "L'accesso è a vita (Life-time). Potrai riguardare le lezioni tutte le volte che vuoi, a qualsiasi ora, da telefono, tablet o computer. Tutti i futuri aggiornamenti tecnici saranno inclusi gratuitamente."
              },
              {
                question: "Viene rilasciato un attestato a fine corso?",
                answer: "Sì, al termine del percorso e superati i test pratici potrai scaricare l'Attestato di Partecipazione nominale, utile per arricchire il tuo curriculum e dare prestigio al tuo studio."
              },
              {
                question: "Come riceverò supporto se ho dubbi o difficoltà?",
                answer: "Tutte le corsiste hanno accesso esclusivo al nostro gruppo di supporto privato. Potrai fare domande e condividere le foto dei tuoi lavori su latex per ricevere feedback costruttivi direttamente dalla Master."
              }
            ].map((faq, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                viewport={{ once: true }}
                className={`pb-6 ${index !== 4 ? 'mb-6 border-b border-primary-100' : ''}`}
              >
                <h3 className="text-xl font-serif font-medium text-gray-900 mb-3">{faq.question}</h3>
                <p className="text-gray-600 leading-relaxed">{faq.answer}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-primary-900 relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 bg-primary-800 rounded-full opacity-50 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-80 h-80 bg-primary-700 rounded-full opacity-50 blur-3xl"></div>
        
        <div className="container mx-auto px-6 text-center relative z-10">
          <h2 className="text-3xl md:text-5xl font-serif font-bold text-white mb-6">Pronta a investire sul tuo futuro?</h2>
          <p className="text-xl text-primary-100 mb-10 max-w-2xl mx-auto leading-relaxed">
            Il settore del trucco permanente è in continua crescita. Non aspettare che altre prendano il tuo posto. Impara una professione altamente remunerativa oggi stesso.
          </p>

          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="inline-block"
          >
            <a href="#catalogo" className="px-10 py-5 bg-white text-primary-900 rounded-full font-bold text-lg hover:bg-primary-50 transition shadow-xl border border-white">
              Vedi i Corsi Disponibili
            </a>
          </motion.div>

          <p className="mt-8 text-primary-200/80 text-sm uppercase tracking-widest font-medium">Elevati. Specializzati. Distinguiti.</p>
        </div>
      </section>

    </div>
  );
};

export default LandingPage;
