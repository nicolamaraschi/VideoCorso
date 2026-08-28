import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StudentTable } from '../components/admin/StudentTable';
import { adminService } from '../services/adminService';
import type { StudentListItem } from '../types';
import { Loading } from '../components/common/Loading';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { Plus, Save, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { getErrorMessage } from '../utils/errors';
import { useAdminOperationBanner } from '../components/common/AdminOperationBanner';

const PER_PAGE = 50;
const SEARCH_DEBOUNCE_MS = 400;

export const AdminStudentsPage: React.FC = () => {
  const { showSuccess, showError } = useAdminOperationBanner();
  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalStudents, setTotalStudents] = useState(0);

  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newStudentForm, setNewStudentForm] = useState({ email: '', full_name: '' });
  const [isSaving, setIsSaving] = useState(false);

  // Debounce the search box so we don't fire an API request on every
  // keystroke; searching resets pagination since results aren't paginated
  // server-side (search returns up to 25 direct matches).
  useEffect(() => {
    const handle = setTimeout(() => {
      setSearchQuery(searchInput.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [searchInput]);

  const requestIdRef = useRef(0);

  const loadStudents = useCallback(async (targetPage: number) => {
    const requestId = ++requestIdRef.current;
    try {
      setLoading(true);
      setError(null);
      const response = await adminService.getStudents(targetPage, PER_PAGE);
      if (requestId !== requestIdRef.current) return; // stale response, a newer request superseded it
      setStudents(response.items);
      setPage(response.page);
      setTotalPages(response.total_pages);
      setTotalStudents(response.total);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setError(getErrorMessage(err, 'Failed to load students'));
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, []);

  const runSearch = useCallback(async (query: string) => {
    const requestId = ++requestIdRef.current;
    try {
      setIsSearching(true);
      setError(null);
      const results = await adminService.searchStudents(query);
      if (requestId !== requestIdRef.current) return;
      setStudents(results);
      setTotalPages(1);
      setTotalStudents(results.length);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setError(getErrorMessage(err, 'Failed to search students'));
    } finally {
      if (requestId === requestIdRef.current) setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    if (searchQuery) {
      void runSearch(searchQuery);
    } else {
      void loadStudents(1);
    }
    // Re-run whenever the (debounced) search query changes; page changes are
    // handled separately below only while not searching.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  const goToPage = (targetPage: number) => {
    if (targetPage < 1 || targetPage > totalPages || searchQuery) return;
    void loadStudents(targetPage);
  };

  const reload = useCallback(() => {
    if (searchQuery) {
      return runSearch(searchQuery);
    }
    return loadStudents(page);
  }, [searchQuery, runSearch, loadStudents, page]);

  const handleUpdateStudent = async (
    studentId: string,
    data: { subscription_end_date?: string; global_access?: boolean }
  ): Promise<void> => {
    try {
      await adminService.updateStudent(studentId, data);
      showSuccess('Studente aggiornato', 'Le modifiche all’accesso dello studente sono state salvate.');
      await reload();
    } catch (err) {
      showError('Studente non aggiornato', getErrorMessage(err, 'Le modifiche allo studente non sono state salvate.'));
    }
  };

  const handleCreateStudent = async () => {
    if (!newStudentForm.email || !newStudentForm.full_name) {
      showError('Studente non creato', 'Email e nome completo sono obbligatori.');
      return;
    }
    
    try {
      setIsSaving(true);
      await adminService.createStudent(newStudentForm);
      showSuccess('Studente creato', `L’account di ${newStudentForm.email} è stato creato e l’invito è stato inviato.`);
      setShowCreateModal(false);
      setNewStudentForm({ email: '', full_name: '' });
      await reload(); // Ricarica la lista
    } catch (err) {
      showError('Studente non creato', getErrorMessage(err, 'L’account studente non è stato creato.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetPassword = async (studentId: string): Promise<void> => {
    if (!window.confirm('Inviare una nuova password temporanea a questo studente? La password attuale non funzionerà più.')) return;
    try {
      await adminService.resetPassword(studentId);
      showSuccess('Password reimpostata', 'La nuova password temporanea è stata inviata via email allo studente.');
    } catch (err) {
      showError('Password non reimpostata', getErrorMessage(err, 'La password precedente resta valida.'));
    }
  };

  const handleDeleteStudent = async (studentId: string): Promise<void> => {
    if (!window.confirm('Sei sicuro di voler eliminare definitivamente questo studente? Questa azione non può essere annullata.')) return;
    try {
      await adminService.deleteStudent(studentId);
      showSuccess('Studente eliminato', 'L’account studente è stato eliminato.');
      await reload();
    } catch (err) {
      showError('Studente non eliminato', getErrorMessage(err, 'L’account studente è rimasto invariato.'));
    }
  };


  if (loading && students.length === 0) {
    return <Loading fullScreen text="Loading students..." />;
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <ErrorMessage
          variant="card"
          message={error}
          onRetry={reload}
        />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4 md:mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Students</h1>
          <p className="text-gray-600">
            Manage paid students, global access and learning progress
          </p>
        </div>
        <Button 
          variant="primary" 
          onClick={() => {
            setNewStudentForm({ email: '', full_name: '' });
            setShowCreateModal(true);
          }}
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Student
        </Button>
      </div>

      <div className="mb-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Cerca studenti per nome o email..."
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            aria-label="Cerca studenti"
          />
        </div>
        {searchQuery && (
          <p className="mt-2 text-sm text-gray-500">
            {isSearching ? 'Ricerca in corso...' : `${totalStudents} risultati per "${searchQuery}" (max 25 mostrati)`}
          </p>
        )}
      </div>

      <StudentTable students={students} onUpdateStudent={handleUpdateStudent} onResetPassword={handleResetPassword} onDeleteStudent={handleDeleteStudent} />

      {!searchQuery && totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Pagina {page} di {totalPages} &middot; {totalStudents} studenti totali
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1 || loading}
              aria-label="Pagina precedente"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="secondary"
              onClick={() => goToPage(page + 1)}
              disabled={page >= totalPages || loading}
              aria-label="Pagina successiva"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New Student"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Full Name
            </label>
            <input
              type="text"
              value={newStudentForm.full_name}
              onChange={(e) =>
                setNewStudentForm({ ...newStudentForm, full_name: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <input
              type="email"
              value={newStudentForm.email}
              onChange={(e) =>
                setNewStudentForm({ ...newStudentForm, email: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              A welcome email with a temporary password will be sent to this address.
            </p>
          </div>
          <Button
            onClick={handleCreateStudent}
            variant="primary"
            fullWidth
            loading={isSaving}
          >
            <Save className="w-4 h-4 mr-2" />
            Create Student and Send Invite
          </Button>
        </div>
      </Modal>
    </div>
  );
};
