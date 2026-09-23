"use client";

import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BETA_FEEDBACK_CATEGORIES } from "@/lib/beta-types";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const CATEGORY_LABEL: Record<(typeof BETA_FEEDBACK_CATEGORIES)[number], string> = {
  bug: "Bug",
  idea: "Idea",
  scan_result: "Scan result",
  payment: "Payment",
  other: "Other",
};

type OwnFeedback = {
  id: string;
  type: string;
  note: string;
  rating: number | null;
  status: string;
  operatorStatus?: string;
  createdAt: string;
  contactMe: boolean;
};

export function BetaFeedbackForm() {
  const { user } = useAuth();
  const [category, setCategory] = useState<(typeof BETA_FEEDBACK_CATEGORIES)[number]>("bug");
  const [rating, setRating] = useState(5);
  const [message, setMessage] = useState("");
  const [contactMe, setContactMe] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [mine, setMine] = useState<OwnFeedback[]>([]);

  const loadMine = useCallback(async () => {
    if (!user) {
      setMine([]);
      return;
    }
    const res = await fetch("/api/feedback");
    const json = (await res.json().catch(() => ({}))) as { feedback?: OwnFeedback[] };
    if (res.ok) setMine(json.feedback ?? []);
  }, [user]);

  useEffect(() => {
    void loadMine();
  }, [loadMine]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: category,
        category,
        note: message,
        message,
        rating,
        contactMe,
        source: "exe",
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res.ok) {
      setStatus(json.error || "Could not send feedback.");
      return;
    }
    setMessage("");
    setContactMe(false);
    setStatus("Thanks — the Closed Beta operator received this.");
    await loadMine();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Feedback</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          Closed Beta only. Do not paste seed phrases, private keys, or PayPal secrets. The server stores your account
          id, category, rating, note, app version, and status.
        </p>
        {!user ? (
          <p>
            <Link href="/login?next=/desktop" className="text-primary underline">
              Sign in
            </Link>{" "}
            to send feedback from the Windows client.
          </p>
        ) : (
          <form className="space-y-3" onSubmit={(e) => void submit(e)}>
            <label className="block text-xs font-medium" htmlFor="exe-feedback-category">
              Category
            </label>
            <select
              id="exe-feedback-category"
              className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm"
              value={category}
              onChange={(e) => setCategory(e.target.value as (typeof BETA_FEEDBACK_CATEGORIES)[number])}
            >
              {BETA_FEEDBACK_CATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {CATEGORY_LABEL[value]}
                </option>
              ))}
            </select>
            <fieldset>
              <legend className="text-xs font-medium">Rating</legend>
              <div className="mt-1 flex gap-2">
                {[1, 2, 3, 4, 5].map((value) => (
                  <label key={value} className="flex items-center gap-1 text-xs">
                    <input
                      type="radio"
                      name="exe-feedback-rating"
                      value={value}
                      checked={rating === value}
                      onChange={() => setRating(value)}
                    />
                    {value}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="block text-xs font-medium" htmlFor="exe-feedback-message">
              Message
            </label>
            <textarea
              id="exe-feedback-message"
              required
              minLength={3}
              maxLength={1000}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="What happened? No seeds, keys, or PayPal credentials."
              className="min-h-24 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm"
            />
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={contactMe} onChange={(e) => setContactMe(e.target.checked)} />
              Contact me about this
            </label>
            <Button type="submit" disabled={busy}>
              {busy ? "Sending…" : "Submit"}
            </Button>
          </form>
        )}
        {status ? (
          <p className="text-xs" role="status">
            {status}
          </p>
        ) : null}
        {mine.length ? (
          <ul className="space-y-2 text-xs text-muted-foreground">
            {mine.map((row) => (
              <li key={row.id}>
                {row.type} · {row.operatorStatus || row.status}
                {row.rating ? ` · ${row.rating}/5` : ""} · {row.createdAt}
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}
