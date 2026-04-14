const SITE_ACCESS_STORAGE_KEY = "ff14_workshop_site_access";
const SITE_ACCESS_SHA256 =
  "6958b282a614429ed8e5b00a28bc13d253fd8993e684b9f4f47d1177e85fe33f";

function bytesToHex(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

async function sha256HexUtf8(text: string): Promise<string | null> {
  try {
    if (!globalThis.crypto?.subtle) return null;
    const data = new TextEncoder().encode(text);
    const digest = await globalThis.crypto.subtle.digest("SHA-256", data);
    return bytesToHex(new Uint8Array(digest));
  } catch {
    return null;
  }
}

export async function hasSiteAccess(): Promise<boolean> {
  try {
    if (typeof window === "undefined" || typeof localStorage === "undefined") {
      return false;
    }
    const raw = localStorage.getItem(SITE_ACCESS_STORAGE_KEY);
    if (raw == null || raw === "") return false;
    const hex = await sha256HexUtf8(raw);
    if (hex == null) return false;
    return hex === SITE_ACCESS_SHA256;
  } catch {
    return false;
  }
}

/** 驗證密語；正確則寫入 localStorage 並回傳 true */
export async function tryStoreSiteAccess(passcode: string): Promise<boolean> {
  const trimmed = passcode.trim();
  if (!trimmed) return false;
  const hex = await sha256HexUtf8(trimmed);
  if (hex == null || hex !== SITE_ACCESS_SHA256) return false;
  try {
    localStorage.setItem(SITE_ACCESS_STORAGE_KEY, trimmed);
    return true;
  } catch {
    return false;
  }
}
