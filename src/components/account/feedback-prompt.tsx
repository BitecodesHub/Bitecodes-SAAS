"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ThumbsUpIcon, ThumbsDownIcon } from "lucide-react";

/**
 * An in-app feedback prompt for the /app dashboard.
 *
 * Prompts the customer for NPS-style feedback (thumbs up/down) and offers
 * the option to consent to a testimonial. Owned by the lifecycle package.
 */
export function FeedbackPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [feedback, setFeedback] = useState<"thumbs-up" | "thumbs-down" | null>(
    null,
  );

  const closePrompt = () => setShowPrompt(false);

  const handleSubmit = async () => {
    if (!feedback) return;

    setShowPrompt(false);

    // In production, this would send to an API endpoint
    // to store the feedback and potentially consent to a testimonial
    console.log("Feedback submitted:", feedback);
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur">
      <div className="bg-card border-border w-full max-w-sm rounded-xl p-6 shadow-lg">
        <h3 className="mb-4 font-semibold">We love your feedback</h3>
        <p className="text-muted-foreground mb-6">
          How was your experience with Bitecodes?
        </p>
        <div className="space-y-3">
          <Button
            variant="outline"
            size="lg"
            onClick={() => {
              setFeedback("thumbs-up");
              setTimeout(closePrompt, 100);
            }}
          >
            <ThumbsUpIcon className="mr-2 size-5" /> Great
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() => {
              setFeedback("thumbs-down");
              setTimeout(closePrompt, 100);
            }}
          >
            <ThumbsDownIcon className="mr-2 size-5" /> Needs improvement
          </Button>
        </div>
        <div className="text-muted-foreground mt-6 border-t pt-6 text-xs">
          <p>
            By selecting above, you consent to potentially being featured as a
            testimonial (anonymous by default).
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={closePrompt}
          className="mt-4 w-full"
        >
          Skip
        </Button>
        <Button
          variant="default"
          size="sm"
          onClick={handleSubmit}
          className="mt-2 w-full"
          disabled={!feedback}
        >
          Submit
        </Button>
      </div>
    </div>
  );
}
