import { AppError, check } from "./crm.mjs";
export async function claimOperation(ctx, key, kind) {
  if (!/^[0-9a-f-]{36}$/i.test(key || ""))
    throw new AppError("Identifiant de requête invalide.");
  const { data, error } = await ctx.client
    .from("crm_outbox")
    .insert({
      workspace_id: ctx.workspace,
      user_id: ctx.user.id,
      request_key: key,
      kind,
    })
    .select()
    .single();
  if (!error) return { operation: data };
  if (error.code !== "23505") throw error;
  const prior = check(
    await ctx.client
      .from("crm_outbox")
      .select("*")
      .eq("user_id", ctx.user.id)
      .eq("request_key", key)
      .single()
  );
  if (prior.workspace_id !== ctx.workspace || prior.kind !== kind)
    throw new AppError("Identifiant de requête déjà utilisé.", 409);
  if (prior.status === "accepted") return { result: prior.result };
  throw new AppError(
    prior.status === "pending" || prior.status === "uncertain"
      ? "Cette opération est en cours ou son résultat est incertain. Vérifiez votre boîte Envoyés ou votre agenda avant de recommencer."
      : prior.error ||
        "Cette opération a échoué. Corrigez-la avant de réessayer.",
    409
  );
}
export async function finishOperation(ctx, op, result) {
  check(
    await ctx.client
      .from("crm_outbox")
      .update({ status: "accepted", result })
      .eq("id", op.id)
  );
  return result;
}
export async function failOperation(ctx, op, error) {
  if (!op) return;
  await ctx.client
    .from("crm_outbox")
    .update({
      status:
        error.providerStatus && error.providerStatus < 500
          ? "failed"
          : "uncertain",
      error: error.message,
    })
    .eq("id", op.id);
}
