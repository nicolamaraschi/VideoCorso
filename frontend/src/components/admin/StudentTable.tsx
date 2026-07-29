import React, { useState } from 'react';
import { Edit, MoreHorizontal, Search, Key, Trash2 } from 'lucide-react';
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
  const [actionMenuStudentId, setActionMenuStudentId] = useState<string | null>(null);

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

      {/* Mobile card list */}
      <div className="space-y-3 sm:hidden">
        {filteredStudents.map((student) => (
          <div key={student.user_id} className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => navigate(`/admin/students/${student.user_id}`)}
                  className="font-medium text-gray-900 hover:text-primary-700 hover:underline text-left break-words"
                  title="Apri scheda studente"
                >
                  {student.full_name}
                </button>
                <div className="text-sm text-gray-500 break-all">{student.email}</div>
              </div>
              <span className={`inline-flex flex-shrink-0 px-2 py-1 text-xs font-semibold rounded-full ${getSubscriptionStatusColor(student.subscription_status)}`}>
                {student.subscription_status}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Accesso</div>
                <div className="text-gray-700">{student.global_access ? 'Globale' : 'Per acquisto'}</div>
                {student.subscription_end_date && (
                  <div className="text-xs text-gray-500 mt-0.5">{formatDate(student.subscription_end_date)}</div>
                )}
              </div>
              <div>
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Corsi</div>
                <div className="text-gray-700">{student.accessible_courses_count} sbloccati</div>
                <div className="text-xs text-gray-500">{student.purchased_courses_count} acquistati</div>
              </div>
            </div>

            <div className="mt-3">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Progress</div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-gray-200 rounded-full">
                  <div className="h-full bg-primary-600 rounded-full" style={{ width: `${student.completion_percentage}%` }} />
                </div>
                <span className="text-sm text-gray-600">{student.completion_percentage.toFixed(0)}%</span>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <button
                onClick={() => handleEditClick(student)}
                className="flex flex-1 items-center justify-center px-3 py-2 text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md transition-colors"
              >
                <Edit className="w-3.5 h-3.5 mr-1.5" />
                Modifica
              </button>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setActionMenuStudentId((current) => current === student.user_id ? null : student.user_id)}
                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-md transition-colors border border-gray-200"
                  aria-label={`Altre azioni per ${student.full_name}`}
                  aria-expanded={actionMenuStudentId === student.user_id}
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
                {actionMenuStudentId === student.user_id && (
                  <div className="absolute right-0 z-20 mt-2 w-52 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                    <button
                      type="button"
                      onClick={() => {
                        setActionMenuStudentId(null);
                        void onResetPassword(student.user_id);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <Key className="w-4 h-4 text-orange-600" />
                      Invia nuova password
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActionMenuStudentId(null);
                        void onDeleteStudent(student.user_id);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                      Elimina studente
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {filteredStudents.length === 0 && (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <p className="text-gray-500">No students found</p>
          </div>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block bg-white rounded-lg border border-gray-200 overflow-visible">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Accesso</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Corsi</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Progress</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Gestisci</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredStudents.map((student) => (
                <tr key={student.user_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div>
                      <button
                        type="button"
                        onClick={() => navigate(`/admin/students/${student.user_id}`)}
                        className="font-medium text-gray-900 hover:text-primary-700 hover:underline text-left"
                        title="Apri scheda studente"
                      >
                        {student.full_name}
                      </button>
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
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleEditClick(student)}
                        className="flex items-center px-3 py-1.5 text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md transition-colors"
                      >
                        <Edit className="w-3.5 h-3.5 mr-1.5" />
                        Modifica
                      </button>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setActionMenuStudentId((current) => current === student.user_id ? null : student.user_id)}
                          className="p-2 text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                          aria-label={`Altre azioni per ${student.full_name}`}
                          aria-expanded={actionMenuStudentId === student.user_id}
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                        {actionMenuStudentId === student.user_id && (
                          <div className="absolute right-0 z-20 mt-2 w-52 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                            <button
                              type="button"
                              onClick={() => {
                                setActionMenuStudentId(null);
                                void onResetPassword(student.user_id);
                              }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                            >
                              <Key className="w-4 h-4 text-orange-600" />
                              Invia nuova password
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setActionMenuStudentId(null);
                                void onDeleteStudent(student.user_id);
                              }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                              Elimina studente
                            </button>
                          </div>
                        )}
                      </div>
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

      <Modal isOpen={!!editingStudent} onClose={() => setEditingStudent(null)} title="Modifica accesso studente">
        {editingStudent && (
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600">Studente</p>
              <p className="font-medium text-gray-900">{editingStudent.full_name}</p>
              <p className="text-sm text-gray-500">{editingStudent.email}</p>
            </div>

            <div className="rounded-lg border border-gray-200 p-4">
              <label className="flex items-center gap-3 text-sm font-medium text-gray-900">
                <input
                  type="checkbox"
                  checked={globalAccess}
                  onChange={(event) => setGlobalAccess(event.target.checked)}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                Accesso globale a tutti i corsi
              </label>
              <p className="mt-2 text-xs text-gray-500">Lo studente potrà accedere a tutti i corsi, anche senza un acquisto specifico.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Scadenza accesso</label>
              <input
                type="date"
                value={newEndDate}
                onChange={(event) => setNewEndDate(event.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <p className="mt-1 text-xs text-gray-500">Lascia vuoto se l’accesso non deve scadere.</p>
            </div>

            <div className="flex gap-3">
              <Button onClick={() => void handleSave()} variant="primary" fullWidth>
                Salva modifiche
              </Button>
              <Button onClick={() => setEditingStudent(null)} variant="secondary" fullWidth>
                Annulla
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
