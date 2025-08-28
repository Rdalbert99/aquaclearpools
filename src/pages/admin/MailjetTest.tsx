import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  to: z.string().email("Valid recipient email required"),
  subject: z.string().min(1, "Subject is required"),
  text: z.string().optional(),
  html: z.string().optional(),
  fromEmail: z.string().email("Must be a valid email").optional(),
  fromName: z.string().optional(),
}).refine((vals) => !!(vals.text || vals.html), {
  message: "Provide either Text or HTML content",
  path: ["text"],
});

type FormValues = z.infer<typeof formSchema>;

export default function MailjetTest() {
  const { toast } = useToast();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      to: "",
      subject: "Test Email via Mailjet",
      text: "This is a Mailjet test sent from the admin tester page.",
      html: "<h2>Mailjet Test</h2><p>This is a <strong>Mailjet</strong> test sent from the admin tester page.</p>",
      fromEmail: "no-reply@getaquaclear.com",
      fromName: "AquaClear Pools",
    },
  });

  useEffect(() => {
    document.title = "Mailjet Test | Admin";
  }, []);

  const onSubmit = async (values: FormValues) => {
    try {
      const { data, error } = await supabase.functions.invoke("mailjet-test-email", {
        body: values,
      });

      if (error) throw error;

      toast({
        title: "Mailjet test sent",
        description: "Your test email request was sent. Check the inbox.",
      });
    } catch (err: any) {
      toast({
        title: "Failed to send",
        description: err?.message || "Unknown error",
        variant: "destructive",
      });
    }
  };

  return (
    <main className="container mx-auto max-w-3xl p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Mailjet Email Tester</h1>
        <p className="text-muted-foreground">Send a simple test email via the new Mailjet integration.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Send Test Email</CardTitle>
          <CardDescription>Uses a secure Supabase Edge Function to call Mailjet's v3.1 Send API.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="to"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>To</FormLabel>
                      <FormControl>
                        <Input placeholder="recipient@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="subject"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subject</FormLabel>
                      <FormControl>
                        <Input placeholder="Subject" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="fromEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>From Email</FormLabel>
                      <FormControl>
                        <Input placeholder="no-reply@getaquaclear.com" {...field} />
                      </FormControl>
                      <FormDescription>Must be a validated sender/domain in Mailjet.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="fromName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>From Name</FormLabel>
                      <FormControl>
                        <Input placeholder="AquaClear Pools" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="text"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Text Content</FormLabel>
                    <FormControl>
                      <Textarea rows={4} placeholder="Plain text content (optional)" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="html"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>HTML Content</FormLabel>
                    <FormControl>
                      <Textarea rows={6} placeholder="<h1>Hello</h1> Rich HTML content (optional)" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-3">
                <Button type="submit">Send Test Email</Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </main>
  );
}
