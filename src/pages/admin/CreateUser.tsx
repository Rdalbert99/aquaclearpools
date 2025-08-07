import { useSearchParams, useNavigate } from 'react-router-dom';
import { UserCreationForm } from '@/components/admin/UserCreationForm';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function CreateUser() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const role = searchParams.get('role');

  const handleSuccess = () => {
    navigate('/admin');
  };

  const handleCancel = () => {
    navigate('/admin');
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => navigate('/admin')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Create New User</h1>
          <p className="text-muted-foreground">
            {role ? `Creating a new ${role}` : 'Add a new user to the system'}
          </p>
        </div>
      </div>

      <UserCreationForm onSuccess={handleSuccess} onCancel={handleCancel} />
    </div>
  );
}