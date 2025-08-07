import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ImageUpload } from '@/components/ui/image-upload';
import { ClientSelector } from '@/components/ui/client-selector';
import { supabase } from '@/integrations/supabase/client';
import { Camera } from 'lucide-react';
import { toast } from 'sonner';

export function PoolImageUpload() {
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string>('');

  const handleImageUpload = (url: string) => {
    setUploadedImageUrl(url);
  };

  const saveImageToClient = async () => {
    if (!selectedClientId || !uploadedImageUrl) {
      toast.error('Please select a client and upload an image');
      return;
    }

    try {
      setUploading(true);
      
      const { error } = await supabase
        .from('clients')
        .update({
          pool_image_url: uploadedImageUrl,
          pool_image_uploaded_at: new Date().toISOString()
        })
        .eq('id', selectedClientId);

      if (error) throw error;

      toast.success('Pool image saved successfully');
      setSelectedClientId('');
      setUploadedImageUrl('');
    } catch (error) {
      console.error('Error saving image:', error);
      toast.error('Failed to save image');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Camera className="h-5 w-5" />
          <span>Upload Pool Images</span>
        </CardTitle>
        <CardDescription>
          Upload and assign pool images to clients
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm font-medium mb-2 block">Select Client</label>
          <ClientSelector
            onClientSelect={setSelectedClientId}
            selectedClientId={selectedClientId}
            placeholder="Choose a client to upload image for..."
          />
        </div>

        <ImageUpload
          onImageUploaded={handleImageUpload}
          currentImage={uploadedImageUrl}
          path="pool-photos"
          label="Pool Image"
        />

        {uploadedImageUrl && selectedClientId && (
          <Button 
            onClick={saveImageToClient}
            disabled={uploading}
            className="w-full"
          >
            {uploading ? 'Saving...' : 'Save Image to Client'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}