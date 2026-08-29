import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Terminal,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  RefreshCw,
  Search,
  Copy,
  Check,
  X,
  Filter,
  Layers,
  User,
  Clock,
  Code2,
} from 'lucide-react';
import { adminService } from '../services/adminService';
import type { AuditLogEntry } from '../types';

export const AdminSystemLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [levelFilter, setLevelFilter] = useState<string>('ALL');
  const [sourceFilter, setSourceFilter] = useState<string>('ALL');
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
        level: levelFilter !== 'ALL' ? levelFilter : undefined,
        source: sourceFilter !== 'ALL' ? sourceFilter : undefined,
        search: searchTerm.trim() || undefined,
        limit: 250,
      });
      setLogs(response.items || []);
    } catch (err: unknown) {
      console.error('Failed to fetch system audit logs:', err);
      setError('Impossibile caricare i log tecnici. Verifica la connessione o i permessi.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [levelFilter, sourceFilter, searchTerm]);

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

  // Stats calculation
  const stats = useMemo(() => {
    let criticalCount = 0;
    let errorCount = 0;
    let warningCount = 0;
    let infoCount = 0;

    for (const log of logs) {
      const lvl = (log.level || 'INFO').toUpperCase();
      if (lvl === 'CRITICAL') criticalCount++;
      else if (lvl === 'ERROR') errorCount++;
      else if (lvl === 'WARNING') warningCount++;
      else infoCount++;
    }

    return {
      total: logs.length,
      criticalCount,
      errorCount,
      warningCount,
      infoCount,
      issuesCount: criticalCount + errorCount,
    };
  }, [logs]);

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
      `=== REPORT DIAGNOSTICO INCIDENTE ===`,
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
      `====================================`,
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
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-300">
            <AlertCircle className="w-3.5 h-3.5 text-red-600" />
            CRITICAL
          </span>
        );
      case 'ERROR':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
            <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
            ERROR
          </span>
        );
      case 'WARNING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            WARNING
          </span>
        );
      case 'INFO':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
            <Info className="w-3.5 h-3.5 text-blue-500" />
            INFO
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-slate-900 text-white rounded-lg">
              <Terminal className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Pannello Tecnico & Log di Sistema</h1>
              <p className="text-sm text-gray-500">
                Console diagnostica per monitorare anomalie, errori di pagamento, azioni amministrative e stato operativo.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs font-medium text-gray-700 bg-white px-3 py-2 border border-gray-200 rounded-lg shadow-sm cursor-pointer hover:bg-gray-50">
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
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing || loading ? 'animate-spin text-primary-600' : ''}`} />
            <span>Aggiorna</span>
          </button>
        </div>
      </div>

      {/* KPI Status Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Log Totali Caricati</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</div>
          <div className="text-xs text-gray-400 mt-0.5">Storico eventi recenti</div>
        </div>

        <div className={`p-4 rounded-xl border shadow-sm ${stats.issuesCount > 0 ? 'bg-red-50/50 border-red-200' : 'bg-white border-gray-200'}`}>
          <div className="text-xs font-medium text-red-600 uppercase tracking-wider flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" />
            Errori / Criticità
          </div>
          <div className="text-2xl font-bold text-red-700 mt-1">{stats.issuesCount}</div>
          <div className="text-xs text-red-500 mt-0.5">Richiedono attenzione o debug</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div className="text-xs font-medium text-amber-600 uppercase tracking-wider flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            Warning
          </div>
          <div className="text-2xl font-bold text-amber-700 mt-1">{stats.warningCount}</div>
          <div className="text-xs text-gray-400 mt-0.5">Avvisi non bloccanti</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div className="text-xs font-medium text-blue-600 uppercase tracking-wider flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Operazioni & Audit Info
          </div>
          <div className="text-2xl font-bold text-blue-700 mt-1">{stats.infoCount}</div>
          <div className="text-xs text-gray-400 mt-0.5">Azioni admin & esecuzioni regolari</div>
        </div>
      </div>

      {/* Filters & Search Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cerca per email, ID acquisto (pi_...), tipo azione, ID target o testo errore..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
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

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-50 px-2 py-1.5 rounded-lg border border-gray-200">
              <Filter className="w-3.5 h-3.5 text-gray-400" />
              <span>Severità:</span>
              <select
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value)}
                className="bg-transparent text-xs font-semibold text-gray-800 border-none p-0 pr-4 focus:ring-0 cursor-pointer"
              >
                <option value="ALL">Tutte</option>
                <option value="ERROR_OR_CRITICAL">🔴 Solo Errori & Critici</option>
                <option value="WARNING">🟡 Warning</option>
                <option value="INFO">🔵 Info / Azioni</option>
              </select>
            </div>

            <div className="flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-50 px-2 py-1.5 rounded-lg border border-gray-200">
              <Layers className="w-3.5 h-3.5 text-gray-400" />
              <span>Fonte:</span>
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                className="bg-transparent text-xs font-semibold text-gray-800 border-none p-0 pr-4 focus:ring-0 cursor-pointer"
              >
                <option value="ALL">Tutte le Fonti</option>
                <option value="admin_handler">Admin Backoffice</option>
                <option value="payment">Stripe & Pagamenti</option>
                <option value="auth">Autenticazione</option>
                <option value="video">Video Streaming</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center justify-between">
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

      {/* Logs Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading && !refreshing ? (
          <div className="py-16 text-center">
            <RefreshCw className="w-8 h-8 text-primary-600 animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-500 font-medium">Caricamento log tecnici da DynamoDB...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="py-16 text-center px-4">
            <Terminal className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-gray-800">Nessun log trovato</h3>
            <p className="text-sm text-gray-500 max-w-md mx-auto mt-1">
              Non ci sono eventi che corrispondono ai filtri o al termine di ricerca impostato.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50/75 text-xs uppercase font-semibold text-gray-500 border-b border-gray-200">
                <tr>
                  <th className="py-3 px-4">Livello & Data</th>
                  <th className="py-3 px-4">Azione / Evento</th>
                  <th className="py-3 px-4">Attore (Chi)</th>
                  <th className="py-3 px-4">Target Impattato</th>
                  <th className="py-3 px-4">Dettagli / Messaggio</th>
                  <th className="py-3 px-4 text-right">Diagnostica</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-mono text-xs">
                {logs.map((log) => {
                  const isError = log.level === 'ERROR' || log.level === 'CRITICAL';
                  const isWarning = log.level === 'WARNING';

                  return (
                    <tr
                      key={log.audit_id}
                      onClick={() => setSelectedLog(log)}
                      className={`hover:bg-slate-50 transition-colors cursor-pointer ${
                        isError ? 'bg-red-50/30' : isWarning ? 'bg-amber-50/20' : ''
                      }`}
                    >
                      {/* Level & Timestamp */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="space-y-1">
                          <div>{getLevelBadge(log.level)}</div>
                          <div className="text-[11px] text-gray-500 font-sans flex items-center gap-1">
                            <Clock className="w-3 h-3 text-gray-400" />
                            {formatTimestamp(log.created_at)}
                          </div>
                        </div>
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4">
                        <div className="space-y-0.5">
                          <span className="font-bold text-gray-900 bg-gray-100 px-1.5 py-0.5 rounded text-xs border border-gray-200">
                            {log.action}
                          </span>
                          <div className="text-[11px] text-gray-400 font-sans">
                            Origine: {log.source || 'admin_handler'}
                          </div>
                        </div>
                      </td>

                      {/* Actor */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 text-gray-700 max-w-[180px] truncate" title={log.actor || log.admin_email}>
                          <User className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                          <span className="truncate">{log.actor || log.admin_email || 'system'}</span>
                        </div>
                      </td>

                      {/* Target */}
                      <td className="py-3 px-4">
                        {log.target_id ? (
                          <div className="space-y-0.5">
                            <span className="text-[11px] text-gray-400 uppercase font-sans">
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
                      <td className="py-3 px-4 max-w-[280px]">
                        {log.error_message ? (
                          <span className="text-red-700 font-medium line-clamp-2" title={log.error_message}>
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
                      <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => void copyToClipboard(log.audit_id, log.audit_id)}
                            title="Copia ID Audit"
                            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                          >
                            {copiedId === log.audit_id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button
                            onClick={() => setSelectedLog(log)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-md transition-colors"
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
            <div className="p-5 border-b border-gray-200 bg-slate-50 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  {getLevelBadge(selectedLog.level)}
                  <span className="font-mono text-xs text-gray-500 font-bold bg-white px-2 py-0.5 rounded border border-gray-200">
                    {selectedLog.action}
                  </span>
                </div>
                <h2 className="text-lg font-bold text-gray-900">Dettagli Evento & Ispezione Diagnostica</h2>
                <p className="text-xs font-mono text-gray-500 mt-0.5">ID Audit: {selectedLog.audit_id}</p>
              </div>

              <button
                onClick={() => setSelectedLog(null)}
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 text-sm">
              {/* Metadata Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-gray-50 p-4 rounded-xl border border-gray-200 text-xs">
                <div>
                  <span className="text-gray-500 font-medium">Timestamp:</span>
                  <div className="font-mono font-semibold text-gray-900 mt-0.5">{selectedLog.created_at}</div>
                </div>
                <div>
                  <span className="text-gray-500 font-medium">Attore (Chi ha agito):</span>
                  <div className="font-semibold text-gray-900 mt-0.5 truncate">{selectedLog.actor || selectedLog.admin_email || 'system'}</div>
                </div>
                <div>
                  <span className="text-gray-500 font-medium">Componente:</span>
                  <div className="font-semibold text-gray-900 mt-0.5">{selectedLog.source || 'admin_handler'}</div>
                </div>
                <div>
                  <span className="text-gray-500 font-medium">Tipo Target:</span>
                  <div className="font-semibold text-gray-900 mt-0.5">{selectedLog.target_type || 'N/A'}</div>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-500 font-medium">ID Target Impattato:</span>
                  <div className="font-mono font-semibold text-primary-700 mt-0.5 break-all">{selectedLog.target_id || 'N/A'}</div>
                </div>
              </div>

              {/* Error Message & Stack Trace if any */}
              {selectedLog.error_message && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-red-700 uppercase tracking-wide">
                    <AlertCircle className="w-4 h-4" />
                    <span>Messaggio di Errore Catturato</span>
                  </div>
                  <div className="bg-red-950 text-red-200 p-3 rounded-lg font-mono text-xs overflow-x-auto border border-red-800">
                    {selectedLog.error_message}
                  </div>
                </div>
              )}

              {selectedLog.stack_trace && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700 uppercase tracking-wide">
                    <Code2 className="w-4 h-4" />
                    <span>Stack Trace Backend (Python Lambda)</span>
                  </div>
                  <pre className="bg-slate-950 text-emerald-400 p-3 rounded-lg font-mono text-xs overflow-x-auto border border-slate-800 max-h-48 whitespace-pre-wrap">
                    {selectedLog.stack_trace}
                  </pre>
                </div>
              )}

              {/* JSON Payload Details */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700 uppercase tracking-wide">
                    <Code2 className="w-4 h-4" />
                    <span>Payload Dati & Parametri (JSON)</span>
                  </div>
                  <button
                    onClick={() => void copyToClipboard(JSON.stringify(selectedLog.details || {}, null, 2), 'payload')}
                    className="text-xs font-medium text-primary-700 hover:text-primary-800 flex items-center gap-1"
                  >
                    {copiedId === 'payload' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>Copia JSON</span>
                  </button>
                </div>
                <pre className="bg-slate-900 text-slate-100 p-4 rounded-xl font-mono text-xs overflow-x-auto border border-slate-800 max-h-64 whitespace-pre-wrap">
                  {JSON.stringify(selectedLog.details || {}, null, 2)}
                </pre>
              </div>
            </div>

            {/* Modal Footer with One-Click Debug Report Export */}
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
              <span className="text-xs text-gray-500">
                Usa il pulsante per esportare tutti i dettagli tecnici in chat o ticket di supporto.
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedLog(null)}
                  className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  Chiudi
                </button>
                <button
                  onClick={() => void handleCopyFullReport(selectedLog)}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition-colors shadow-sm"
                >
                  {copiedReport ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span>Copiato negli Appunti!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
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
