"use client";

import { Suspense } from "react";
import CVsAndLetters from "./content";

export default function Page() {
  return (
    <Suspense fallback={<div>Loading cover letters...</div>}>
      <CVsAndLetters />
    </Suspense>
  );
}
