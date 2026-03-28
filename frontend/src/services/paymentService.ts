import apiClient from './api';
import type{
  CreateCheckoutRequest,
  CreateCheckoutResponse,
  ApiResponse,
  Subscription,
} from '../types';

export const paymentService = {
  // Create Stripe checkout session
  async createCheckoutSession(data: CreateCheckoutRequest): Promise<CreateCheckoutResponse> {
    return apiClient.post<CreateCheckoutResponse>('/payment/create-checkout', data);
  },

  // Verify payment status (after redirect from Stripe)
  async verifyPayment(sessionId: string): Promise<ApiResponse<unknown>> {
    return apiClient.get<ApiResponse<unknown>>(`/payment/verify/${sessionId}`);
  },

  async getSubscription(): Promise<Subscription> {
    return apiClient.get<Subscription>('/user/subscription');
  },
};
