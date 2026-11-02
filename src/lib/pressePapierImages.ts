/** Ne lit que les fichiers du collage explicite, jamais le presse-papiers en arrière-plan ni une URL distante. */
export function imagesDuCollage(pressePapier: Pick<DataTransfer, "items" | "files">): File[] {
  const fichiers: File[] = [];
  for (const element of Array.from(pressePapier.items ?? [])) {
    if (element.kind !== "file" || !element.type.startsWith("image/")) continue;
    const fichier = element.getAsFile();
    if (fichier) fichiers.push(fichier);
  }
  if (!fichiers.length) fichiers.push(...Array.from(pressePapier.files ?? []).filter(f => f.type.startsWith("image/")));
  return fichiers;
}
