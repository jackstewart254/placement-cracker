import Cards from "./content";
import { Suspense } from "react";

export default async function ProtectedPage() {
  return (
    <Suspense fallback={<div>Loading cover letters...</div>}>
      <Cards />
    </Suspense>
  );
}
