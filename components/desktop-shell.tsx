"use client";

import { BetaFeedbackForm } from "@/components/beta-feedback-form";
import { SubscriptionPanel } from "@/components/subscription-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Suspense } from "react";

export function DesktopShell() {
  return (
    <Tabs defaultValue="billing" className="w-full">
      <TabsList>
        <TabsTrigger value="billing">Subscription</TabsTrigger>
        <TabsTrigger value="feedback">Feedback</TabsTrigger>
      </TabsList>
      <TabsContent value="billing">
        <Suspense fallback={<p className="text-sm text-muted-foreground">Loading subscription…</p>}>
          <SubscriptionPanel variant="exe" />
        </Suspense>
      </TabsContent>
      <TabsContent value="feedback">
        <BetaFeedbackForm />
      </TabsContent>
    </Tabs>
  );
}
