import * as React from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Reveal } from "@/components/motion/reveal";

interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  as?: "section" | "div";
  /** Adds vertical padding rhythm. */
  spacing?: "default" | "sm" | "lg" | "none";
}

const spacingMap = {
  none: "",
  sm: "py-12 sm:py-16",
  default: "py-20 sm:py-28",
  lg: "py-24 sm:py-36",
};

export function Section({
  className,
  as: Tag = "section",
  spacing = "default",
  children,
  ...props
}: SectionProps) {
  return (
    <Tag className={cn(spacingMap[spacing], className)} {...props}>
      {children}
    </Tag>
  );
}

interface SectionHeaderProps {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  align?: "left" | "center";
  className?: string;
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  align = "center",
  className,
}: SectionHeaderProps) {
  return (
    <Reveal
      className={cn(
        "flex max-w-2xl flex-col gap-4",
        align === "center" && "mx-auto items-center text-center",
        className,
      )}
    >
      {eyebrow && (
        <Badge variant="default" className="w-fit">
          {eyebrow}
        </Badge>
      )}
      <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl md:text-[2.75rem] md:leading-[1.1]">
        {title}
      </h2>
      {description && (
        <p className="text-muted-foreground text-base leading-relaxed text-pretty sm:text-lg">
          {description}
        </p>
      )}
    </Reveal>
  );
}
