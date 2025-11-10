import React, { useState } from 'react';
import { CheckCircle, Shield, CreditCard } from 'lucide-react';
import { Button } from '../components/common/Button';
import { paymentService } from '../services/paymentService';
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY || '');

export const CheckoutPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Course details - in a real app, this would come from API
  const coursePrice = 99.99; // Example price
  const courseTitle = 'Video Corso Completo';

  const handleCheckout = async () => {
    try {
      setLoading(true);
      setError('');

      // Create checkout session
      const session = await paymentService.createCheckoutSession({
        course_id: 'main-course', // Replace with actual course ID
        success_url: `${window.location.origin}/payment-success`,
        cancel_url: `${window.location.origin}/checkout`,
      });

      // Redirect to Stripe Checkout
      const stripe = await stripePromise;
      if (stripe) {
        await stripe.redirectToCheckout({
          sessionId: session.session_id,
        });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to initiate checkout');
    } finally {
      setLoading(false);
    }
  };

  const features = [
    'Lifetime access to all course content',
    'HD video lessons organized in chapters',
    'Progress tracking and bookmarks',
    'Watch on any device',
    'Expert instructor support',
    'Certificate of completion',
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Get Full Access to {courseTitle}
          </h1>
          <p className="text-xl text-gray-600">
            Start learning today with our comprehensive video course
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Course Info */}
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              What's Included
            </h2>
            <ul className="space-y-4">
              {features.map((feature, index) => (
                <li key={index} className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">{feature}</span>
                </li>
              ))}
            </ul>

            <div className="mt-8 p-4 bg-primary-50 rounded-lg">
              <div className="flex items-center gap-2 text-primary-700 mb-2">
                <Shield className="w-5 h-5" />
                <span className="font-medium">Secure Payment</span>
              </div>
              <p className="text-sm text-primary-600">
                Your payment is processed securely through Stripe
              </p>
            </div>
          </div>

          {/* Checkout Card */}
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-gray-600">Course Price</span>
                <span className="text-3xl font-bold text-gray-900">
                  €{coursePrice.toFixed(2)}
                </span>
              </div>
              <div className="border-t border-gray-200 pt-4">
                <div className="flex items-center justify-between text-lg font-semibold">
                  <span>Total</span>
                  <span className="text-primary-600">€{coursePrice.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <Button
              onClick={handleCheckout}
              loading={loading}
              variant="primary"
              size="lg"
              fullWidth
              className="mb-4"
            >
              <CreditCard className="w-5 h-5 mr-2" />
              Proceed to Payment
            </Button>

            <p className="text-xs text-center text-gray-500">
              By purchasing, you agree to our Terms of Service and Privacy Policy
            </p>

            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-3">
                What happens after purchase?
              </h3>
              <ol className="space-y-2 text-sm text-gray-600">
                <li>1. Complete your payment securely via Stripe</li>
                <li>2. Receive your login credentials via email</li>
                <li>3. Access the course immediately</li>
                <li>4. Start learning at your own pace</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
