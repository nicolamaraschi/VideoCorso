import apiClient from './api';
import type{
  CreateCheckoutRequest,
  CreateCheckoutResponse,
  ApiResponse,
  PaymentVerification,
  Subscription,
} from '../types';

export const paymentService = {
  async quoteCheckout(data: { course_id: string; email?: string; coupon_code?: string; package_id?: string }): Promise<{
    base_total: number;
    final_total: number;
    coupon_code: string | null;
    is_free_access: boolean;
    package_id: string | null;
    requires_shipping_address: boolean;
  }> {
    return apiClient.post('/payment/quote', data);
  },

  // Create Stripe checkout session
  async createCheckoutSession(data: CreateCheckoutRequest): Promise<CreateCheckoutResponse> {
    return apiClient.post<CreateCheckoutResponse>('/payment/create-checkout', data);
  },

  // Verify payment status (after redirect from Stripe)
  async verifyPayment(sessionId: string): Promise<ApiResponse<PaymentVerification>> {
    return apiClient.get<ApiResponse<PaymentVerification>>(`/payment/verify/${encodeURIComponent(sessionId)}`);
  },

  async getSubscription(): Promise<Subscription> {
    return apiClient.get<Subscription>('/user/subscription');
  },
};
