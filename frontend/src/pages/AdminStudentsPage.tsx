import React, { useState, useEffect } from 'react';
import { StudentTable } from '../components/admin/StudentTable';
import { adminService } from '../services/adminService';
import type { StudentListItem } from '../types';
import { Loading } from '../components/common/Loading';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { Plus, Save } from 'lucide-react';
import { getErrorMessage } from '../utils/errors';
import { useAdminOperationBanner } from '../components/common/AdminOperationBanner';

export const AdminStudentsPage: React.FC = () => {
  const { showSuccess, showError } = useAdminOperationBanner();
  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newStudentForm, setNewStudentForm] = useState({ email: '', full_name: '' });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadStudents();
  }, []);

  const loadStudents = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await adminService.getStudents();
      setStudents(response.items);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load students'));
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStudent = async (
    studentId: string,
    data: { subscription_end_date?: string; global_access?: boolean }
  ): Promise<void> => {
    try {
      await adminService.updateStudent(studentId, data);
      showSuccess('Studente aggiornato', 'Le modifiche all’accesso dello studente sono state salvate.');
      await loadStudents();
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
      await loadStudents(); // Ricarica la lista
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
      await loadStudents();
    } catch (err) {
      showError('Studente non eliminato', getErrorMessage(err, 'L’account studente è rimasto invariato.'));
    }
  };


  if (loading) {
    return <Loading fullScreen text="Loading students..." />;
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <ErrorMessage
          variant="card"
          message={error}
          onRetry={loadStudents}
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

      <StudentTable students={students} onUpdateStudent={handleUpdateStudent} onResetPassword={handleResetPassword} onDeleteStudent={handleDeleteStudent} />

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
