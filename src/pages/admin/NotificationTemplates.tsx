import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, RotateCcw, Save } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Template {
  key: string;
  label: string;
  description: string | null;
  sms_body: string | null;
  email_subject: string | null;
  email_text: string | null;
  email_html: string | null;
}

const DEFAULTS: Record<string, Partial<Template>> = {
  salt_cell_cleaned: {
    sms_body:
      'Aqua Clear Pools: Hi {first_name}, your salt cell was cleaned on {cleaned_date} and is back in service. Thanks for choosing us! Reply STOP to opt out.',
    email_subject: 'Your salt cell has been cleaned',
    email_text:
      'Hi {first_name},\n\nJust a quick note to let you know your salt cell was cleaned on {cleaned_date} and is back in service. Regular cleanings keep your cell producing chlorine efficiently and extend its lifespan.\n\nIf you have any questions, just reply to this email or give us a call.\n\nThanks for choosing {business_name}!',
    email_html:
      '<p>Hi {first_name},</p><p>Just a quick note to let you know your salt cell was cleaned on <strong>{cleaned_date}</strong> and is back in service. Regular cleanings keep your cell producing chlorine efficiently and extend its lifespan.</p><p>If you have any questions, just reply to this email or give us a call.</p><p>Thanks for choosing <strong>{business_name}</strong>!</p>',
  },
};

export default function NotificationTemplates() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('notification_templates')
      .select('*')
      .order('label');
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setTemplates(data || []);
    }
    setLoading(false);
  };

  const updateField = (key: string, field: keyof Template, value: string) => {
    setTemplates((prev) => prev.map((t) => (t.key === key ? { ...t, [field]: value } : t)));
  };

  const save = async (tpl: Template) => {
    setSaving(tpl.key);
    const { error } = await (supabase as any)
      .from('notification_templates')
      .update({
        sms_body: tpl.sms_body,
        email_subject: tpl.email_subject,
        email_text: tpl.email_text,
        email_html: tpl.email_html,
        updated_by: user?.id,
      })
      .eq('key', tpl.key);
    setSaving(null);
    if (error) {
      toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Saved', description: `"${tpl.label}" template updated.` });
    }
  };

  const resetToDefault = (tpl: Template) => {
    const def = DEFAULTS[tpl.key];
    if (!def) {
      toast({ title: 'No default available', variant: 'destructive' });
      return;
    }
    setTemplates((prev) =>
      prev.map((t) => (t.key === tpl.key ? { ...t, ...def } as Template : t)),
    );
    toast({ title: 'Restored default', description: 'Click Save to apply.' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Notification Templates</h1>
          <p className="text-sm text-muted-foreground">
            Customize the wording of automated customer messages. Use placeholders like{' '}
            <code className="bg-muted px-1 rounded">{'{first_name}'}</code>,{' '}
            <code className="bg-muted px-1 rounded">{'{customer}'}</code>,{' '}
            <code className="bg-muted px-1 rounded">{'{cleaned_date}'}</code>, and{' '}
            <code className="bg-muted px-1 rounded">{'{business_name}'}</code>.
          </p>
        </div>
      </div>

      {templates.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No templates found.
          </CardContent>
        </Card>
      )}

      {templates.map((tpl) => (
        <Card key={tpl.key}>
          <CardHeader>
            <CardTitle>{tpl.label}</CardTitle>
            {tpl.description && (
              <p className="text-sm text-muted-foreground">{tpl.description}</p>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>SMS body</Label>
              <Textarea
                rows={3}
                value={tpl.sms_body || ''}
                onChange={(e) => updateField(tpl.key, 'sms_body', e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {(tpl.sms_body || '').length} characters (SMS segments split at 160).
              </p>
            </div>

            <div className="space-y-2">
              <Label>Email subject</Label>
              <Input
                value={tpl.email_subject || ''}
                onChange={(e) => updateField(tpl.key, 'email_subject', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Email body (plain text)</Label>
              <Textarea
                rows={6}
                value={tpl.email_text || ''}
                onChange={(e) => updateField(tpl.key, 'email_text', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Email body (HTML)</Label>
              <Textarea
                rows={6}
                className="font-mono text-xs"
                value={tpl.email_html || ''}
                onChange={(e) => updateField(tpl.key, 'email_html', e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Leave blank to reuse the plain text version.
              </p>
            </div>

            <div className="flex gap-2 justify-end">
              {DEFAULTS[tpl.key] && (
                <Button
                  variant="outline"
                  onClick={() => resetToDefault(tpl)}
                  disabled={saving === tpl.key}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset to default
                </Button>
              )}
              <Button onClick={() => save(tpl)} disabled={saving === tpl.key}>
                <Save className="h-4 w-4 mr-2" />
                {saving === tpl.key ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
