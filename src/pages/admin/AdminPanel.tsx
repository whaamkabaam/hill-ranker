import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ArrowLeft, UserPlus, Shield, Users, TrendingUp, Trash2, MoreVertical } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

interface UserWithRole {
  id: string;
  email: string;
  full_name: string | null;
  job_title: string | null;
  role: string;
  created_at: string;
}

export default function AdminPanel() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [stats, setStats] = useState({ totalUsers: 0, totalVotes: 0, totalRankings: 0 });
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<'user' | 'moderator' | 'admin'>('user');
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    if (!roleLoading && !isAdmin) {
      toast.error('Access denied. Admin privileges required.');
      navigate('/dashboard');
    }
  }, [isAdmin, roleLoading, navigate]);

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
      fetchStats();
    }
  }, [isAdmin]);

  const fetchUsers = async () => {
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, full_name, job_title, created_at');

      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      const usersWithRoles = profiles?.map(profile => {
        const userRole = roles?.find(r => r.user_id === profile.id);
        return {
          ...profile,
          role: userRole?.role || 'user',
        };
      }) || [];

      setUsers(usersWithRoles);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to load users');
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchStats = async () => {
    try {
      const [usersCount, votesCount, rankingsCount] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('votes').select('id', { count: 'exact', head: true }),
        supabase.from('rankings').select('id', { count: 'exact', head: true }),
      ]);

      setStats({
        totalUsers: usersCount.count || 0,
        totalVotes: votesCount.count || 0,
        totalRankings: rankingsCount.count || 0,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  const handleAddAllowedUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newUserEmail) {
      toast.error('Please enter an email address');
      return;
    }

    try {
      const { error } = await supabase
        .from('allowed_users')
        .insert({ email: newUserEmail.toLowerCase().trim() });

      if (error) throw error;

      toast.success('Email added to allowed users list');
      setNewUserEmail('');
    } catch (error: any) {
      console.error('Error adding allowed user:', error);
      toast.error(error.message || 'Failed to add email to allowed list');
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin':
        return 'destructive';
      case 'moderator':
        return 'default';
      default:
        return 'secondary';
    }
  };

  const handleResetAllVotes = async () => {
    try {
      // Delete all records
      const { error: votesError } = await supabase.from('votes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      const { error: rankingsError } = await supabase.from('rankings').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      const { error: sessionsError } = await supabase.from('comparison_sessions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      const { error: completionsError } = await supabase.from('prompt_completions').delete().neq('id', '00000000-0000-0000-0000-000000000000');

      if (votesError) throw votesError;
      if (rankingsError) throw rankingsError;
      if (sessionsError) throw sessionsError;
      if (completionsError) throw completionsError;

      toast.success('All voting data has been reset');
      fetchStats();
    } catch (error) {
      console.error('Error resetting all votes:', error);
      toast.error('Failed to reset all votes');
    }
  };

  const handleResetUserVotes = async (userId: string, userEmail: string) => {
    try {
      // Delete all records for this user
      const { error: votesError } = await supabase.from('votes').delete().eq('user_id', userId);
      const { error: rankingsError } = await supabase.from('rankings').delete().eq('user_id', userId);
      const { error: sessionsError } = await supabase.from('comparison_sessions').delete().eq('user_id', userId);
      const { error: completionsError } = await supabase.from('prompt_completions').delete().eq('user_id', userId);

      if (votesError) throw votesError;
      if (rankingsError) throw rankingsError;
      if (sessionsError) throw sessionsError;
      if (completionsError) throw completionsError;

      toast.success(`All votes reset for ${userEmail}`);
      fetchStats();
    } catch (error) {
      console.error('Error resetting user votes:', error);
      toast.error('Failed to reset user votes');
    }
  };

  if (roleLoading || loadingUsers) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/dashboard')}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Shield className="h-8 w-8 text-primary" />
                Admin Panel
              </h1>
              <p className="text-muted-foreground">Manage users and platform settings</p>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUsers}</div>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Votes</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalVotes}</div>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Rankings</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalRankings}</div>
            </CardContent>
          </Card>
        </div>

        {/* Data Management */}
        <Card className="glass-card mb-8 border-destructive/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Data Management
            </CardTitle>
            <CardDescription>
              Danger zone: Reset all voting data for the entire platform
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="gap-2">
                  <Trash2 className="w-4 h-4" />
                  Reset All Votes
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-destructive">⚠️ Reset All Platform Data?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete:
                    <ul className="list-disc ml-6 mt-2 space-y-1">
                      <li>All votes from all users</li>
                      <li>All rankings from all users</li>
                      <li>All comparison sessions</li>
                      <li>All prompt completions</li>
                    </ul>
                    <p className="mt-4 font-semibold text-destructive">This action cannot be undone!</p>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleResetAllVotes} className="bg-destructive hover:bg-destructive/90">
                    Yes, Reset Everything
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>

        {/* Add Allowed User */}
        <Card className="glass-card mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Add Allowed Email
            </CardTitle>
            <CardDescription>
              Add email addresses that are allowed to register for the platform
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddAllowedUser} className="flex gap-4">
              <div className="flex-1">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="user@example.com"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div className="flex items-end">
                <Button type="submit">Add Email</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>User Management</CardTitle>
            <CardDescription>
              View and manage all registered users
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.email}</TableCell>
                    <TableCell>{user.full_name || 'N/A'}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {user.job_title || 'Not specified'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getRoleBadgeVariant(user.role)}>
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(user.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive cursor-pointer">
                                <Trash2 className="w-4 h-4 mr-2" />
                                Reset User's Votes
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Reset Votes for {user.email}?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently delete all votes, rankings, and sessions for this user. This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={() => handleResetUserVotes(user.id, user.email)}
                                  className="bg-destructive hover:bg-destructive/90"
                                >
                                  Reset User Votes
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
