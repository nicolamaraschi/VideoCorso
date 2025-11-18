import React, { useState, useEffect } from 'react';
import { StudentTable } from '../components/admin/StudentTable';
import { adminService } from '../services/adminService';
import type { StudentListItem } from '../types';
import { Loading } from '../components/common/Loading';
import { ErrorMessage } from '../components/common/ErrorMessage';
// FIX: Importa Button, Modal e Icone
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { Plus, Save } from 'lucide-react';

export const AdminStudentsPage: React.FC = () => {
  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // FIX: Stato per il modale di creazione
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
    } catch (err: any) {
      setError(err.message || 'Failed to load students');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStudent = async (
    studentId: string,
    data: { subscription_end_date?: string }
  ) => {
    try {
      await adminService.updateStudent(studentId, data);
      await loadStudents();
    } catch (err: any) {
      alert(err.message || 'Failed to update student');
    }
  };

  // FIX: Funzione per creare lo studente
  const handleCreateStudent = async () => {
    if (!newStudentForm.email || !newStudentForm.full_name) {
      alert('Email and Full Name are required.');
      return;
    }
    
    try {
      setIsSaving(true);
      await adminService.createStudent(newStudentForm);
      setShowCreateModal(false);
      setNewStudentForm({ email: '', full_name: '' });
      await loadStudents(); // Ricarica la lista
    } catch (err: any) {
      alert(err.message || 'Failed to create student');
    } finally {
      setIsSaving(false);
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
      {/* FIX: Modificato Header per includere il pulsante */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Students</h1>
          <p className="text-gray-600">
            Manage student subscriptions and monitor their progress
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

      <StudentTable students={students} onUpdateStudent={handleUpdateStudent} />

      {/* FIX: Modale per la creazione manuale */}
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