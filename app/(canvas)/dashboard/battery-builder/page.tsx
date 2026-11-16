import type { Metadata } from "next";
import { Suspense } from "react";
import { BatteryBuilder } from "@/components/v3/battery-builder/BatteryBuilder";

export const metadata: Metadata = {
  title: "Build prompts · IntoFocus",
  description: "Build AI battery questions from shopper details",
};

export default function BatteryBuilderPage() {
  return (
    <Suspense fallback={null}>
      <BatteryBuilder />
    </Suspense>
  );
}
