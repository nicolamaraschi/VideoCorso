import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Terminal,
  AlertTriangle,
  AlertCircle,
  Info,
  RefreshCw,
  Search,
  Copy,
  Check,
  X,
  User,
  Clock,
  Code2,
  SlidersHorizontal,
} from 'lucide-react';
import { adminService } from '../services/adminService';
import type { AuditLogEntry } from '../types';

export const AdminSystemLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [quickFilter, setQuickFilter] = useState<'ALL' | 'ERRORS' | 'WARNINGS' | 'PAYMENTS' | 'ADMIN'>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [autoRefresh, setAutoRefresh] = useState<boolean>(false);

  // Detail Modal / Drawer
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedReport, setCopiedReport] = useState<boolean>(false);

  const fetchLogs = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const response = await adminService.getAuditLogs({
        limit: 300,
      });
      setLogs(response.items || []);
    } catch (err: unknown) {
      console.error('Failed to fetch system audit logs:', err);
      setError('Impossibile caricare i log tecnici dal backend.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  // Auto-refresh timer
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      void fetchLogs(true);
    }, 15000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchLogs]);

  // Filter logs locally for instant responsiveness
  const filteredLogs = useMemo(() => {
    let result = logs;

    // Quick filter
    if (quickFilter === 'ERRORS') {
      result = result.filter(
        (l) => l.level === 'ERROR' || l.level === 'CRITICAL' || Boolean(l.error_message) || l.action.toLowerCase().includes('error')
      );
    } else if (quickFilter === 'WARNINGS') {
      result = result.filter((l) => l.level === 'WARNING');
    } else if (quickFilter === 'PAYMENTS') {
      result = result.filter(
        (l) =>
          l.target_type === 'purchase' ||
          l.action.toLowerCase().includes('purchase') ||
          l.action.toLowerCase().includes('refund') ||
          l.action.toLowerCase().includes('stripe') ||
          (l.source && l.source.toLowerCase().includes('payment'))
      );
    } else if (quickFilter === 'ADMIN') {
      result = result.filter(
        (l) =>
          l.actor !== 'system' &&
          l.actor !== 'stripe' &&
          !l.action.toLowerCase().includes('webhook')
      );
    }

    // Search term
    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      result = result.filter((l) => {
        const actionMatch = (l.action || '').toLowerCase().includes(term);
        const actorMatch = (l.actor || l.admin_email || '').toLowerCase().includes(term);
        const targetMatch = (l.target_id || '').toLowerCase().includes(term);
        const targetTypeMatch = (l.target_type || '').toLowerCase().includes(term);
        const errorMatch = (l.error_message || '').toLowerCase().includes(term);
        const auditIdMatch = (l.audit_id || '').toLowerCase().includes(term);
        const detailsMatch = JSON.stringify(l.details || {}).toLowerCase().includes(term);

        return actionMatch || actorMatch || targetMatch || targetTypeMatch || errorMatch || auditIdMatch || detailsMatch;
      });
    }

    return result;
  }, [logs, quickFilter, searchTerm]);

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (e) {
      console.error('Copy failed', e);
    }
  };

  const generateDiagnosticReport = (log: AuditLogEntry): string => {
    return [
      `=== REPORT DIAGNOSTICO BACKEND ===`,
      `Audit ID: ${log.audit_id}`,
      `Data/Ora: ${log.created_at}`,
      `Severità: ${log.level}`,
      `Componente: ${log.source || 'admin_handler'}`,
      `Azione: ${log.action}`,
      `Attore: ${log.actor || log.admin_email || 'system'}`,
      `Target Impattato: [${log.target_type || 'N/A'}] ${log.target_id || 'N/A'}`,
      log.error_message ? `Messaggio Errore: ${log.error_message}` : '',
      log.stack_trace ? `Stack Trace:\n${log.stack_trace}` : '',
      `Dettagli / Payload:\n${JSON.stringify(log.details || {}, null, 2)}`,
      `==================================`,
    ].filter(Boolean).join('\n');
  };

  const handleCopyFullReport = async (log: AuditLogEntry) => {
    const report = generateDiagnosticReport(log);
    try {
      await navigator.clipboard.writeText(report);
      setCopiedReport(true);
      setTimeout(() => setCopiedReport(false), 2500);
    } catch (e) {
      console.error('Copy report failed', e);
    }
  };

  const formatTimestamp = (isoString: string) => {
    if (!isoString) return '-';
    try {
      const date = new Date(isoString);
      return date.toLocaleString('it-IT', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  const getLevelBadge = (level: string) => {
    const lvl = (level || 'INFO').toUpperCase();
    switch (lvl) {
      case 'CRITICAL':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-red-100 text-red-800 border border-red-300">
            <AlertCircle className="w-3 h-3 text-red-600" />
            CRITICAL
          </span>
        );
      case 'ERROR':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
            <AlertCircle className="w-3 h-3 text-rose-600" />
            ERROR
          </span>
        );
      case 'WARNING':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            <AlertTriangle className="w-3 h-3 text-amber-600" />
            WARNING
          </span>
        );
      case 'INFO':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
            <Info className="w-3 h-3 text-slate-500" />
            INFO
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-900 text-white rounded-lg">
            <Terminal className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900">Console Log di Sistema</h1>
              <span className="bg-slate-100 text-slate-700 text-xs font-mono px-2 py-0.5 rounded font-semibold border border-slate-200">
                {filteredLogs.length} eventi
              </span>
            </div>
            <p className="text-xs text-gray-500">
              Tracciamento operativo delle chiamate backend, webhook Stripe, azioni amministrative e anomalie.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs font-medium text-gray-700 bg-slate-50 px-3 py-1.5 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-100">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span>Auto-refresh (15s)</span>
          </label>

          <button
            onClick={() => void fetchLogs()}
            disabled={loading || refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing || loading ? 'animate-spin' : ''}`} />
            <span>Ricarica</span>
          </button>
        </div>
      </div>

      {/* Search & Fast Filters */}
      <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm space-y-2.5">
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cerca subito per email corsista, ID acquisto (pi_...), tipo azione, ID target, testo errore o dettagli..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-sm font-mono border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-gray-100 text-xs">
          <span className="text-gray-400 font-medium mr-1 flex items-center gap-1">
            <SlidersHorizontal className="w-3 h-3" />
            Filtra:
          </span>

          <button
            onClick={() => setQuickFilter('ALL')}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
              quickFilter === 'ALL'
                ? 'bg-slate-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Tutti ({logs.length})
          </button>

          <button
            onClick={() => setQuickFilter('ERRORS')}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors flex items-center gap-1 ${
              quickFilter === 'ERRORS'
                ? 'bg-red-600 text-white'
                : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
            }`}
          >
            <AlertCircle className="w-3 h-3" />
            🔴 Solo Errori / Criticità
          </button>

          <button
            onClick={() => setQuickFilter('WARNINGS')}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors flex items-center gap-1 ${
              quickFilter === 'WARNINGS'
                ? 'bg-amber-600 text-white'
                : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
            }`}
          >
            <AlertTriangle className="w-3 h-3" />
            🟡 Warning
          </button>

          <button
            onClick={() => setQuickFilter('PAYMENTS')}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
              quickFilter === 'PAYMENTS'
                ? 'bg-emerald-700 text-white'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
            }`}
          >
            💳 Pagamenti & Stripe
          </button>

          <button
            onClick={() => setQuickFilter('ADMIN')}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
              quickFilter === 'ADMIN'
                ? 'bg-blue-700 text-white'
                : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
            }`}
          >
            👤 Azioni Admin
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => void fetchLogs()}
            className="text-xs font-bold text-red-800 underline hover:no-underline"
          >
            Riprova
          </button>
        </div>
      )}

      {/* Main Log Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading && !refreshing ? (
          <div className="py-16 text-center">
            <RefreshCw className="w-7 h-7 text-primary-600 animate-spin mx-auto mb-2" />
            <p className="text-xs text-gray-500 font-medium">Caricamento log tecnici da DynamoDB...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-16 text-center px-4">
            <Terminal className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-gray-800">Nessun log trovato</h3>
            <p className="text-xs text-gray-500 max-w-md mx-auto mt-1">
              Non ci sono eventi che corrispondono al filtro selezionato o al testo cercato.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-600 font-mono">
              <thead className="bg-slate-50 text-[11px] uppercase font-bold text-slate-500 border-b border-gray-200">
                <tr>
                  <th className="py-2.5 px-3">Livello</th>
                  <th className="py-2.5 px-3">Data / Ora</th>
                  <th className="py-2.5 px-3">Azione & Origine</th>
                  <th className="py-2.5 px-3">Attore (Chi)</th>
                  <th className="py-2.5 px-3">Target Impattato</th>
                  <th className="py-2.5 px-3">Dettagli / Errore</th>
                  <th className="py-2.5 px-3 text-right">Diagnostica</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredLogs.map((log) => {
                  const isError = log.level === 'ERROR' || log.level === 'CRITICAL';
                  const isWarning = log.level === 'WARNING';

                  return (
                    <tr
                      key={log.audit_id}
                      onClick={() => setSelectedLog(log)}
                      className={`hover:bg-slate-100/70 transition-colors cursor-pointer ${
                        isError ? 'bg-red-50/40' : isWarning ? 'bg-amber-50/30' : ''
                      }`}
                    >
                      {/* Level */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {getLevelBadge(log.level)}
                      </td>

                      {/* Timestamp */}
                      <td className="py-2.5 px-3 whitespace-nowrap text-gray-500 font-sans text-[11px]">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-gray-400" />
                          <span>{formatTimestamp(log.created_at)}</span>
                        </div>
                      </td>

                      {/* Action & Source */}
                      <td className="py-2.5 px-3">
                        <div className="space-y-0.5">
                          <span className="font-bold text-gray-900 bg-white px-1.5 py-0.5 rounded text-xs border border-gray-200">
                            {log.action}
                          </span>
                          <div className="text-[10px] text-gray-400 font-sans">
                            {log.source || 'admin_handler'}
                          </div>
                        </div>
                      </td>

                      {/* Actor */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1 text-gray-700 max-w-[170px] truncate" title={log.actor || log.admin_email}>
                          <User className="w-3 h-3 text-gray-400 flex-shrink-0" />
                          <span className="truncate">{log.actor || log.admin_email || 'system'}</span>
                        </div>
                      </td>

                      {/* Target */}
                      <td className="py-2.5 px-3">
                        {log.target_id ? (
                          <div className="space-y-0.5">
                            <span className="text-[10px] text-gray-400 uppercase font-sans">
                              {log.target_type || 'ID'}:
                            </span>
                            <div className="text-primary-700 font-semibold truncate max-w-[150px]" title={log.target_id}>
                              {log.target_id}
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>

                      {/* Summary message / details snippet */}
                      <td className="py-2.5 px-3 max-w-[280px]">
                        {log.error_message ? (
                          <span className="text-red-700 font-semibold line-clamp-2" title={log.error_message}>
                            {log.error_message}
                          </span>
                        ) : log.details && Object.keys(log.details).length > 0 ? (
                          <span className="text-gray-600 line-clamp-1 font-sans text-xs" title={JSON.stringify(log.details)}>
                            {JSON.stringify(log.details)}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>

                      {/* Diagnostic actions */}
                      <td className="py-2.5 px-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => void copyToClipboard(log.audit_id, log.audit_id)}
                            title="Copia ID Audit"
                            className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded transition-colors"
                          >
                            {copiedId === log.audit_id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button
                            onClick={() => setSelectedLog(log)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded transition-colors border border-slate-300"
                          >
                            <Code2 className="w-3 h-3" />
                            <span>Ispeziona</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Drawer / Detail Modal for deep JSON & Stacktrace Inspection */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 border-b border-gray-200 bg-slate-50 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  {getLevelBadge(selectedLog.level)}
                  <span className="font-mono text-xs text-gray-700 font-bold bg-white px-2 py-0.5 rounded border border-gray-200">
                    {selectedLog.action}
                  </span>
                </div>
                <h2 className="text-base font-bold text-gray-900">Ispezione Diagnostica Evento</h2>
                <p className="text-xs font-mono text-gray-500">ID Audit: {selectedLog.audit_id}</p>
              </div>

              <button
                onClick={() => setSelectedLog(null)}
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs font-mono">
              {/* Metadata Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-gray-50 p-3 rounded-xl border border-gray-200">
                <div>
                  <span className="text-gray-500 font-sans font-medium">Timestamp:</span>
                  <div className="font-semibold text-gray-900 mt-0.5">{selectedLog.created_at}</div>
                </div>
                <div>
                  <span className="text-gray-500 font-sans font-medium">Attore (Chi ha agito):</span>
                  <div className="font-semibold text-gray-900 mt-0.5 truncate">{selectedLog.actor || selectedLog.admin_email || 'system'}</div>
                </div>
                <div>
                  <span className="text-gray-500 font-sans font-medium">Componente:</span>
                  <div className="font-semibold text-gray-900 mt-0.5">{selectedLog.source || 'admin_handler'}</div>
                </div>
                <div>
                  <span className="text-gray-500 font-sans font-medium">Tipo Target:</span>
                  <div className="font-semibold text-gray-900 mt-0.5">{selectedLog.target_type || 'N/A'}</div>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-500 font-sans font-medium">ID Target Impattato:</span>
                  <div className="font-semibold text-primary-700 mt-0.5 break-all">{selectedLog.target_id || 'N/A'}</div>
                </div>
              </div>

              {/* Error Message & Stack Trace if any */}
              {selectedLog.error_message && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1 font-sans font-bold text-red-700 uppercase tracking-wide">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Messaggio di Errore</span>
                  </div>
                  <div className="bg-red-950 text-red-200 p-3 rounded-lg overflow-x-auto border border-red-800 whitespace-pre-wrap">
                    {selectedLog.error_message}
                  </div>
                </div>
              )}

              {selectedLog.stack_trace && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1 font-sans font-bold text-gray-700 uppercase tracking-wide">
                    <Code2 className="w-3.5 h-3.5" />
                    <span>Stack Trace Backend</span>
                  </div>
                  <pre className="bg-slate-950 text-emerald-400 p-3 rounded-lg overflow-x-auto border border-slate-800 max-h-48 whitespace-pre-wrap">
                    {selectedLog.stack_trace}
                  </pre>
                </div>
              )}

              {/* JSON Payload Details */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between font-sans">
                  <div className="flex items-center gap-1 font-bold text-gray-700 uppercase tracking-wide">
                    <Code2 className="w-3.5 h-3.5" />
                    <span>Payload Dati & Parametri (JSON)</span>
                  </div>
                  <button
                    onClick={() => void copyToClipboard(JSON.stringify(selectedLog.details || {}, null, 2), 'payload')}
                    className="text-xs font-semibold text-primary-700 hover:text-primary-800 flex items-center gap-1"
                  >
                    {copiedId === 'payload' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>Copia JSON</span>
                  </button>
                </div>
                <pre className="bg-slate-900 text-slate-100 p-3.5 rounded-xl overflow-x-auto border border-slate-800 max-h-64 whitespace-pre-wrap">
                  {JSON.stringify(selectedLog.details || {}, null, 2)}
                </pre>
              </div>
            </div>

            {/* Modal Footer with One-Click Debug Report Export */}
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
              <span className="text-xs text-gray-500 font-sans">
                Esporta i dettagli tecnici in chat o ticket con 1 clic.
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedLog(null)}
                  className="px-3.5 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  Chiudi
                </button>
                <button
                  onClick={() => void handleCopyFullReport(selectedLog)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition-colors shadow-sm"
                >
                  {copiedReport ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Copiato negli Appunti!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copia Report per Assistenza</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSystemLogsPage;
