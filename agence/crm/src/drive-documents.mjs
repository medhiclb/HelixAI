export function driveDocumentId(value){
 try{const u=new URL(value);if(u.protocol!=='https:'||!['drive.google.com','docs.google.com'].includes(u.hostname))return null;return u.pathname.match(/^\/(?:file|document|spreadsheets|presentation)\/d\/([a-zA-Z0-9_-]+)(?:\/|$)/)?.[1]||null;}catch{return null;}
}

export function driveLinks(records) {
 const links = new Map();
 for (const record of records) {
  for (const line of (record.description || "").split("\n")) {
   for (const match of line.matchAll(/https:\/\/[^\s<>"')]+/g)) {
    const href = match[0].replace(/[.,;]+$/, "");
    let url;
    try { url = new URL(href); } catch { continue; }
    const file = driveDocumentId(href);
    const folder = url.hostname === "drive.google.com" && url.pathname.match(/^\/drive\/folders\/([\w-]+)\/?$/)?.[1];
    if ((!file && !folder) || links.has(file || folder)) continue;
    const label = line.slice(0, match.index).trim().replace(/[:–—]+\s*$/, "").trim();
    links.set(file || folder, { href, file, label: label || record.name || "Document Drive" });
   }
  }
 }
 return [...links.values()];
}
