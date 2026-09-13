import { notFound } from "next/navigation";
import { getCatalogue, requireViewer } from "@/lib/data";
import { AdminCatalogue } from "@/components/admin-catalogue";
export const metadata = { title: "Manage coasters" };
export default async function AdminPage() {
  const viewer = await requireViewer();
  if (!viewer.isAdmin) notFound();
  const coasters = await getCatalogue(true);
  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">LOOK AFTER THE COLLECTION</p>
          <h1>
            Good data. <span>Better adventures.</span>
          </h1>
          <p className="page-intro">
            A trustworthy catalogue for everyone who loves the ride.
          </p>
        </div>
        <span className="status-pill">Catalogue admin</span>
      </header>
      <AdminCatalogue coasters={coasters} />
    </>
  );
}
