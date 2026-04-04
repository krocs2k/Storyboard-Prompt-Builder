'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Loader2, ArrowLeft, UserCheck, UserX, Shield, ShieldOff, Trash2, Search, RefreshCw, CheckSquare, Square, MinusSquare, Mail, ToggleLeft, ToggleRight, Send } from 'lucide-react';
import Link from 'next/link';

interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
  isActive: boolean;
  emailVerified: Date | null;
  createdAt: string;
  accounts: { provider: string }[];
}

export default function UsersPage() {
  const sessionData = useSession();
  const session = sessionData?.data;
  const status = sessionData?.status || 'loading';
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [signupDisabled, setSignupDisabled] = useState(false);
  const [signupToggleLoading, setSignupToggleLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteMessage, setInviteMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (status === 'unauthenticated') {
      router.replace('/login');
    } else if (status === 'authenticated' && session?.user?.role !== 'admin') {
      router.replace('/');
    }
  }, [status, session, router, mounted]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      if (data.users) {
        setUsers(data.users);
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSignupSetting = async () => {
    try {
      const res = await fetch('/api/admin/users/signup-setting');
      const data = await res.json();
      setSignupDisabled(data.signupDisabled === true);
    } catch (err) {
      console.error('Failed to fetch signup setting:', err);
    }
  };

  const toggleSignup = async () => {
    setSignupToggleLoading(true);
    try {
      const res = await fetch('/api/admin/users/signup-setting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disabled: !signupDisabled }),
      });
      const data = await res.json();
      if (data.success) {
        setSignupDisabled(data.signupDisabled);
      }
    } catch (err) {
      console.error('Toggle signup failed:', err);
    } finally {
      setSignupToggleLoading(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviteLoading(true);
    setInviteMessage(null);
    try {
      const res = await fetch('/api/admin/users/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setInviteMessage({ type: 'success', text: data.message });
        setInviteEmail('');
      } else {
        setInviteMessage({ type: 'error', text: data.error || 'Failed to send invitation' });
      }
    } catch {
      setInviteMessage({ type: 'error', text: 'An unexpected error occurred' });
    } finally {
      setInviteLoading(false);
    }
  };

  useEffect(() => {
    if (session?.user?.role === 'admin') {
      fetchUsers();
      fetchSignupSetting();
    }
  }, [session]);

  const handleAction = async (userId: string, action: string) => {
    setActionLoading(userId);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action })
      });
      const data = await res.json();
      if (data.user) {
        setUsers(users.map(u => u.id === userId ? { ...u, ...data.user } : u));
      } else if (data.error) {
        alert(data.error);
      }
    } catch (err) {
      console.error('Action failed:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (userId: string, email: string) => {
    if (!confirm(`Are you sure you want to delete ${email}? This action cannot be undone.`)) {
      return;
    }
    setActionLoading(userId);
    try {
      const res = await fetch(`/api/admin/users?userId=${userId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        setUsers(users.filter(u => u.id !== userId));
      } else if (data.error) {
        alert(data.error);
      }
    } catch (err) {
      console.error('Delete failed:', err);
    } finally {
      setActionLoading(null);
    }
  };

  // Selectable users = those that aren't the current admin
  const selectableFilteredUsers = (list: User[]) => list.filter(u => u.id !== session?.user?.id);

  const toggleSelectUser = (userId: string) => {
    setSelectedUsers(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const selectable = selectableFilteredUsers(filteredUsers);
    if (selectedUsers.size === selectable.length && selectable.length > 0) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(selectable.map(u => u.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedUsers.size === 0) return;
    const count = selectedUsers.size;
    if (!confirm(`Are you sure you want to delete ${count} user${count > 1 ? 's' : ''}? This action cannot be undone.`)) {
      return;
    }
    setBulkDeleting(true);
    try {
      const ids = Array.from(selectedUsers).join(',');
      const res = await fetch(`/api/admin/users?userIds=${encodeURIComponent(ids)}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        setUsers(users.filter(u => !selectedUsers.has(u.id)));
        setSelectedUsers(new Set());
      } else if (data.error) {
        alert(data.error);
      }
    } catch (err) {
      console.error('Bulk delete failed:', err);
    } finally {
      setBulkDeleting(false);
    }
  };

  const filteredUsers = users.filter(u =>
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.name && u.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (!mounted || status === 'loading' || (status === 'authenticated' && session?.user?.role !== 'admin')) {
    return (
      <div className="min-h-screen flex items-center justify-center ">
        <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen ">
      <div className="max-w-6xl mx-auto p-6">
        <div className="mb-8">
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Admin
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">User Management</h1>
              <p className="text-gray-500">{users.length} total users</p>
            </div>
            <div className="flex items-center gap-3">
              {selectedUsers.size > 0 && (
                <button
                  onClick={handleBulkDelete}
                  disabled={bulkDeleting}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-red-800 text-white rounded-lg transition-colors font-medium text-sm"
                >
                  {bulkDeleting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  Delete {selectedUsers.size} user{selectedUsers.size > 1 ? 's' : ''}
                </button>
              )}
              <button
                onClick={fetchUsers}
                className="p-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
              >
                <RefreshCw className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>
        </div>

        {/* Signup Toggle & Invite User */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Signup Toggle */}
          <div className="bg-gray-800 border border-gray-700 shadow-lg rounded-xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-white font-semibold text-sm mb-1">Public Registration</h3>
                <p className="text-gray-400 text-xs">
                  {signupDisabled ? 'New users must be invited by an admin' : 'Anyone can register for an account'}
                </p>
              </div>
              <button
                onClick={toggleSignup}
                disabled={signupToggleLoading}
                className="flex items-center gap-2 transition-colors disabled:opacity-50"
                title={signupDisabled ? 'Enable public signup' : 'Disable public signup'}
              >
                {signupToggleLoading ? (
                  <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                ) : signupDisabled ? (
                  <ToggleLeft className="w-10 h-10 text-gray-500 hover:text-gray-400" />
                ) : (
                  <ToggleRight className="w-10 h-10 text-green-500 hover:text-green-400" />
                )}
              </button>
            </div>
          </div>

          {/* Invite User */}
          <div className="bg-gray-800 border border-gray-700 shadow-lg rounded-xl p-5">
            <h3 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
              <Mail className="w-4 h-4 text-rose-400" /> Invite User
            </h3>
            <form onSubmit={handleInvite} className="flex gap-2">
              <input
                type="email"
                placeholder="user@example.com"
                value={inviteEmail}
                onChange={(e) => { setInviteEmail(e.target.value); setInviteMessage(null); }}
                className="flex-1 px-3 py-2 bg-gray-900/50 border border-gray-600 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                required
              />
              <button
                type="submit"
                disabled={inviteLoading || !inviteEmail.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-rose-500 to-purple-600 text-white text-sm font-medium rounded-lg hover:from-rose-600 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {inviteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Send
              </button>
            </form>
            {inviteMessage && (
              <p className={`mt-2 text-xs ${inviteMessage.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                {inviteMessage.text}
              </p>
            )}
            <p className="mt-2 text-gray-500 text-xs">Invitation link expires in 48 hours &amp; can only be used once.</p>
          </div>
        </div>

        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search users by email or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 shadow-lg rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
          </div>
        ) : (
          <div className="bg-gray-800 border border-gray-700 shadow-lg rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="p-4 w-10">
                      <button onClick={toggleSelectAll} className="text-gray-500 hover:text-gray-900 transition-colors">
                        {(() => {
                          const selectable = selectableFilteredUsers(filteredUsers);
                          if (selectable.length === 0) return <Square className="w-5 h-5" />;
                          if (selectedUsers.size === selectable.length) return <CheckSquare className="w-5 h-5 text-rose-400" />;
                          if (selectedUsers.size > 0) return <MinusSquare className="w-5 h-5 text-rose-400" />;
                          return <Square className="w-5 h-5" />;
                        })()}
                      </button>
                    </th>
                    <th className="text-left p-4 text-gray-400 font-medium">User</th>
                    <th className="text-left p-4 text-gray-400 font-medium">Status</th>
                    <th className="text-left p-4 text-gray-400 font-medium">Role</th>
                    <th className="text-left p-4 text-gray-400 font-medium">Provider</th>
                    <th className="text-left p-4 text-gray-400 font-medium">Joined</th>
                    <th className="text-right p-4 text-gray-400 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className={`border-b border-gray-700/50 hover:bg-gray-700/20 ${selectedUsers.has(user.id) ? 'bg-rose-500/5' : ''}`}>
                      <td className="p-4 w-10">
                        {user.id !== session?.user?.id ? (
                          <button onClick={() => toggleSelectUser(user.id)} className="text-gray-500 hover:text-gray-900 transition-colors">
                            {selectedUsers.has(user.id) ? (
                              <CheckSquare className="w-5 h-5 text-rose-400" />
                            ) : (
                              <Square className="w-5 h-5" />
                            )}
                          </button>
                        ) : (
                          <span className="w-5 h-5 block" />
                        )}
                      </td>
                      <td className="p-4">
                        <div>
                          <p className="text-white font-medium">{user.name || 'No name'}</p>
                          <p className="text-gray-400 text-sm">{user.email}</p>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col gap-1">
                          {!user.emailVerified ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-500/20 text-gray-400 w-fit">
                              Unverified
                            </span>
                          ) : user.isActive ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-500/20 text-green-400 w-fit">
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-amber-500/20 text-amber-400 w-fit">
                              Pending Approval
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${
                          user.role === 'admin'
                            ? 'bg-purple-500/20 text-purple-400'
                            : 'bg-gray-500/20 text-gray-400'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-gray-400 text-sm">
                          {user.accounts.length > 0
                            ? user.accounts.map(a => a.provider).join(', ')
                            : 'credentials'}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-gray-400 text-sm">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-2">
                          {actionLoading === user.id ? (
                            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                          ) : (
                            <>
                              {user.id !== session?.user?.id && (
                                <>
                                  {user.isActive ? (
                                    <button
                                      onClick={() => handleAction(user.id, 'deactivate')}
                                      className="p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
                                      title="Deactivate"
                                    >
                                      <UserX className="w-4 h-4" />
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => handleAction(user.id, 'activate')}
                                      className="p-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors"
                                      title="Activate"
                                    >
                                      <UserCheck className="w-4 h-4" />
                                    </button>
                                  )}
                                  {user.role === 'admin' ? (
                                    <button
                                      onClick={() => handleAction(user.id, 'demote')}
                                      className="p-2 bg-amber-500/20 text-amber-400 rounded-lg hover:bg-amber-500/30 transition-colors"
                                      title="Remove Admin"
                                    >
                                      <ShieldOff className="w-4 h-4" />
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => handleAction(user.id, 'promote')}
                                      className="p-2 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-colors"
                                      title="Make Admin"
                                    >
                                      <Shield className="w-4 h-4" />
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleDelete(user.id, user.email)}
                                    className="p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
                                    title="Delete"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
