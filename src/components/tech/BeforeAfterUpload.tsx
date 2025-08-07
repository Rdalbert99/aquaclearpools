import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ImageUpload } from '@/components/ui/image-upload';
import { ClientSelector } from '@/components/ui/client-selector';
import { supabase } from '@/integrations/supabase/client';
import { Camera } from 'lucide-react';
import { toast } from 'sonner';

export function BeforeAfterUpload() {
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [beforeImage, setBeforeImage] = useState<string>('');
  const [afterImage, setAfterImage] = useState<string>('');
  const [uploading, setUploading] = useState(false);

  const saveImages = async () => {
    if (!selectedClientId || (!beforeImage && !afterImage)) {
      toast.error('Please select a client and upload at least one image');
      return;
    }

    try {
      setUploading(true);
      
      // Create a service record with the images
      const { error } = await supabase
        .from('services')
        .insert({
          client_id: selectedClientId,
          service_date: new Date().toISOString(),
          status: 'completed',
          notes: `Before/After images uploaded${beforeImage ? '\nBefore image: ' + beforeImage : ''}${afterImage ? '\nAfter image: ' + afterImage : ''}`,
          services_performed: 'Photo documentation'
        });

      if (error) throw error;

      toast.success('Before/After images saved successfully');
      setSelectedClientId('');
      setBeforeImage('');
      setAfterImage('');
    } catch (error) {
      console.error('Error saving images:', error);
      toast.error('Failed to save images');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Camera className="h-5 w-5" />
          <span>Before & After Photos</span>
        </CardTitle>
        <CardDescription>
          Document service progress with before and after images
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm font-medium mb-2 block">Select Client</label>
          <ClientSelector
            onClientSelect={setSelectedClientId}
            selectedClientId={selectedClientId}
            placeholder="Choose a client for photo documentation..."
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ImageUpload
            onImageUploaded={setBeforeImage}
            currentImage={beforeImage}
            path="before-after/before"
            label="Before Image"
          />
          
          <ImageUpload
            onImageUploaded={setAfterImage}
            currentImage={afterImage}
            path="before-after/after"
            label="After Image"
          />
        </div>

        {(beforeImage || afterImage) && selectedClientId && (
          <Button 
            onClick={saveImages}
            disabled={uploading}
            className="w-full"
          >
            {uploading ? 'Saving...' : 'Save Photo Documentation'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}