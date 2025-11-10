import React, { useState, useEffect } from 'react';
import { StudentTable } from '../components/admin/StudentTable';
import { adminService } from '../services/adminService';
import type { StudentListItem } from '../types';
import { Loading } from '../components/common/Loading';
import { ErrorMessage } from '../components/common/ErrorMessage';

export const AdminStudentsPage: React.FC = () => {
  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Students</h1>
        <p className="text-gray-600">
          Manage student subscriptions and monitor their progress
        </p>
      </div>

      <StudentTable students={students} onUpdateStudent={handleUpdateStudent} />
    </div>
  );
};
