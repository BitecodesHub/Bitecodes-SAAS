import "server-only";

import { z } from "zod";

const serverEnvSchema = z.object({
  MONGODB_URI: z.string().min(1),
  MONGODB_DB_NAME: z.string().trim().min(1).default("bitecodes"),
  SMTP_HOST: z.string().trim().min(1),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535),
  SMTP_SECURE: z.enum(["true", "false"]).transform((value) => value === "true"),
  SMTP_USER: z.string().min(1),
  SMTP_PASSWORD: z.string().min(1),
  SMTP_FROM: z.string().trim().min(3),
  CONTACT_NOTIFICATION_TO: z
    .string()
    .transform((value) =>
      value
        .split(",")
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
    )
    .pipe(z.array(z.string().email()).min(1)),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let parsedEnv: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  if (parsedEnv) return parsedEnv;

  const result = serverEnvSchema.safeParse(process.env);

  if (!result.success) {
    const variables = Object.keys(result.error.flatten().fieldErrors).join(
      ", ",
    );
    throw new Error(`Server configuration is missing or invalid: ${variables}`);
  }

  parsedEnv = result.data;
  return parsedEnv;
}
