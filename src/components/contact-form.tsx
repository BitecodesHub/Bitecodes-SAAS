"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { jobOpenings } from "@/data/careers";
import { cn } from "@/lib/utils";

const budgets = [
  "Under $5k",
  "$5k – $15k",
  "$15k – $50k",
  "$50k+",
  "Not sure yet",
] as const;

const contactSchema = z.object({
  name: z.string().min(2, "Please enter your name."),
  email: z.string().email("Please enter a valid email."),
  company: z.string().optional(),
  budget: z.string().optional(),
  message: z
    .string()
    .min(10, "A little more detail helps us reply usefully.")
    .max(2000, "That is a little long — please keep it under 2000 characters."),
});

type ContactValues = z.infer<typeof contactSchema>;

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-destructive mt-1.5 text-sm">
      {message}
    </p>
  );
}

export function ContactForm() {
  const [submitted, setSubmitted] = React.useState(false);

  // If arriving from a careers "Apply" link (/contact?role=slug), prefill the
  // message so the deep-link is meaningful rather than a silent no-op.
  const searchParams = useSearchParams();
  const roleSlug = searchParams.get("role");
  const role = jobOpenings.find((j) => j.slug === roleSlug);
  const defaultMessage = role
    ? `Hi Bitecodes team, I'd like to apply for the ${role.title} role. A little about me: `
    : "";

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ContactValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: "",
      email: "",
      company: "",
      budget: "",
      message: defaultMessage,
    },
  });

  // Frontend-only: simulate a network round-trip. A backend can be wired in
  // here later by sending `values` — the form's shape and validation are ready.
  const onSubmit = async (values: ContactValues) => {
    void values;
    await new Promise((r) => setTimeout(r, 900));
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="border-border bg-card flex flex-col items-center rounded-2xl border p-10 text-center shadow-[var(--shadow-soft)]">
        <span className="bg-primary/10 text-primary flex size-14 items-center justify-center rounded-full">
          <CheckCircle2 className="size-7" />
        </span>
        <h3 className="mt-5 text-xl font-semibold">
          Thank you — message received.
        </h3>
        <p className="text-muted-foreground mt-2 max-w-sm text-sm">
          We will get back to you within one business day. In the meantime, feel
          free to explore our recent work.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="border-border bg-card rounded-2xl border p-6 shadow-[var(--shadow-soft)] sm:p-8"
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-1">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            autoComplete="name"
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? "name-error" : undefined}
            className="mt-2"
            {...register("name")}
          />
          <FieldError id="name-error" message={errors.name?.message} />
        </div>
        <div className="sm:col-span-1">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "email-error" : undefined}
            className="mt-2"
            {...register("email")}
          />
          <FieldError id="email-error" message={errors.email?.message} />
        </div>
        <div className="sm:col-span-1">
          <Label htmlFor="company">Company (optional)</Label>
          <Input
            id="company"
            autoComplete="organization"
            className="mt-2"
            {...register("company")}
          />
        </div>
        <div className="sm:col-span-1">
          <Label htmlFor="budget">Budget (optional)</Label>
          <select
            id="budget"
            className={cn(
              "border-input bg-background focus-visible:border-ring focus-visible:ring-ring/40 mt-2 flex h-11 w-full rounded-xl border px-4 text-base shadow-sm transition-colors focus-visible:ring-2 focus-visible:outline-none sm:text-sm",
            )}
            {...register("budget")}
          >
            <option value="">Select a range</option>
            {budgets.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="message">How can we help?</Label>
          <Textarea
            id="message"
            rows={5}
            aria-invalid={!!errors.message}
            aria-describedby={errors.message ? "message-error" : undefined}
            className="mt-2"
            placeholder="Tell us about your project, timeline, and goals."
            {...register("message")}
          />
          <FieldError id="message-error" message={errors.message?.message} />
        </div>
      </div>
      <Button
        type="submit"
        variant="gradient"
        size="lg"
        disabled={isSubmitting}
        className="mt-6 w-full sm:w-auto"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Sending…
          </>
        ) : (
          <>
            Send message
            <Send className="size-4" />
          </>
        )}
      </Button>
    </form>
  );
}
