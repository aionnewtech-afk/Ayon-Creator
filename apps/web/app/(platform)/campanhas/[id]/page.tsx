import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/session";
import { ContentPackageReview } from "../../criar-campanha/content-package-review";
import { getCampaignContentPiecesAction } from "../../criar-campanha/asset-actions";

export default async function CampanhaDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const session = await getCurrentSession();
  if (!session?.brand || !session.membership) {
    redirect("/painel");
  }

  const result = await getCampaignContentPiecesAction(id);
  if (!result.ok || !result.contentPieces) {
    redirect("/campanhas");
  }

  return (
    <ContentPackageReview
      brandName={session.brand.name}
      initialContentPieces={result.contentPieces}
      campaignTitle={result.campaignTitle}
      initialPackageReady={result.campaignStatus === "package_ready"}
      initialDownloadUrl={result.packageDownloadUrl}
    />
  );
}
