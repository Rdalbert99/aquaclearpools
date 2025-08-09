import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { 
  Shield, 
  Plus, 
  ArrowLeft,
  Mail,
  Phone,
  User,
  Calendar,
  Edit2,
  KeyRound
} from 'lucide-react';

interface AdminUser {
  id: string;
  name: string;
  login: string;
  email: string;
  phone?: string;
  created_at: string;
  last_login?: string;
}

export default function ManageAdmins() {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingAdmin, setEditingAdmin] = useState<AdminUser | null>(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '', login: '' });
  const [newPassword, setNewPassword] = useState('');
  const [resettingPasswordFor, setResettingPasswordFor] = useState<AdminUser | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadAdmins();
  }, []);

  // Auto-clean duplicate client accounts for Beckama on first load
  const cleanedRef = useRef(false);
  useEffect(() => {
    if (cleanedRef.current) return;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('id, login, role')
          .in('login', ['Beckama', 'beckama23']);
        if (error) return;
        const ids = (data || []).filter((u: any) => u.role === 'client').map((u: any) => u.id);
        if (ids.length > 0) {
          const { error: fnErr } = await supabase.functions.invoke('delete-users-and-clients', {
            body: { userIds: ids },
          });
          if (!fnErr) {
            cleanedRef.current = true;
            toast({ title: 'Cleanup complete', description: 'Removed duplicate client accounts.' });
            await loadAdmins();
          }
        }
      } catch (e) {
        console.error('Auto-clean error', e);
      }
    })();
  }, []);

  const loadAdmins = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, login, email, phone, created_at')
        .eq('role', 'admin')
        .order('name');

      if (error) throw error;
      setAdmins(data || []);
    } catch (error) {
      console.error('Error loading admins:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAdmin = async (adminId: string) => {
    try {
      console.log('Deleting admin with ID:', adminId);
      
      const { error } = await supabase
        .from('users')
        .update({ role: 'client', updated_at: new Date().toISOString() })
        .eq('id', adminId);

      if (error) {
        console.error('Delete error:', error);
        throw error;
      }

      console.log('Admin deleted successfully, refreshing list...');
      
      toast({
        title: "Admin deleted",
        description: "The administrator has been successfully removed.",
      });

      // Refresh the list
      await loadAdmins();
      
    } catch (error) {
      console.error('Error deleting admin:', error);
      toast({
        title: "Error",
        description: "Failed to delete administrator.",
        variant: "destructive",
      });
    }
  };

  const handleEditAdmin = (admin: AdminUser) => {
    setEditingAdmin(admin);
    setEditForm({
      name: admin.name,
      email: admin.email,
      phone: admin.phone || '',
      login: admin.login || ''
    });
  };

  const handleSaveEdit = async () => {
    if (!editingAdmin) return;

    try {
      const { error } = await supabase
        .from('users')
        .update({
          name: editForm.name,
          email: editForm.email,
          phone: editForm.phone || null,
          login: editForm.login,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingAdmin.id);

      if (error) throw error;

      toast({
        title: "Admin Updated",
        description: "Administrator details have been successfully updated.",
      });

      setEditingAdmin(null);
      loadAdmins();
    } catch (error) {
      console.error('Error updating admin:', error);
      toast({
        title: "Error",
        description: "Failed to update administrator.",
        variant: "destructive",
      });
    }
  };

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(password);
  };

  const handleResetPassword = async () => {
    if (!resettingPasswordFor || !newPassword) return;

    try {
      const { data, error } = await supabase.functions.invoke('reset-user-password', {
        body: {
          userId: resettingPasswordFor.id,
          newPassword: newPassword
        }
      });

      if (error) {
        console.error('Edge function error:', error);
        throw new Error(error.message || 'Failed to reset password');
      }

      if (data?.error) {
        console.error('Edge function data error:', data.error);
        throw new Error(data.error);
      }

      toast({
        title: "Password Reset",
        description: `Password has been reset for ${resettingPasswordFor.name}. They will be required to change it on next login.`,
      });

      setResettingPasswordFor(null);
      setNewPassword('');
    } catch (error: any) {
      console.error('Error resetting password:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to reset password.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Shield className="h-8 w-8" />
              Manage Administrators
            </h1>
            <p className="text-muted-foreground">
              View and manage admin user accounts
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/admin/users/new?role=admin">
              <Plus className="h-4 w-4 mr-2" />
              Add New Admin
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Administrator Overview
          </CardTitle>
          <CardDescription>
            Total administrators: {admins.length}
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Admins Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {admins.map((admin) => (
          <Card key={admin.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                {admin.name}
              </CardTitle>
              <div className="mt-1">
                <Badge variant="secondary" className="w-fit">
                  <Shield className="h-3 w-3 mr-1" />
                  Administrator
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Username:</span>
                  <span>{admin.login}</span>
                </div>
                
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Email:</span>
                  <span className="truncate">{admin.email}</span>
                </div>
                
                {admin.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Phone:</span>
                    <span>{admin.phone}</span>
                  </div>
                )}
                
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Created:</span>
                  <span>{new Date(admin.created_at).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="pt-3 border-t">
                <div className="flex gap-2">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => handleEditAdmin(admin)}>
                        <Edit2 className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Edit Administrator</DialogTitle>
                        <DialogDescription>
                          Update administrator details for {admin.name}
                        </DialogDescription>
                      </DialogHeader>
                      
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="edit-name">Name</Label>
                          <Input
                            id="edit-name"
                            value={editForm.name}
                            onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="edit-email">Email</Label>
                          <Input
                            id="edit-email"
                            type="email"
                            value={editForm.email}
                            onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="edit-login">Username</Label>
                          <Input
                            id="edit-login"
                            value={editForm.login}
                            onChange={(e) => setEditForm(prev => ({ ...prev, login: e.target.value }))}
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="edit-phone">Phone</Label>
                          <Input
                            id="edit-phone"
                            value={editForm.phone}
                            onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                          />
                        </div>
                      </div>

                      <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingAdmin(null)}>
                          Cancel
                        </Button>
                        <Button onClick={handleSaveEdit}>
                          Save Changes
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => {
                        setResettingPasswordFor(admin);
                        generateRandomPassword();
                      }}>
                        <KeyRound className="h-3 w-3 mr-1" />
                        Reset Password
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Reset Password</DialogTitle>
                        <DialogDescription>
                          Reset password for {admin.name}. They will be required to change this password on next login.
                        </DialogDescription>
                      </DialogHeader>
                      
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="new-password">New Password</Label>
                          <div className="flex gap-2">
                            <Input
                              id="new-password"
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              type="text"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              onClick={generateRandomPassword}
                            >
                              Generate
                            </Button>
                          </div>
                        </div>
                      </div>

                      <DialogFooter>
                        <Button variant="outline" onClick={() => {
                          setResettingPasswordFor(null);
                          setNewPassword('');
                        }}>
                          Cancel
                        </Button>
                        <Button onClick={handleResetPassword} disabled={!newPassword}>
                          Reset Password
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm" className="flex-1">
                        Remove
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove Administrator</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to remove {admin.name}? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDeleteAdmin(admin.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Remove
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {admins.length === 0 && (
          <div className="col-span-full text-center py-12">
            <Shield className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Administrators Found</h3>
            <p className="text-muted-foreground mb-4">
              Get started by adding the first administrator to your system.
            </p>
            <Button asChild>
              <Link to="/admin/users/new?role=admin">
                <Plus className="h-4 w-4 mr-2" />
                Add First Admin
              </Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}