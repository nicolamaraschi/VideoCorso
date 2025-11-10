import React, { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { paymentService } from '../services/paymentService';
import { Loading } from '../components/common/Loading';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { Button } from '../components/common/Button';
import { CheckCircle, Shield, Award, Video } from 'lucide-react';

// Carica la chiave pubblica di Stripe dalle variabili d'ambiente .env
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY || '');

// Immagine della garanzia
const guaranteeImageUrl = "https://images.leadconnectorhq.com/image/f_webp/q_80/r_1200/u_https://assets.cdn.filesafe.space/ceYe4VnMXLjh1ENSEbH0/media/6514585ac9753e719aa60206.png";

export const CheckoutPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheckout = async () => {
    setLoading(true);
    setError(null);

    try {
      const stripe = await stripePromise;
      if (!stripe) {
        throw new Error('Stripe.js failed to load.');
      }

      // 1. Crea la sessione di checkout sul backend
      // Il course_id qui è un placeholder, ma non influenza il prezzo
      // che è fissato a 99.99€ nella Lambda.
      const { session_id } = await paymentService.createCheckoutSession({
        course_id: 'corso_completo_pmu', 
        success_url: `${window.location.origin}/dashboard?payment=success`,
        cancel_url: `${window.location.origin}/checkout?payment=cancelled`,
      });

      // 2. Reindirizza a Stripe
      const { error } = await stripe.redirectToCheckout({
        sessionId: session_id,
      });

      if (error) {
        setError(error.message || 'An error occurred during redirect.');
        setLoading(false);
      }

    } catch (err: any) {
      setError(err.message || 'Failed to create checkout session.');
      setLoading(false);
    }
  };

  const benefits = [
    { icon: Video, text: "Accesso a vita a tutti i moduli" },
    { icon: Award, text: "Tecnica 'UltraRealistic Brows' di Chiara Morocutti" },
    { icon: CheckCircle, text: "Futuri aggiornamenti inclusi" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12">
        
        {/* Colonna Sinistra: Riepilogo Benefici */}
        <div className="bg-white rounded-lg shadow-lg p-8 border border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900 mb-6" style={{ fontFamily: 'Abhaya Libre, serif' }}>
            Cosa stai acquistando
          </h2>
          
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800">Corso Completo: Metodo UltraRealistic Brows</h3>
            <p className="text-gray-600">La guida definitiva per diventare una Dermopigmentista di successo.</p>
          </div>

          <ul className="space-y-4 mb-8">
            {benefits.map((item, index) => {
              const Icon = item.icon;
              return (
                <li key={index} className="flex items-center gap-3">
                  <Icon className="w-5 h-5 text-primary-600 flex-shrink-0" />
                  <span className="text-gray-700">{item.text}</span>
                </li>
              );
            })}
          </ul>

          <div className="text-center">
            <img 
              src={guaranteeImageUrl} 
              alt="Garanzia Soddisfatta o Rimborsata" 
              className="mx-auto w-48 mb-4"
            />
            <h4 className="font-semibold text-gray-800">Garanzia 14 Giorni</h4>
            <p className="text-sm text-gray-600">Se il corso non fa per te, ti rimborsiamo l'intera quota. Senza rischi.</p>
          </div>
        </div>

        {/* Colonna Destra: Box Pagamento */}
        <div className="bg-white rounded-lg shadow-lg p-8 border border-gray-200 h-fit">
          <h2 className="text-2xl font-bold text-center text-gray-900 mb-6">
            Completa il tuo Acquisto
          </h2>

          {/* Dettagli Prezzo */}
          <div className="space-y-3 mb-6">
            <div className="flex justify-between text-gray-600">
              <span>Valore del corso</span>
              <span className="line-through">550,00€</span>
            </div>
            <div className="flex justify-between text-green-600 font-medium">
              <span>Sconto Lancio "CORSO100"</span>
              <span>-450,01€</span>
            </div>
            <div className="flex justify-between text-2xl font-bold text-gray-900 pt-3 border-t">
              <span>Totale</span>
              <span>99,99€</span>
            </div>
          </div>
          
          {error && (
            <div className="my-4">
              <ErrorMessage title="Errore Pagamento" message={error} onRetry={handleCheckout} />
            </div>
          )}

          {loading ? (
            <Loading text="Stiamo reindirizzando al pagamento sicuro..." />
          ) : (
            <>
              <Button
                onClick={handleCheckout}
                disabled={loading}
                variant="primary"
                fullWidth
                size="lg"
                className="transform hover:scale-105"
              >
                Paga 99,99€ con Stripe
              </Button>
              <div className="flex items-center justify-center gap-2 mt-4 text-sm text-gray-500">
                <Shield className="w-4 h-4" />
                <span>Pagamento sicuro gestito da Stripe</span>
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  );
};