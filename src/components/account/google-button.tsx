import Link from "next/link";

/**
 * "Continue with Google".
 *
 * A link, not a button with an onClick: starting the flow is a plain navigation
 * to `/api/google/start`, so this works with JavaScript disabled and shows the
 * destination on hover like any other link.
 *
 * The mark is inlined rather than fetched. Google's brand guidelines require
 * the four-colour "G" unaltered, and loading it from their CDN would leak the
 * fact that somebody is looking at our sign-in page to a third party before
 * they have chosen to involve one.
 */
export function GoogleButton({
  next,
  label = "Continue with Google",
}: {
  next?: string;
  label?: string;
}) {
  const href = next
    ? `/api/google/start?next=${encodeURIComponent(next)}`
    : "/api/google/start";

  return (
    <Link
      href={href}
      // `prefetch={false}`: this URL mints PKCE secrets and sets a cookie, so
      // Next quietly fetching it on hover would start a sign-in nobody asked
      // for and overwrite the state of one already in progress.
      prefetch={false}
      className="border-border bg-background hover:bg-muted focus-visible:ring-ring flex w-full items-center justify-center gap-2.5 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
    >
      <GoogleMark />
      {label}
    </Link>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 18 18" className="size-[18px]">
      <path
        fill="#4285F4"
        d="M17.64 9.2045c0-.6381-.0573-1.2518-.1636-1.8409H9v3.4814h4.8436c-.2086 1.125-.8427 2.0782-1.7959 2.7164v2.2581h2.9087c1.7018-1.5668 2.6836-3.874 2.6836-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.4673-.806 5.9564-2.1805l-2.9087-2.2581c-.8059.54-1.8368.859-3.0477.859-2.344 0-4.3282-1.5831-5.036-3.7104H.9574v2.3318C2.4382 15.9832 5.4818 18 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.71c-.18-.54-.2822-1.1168-.2822-1.71s.1023-1.17.2823-1.71V4.9582H.9573A8.9965 8.9965 0 0 0 0 9c0 1.4523.3477 2.8268.9573 4.0418L3.964 10.71z"
      />
      <path
        fill="#EA4335"
        d="M9 3.5795c1.3214 0 2.5077.4541 3.4405 1.346l2.5813-2.5814C13.4632.8918 11.426 0 9 0 5.4818 0 2.4382 2.0168.9573 4.9582L3.964 7.29C4.6718 5.1627 6.6559 3.5795 9 3.5795z"
      />
    </svg>
  );
}
