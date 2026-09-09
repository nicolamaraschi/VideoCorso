import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Save, 
  Eye, 
  Clock, 
  MousePointerClick, 
  FileText, 
  RotateCcw, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';
import { OfferCountdownBar } from '../components/common/OfferCountdownBar';
import { 
  offerBarService, 
  type OfferBarConfig, 
  DEFAULT_OFFER_BAR_CONFIG 
} from '../services/offerBarService';

export const AdminBannerPage: React.FC = () => {
  const [config, setConfig] = useState<OfferBarConfig>(offerBarService.getLocalConfig());
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Load latest configuration from backend
  useEffect(() => {
    void offerBarService.fetchRemoteConfig().then((latest) => {
      setConfig(latest);
    });
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    setSaveError(null);

    try {
      await offerBarService.saveConfig(config);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Errore durante il salvataggio della configurazione.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDefaults = () => {
    if (window.confirm('Vuoi ripristinare le impostazioni predefinite del banner?')) {
      setConfig({ ...DEFAULT_OFFER_BAR_CONFIG, enabled: config.enabled });
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Intestazione */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-amber-50 rounded-xl text-amber-600 border border-amber-200">
              <Sparkles className="w-5 h-5" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-primary-700">
              Marketing & Conversioni
            </span>
          </div>
          <h1 className="mt-2 text-2xl sm:text-3xl font-bold text-gray-900">
            Banner Promozionale & Offerte
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Attiva o disattiva la barra promozionale in cima al sito e personalizza testi, conto alla rovescia e destinazione del bottone.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold tracking-wide uppercase ${
              config.enabled
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-gray-100 text-gray-600 border border-gray-200'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                config.enabled ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'
              }`}
            />
            {config.enabled ? 'Attivo sul sito' : 'Disattivato'}
          </span>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-950 text-white font-semibold text-sm hover:bg-primary-900 transition-all shadow-sm hover:shadow active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Salvataggio...' : 'Salva Modifiche'}</span>
          </button>
        </div>
      </header>

      {/* Messaggi di feedback */}
      {saveSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-3 animate-in fade-in duration-200">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <div className="text-sm font-medium">
            Configurazione del banner salvata con successo! Le modifiche sono ora attive.
          </div>
        </div>
      )}

      {saveError && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <div className="text-sm font-medium">{saveError}</div>
        </div>
      )}

      {/* 1. ANTEPRIMA DAL VIVO (LIVE PREVIEW) */}
      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/70">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-primary-700" />
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
              Anteprima dal vivo in tempo reale
            </h2>
          </div>
          <span className="text-xs text-gray-500 italic">
            {config.enabled ? '🟢 Questo è esattamente ciò che vedranno gli utenti' : '⚪ Il banner è attualmente disattivato (anteprima di prova)'}
          </span>
        </div>

        <div className="p-6 bg-[#0f0508] border-y border-[#381b21]">
          {/* Componente vero e proprio in modalità previewConfig */}
          <div className="rounded-xl overflow-hidden shadow-2xl border border-[#E5C378]/20">
            <OfferCountdownBar previewConfig={config} />
          </div>
        </div>
      </section>

      {/* 2. INTERRUTTORE STATO (ON / OFF) */}
      <section className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-gray-900">
              Stato di Visualizzazione sul Sito
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Quando è attivato, il banner apparirà in alto fisso su tutte le pagine pubbliche. Quando è disattivato, nessuno lo vedrà.
            </p>
          </div>

          <label className="relative inline-flex items-center cursor-pointer select-none">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-14 h-8 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-emerald-600 shadow-inner"></div>
            <span className="ml-3 text-sm font-bold text-gray-900">
              {config.enabled ? 'Attivo' : 'Disattivato'}
            </span>
          </label>
        </div>
      </section>

      {/* 3. TESTI & CONTENUTI */}
      <section className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-6">
        <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
          <FileText className="w-4 h-4 text-primary-700" />
          <h3 className="text-base font-bold text-gray-900">
            Testi del Banner
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Badge Text */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">
              Testo Badge Superiore
            </label>
            <input
              type="text"
              value={config.badgeText}
              onChange={(e) => setConfig({ ...config, badgeText: e.target.value })}
              placeholder="es. OFFERTA LANCIO, PROMO FLASH"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
            />
            <p className="mt-1 text-xs text-gray-500">
              La targhetta dorata con icona a scintilla in evidenza a sinistra.
            </p>
          </div>

          {/* Scarcity Text */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                Messaggio di Scarsità Posti
              </label>
              <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.showScarcity}
                  onChange={(e) => setConfig({ ...config, showScarcity: e.target.checked })}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span>Mostra scarsità</span>
              </label>
            </div>
            <input
              type="text"
              value={config.scarcityText}
              onChange={(e) => setConfig({ ...config, scarcityText: e.target.value })}
              disabled={!config.showScarcity}
              placeholder="es. Solo 3 posti disponibili a questo prezzo"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm disabled:bg-gray-50 disabled:text-gray-400"
            />
            <p className="mt-1 text-xs text-gray-500">
              Testo con pallino verde pulsante per creare urgenza psicologica.
            </p>
          </div>

        </div>

        {/* Headline Offerta */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">
            Testo Principale dell'Offerta
          </label>
          <input
            type="text"
            value={config.headline}
            onChange={(e) => setConfig({ ...config, headline: e.target.value })}
            placeholder="es. Sconto -50% sul Percorso con Kit Professionale e Attestato Ufficiale"
            className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
          />
          <p className="mt-1 text-xs text-gray-500">
            La frase principale descrittiva al centro della barra promozionale.
          </p>
        </div>
      </section>

      {/* 4. CONTO ALLA ROVESCIA & TIMER */}
      <section className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary-700" />
            <h3 className="text-base font-bold text-gray-900">
              Conto alla Rovescia (Timer)
            </h3>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 font-semibold cursor-pointer">
            <input
              type="checkbox"
              checked={config.showTimer}
              onChange={(e) => setConfig({ ...config, showTimer: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span>Attiva Timer</span>
          </label>
        </div>

        {config.showTimer ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">
                Durata Conto alla Rovescia (Ore)
              </label>
              <input
                type="number"
                min="1"
                max="72"
                value={config.timerHours}
                onChange={(e) => setConfig({ ...config, timerHours: Math.max(1, parseInt(e.target.value) || 1) })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
              />
              <p className="mt-1 text-xs text-gray-500">
                Il timer ticchetta in tempo reale e si memorizza nel browser dell'utente, continuando realisticamente da dove era arrivato.
              </p>
            </div>
            <div className="p-4 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs text-amber-900 leading-relaxed flex flex-col justify-center">
              <span className="font-bold mb-1">💡 Come funziona la persistenza del timer:</span>
              Quando una cliente apre il sito per la prima volta, parte il timer impostato (es. {config.timerHours} ore). Se ricarica la pagina o torna più tardi, il timer non si resetta ma prosegue verso la scadenza per massimizzare la conversione d'acquisto!
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500 italic">
            Il conto alla rovescia è attualmente disattivato: la barra mostrerà solo il testo dell'offerta e il pulsante d'azione.
          </p>
        )}
      </section>

      {/* 5. PULSANTE D'AZIONE (CTA) */}
      <section className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-6">
        <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
          <MousePointerClick className="w-4 h-4 text-primary-700" />
          <h3 className="text-base font-bold text-gray-900">
            Pulsante d'Azione (Call to Action)
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Testo Bottone */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">
              Testo del Bottone Dorato
            </label>
            <input
              type="text"
              value={config.ctaText}
              onChange={(e) => setConfig({ ...config, ctaText: e.target.value })}
              placeholder="es. Blocca Offerta, Iscriviti Subito"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
            />
          </div>

          {/* Azione al click */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">
              Azione al Click
            </label>
            <select
              value={config.ctaAction}
              onChange={(e) => setConfig({ ...config, ctaAction: e.target.value as OfferBarConfig['ctaAction'] })}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm bg-white"
            >
              <option value="scroll_pricing">Scorri alla sezione Prezzi e Pacchetti (#corso)</option>
              <option value="checkout">Vai diretto alla pagina di Checkout (/checkout)</option>
              <option value="custom_url">Apri un link personalizzato (es. WhatsApp, Instagram)</option>
            </select>
          </div>
        </div>

        {/* Link personalizzato opzionale */}
        {config.ctaAction === 'custom_url' && (
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">
              URL del Link Personalizzato
            </label>
            <input
              type="url"
              value={config.ctaCustomUrl || ''}
              onChange={(e) => setConfig({ ...config, ctaCustomUrl: e.target.value })}
              placeholder="https://wa.me/393... oppure https://..."
              className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm bg-white"
            />
          </div>
        )}
      </section>

      {/* BARRA INFERIORE SALVATAGGIO */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-gray-200">
        <button
          type="button"
          onClick={handleResetDefaults}
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Ripristina Testi Predefiniti</span>
        </button>

        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3 rounded-xl bg-gradient-to-r from-[#E5C378] via-[#edd293] to-[#E5C378] hover:from-[#f0d89c] hover:to-[#dfbb6a] text-[#1a0a0e] font-extrabold text-sm shadow-md hover:shadow-lg hover:scale-105 active:scale-95 transition-all duration-200 disabled:opacity-50 cursor-pointer"
        >
          <Save className="w-4 h-4 text-[#1a0a0e]" />
          <span>{isSaving ? 'Salvataggio in corso...' : 'Salva Tutte le Modifiche'}</span>
        </button>
      </div>

    </div>
  );
};

export default AdminBannerPage;
