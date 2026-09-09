import { adminService } from './adminService';
import { courseService } from './courseService';

export interface OfferBarConfig {
  enabled: boolean;
  badgeText: string;
  headline: string;
  showScarcity: boolean;
  scarcityText: string;
  showTimer: boolean;
  timerHours: number;
  ctaText: string;
  ctaAction: 'scroll_pricing' | 'checkout' | 'custom_url';
  ctaCustomUrl?: string;
}

export const DEFAULT_OFFER_BAR_CONFIG: OfferBarConfig = {
  enabled: false, // Default is hidden
  badgeText: 'OFFERTA LANCIO',
  headline: 'Sconto -50% sul Percorso con Kit Professionale e Attestato Ufficiale',
  showScarcity: true,
  scarcityText: 'Solo 3 posti disponibili a questo prezzo',
  showTimer: true,
  timerHours: 5,
  ctaText: 'Blocca Offerta',
  ctaAction: 'scroll_pricing',
  ctaCustomUrl: '',
};

const LOCAL_STORAGE_KEY = 'cm_offer_bar_config_v1';
const CONFIG_EVENT_NAME = 'cm_offer_bar_config_changed';

// Prefix to detect embedded banner configuration inside course badge/metadata
const BANNER_BADGE_PREFIX = '__BANNER_CONFIG__:';

export const offerBarService = {
  /**
   * Reads the current active configuration.
   * Priority:
   * 1. Local storage (instant cache/admin local edits)
   * 2. Course metadata from public backend catalog
   * 3. Fallback to DEFAULT_OFFER_BAR_CONFIG (enabled: false)
   */
  getLocalConfig(): OfferBarConfig {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_OFFER_BAR_CONFIG, ...JSON.parse(stored) };
      }
    } catch {
      // Fallback
    }
    return DEFAULT_OFFER_BAR_CONFIG;
  },

  /**
   * Fetches latest configuration from the public catalog course metadata.
   */
  async fetchRemoteConfig(): Promise<OfferBarConfig> {
    try {
      const catalog = await courseService.getCatalog();
      if (catalog && catalog.length > 0) {
        const primaryCourse = catalog[0];
        if (primaryCourse.badge && primaryCourse.badge.startsWith(BANNER_BADGE_PREFIX)) {
          const jsonStr = primaryCourse.badge.replace(BANNER_BADGE_PREFIX, '');
          const parsed = JSON.parse(jsonStr);
          const merged: OfferBarConfig = { ...DEFAULT_OFFER_BAR_CONFIG, ...parsed };
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(merged));
          window.dispatchEvent(new CustomEvent(CONFIG_EVENT_NAME, { detail: merged }));
          return merged;
        }
      }
    } catch (err) {
      console.warn('Could not fetch remote banner config:', err);
    }
    return this.getLocalConfig();
  },

  /**
   * Saves new configuration.
   * Saves locally and, if admin is authenticated, syncs to the primary course in DynamoDB.
   */
  async saveConfig(config: OfferBarConfig): Promise<void> {
    // 1. Save locally
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(config));
    window.dispatchEvent(new CustomEvent(CONFIG_EVENT_NAME, { detail: config }));

    // 2. Sync to backend primary course if available
    try {
      const courses = await adminService.getCourses();
      if (courses && courses.length > 0) {
        const primaryCourse = courses[0];
        const badgePayload = `${BANNER_BADGE_PREFIX}${JSON.stringify(config)}`;
        await adminService.updateCourse(primaryCourse.course_id, {
          badge: badgePayload,
        });
      }
    } catch (err) {
      console.warn('Backend sync warning (saved locally only):', err);
    }
  },

  /**
   * Subscribe to config changes across components.
   */
  onConfigChange(callback: (config: OfferBarConfig) => void): () => void {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent<OfferBarConfig>;
      callback(customEvent.detail || this.getLocalConfig());
    };
    window.addEventListener(CONFIG_EVENT_NAME, handler);
    return () => window.removeEventListener(CONFIG_EVENT_NAME, handler);
  },
};
