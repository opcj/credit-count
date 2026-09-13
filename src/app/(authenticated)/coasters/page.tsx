import { getCatalogue, requireViewer } from "@/lib/data";
import { Catalogue } from "@/components/catalogue";
export const metadata = { title: "Coaster catalogue" };
export default async function CoastersPage() {
  await requireViewer();
  const coasters = await getCatalogue();
  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">THE NEXT ONE IS OUT THERE</p>
          <h1>
            Pick your <span>next scream.</span>
          </h1>
          <p className="page-intro">
            Wooden legends. Steel giants. Your next favourite is in here.
          </p>
        </div>
        <span className="status-pill">
          {coasters.length} coasters · one shared collection
        </span>
      </header>
      <Catalogue coasters={coasters} />
    </>
  );
}
