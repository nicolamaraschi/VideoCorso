import React, { useState } from 'react';
import { Edit, ExternalLink, Search, Key, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { StudentListItem } from '../../types';
import { formatDate, getSubscriptionStatusColor } from '../../utils/formatters';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';

interface StudentTableProps {
  students: StudentListItem[];
  onUpdateStudent: (studentId: string, data: { subscription_end_date?: string; global_access?: boolean }) => Promise<void>;
  onResetPassword: (studentId: string) => Promise<void>;
  onDeleteStudent: (studentId: string) => Promise<void>;
}

export const StudentTable: React.FC<StudentTableProps> = ({ students, onUpdateStudent, onResetPassword, onDeleteStudent }) => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [editingStudent, setEditingStudent] = useState<StudentListItem | null>(null);
  const [globalAccess, setGlobalAccess] = useState(false);
  const [newEndDate, setNewEndDate] = useState('');

  const filteredStudents = students.filter((student) => {
    const value = searchTerm.toLowerCase();
    return (
      student.email.toLowerCase().includes(value) ||
      student.full_name.toLowerCase().includes(value)
    );
  });

  const handleEditClick = (student: StudentListItem) => {
    setEditingStudent(student);
    setGlobalAccess(student.global_access);
    setNewEndDate(student.subscription_end_date ? student.subscription_end_date.split('T')[0] : '');
  };

  const handleSave = async () => {
    if (!editingStudent) {
      return;
    }

    await onUpdateStudent(editingStudent.user_id, {
      global_access: globalAccess,
      subscription_end_date: newEndDate ? new Date(newEndDate).toISOString() : undefined,
    });
    setEditingStudent(null);
  };

  return (
    <div>
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search students by name or email..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Accesso</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Corsi</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Progress</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredStudents.map((student) => (
                <tr key={student.user_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div>
                      <div className="font-medium text-gray-900">{student.full_name}</div>
                      <div className="text-sm text-gray-500">{student.email}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getSubscriptionStatusColor(student.subscription_status)}`}>
                      {student.subscription_status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {student.global_access ? 'Globale' : 'Per acquisto'}
                    {student.subscription_end_date && (
                      <div className="text-xs text-gray-500 mt-1">{formatDate(student.subscription_end_date)}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    <div>{student.accessible_courses_count} sbloccati</div>
                    <div className="text-xs text-gray-500">{student.purchased_courses_count} acquistati</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <div className="w-24 h-2 bg-gray-200 rounded-full">
                          <div className="h-full bg-primary-600 rounded-full" style={{ width: `${student.completion_percentage}%` }} />
                        </div>
                      </div>
                      <span className="text-sm text-gray-600">{student.completion_percentage.toFixed(0)}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 flex-wrap">
                      <button
                        onClick={() => navigate(`/admin/students/${student.user_id}`)}
                        className="flex items-center px-2 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                        Dettaglio
                      </button>
                      <button
                        onClick={() => handleEditClick(student)}
                        className="flex items-center px-2 py-1.5 text-xs font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-md transition-colors"
                      >
                        <Edit className="w-3.5 h-3.5 mr-1.5" />
                        Modifica
                      </button>
                      <button
                        onClick={() => void onResetPassword(student.user_id)}
                        className="flex items-center px-2 py-1.5 text-xs font-medium text-orange-700 bg-orange-50 hover:bg-orange-100 rounded-md transition-colors"
                        title="Re-invia invito o resetta password"
                      >
                        <Key className="w-3.5 h-3.5 mr-1.5" />
                        Reset Pwd
                      </button>
                      <button
                        onClick={() => void onDeleteStudent(student.user_id)}
                        className="flex items-center px-2 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-md transition-colors"
                        title="Elimina Studente"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredStudents.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No students found</p>
            </div>
          )}
        </div>
      </div>

      <Modal isOpen={!!editingStudent} onClose={() => setEditingStudent(null)} title="Edit student access">
        {editingStudent && (
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600">Student</p>
              <p className="font-medium text-gray-900">{editingStudent.full_name}</p>
              <p className="text-sm text-gray-500">{editingStudent.email}</p>
            </div>

            <label className="flex items-center gap-3 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={globalAccess}
                onChange={(event) => setGlobalAccess(event.target.checked)}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              Accesso globale all'account
            </label>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Data fine accesso legacy</label>
              <input
                type="date"
                value={newEndDate}
                onChange={(event) => setNewEndDate(event.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            <div className="flex gap-3">
              <Button onClick={() => void handleSave()} variant="primary" fullWidth>
                Save changes
              </Button>
              <Button onClick={() => setEditingStudent(null)} variant="secondary" fullWidth>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
