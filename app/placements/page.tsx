import Cards from "./content";
import { Suspense } from "react";

export default async function ProtectedPage() {
  return (
    <div className="w-full h-[calc(100vh-4rem)] flex flex-col">
      <div className="flex-1 overflow-hidden">
        <Suspense fallback={<div>Loading cover letters...</div>}>
          <Cards />
        </Suspense>
      </div>
    </div>
  );
}
