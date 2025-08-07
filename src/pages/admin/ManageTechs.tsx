import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { 
  Settings, 
  Plus, 
  ArrowLeft,
  Mail,
  Phone,
  User,
  Calendar,
  Wrench,
  Edit2,
  KeyRound
} from 'lucide-react';

interface TechUser {
  id: string;
  name: string;
  login: string;
  email: string;
  phone?: string;
  created_at: string;
  last_login?: string;
}

export default function ManageTechs() {
  const [techs, setTechs] = useState<TechUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientsToReassign, setClientsToReassign] = useState<any[]>([]);
  const [selectedTechForReassignment, setSelectedTechForReassignment] = useState<string>('');
  const [techToDelete, setTechToDelete] = useState<TechUser | null>(null);
  const [showReassignDialog, setShowReassignDialog] = useState(false);
  const [editingTech, setEditingTech] = useState<TechUser | null>(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '' });
  const [newPassword, setNewPassword] = useState('');
  const [resettingPasswordFor, setResettingPasswordFor] = useState<TechUser | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadTechs();
  }, []);

  const loadTechs = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, login, email, phone, created_at')
        .eq('role', 'tech')
        .order('name');

      if (error) throw error;
      setTechs(data || []);
    } catch (error) {
      console.error('Error loading techs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTech = async (tech: TechUser) => {
    try {
      // Check if tech has assigned clients
      const { data: clients, error: clientError } = await supabase
        .from('clients')
        .select('id, customer')
        .or(`user_id.eq.${tech.id}`);

      if (clientError) throw clientError;

      if (clients && clients.length > 0) {
        setTechToDelete(tech);
        setClientsToReassign(clients);
        setShowReassignDialog(true);
        return;
      }

      // No clients assigned, can delete directly
      await deleteTech(tech.id);
    } catch (error) {
      console.error('Error checking tech assignments:', error);
      toast({
        title: "Error",
        description: "Failed to check technician assignments.",
        variant: "destructive",
      });
    }
  };

  const deleteTech = async (techId: string) => {
    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', techId);

      if (error) throw error;

      toast({
        title: "Technician deleted",
        description: "The technician has been successfully removed.",
      });

      loadTechs();
    } catch (error) {
      console.error('Error deleting tech:', error);
      toast({
        title: "Error",
        description: "Failed to delete technician.",
        variant: "destructive",
      });
    }
  };

  const handleReassignAndDelete = async () => {
    if (!techToDelete || !selectedTechForReassignment) return;

    try {
      // Reassign clients to selected tech
      const { error: reassignError } = await supabase
        .from('clients')
        .update({ user_id: selectedTechForReassignment })
        .eq('user_id', techToDelete.id);

      if (reassignError) throw reassignError;

      // Delete the tech
      await deleteTech(techToDelete.id);

      // Reset state
      setShowReassignDialog(false);
      setTechToDelete(null);
      setClientsToReassign([]);
      setSelectedTechForReassignment('');

      toast({
        title: "Clients reassigned and technician deleted",
        description: `${clientsToReassign.length} clients have been reassigned.`,
      });
    } catch (error) {
      console.error('Error reassigning clients:', error);
      toast({
        title: "Error",
        description: "Failed to reassign clients.",
        variant: "destructive",
      });
    }
  };

  const handleEditTech = (tech: TechUser) => {
    setEditingTech(tech);
    setEditForm({
      name: tech.name,
      email: tech.email,
      phone: tech.phone || ''
    });
  };

  const handleSaveEdit = async () => {
    if (!editingTech) return;

    try {
      const { error } = await supabase
        .from('users')
        .update({
          name: editForm.name,
          email: editForm.email,
          phone: editForm.phone || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingTech.id);

      if (error) throw error;

      toast({
        title: "Technician Updated",
        description: "Technician details have been successfully updated.",
      });

      setEditingTech(null);
      loadTechs();
    } catch (error) {
      console.error('Error updating tech:', error);
      toast({
        title: "Error",
        description: "Failed to update technician.",
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
      const { error } = await supabase
        .from('users')
        .update({
          password: newPassword,
          must_change_password: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', resettingPasswordFor.id);

      if (error) throw error;

      toast({
        title: "Password Reset",
        description: `Password has been reset for ${resettingPasswordFor.name}. They will be required to change it on next login.`,
      });

      setResettingPasswordFor(null);
      setNewPassword('');
    } catch (error) {
      console.error('Error resetting password:', error);
      toast({
        title: "Error",
        description: "Failed to reset password.",
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
              <Settings className="h-8 w-8" />
              Manage Technicians
            </h1>
            <p className="text-muted-foreground">
              View and manage technician user accounts
            </p>
          </div>
        </div>
        <Button asChild>
          <Link to="/admin/users/new?role=tech">
            <Plus className="h-4 w-4 mr-2" />
            Add New Technician
          </Link>
        </Button>
      </div>

      {/* Stats Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Technician Overview
          </CardTitle>
          <CardDescription>
            Total technicians: {techs.length}
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Techs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {techs.map((tech) => (
          <Card key={tech.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                {tech.name}
              </CardTitle>
              <CardDescription>
                <Badge variant="outline" className="w-fit">
                  <Wrench className="h-3 w-3 mr-1" />
                  Technician
                </Badge>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Username:</span>
                  <span>{tech.login}</span>
                </div>
                
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Email:</span>
                  <span className="truncate">{tech.email}</span>
                </div>
                
                {tech.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Phone:</span>
                    <span>{tech.phone}</span>
                  </div>
                )}
                
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Created:</span>
                  <span>{new Date(tech.created_at).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="pt-3 border-t">
                <div className="flex gap-2">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => handleEditTech(tech)}>
                        <Edit2 className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Edit Technician</DialogTitle>
                        <DialogDescription>
                          Update technician details for {tech.name}
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
                          <Label htmlFor="edit-phone">Phone</Label>
                          <Input
                            id="edit-phone"
                            value={editForm.phone}
                            onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                          />
                        </div>
                      </div>

                      <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingTech(null)}>
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
                        setResettingPasswordFor(tech);
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
                          Reset password for {tech.name}. They will be required to change this password on next login.
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
                        <AlertDialogTitle>Remove Technician</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to remove {tech.name}? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDeleteTech(tech)}
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

        {techs.length === 0 && (
          <div className="col-span-full text-center py-12">
            <Settings className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Technicians Found</h3>
            <p className="text-muted-foreground mb-4">
              Get started by adding the first technician to your system.
            </p>
            <Button asChild>
              <Link to="/admin/users/new?role=tech">
                <Plus className="h-4 w-4 mr-2" />
                Add First Technician
              </Link>
            </Button>
          </div>
        )}
      </div>

      {/* Client Reassignment Dialog */}
      <Dialog open={showReassignDialog} onOpenChange={setShowReassignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reassign Clients</DialogTitle>
            <DialogDescription>
              {techToDelete?.name} has {clientsToReassign.length} assigned clients. 
              Please select another technician to reassign them to before deletion.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Clients to reassign:</label>
              <div className="mt-2 space-y-1">
                {clientsToReassign.map((client) => (
                  <div key={client.id} className="text-sm text-muted-foreground">
                    • {client.customer}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Reassign to:</label>
              <Select value={selectedTechForReassignment} onValueChange={setSelectedTechForReassignment}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select a technician" />
                </SelectTrigger>
                <SelectContent>
                  {techs
                    .filter(t => t.id !== techToDelete?.id)
                    .map((tech) => (
                      <SelectItem key={tech.id} value={tech.id}>
                        {tech.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReassignDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleReassignAndDelete}
              disabled={!selectedTechForReassignment}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Reassign & Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}