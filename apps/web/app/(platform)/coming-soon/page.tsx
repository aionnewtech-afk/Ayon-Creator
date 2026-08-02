import Link from "next/link";
import { Sparkles } from "lucide-react";
import { buttonVariants, EmptyState } from "@ayon/ui";
import { NAV_ITEMS } from "@/config/navigation";

export default function ComingSoonPage({ searchParams }: { searchParams: { item?: string } }) {
  const item = NAV_ITEMS.find((navItem) => navItem.slug === searchParams.item);

  return (
    <EmptyState
      icon={item?.icon ?? Sparkles}
      title={item ? item.label : "Em breve"}
      description={
        item
          ? item.description
          : "Esta funcionalidade ainda está sendo construída. Volte em breve para conferir as novidades."
      }
      action={
        <Link href="/painel" className={buttonVariants({ variant: "outline" })}>
          Voltar ao Painel
        </Link>
      }
    />
  );
}
