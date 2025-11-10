export interface User {
  user_id: string;
  email: string;
  full_name: string;
  subscription_status: 'active' | 'expired' | 'cancelled';
  subscription_end_date: string;
  total_watch_time: number;
  last_login: string;
  is_admin?: boolean;
}

export interface Purchase {
  purchase_id: string;
  user_id: string;
  course_id: string;
  payment_id: string;
  stripe_session_id: string;
  amount: number;
  purchase_date: string;
  expiration_date: string;
  status: 'active' | 'expired' | 'cancelled';
}

export interface Subscription {
  purchase: Purchase;
  course: {
    course_id: string;
    title: string;
  };
  days_remaining: number;
  is_active: boolean;
}

export interface AuthUser {
  userId: string;
  email: string;
  fullName: string;
  isAdmin: boolean;
  subscriptionStatus: string;
  subscriptionEndDate: string;
}
