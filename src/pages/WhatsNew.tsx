import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { APP_VERSION, RELEASE_NOTES } from '@/releaseNotes';

export default function WhatsNew() {
  const navigate = useNavigate();

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 pb-24 sm:pb-6">
      <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate(-1)}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Button>

      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Sparkles className="h-6 w-6 text-primary" />
          What's New
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          You're running Aqua Clear version {APP_VERSION}.
        </p>
      </div>

      <div className="space-y-4">
        {RELEASE_NOTES.map((release) => (
          <Card key={release.version}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                Version {release.version}
                {release.version === APP_VERSION && <Badge variant="secondary">Current</Badge>}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {new Date(release.date).toLocaleDateString()}
              </p>
            </CardHeader>
            <CardContent>
              <ul className="list-disc space-y-2 pl-5 text-sm text-foreground">
                {release.highlights.map((highlight) => (
                  <li key={highlight}>{highlight}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        <Link to="/profile" className="underline">
          Back to settings
        </Link>
      </p>
    </div>
  );
}
