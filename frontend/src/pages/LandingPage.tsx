import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, CheckCircle, Clock, Award, Shield, DollarSign, Users } from 'lucide-react';
import { Button } from '../components/common/Button';

// URL delle immagini prese dal sito della tua cliente
const heroImageUrl = "https://images.leadconnectorhq.com/image/f_webp/q_80/r_1200/u_https://assets.cdn.filesafe.space/Hvcye2IPwfUI6pnRhX9l/media/65049997e254f22eaeda46ba.jpeg";
const authorImageUrl = "https://images.leadconnectorhq.com/image/f_webp/q_80/r_640/u_https://assets.cdn.filesafe.space/ceYe4VnMXLjh1ENSEbH0/media/65eb2bc8fac23461035c1169.jpeg";
const guaranteeImageUrl = "https://images.leadconnectorhq.com/image/f_webp/q_80/r_1200/u_https://assets.cdn.filesafe.space/ceYe4VnMXLjh1ENSEbH0/media/6514585ac9753e719aa60206.png";

// Icone per i moduli, prese dal sito della cliente
const consulenzaIconUrl = "https://images.leadconnectorhq.com/image/f_webp/q_80/r_900/u_https://assets.cdn.filesafe.space/Ip3SPjvqJyEJvmar2U1c/media/c142bd97-8b30-4bbf-84e3-aa7596e58aef.png";
const primaSedutaIconUrl = "https://images.leadconnectorhq.com/image/f_webp/q_80/r_900/u_https://assets.cdn.filesafe.space/Ip3SPjvqJyEJvmar2U1c/media/af25b5c6-0fa2-4591-b4ca-a1f9c46ffe31.png";
const secondaSedutaIconUrl = "https://images.leadconnectorhq.com/image/f_webp/q_80/r_900/u_https://assets.cdn.filesafe.space/Ip3SPjvqJyEJvmar2U1c/media/6e26883c-32be-43ab-abf7-a938a6312a5b.png";


export const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  // I moduli del corso sono basati sui "3+1 step" del suo sito B2C
  const courseModules = [
    {
      iconUrl: consulenzaIconUrl,
      title: 'Modulo 1: Consulenza e Progetto',
      description: "Impara lo studio avanzato di sopracciglia, pelle, mimica facciale e lineamenti per garantire un trattamento su misura.",
    },
    {
      iconUrl: primaSedutaIconUrl,
      title: "Modulo 2: Esecuzione Prima Seduta",
      description: "Padroneggia la tecnica 'UltraRealistic Brows' per analizzare il viso, decidere la forma perfetta e iniziare il trattamento.",
    },
    {
      iconUrl: secondaSedutaIconUrl,
      title: 'Modulo 3: Seconda Seduta (30/40 giorni)',
      description: "Scopri come perfezionare il lavoro e gestire la reazione della pelle, specialmente quella grassa che tende a espurgare colore.",
    },
    {
      icon: Clock, // Icona generica per l'ultimo step
      title: 'Modulo 4: Ritocco Annuale e Gestione',
      description: "Impara a gestire i ritocchi periodici (10-14 mesi) e i fattori che influenzano la durata (sole, farmaci, età) per fidelizzare i clienti.",
    },
  ];

  return (
    <div className="min-h-screen bg-white">

      {/* --- 1. HERO SECTION --- */}
      {/* Usa l'immagine di sfondo e i testi principali del sito B2C, adattati al B2B */}
      <div 
        className="relative bg-cover bg-center py-32" 
        style={{ backgroundImage: `url(${heroImageUrl})` }}
      >
        <div className="absolute inset-0 bg-black opacity-50"></div>
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center z-10">
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6" style={{ fontFamily: 'Abhaya Libre, serif' }}>
            Diventa una Dermopigmentista di Successo
          </h1>
          <p className="text-xl text-gray-200 mb-8 max-w-2xl mx-auto" style={{ fontFamily: 'Abhaya Libre, serif' }}>
            Impara il Metodo 'UltraRealistic Brows' da Chiara Morocutti e trasforma la tua carriera con la tecnica che ha già conquistato oltre 400 clienti.
          </p>
          <Button
            variant="primary"
            size="lg"
            onClick={() => navigate('/checkout')}
            className="transform hover:scale-105"
          >
            Iscriviti Ora (Prezzo Lancio 99,99€)
          </Button>
        </div>
      </div>

      {/* --- 2. SEZIONE PROMO (Urgenza) --- */}
      {/* Presa dall'idea della "PROMO MICRO100" del sito B2C */}
      <div className="bg-yellow-400 py-12 px-4">
        <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Offerta Lancio "CORSO100"</h2>
            <p className="text-xl text-gray-800">
              Il valore del corso completo è 550€. Solo per oggi, accedi a tutto con un pagamento unico di <strong>99,99€</strong> e ricevi una <strong>Gift Card da 100€</strong> da usare per i tuoi futuri acquisti.
            </p>
        </div>
      </div>

      {/* --- 3. SEZIONE AUTORITÀ (Social Proof) --- */}
      {/* Basata sulla sua bio e i risultati B2C */}
      <div className="bg-gray-50 py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4" style={{ fontFamily: 'Abhaya Libre, serif' }}>
              Perché imparare da Chiara Morocutti?
            </h2>
            <p className="text-lg text-gray-700 mb-6" style={{ fontFamily: 'Abhaya Libre, serif' }}>
              "Sono una Dermopigmentista e ad oggi ho aiutato oltre 400 Donne a Milano a dare pienezza, definizione e forma alle loro sopracciglia mantenendo uno stile super naturale. Qualsiasi sia la tua situazione di partenza, sono pronta ad insegnarti il mio metodo."
            </p>
            <div className="flex space-x-8">
              <div className="flex items-center gap-2">
                <Users className="w-8 h-8 text-primary-600" />
                <span className="text-lg font-semibold text-gray-900">400+ Clienti</span>
              </div>
              <div className="flex items-center gap-2">
                <Award className="w-8 h-8 text-primary-600" />
                <span className="text-lg font-semibold text-gray-900">Tecnica Realistica</span>
              </div>
            </div>
          </div>
          <div>
            <img src={authorImageUrl} alt="Chiara Morocutti - Esperta Microblading" className="rounded-lg shadow-2xl w-full h-auto object-cover" />
          </div>
        </div>
      </div>
      
      {/* --- 4. MODULI DEL CORSO (Features) --- */}
      {/* Basati sui 3+1 step del sito B2C */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-12" style={{ fontFamily: 'Abhaya Libre, serif' }}>
          Cosa Imparerai nel Corso?
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {courseModules.map((mod, index) => (
            <div
              key={index}
              className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow border border-gray-100"
            >
              <div className="w-20 h-20 bg-primary-50 rounded-full flex items-center justify-center mb-4 mx-auto">
                {mod.iconUrl ? (
                  <img src={mod.iconUrl} alt={mod.title} className="w-12 h-12" />
                ) : (
                  <mod.icon className="w-10 h-10 text-primary-600" />
                )}
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2 text-center">
                {mod.title}
              </h3>
              <p className="text-gray-600 text-center">{mod.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* --- 5. SEZIONE FAQ (Gestione Obiezioni) --- */}
      {/* Prese dalle FAQ B2C e adattate a studenti B2B */}
      <div className="bg-white py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12" style={{ fontFamily: 'Abhaya Libre, serif' }}>
            Domande Frequenti sul Metodo
          </h2>
          <div className="space-y-6">
            <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Imparerò a gestire i rischi e la sicurezza?</h3>
              <p className="text-gray-600">Assolutamente. Il corso condivide le stesse precauzioni di un tatuaggio. Imparerai a verificare patologie, controindicazioni e a garantire la massima igiene, una priorità assoluta.</p>
            </div>
            <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Come gestirò le clienti che hanno paura del dolore?</h3>
              <p className="text-gray-600">Il dolore è soggettivo. Ti insegneremo come spiegare la sensazione (un fastidio per alcune, nullo per altre) e a mettere le clienti a proprio agio per un trattamento rilassante.</p>
            </div>
            <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Cosa saprò dire sulla durata del trattamento?</h3>
              <p className="text-gray-600">Saprà spiegare con professionalità che è un trattamento semipermanente (dura 10-14 mesi) e quali fattori influenzano la durata (tipo di pelle, età, farmaci, esposizione al sole), gestendo le aspettative.</p>
            </div>
          </div>
        </div>
      </div>

      {/* --- 6. SEZIONE GARANZIA (dall'immagine B2C) --- */}
      <div className="bg-gray-50 py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <img src={guaranteeImageUrl} alt="Garanzia" className="mx-auto mb-8 w-full max-w-md" />
            <h2 className="text-3xl font-bold text-gray-900 mb-4" style={{ fontFamily: 'Abhaya Libre, serif' }}>
              Soddisfatta o Rimborsata
            </h2>
            <p className="text-lg text-gray-700 mb-8 max-w-2xl mx-auto">
              Siamo così sicuri del valore di questo corso che se non sei soddisfatta dei contenuti entro i primi 14 giorni, ti rimborsiamo l'intera quota.
            </p>
            <Button
              variant="primary"
              size="lg"
              onClick={() => navigate('/checkout')}
              className="transform hover:scale-105"
            >
              Inizia Ora Senza Rischi
            </Button>
        </div>
      </div>

    </div>
  );
};