"use client";

import dynamic from "next/dynamic";

// relativ sti fra app/ → components/
const PennyScoreStepper = dynamic(
  () => import("../components/PennyScoreStepper"),
  { ssr: false }
);

export default function Page() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <PennyScoreStepper />
    </div>
  );
}
