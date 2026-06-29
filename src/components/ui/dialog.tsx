"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;
const DialogTitle = DialogPrimitive.Title;
const DialogDescription = DialogPrimitive.Description;

const DialogOverlay = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "bg-foreground/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 backdrop-blur-sm dark:bg-black/60",
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = "DialogOverlay";

/** Slide-in sheet variant used for the mobile navigation drawer. */
const DialogSheet = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    side?: "right" | "left";
  }
>(({ className, children, side = "right", ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "border-border bg-background data-[state=open]:animate-in data-[state=closed]:animate-out fixed inset-y-0 z-50 flex w-full max-w-sm flex-col gap-6 p-6 shadow-xl transition ease-in-out data-[state=closed]:duration-300 data-[state=open]:duration-300",
        side === "right" &&
          "data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right right-0 border-l",
        side === "left" &&
          "data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left left-0 border-r",
        className,
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="focus-visible:ring-ring absolute top-4 right-4 flex size-11 items-center justify-center rounded-full opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus-visible:ring-2">
        <X className="size-5" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogSheet.displayName = "DialogSheet";

export {
  Dialog,
  DialogTrigger,
  DialogClose,
  DialogTitle,
  DialogDescription,
  DialogSheet,
};
