import Cards from "./content";

export default async function ProtectedPage() {
  return (
    <div className="w-full h-[calc(100vh-4rem)] flex flex-col">
      <div className="flex-1 overflow-hidden">
        <Cards />
      </div>
    </div>
  );
}
