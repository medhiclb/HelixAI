export function driveDocumentId(value){
 try{const u=new URL(value);if(u.protocol!=='https:'||!['drive.google.com','docs.google.com'].includes(u.hostname))return null;return u.pathname.match(/^\/(?:file|document|spreadsheets|presentation)\/d\/([a-zA-Z0-9_-]+)(?:\/|$)/)?.[1]||null;}catch{return null;}
}
