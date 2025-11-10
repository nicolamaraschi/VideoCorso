import React, { useState } from 'react';
import { Search, Edit, Calendar } from 'lucide-react';
import type { StudentListItem } from '../../types';
import { formatDate, getDaysRemaining, getSubscriptionStatusColor } from '../../utils/formatters';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';

interface StudentTableProps {
  students: StudentListItem[];
  onUpdateStudent: (studentId: string, data: { subscription_end_date?: string }) => void;
}

export const StudentTable: React.FC<StudentTableProps> = ({
  students,
  onUpdateStudent,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingStudent, setEditingStudent] = useState<StudentListItem | null>(null);
  const [newEndDate, setNewEndDate] = useState('');

  const filteredStudents = students.filter(
    (student) =>
      student.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.full_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEditClick = (student: StudentListItem) => {
    setEditingStudent(student);
    setNewEndDate(student.subscription_end_date.split('T')[0]);
  };

  const handleSave = () => {
    if (editingStudent && newEndDate) {
      onUpdateStudent(editingStudent.user_id, {
        subscription_end_date: new Date(newEndDate).toISOString(),
      });
      setEditingStudent(null);
    }
  };

  return (
    <div>
      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search students by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Student
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Expiration
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Progress
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Purchase Date
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredStudents.map((student) => {
                const daysRemaining = getDaysRemaining(student.subscription_end_date);
                const isExpiringSoon = daysRemaining <= 7 && daysRemaining > 0;

                return (
                  <tr key={student.user_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-medium text-gray-900">
                          {student.full_name}
                        </div>
                        <div className="text-sm text-gray-500">{student.email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getSubscriptionStatusColor(
                          student.subscription_status
                        )}`}
                      >
                        {student.subscription_status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm text-gray-900">
                          {formatDate(student.subscription_end_date)}
                        </div>
                        {isExpiringSoon && (
                          <div className="text-xs text-orange-600 font-medium">
                            Expires in {daysRemaining} days
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <div className="w-24 h-2 bg-gray-200 rounded-full">
                            <div
                              className="h-full bg-primary-600 rounded-full"
                              style={{
                                width: `${student.completion_percentage}%`,
                              }}
                            />
                          </div>
                        </div>
                        <span className="text-sm text-gray-600">
                          {student.completion_percentage.toFixed(0)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {formatDate(student.purchase_date)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleEditClick(student)}
                        className="text-primary-600 hover:text-primary-800"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredStudents.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No students found</p>
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      <Modal
        isOpen={!!editingStudent}
        onClose={() => setEditingStudent(null)}
        title="Edit Student Subscription"
      >
        {editingStudent && (
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600">Student</p>
              <p className="font-medium text-gray-900">{editingStudent.full_name}</p>
              <p className="text-sm text-gray-500">{editingStudent.email}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Subscription End Date
              </label>
              <input
                type="date"
                value={newEndDate}
                onChange={(e) => setNewEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            <div className="flex gap-3">
              <Button onClick={handleSave} variant="primary" fullWidth>
                Save Changes
              </Button>
              <Button
                onClick={() => setEditingStudent(null)}
                variant="secondary"
                fullWidth
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
