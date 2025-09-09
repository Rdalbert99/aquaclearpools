import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ImageUpload } from '@/components/ui/image-upload';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { User, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface ProfilePictureUploadProps {
  currentImageUrl?: string;
  onImageUpdated?: () => void;
}

export function ProfilePictureUpload({ currentImageUrl, onImageUpdated }: ProfilePictureUploadProps) {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);

  const handleImageUpload = async (url: string) => {
    if (!user?.id) {
      toast.error('User information not found');
      return;
    }

    try {
      setUploading(true);
      
      const { error } = await supabase
        .from('users')
        .update({
          profile_image_url: url
        })
        .eq('id', user.id);

      if (error) throw error;

      toast.success('Profile picture updated successfully');
      onImageUpdated?.();
    } catch (error) {
      console.error('Error updating profile picture:', error);
      toast.error('Failed to update profile picture');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <User className="h-5 w-5" />
          <span>Profile Picture</span>
        </CardTitle>
        <CardDescription>
          Add a profile picture to personalize your account
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center space-x-4">
          <Avatar className="h-20 w-20">
            <AvatarImage src={currentImageUrl} alt="Profile picture" />
            <AvatarFallback>
              <User className="h-10 w-10" />
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <ImageUpload
              onImageUploaded={handleImageUpload}
              currentImage={currentImageUrl}
              path="profile-pictures"
              label="Upload Profile Picture"
            />
            {uploading && (
              <p className="text-sm text-muted-foreground mt-2">
                Updating your profile picture...
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}