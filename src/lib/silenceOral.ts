/** Ne termine jamais une réponse sur le seul silence initial ou sur un clic bref. */
export class SilenceOral {
 private debut: number | null = null;
 private derniereVoix = 0;
 private parole = false;
 observer(niveau: number, maintenant: number): boolean {
  if (niveau >= 0.025) {
   if (this.debut === null) this.debut = maintenant;
   if (maintenant - this.debut >= 200) this.parole = true;
   this.derniereVoix = maintenant;
  } else if (!this.parole) this.debut = null;
  return this.parole && maintenant - this.derniereVoix >= 1800;
 }
}
