"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { updateFieldsAction } from "@/lib/server/forms/actions";
import { FIELD_TYPES, FIELD_TYPE_LABELS, MAX_FIELDS } from "@/lib/forms/fields";
import type { FormField, FormFieldType } from "@/lib/server/db/types";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Field builder for one form.
 *
 * Array order is display order, so reordering is a swap. The type list is the
 * closed set the validator and both renderers share — adding a type here without
 * adding it there would produce a field nobody can submit.
 */

/**
 * Turns a human label into a usable field key: "Phone number" -> "phone_number".
 *
 * The key is not cosmetic. It is the property name in every stored submission,
 * the column header in the CSV export, and the field name in the REST API. Left
 * at its `field_4` default, an owner opens their export and finds a column called
 * `field_4` with no way to tell what it holds.
 */
function slugifyFieldName(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

/** True while the key is still an untouched default, so renaming is safe. */
function isDefaultName(name: string): boolean {
  return /^field_\d+$/.test(name);
}

export function FormBuilder({
  formId,
  initialFields,
}: {
  formId: string;
  initialFields: FormField[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [fields, setFields] = useState<FormField[]>(initialFields);

  function patch(index: number, changes: Partial<FormField>) {
    setFields((current) =>
      current.map((f, i) => (i === index ? { ...f, ...changes } : f)),
    );
  }

  function add() {
    if (fields.length >= MAX_FIELDS) return;
    const n = fields.length + 1;
    setFields((current) => [
      ...current,
      {
        id: `f_${Date.now().toString(36)}`,
        type: "text",
        name: `field_${n}`,
        label: `Field ${n}`,
        placeholder: null,
        required: false,
        options: [],
        maxLength: null,
      },
    ]);
  }

  function remove(index: number) {
    setFields((current) => current.filter((_, i) => i !== index));
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= fields.length) return;
    setFields((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function save() {
    start(async () => {
      const result = await updateFieldsAction(formId, fields);
      if (result.ok) {
        toast({ title: "Fields saved", variant: "success" });
        router.refresh();
      } else {
        toast({
          title: "Could not save",
          description: result.error,
          variant: "error",
        });
      }
    });
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-3">
        {fields.map((field, index) => (
          <li
            key={field.id}
            className="border-border bg-card rounded-xl border p-4 shadow-[var(--shadow-soft)]"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={`label-${field.id}`}>Label</Label>
                <Input
                  id={`label-${field.id}`}
                  value={field.label}
                  onChange={(e) => {
                    const label = e.target.value;
                    // Follow the label only while the key is untouched. Once an
                    // owner edits the key it is theirs — silently renaming it
                    // would break a live form's stored data and any integration
                    // already reading that property.
                    const derived = slugifyFieldName(label);
                    patch(
                      index,
                      isDefaultName(field.name) && derived
                        ? { label, name: derived }
                        : { label },
                    );
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`name-${field.id}`}>Field name (key)</Label>
                <Input
                  id={`name-${field.id}`}
                  value={field.name}
                  onChange={(e) => patch(index, { name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`type-${field.id}`}>Type</Label>
                <select
                  id={`type-${field.id}`}
                  value={field.type}
                  onChange={(e) =>
                    patch(index, { type: e.target.value as FormFieldType })
                  }
                  className="border-border bg-background h-9 w-full rounded-md border px-3 text-sm"
                >
                  {FIELD_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {FIELD_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`ph-${field.id}`}>Placeholder</Label>
                <Input
                  id={`ph-${field.id}`}
                  value={field.placeholder ?? ""}
                  onChange={(e) =>
                    patch(index, { placeholder: e.target.value || null })
                  }
                />
              </div>
              {field.type === "select" && (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor={`opt-${field.id}`}>
                    Options (comma-separated)
                  </Label>
                  <Input
                    id={`opt-${field.id}`}
                    value={field.options.join(", ")}
                    onChange={(e) =>
                      patch(index, {
                        options: e.target.value
                          .split(",")
                          .map((o) => o.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                </div>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={field.required}
                  onChange={(e) => patch(index, { required: e.target.checked })}
                />
                Required
              </label>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  aria-label="Move up"
                >
                  <ArrowUp className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => move(index, 1)}
                  disabled={index === fields.length - 1}
                  aria-label="Move down"
                >
                  <ArrowDown className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => remove(index)}
                  aria-label="Remove field"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={add}
          disabled={fields.length >= MAX_FIELDS}
        >
          <Plus className="size-4" />
          Add field
        </Button>
        <Button onClick={save} disabled={pending || fields.length === 0}>
          {pending ? (
            <Loader2 className="animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          Save fields
        </Button>
      </div>
    </div>
  );
}
