"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { jobOpenings } from "@/data/careers";
import {
  contactBudgets,
  contactFormSchema,
  type ContactFormInput,
  type ContactResponse,
} from "@/lib/contact";
import { cn } from "@/lib/utils";

type ContactValues = ContactFormInput;

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-destructive mt-1.5 text-sm">
      {message}
    </p>
  );
}

export function ContactForm() {
  const [reference, setReference] = React.useState<string>();
  const [submitError, setSubmitError] = React.useState<string>();

  // If arriving from a careers "Apply" link (/contact?role=slug), prefill the
  // message so the deep-link is meaningful rather than a silent no-op.
  const searchParams = useSearchParams();
  const roleSlug = searchParams.get("role");
  const estimate = searchParams.get("estimate")?.slice(0, 1200);
  const role = jobOpenings.find((j) => j.slug === roleSlug);
  const defaultMessage = role
    ? `Hi Bitecodes team, I'd like to apply for the ${role.title} role. A little about me: `
    : estimate
      ? `Hi Bitecodes team, I used your cost calculator and would like a detailed proposal.\n\nEstimate: ${estimate}\n\nAdditional context: `
      : "";

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ContactValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      name: "",
      email: "",
      company: "",
      budget: "",
      message: defaultMessage,
    },
  });

  const onSubmit = async (values: ContactValues) => {
    setSubmitError(undefined);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          role: role?.slug ?? "",
        }),
      });
      const result = (await response.json()) as ContactResponse;

      if (!response.ok || !result.ok) {
        throw new Error(
          result.ok ? "Unable to send your message." : result.message,
        );
      }

      setReference(result.reference);
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again.",
      );
    }
  };

  if (reference) {
    return (
      <div className="border-border bg-card flex flex-col items-center rounded-2xl border p-10 text-center shadow-[var(--shadow-soft)]">
        <span className="bg-primary/10 text-primary flex size-14 items-center justify-center rounded-full">
          <CheckCircle2 className="size-7" />
        </span>
        <h3 className="mt-5 text-xl font-semibold">
          Thank you — message received.
        </h3>
        <p className="text-muted-foreground mt-2 max-w-sm text-sm">
          We will get back to you within one business day. Keep reference{" "}
          <strong className="text-foreground">{reference}</strong> for your
          records.
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
            {contactBudgets.map((b) => (
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
      <div className="sr-only" aria-hidden="true">
        <Label htmlFor="website">Website</Label>
        <Input
          id="website"
          tabIndex={-1}
          autoComplete="off"
          {...register("website")}
        />
      </div>
      {submitError ? (
        <p
          id="contact-submit-error"
          role="alert"
          className="bg-destructive/10 text-destructive mt-5 rounded-xl px-4 py-3 text-sm"
        >
          {submitError}
        </p>
      ) : null}
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
