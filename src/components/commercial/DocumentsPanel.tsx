import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, ExternalLink } from 'lucide-react';
import { FacilityScope } from './types';
import { formatDate } from '@/lib/commercial';
import { getSignedStorageUrl } from '@/lib/storage-urls';
import { toast } from '@/hooks/use-toast';

interface Props {
  scope: FacilityScope;
}

export const DocumentsPanel = ({ scope }: Props) => {
  const open = async (filePath: string | null, externalUrl: string | null) => {
    if (externalUrl) {
      window.open(externalUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    if (!filePath) return;
    const url = await getSignedStorageUrl(filePath, 'facility-documents');
    if (!url) {
      toast({ title: 'Unable to open document', description: 'Please contact Aqua Clear Pools.', variant: 'destructive' });
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  if (scope.documents.length === 0) {
    return <Card><CardContent className="p-6 text-sm text-muted-foreground">No documents have been shared for this facility yet.</CardContent></Card>;
  }

  return (
    <div className="space-y-2">
      {scope.documents.map((doc) => (
        <Card key={doc.id}>
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <div className="flex min-w-0 items-center gap-3">
              <FileText className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{doc.title}</p>
                <p className="text-xs text-muted-foreground">
                  {doc.category && <Badge variant="secondary" className="mr-2">{doc.category}</Badge>}
                  Added {formatDate(doc.created_at)}
                </p>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => open(doc.file_path, doc.external_url)}>
              <ExternalLink className="mr-1 h-4 w-4" /> Open
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
