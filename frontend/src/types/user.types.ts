export interface User {
  user_id: string;
  email: string;
  full_name: string;
  subscription_status: 'active' | 'expired' | 'cancelled';
  subscription_end_date: string;
  total_watch_time: number;
  last_login: string;
  is_admin?: boolean;
  global_access?: boolean;
}

export interface PurchaseRecord {
  purchase_id: string;
  user_id: string;
  course_id: string;
  payment_id?: string;
  stripe_session_id?: string;
  stripe_payment_intent_id?: string;
  stripe_charge_id?: string;
  is_stripe_test_purchase?: boolean;
  amount: number;
  amount_gross?: number;
  currency?: string;
  purchase_date: string;
  expiration_date?: string;
  status: 'active' | 'expired' | 'cancelled' | 'paid' | 'pending' | 'failed' | 'refunded' | 'disputed' | 'needs_review';
  local_status?: 'pending' | 'paid' | 'failed' | 'refunded' | 'disputed' | 'cancelled' | 'needs_review';
  stripe_status?: string;
  webhook_status?: string;
  webhook_received_at?: string;
  access_unlocked?: boolean;
  /** Access granted intentionally by an administrator before Stripe confirms payment. */
  manual_access_override?: boolean;
  access_revoked?: boolean;
  access_expires_at?: string | null;
  purchase_origin?: 'public_checkout' | 'admin_manual' | 'coupon_100' | 'gift';
  coupon_code?: string;
  coupon_snapshot?: {
    code?: string;
    discount_type?: 'percent' | 'fixed';
    discount_value?: number;
    is_free_access?: boolean;
  } | null;
  refunded_amount?: number;
  refunded_at?: string | null;
  refund_status?: string;
  refund_type?: 'full' | 'partial' | null;
  access_revoked_at?: string | null;
  access_revocation_reason?: string;
  is_disputed?: boolean;
  verified_by_admin?: boolean;
  access_type?: 'lifetime';
  course_title?: string;
  user_email?: string;
  user_name?: string;
  customer_email?: string;
  created_at?: string;
  updated_at?: string;
  email_corrected_at?: string;
  email_corrected_by?: string;
  email_correction_history?: Array<{
    from_email: string;
    to_email: string;
    corrected_at: string;
    corrected_by: string;
    reason?: string;
  }>;
}

export type Purchase = PurchaseRecord;

export interface AccessGrantState {
  global_access: boolean;
  accessible_courses: Array<{
    course_id: string;
    title: string;
  }>;
}

export interface Subscription {
  purchase: PurchaseRecord | null;
  course: {
    course_id: string;
    title: string;
  } | null;
  accessible_courses?: Array<{
    course_id: string;
    title: string;
  }>;
  days_remaining: number | null;
  is_active: boolean;
  global_access?: boolean;
}

export interface AuthUser {
  userId: string;
  email: string;
  fullName: string;
  isAdmin: boolean;
  subscriptionStatus: string;
  subscriptionEndDate: string;
  total_watch_time: number;
}

export interface StudentListItem {
  user_id: string;
  email: string;
  full_name: string;
  subscription_status: string;
  subscription_end_date: string;
  total_watch_time: number;
  last_login: string;
  purchase_date: string;
  completion_percentage: number;
  global_access: boolean;
  accessible_courses_count: number;
  purchased_courses_count: number;
}

export interface StudentDetail {
  student: StudentListItem;
  purchases: PurchaseRecord[];
  accessible_courses: Array<{
    course_id: string;
    title: string;
  }>;
  progress_by_course: Array<{
    course_id: string;
    title: string;
    has_access: boolean;
    completed_lessons: number;
    total_lessons: number;
    percentage: number;
    last_watched: string;
  }>;
}

export interface AdminAccount {
  email: string;
  username: string;
  full_name: string;
  enabled: boolean;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface PurchaseDetail {
  purchase: PurchaseRecord;
  customer_view?: {
    account_ready: boolean;
    course_access_active: boolean;
    course_access_reason: 'active' | 'account_provisioning' | 'payment_or_access_not_active';
    student_id?: string | null;
  };
  timeline: Array<{
    label: string;
    at: string;
  }>;
}

export interface Coupon {
  coupon_id: string;
  code: string;
  course_scope: string[];
  discount_type: 'percent' | 'fixed';
  discount_value: number;
  starts_at?: string | null;
  expires_at?: string | null;
  max_redemptions?: number | null;
  current_redemptions: number;
  allowed_user_emails: string[];
  is_active: boolean;
  is_free_access: boolean;
  created_at: string;
  updated_at: string;
}
