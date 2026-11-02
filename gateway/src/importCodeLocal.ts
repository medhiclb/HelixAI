import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { npxPrive } from "./installationOpenClaw.ts";
import { t } from "./langue.ts";

/**
 * OpenCode et Zcode, lecture seule (02/11/2026).
 * Schéma OpenCode relevé sur le poste ; Zcode : zai-org/ZCode,
 * adapters/src/storage/session-store/{paths.ts,schema.baseline.sql}.
 * Aucun lancement de ces agents, aucune lecture de leurs clés ou réglages MCP.
 * Le Node privé déjà posé par Helix sert sous Windows ; sqlite3 en repli.
 */
export type SourceCode = "opencode" | "zcode";
const exec = promisify(execFile);
export const baseCode = (source: SourceCode) => source === "zcode"
  ? join(homedir(), ".zcode", "cli", "db", "db.sqlite")
  : process.env.OPENCODE_DB
    ? resolve(process.env.XDG_DATA_HOME ?? join(homedir(), ".local", "share"), "opencode", process.env.OPENCODE_DB)
    : join(process.env.XDG_DATA_HOME ?? join(homedir(), ".local", "share"), "opencode", "opencode.db");

// Programme constant, arguments distincts ; readOnly interdit migrations et écritures.
const LECTEUR = `const {DatabaseSync}=require('node:sqlite'); const d=new DatabaseSync(process.argv[1],{readOnly:true});try {console.log(JSON.stringify(d.prepare(process.argv[2]).all()))}finally{d.close()}`;
export async function lireBaseCode(source: SourceCode, requete: string): Promise<Record<string, unknown>[]> {
  const base = baseCode(source);
  if (!existsSync(base)) return [];
  const node = npxPrive()?.node ?? (!process.versions.electron ? process.execPath : null);
  try {
    const args = node ? ["-e", LECTEUR, base, requete] : ["-readonly", "-json", base, requete];
    const { stdout } = await exec(node ?? "sqlite3", args, { timeout: 15_000, maxBuffer: 24 * 1024 * 1024, encoding: "utf8" });
    return stdout.trim() ? JSON.parse(stdout) as Record<string, unknown>[] : [];
  } catch {
    // Une base illisible ne devient jamais un historique vide présenté comme réussi.
    throw new Error(t("L'historique local n'a pas pu être lu. Fermez le logiciel d'origine, puis réessayez."));
  }
}

export async function sessionsCodeLocales(source: SourceCode) {
  const filtre = source === "zcode" ? "and time_deleted is null" : "";
  return lireBaseCode(source, `select id, directory, title, time_created, time_updated,
    (select count(distinct m.id) from message m join part p on p.message_id=m.id where m.session_id=s.id
      and json_extract(p.data,'$.type')='text' and json_extract(m.data,'$.role') in ('user','assistant')
      and coalesce(json_extract(p.data,'$.synthetic'),0)=0 and length(trim(json_extract(p.data,'$.text')))>0) as messages,
    (select coalesce(sum(min(length(json_extract(p.data,'$.text')),20000)+80),0)+200 from part p where p.session_id=s.id and json_extract(p.data,'$.type')='text') as taille
    from session s where parent_id is null ${filtre} order by time_updated desc, id limit 5000`);
}

export async function messagesCodeLocaux(source: SourceCode, id: string) {
  // Seuls les identifiants du relevé sont acceptés par importLocal.ts ; validation en plus.
  if (!/^[\w-]{1,160}$/.test(id)) return [];
  const ordre = source === "zcode" ? "coalesce(m.sequence,m.time_created),m.id,coalesce(p.sequence,p.time_created),p.id" : "m.time_created,m.id,p.time_created,p.id";
  return lireBaseCode(source, `select m.id, m.time_created, json_extract(m.data,'$.role') as role,
    substr(json_extract(p.data,'$.text'),1,20000) as text from message m join part p on p.message_id=m.id
    where m.session_id='${id}' and p.session_id=m.session_id and json_extract(p.data,'$.type')='text'
    and coalesce(json_extract(p.data,'$.synthetic'),0)=0 order by ${ordre} limit 5000`);
}
