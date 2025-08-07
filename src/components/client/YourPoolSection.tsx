import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ImageUpload } from '@/components/ui/image-upload';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Camera } from 'lucide-react';
import { toast } from 'sonner';

interface YourPoolSectionProps {
  clientId?: string;
  currentImageUrl?: string;
  onImageUpdated?: () => void;
}

export function YourPoolSection({ clientId, currentImageUrl, onImageUpdated }: YourPoolSectionProps) {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);

  const handleImageUpload = async (url: string) => {
    if (!clientId) {
      toast.error('Client information not found');
      return;
    }

    try {
      setUploading(true);
      
      const { error } = await supabase
        .from('clients')
        .update({
          pool_image_url: url,
          pool_image_uploaded_at: new Date().toISOString()
        })
        .eq('id', clientId);

      if (error) throw error;

      toast.success('Pool image updated successfully');
      onImageUpdated?.();
    } catch (error) {
      console.error('Error updating pool image:', error);
      toast.error('Failed to update pool image');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Camera className="h-5 w-5" />
          <span>Your Pool</span>
        </CardTitle>
        <CardDescription>
          Upload a current photo of your pool to help us provide better service
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ImageUpload
          onImageUploaded={handleImageUpload}
          currentImage={currentImageUrl}
          path="client-uploads"
          label="Pool Photo"
        />
        {uploading && (
          <p className="text-sm text-muted-foreground mt-2">
            Updating your pool photo...
          </p>
        )}
      </CardContent>
    </Card>
  );
}