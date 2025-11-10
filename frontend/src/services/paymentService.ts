import apiClient from './api';
import type{
  CreateCheckoutRequest,
  CreateCheckoutResponse,
  ApiResponse,
} from '../types';

export const paymentService = {
  // Create Stripe checkout session
  async createCheckoutSession(data: CreateCheckoutRequest): Promise<CreateCheckoutResponse> {
    return apiClient.post<CreateCheckoutResponse>('/payment/create-checkout', data);
  },

  // Verify payment status (after redirect from Stripe)
  async verifyPayment(sessionId: string): Promise<ApiResponse<any>> {
    return apiClient.get<ApiResponse<any>>(`/payment/verify/${sessionId}`);
  },

  // Get user's subscription info
  async getSubscription(): Promise<any> {
    return apiClient.get<any>('/user/subscription');
  },
};
