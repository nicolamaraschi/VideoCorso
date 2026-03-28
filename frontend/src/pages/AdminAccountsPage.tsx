import React, { useCallback, useEffect, useState } from 'react';
import { Mail, Pencil, Plus, Shield, Trash2 } from 'lucide-react';
import { adminService } from '../services/adminService';
import type { AdminAccount } from '../types';
import { Loading } from '../components/common/Loading';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { formatDate } from '../utils/formatters';
import { getErrorMessage } from '../utils/errors';

export const AdminAccountsPage: React.FC = () => {
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AdminAccount | null>(null);
  const [saving, setSaving] = useState(false);
  const [createForm, setCreateForm] = useState({ email: '', full_name: '' });
  const [editForm, setEditForm] = useState({ full_name: '', enabled: true });

  const loadAccounts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await adminService.getAdminAccounts();
      setAccounts(response);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load admin accounts'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  const handleCreate = async () => {
    if (!createForm.email || !createForm.full_name) {
      alert('Email e nome sono obbligatori.');
      return;
    }

    try {
      setSaving(true);
      await adminService.createAdminAccount(createForm);
      setShowCreateModal(false);
      setCreateForm({ email: '', full_name: '' });
      await loadAccounts();
    } catch (err) {
      alert(getErrorMessage(err, 'Failed to create admin account'));
    } finally {
      setSaving(false);
    }
  };

  const handleOpenEdit = (account: AdminAccount) => {
    setEditingAccount(account);
    setEditForm({
      full_name: account.full_name,
      enabled: account.enabled,
    });
  };

  const handleUpdate = async () => {
    if (!editingAccount) {
      return;
    }

    try {
      setSaving(true);
      await adminService.updateAdminAccount(editingAccount.email, editForm);
      setEditingAccount(null);
      await loadAccounts();
    } catch (err) {
      alert(getErrorMessage(err, 'Failed to update admin account'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (email: string) => {
    if (!confirm(`Eliminare l'account admin ${email}?`)) {
      return;
    }

    try {
      await adminService.deleteAdminAccount(email);
      await loadAccounts();
    } catch (err) {
      alert(getErrorMessage(err, 'Failed to delete admin account'));
    }
  };

  const handleResendInvite = async (email: string) => {
    try {
      await adminService.resendAdminInvite(email);
      alert('Invito admin reinviato con una nuova password temporanea.');
    } catch (err) {
      alert(getErrorMessage(err, 'Failed to resend admin invite'));
    }
  };

  if (loading) {
    return <Loading fullScreen text="Loading admin accounts..." />;
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <ErrorMessage variant="card" message={error} onRetry={loadAccounts} />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Accounts</h1>
          <p className="text-gray-600">CRUD separato per gli amministratori della piattaforma.</p>
        </div>
        <Button
          variant="primary"
          onClick={() => {
            setCreateForm({ email: '', full_name: '' });
            setShowCreateModal(true);
          }}
        >
          <Plus className="w-4 h-4 mr-2" />
          Nuovo Admin
        </Button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Admin</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stato</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Creato</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {accounts.map((account) => (
                <tr key={account.email} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary-50 flex items-center justify-center">
                        <Shield className="w-5 h-5 text-primary-700" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{account.full_name || account.email}</div>
                        <div className="text-sm text-gray-500">{account.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${account.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-700'}`}>
                      {account.enabled ? 'Attivo' : 'Disattivato'}
                    </span>
                    <div className="text-xs text-gray-500 mt-1">{account.status}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">{formatDate(account.created_at)}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => handleResendInvite(account.email)} className="p-2 text-gray-600 hover:text-primary-700">
                        <Mail className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleOpenEdit(account)} className="p-2 text-gray-600 hover:text-primary-700">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(account.email)} className="p-2 text-gray-600 hover:text-red-700">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {accounts.length === 0 && (
            <div className="text-center py-12 text-gray-500">Nessun admin configurato.</div>
          )}
        </div>
      </div>

      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Crea nuovo admin">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Nome completo</label>
            <input
              type="text"
              value={createForm.full_name}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, full_name: event.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
            <input
              type="email"
              value={createForm.email}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, email: event.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <Button onClick={handleCreate} variant="primary" fullWidth loading={saving}>
            Crea admin e invia credenziali
          </Button>
        </div>
      </Modal>

      <Modal isOpen={!!editingAccount} onClose={() => setEditingAccount(null)} title="Modifica admin">
        {editingAccount && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Nome completo</label>
              <input
                type="text"
                value={editForm.full_name}
                onChange={(event) => setEditForm((prev) => ({ ...prev, full_name: event.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <label className="flex items-center gap-3 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={editForm.enabled}
                onChange={(event) => setEditForm((prev) => ({ ...prev, enabled: event.target.checked }))}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              Account admin attivo
            </label>
            <Button onClick={handleUpdate} variant="primary" fullWidth loading={saving}>
              Salva modifiche
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
};
