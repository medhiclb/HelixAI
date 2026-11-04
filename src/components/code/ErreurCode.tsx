import { useEffect, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { InfoBox } from "@/components/ui/InfoBox";
import { Button } from "@/components/ui/Button";
import { copierTexte } from "@/lib/pressePapiers";
import { t } from "@/lib/i18n";

/** Le message exact reste lisible et copiable pour comprendre un signalement. */
export function ErreurCode({ message }: { message: string }) {
  const [copie, setCopie] = useState(false);
  const [refus, setRefus] = useState(false);
  useEffect(() => { setCopie(false); setRefus(false); }, [message]);
  return <InfoBox tone="warning" className="mt-4" leading={<TriangleAlert size={15} strokeWidth={1.75} />}>
    <p className="whitespace-pre-wrap break-words">{message}</p>
    <Button variant="ghost" size="sm" onClick={async () => { const ok = await copierTexte(message); setCopie(ok); setRefus(!ok); }}>{copie ? t("Copié") : t("Copier")}</Button>
    {refus && <p role="status">{t("Sélectionnez le message pour le copier manuellement.")}</p>}
  </InfoBox>;
}
