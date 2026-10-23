import * as React from "react";
import { cn } from "@/lib/utils";
import { Reveal } from "@/components/motion/reveal";

interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  as?: "section" | "div";
  /** Adds vertical padding rhythm. */
  spacing?: "default" | "sm" | "lg" | "none";
}

const spacingMap = {
  none: "",
  sm: "py-16 sm:py-20",
  default: "py-24 sm:py-32",
  lg: "py-28 sm:py-40",
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
        "flex max-w-3xl flex-col gap-5",
        align === "center" && "mx-auto items-center text-center",
        className,
      )}
    >
      {eyebrow && (
        <p className="text-primary text-[13px] font-semibold tracking-[0.14em] uppercase">
          {eyebrow}
        </p>
      )}
      <h2 className="text-[clamp(2.25rem,4.6vw,4rem)] leading-[1.04] font-semibold tracking-[-0.035em] text-balance">
        {title}
      </h2>
      {description && (
        <p className="text-muted-foreground max-w-2xl text-[17px] leading-[1.55] tracking-[-0.012em] text-pretty sm:text-[19px]">
          {description}
        </p>
      )}
    </Reveal>
  );
}
