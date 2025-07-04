import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services/auth-service';

export const Dashboard: React.FC = () => {
  const { user, logout, updateUser } = useAuth();
  const [protectedData, setProtectedData] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    givenName: user?.givenName || '',
    familyName: user?.familyName || '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadProtectedData();
  }, []);

  const loadProtectedData = async () => {
    try {
      setLoading(true);
      const data = await authService.getProtectedData();
      setProtectedData(data);
    } catch (error) {
      // Error is handled by API client
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await updateUser(editForm);
      setIsEditing(false);
    } catch (error) {
      // Error is handled by auth context
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">
                Auth System Dashboard
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-gray-700">Welcome, {user?.email}</span>
              <button
                onClick={handleLogout}
                className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded text-sm font-medium"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* User Profile Card */}
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    User Profile
                  </h3>
                  <button
                    onClick={() => setIsEditing(!isEditing)}
                    className="text-blue-600 hover:text-blue-900 text-sm font-medium"
                  >
                    {isEditing ? 'Cancel' : 'Edit'}
                  </button>
                </div>

                {!isEditing ? (
                  <div className="space-y-3">
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Email</dt>
                      <dd className="mt-1 text-sm text-gray-900">{user?.email}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">First Name</dt>
                      <dd className="mt-1 text-sm text-gray-900">{user?.givenName || 'Not set'}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Last Name</dt>
                      <dd className="mt-1 text-sm text-gray-900">{user?.familyName || 'Not set'}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Email Verified</dt>
                      <dd className="mt-1">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          user?.emailVerified 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {user?.emailVerified ? 'Verified' : 'Not Verified'}
                        </span>
                      </dd>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleUpdateProfile} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        First Name
                      </label>
                      <input
                        type="text"
                        value={editForm.givenName}
                        onChange={(e) => setEditForm({ ...editForm, givenName: e.target.value })}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Last Name
                      </label>
                      <input
                        type="text"
                        value={editForm.familyName}
                        onChange={(e) => setEditForm({ ...editForm, familyName: e.target.value })}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div className="flex space-x-3">
                      <button
                        type="submit"
                        disabled={loading}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
                      >
                        {loading ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>

            {/* Protected Data Card */}
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    Protected Data
                  </h3>
                  <button
                    onClick={loadProtectedData}
                    disabled={loading}
                    className="text-blue-600 hover:text-blue-900 text-sm font-medium disabled:opacity-50"
                  >
                    Refresh
                  </button>
                </div>

                {loading ? (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-2 text-sm text-gray-500">Loading...</p>
                  </div>
                ) : protectedData ? (
                  <div className="space-y-3">
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Message</dt>
                      <dd className="mt-1 text-sm text-gray-900">{protectedData.message}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">User ID</dt>
                      <dd className="mt-1 text-sm text-gray-900 font-mono">{protectedData.user?.id}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Token Type</dt>
                      <dd className="mt-1 text-sm text-gray-900">{protectedData.user?.tokenType}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Timestamp</dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        {new Date(protectedData.timestamp).toLocaleString()}
                      </dd>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-500">No data loaded</p>
                )}
              </div>
            </div>

            {/* Authentication Info Card */}
            <div className="bg-white overflow-hidden shadow rounded-lg md:col-span-2">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                  Authentication Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">User ID</dt>
                    <dd className="mt-1 text-sm text-gray-900 font-mono break-all">{user?.id}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Created At</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Last Modified</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {user?.lastModified ? new Date(user.lastModified).toLocaleDateString() : 'N/A'}
                    </dd>
                  </div>
                </div>
              </div>
            </div>

            {/* API Testing Card */}
            <div className="bg-white overflow-hidden shadow rounded-lg md:col-span-2">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                  API Testing
                </h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600 mb-2">
                    This dashboard demonstrates successful authentication and authorized API access. 
                    The protected data above was retrieved using your JWT token.
                  </p>
                  <div className="flex space-x-2 text-xs">
                    <span className="bg-green-100 text-green-800 px-2 py-1 rounded">✓ Authentication</span>
                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">✓ Authorization</span>
                    <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded">✓ Token Validation</span>
                    <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded">✓ API Access</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};