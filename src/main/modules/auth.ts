import { createHash, randomUUID } from "node:crypto"
import { BrowserWindow } from "electron"
import { store } from "../store.js"
import type { Account } from "../../shared/types.js"

/* ------------------------------------------------------------------ */
/* Offline accounts                                                    */
/* ------------------------------------------------------------------ */

/**
 * Reproduce Java's `UUID.nameUUIDFromBytes(("OfflinePlayer:" + name))`, which
 * is a type-3 (MD5) name-based UUID. This is exactly what the vanilla server
 * uses to derive a UUID for offline players, so worlds/permissions stay stable.
 */
export function offlineUuid(username: string): string {
  const hash = createHash("md5").update(`OfflinePlayer:${username}`, "utf8").digest()
  hash[6] = (hash[6] & 0x0f) | 0x30 // version 3
  hash[8] = (hash[8] & 0x3f) | 0x80 // IETF variant
  const hex = hash.toString("hex")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export function loginOffline(username: string): Account {
  const trimmed = username.trim()
  if (!/^[A-Za-z0-9_]{3,16}$/.test(trimmed)) {
    throw new Error("Username must be 3-16 characters: letters, numbers or underscore.")
  }

  const account: Account = {
    id: randomUUID(),
    kind: "offline",
    username: trimmed,
    uuid: offlineUuid(trimmed),
    active: false,
    // Render a real Minecraft head (Steve/Alex fallback for unknown names).
    avatarUrl: `https://mc-heads.net/avatar/${encodeURIComponent(trimmed)}/64`,
  }

  const accounts = store.getAccounts().filter((a) => !(a.kind === "offline" && a.username === trimmed))
  accounts.push(account)
  persistWithActive(accounts, account.id)
  return account
}

/* ------------------------------------------------------------------ */
/* Microsoft OAuth2 -> Xbox Live -> XSTS -> Minecraft                  */
/* ------------------------------------------------------------------ */

// The vanilla launcher's public MSA client id. Override with AZURE_CLIENT_ID
// to use your own Azure app registration.
const CLIENT_ID = process.env.AZURE_CLIENT_ID ?? "00000000402b5328"
const REDIRECT_URI = "https://login.live.com/oauth20_desktop.srf"
const SCOPE = "XboxLive.signin offline_access"

interface MsToken {
  access_token: string
  refresh_token: string
  expires_in: number
}

/** Drive the interactive consent step in a dedicated window and capture the code. */
function acquireAuthCode(): Promise<string> {
  return new Promise((resolve, reject) => {
    const authUrl =
      "https://login.live.com/oauth20_authorize.srf?" +
      new URLSearchParams({
        client_id: CLIENT_ID,
        response_type: "code",
        redirect_uri: REDIRECT_URI,
        scope: SCOPE,
        prompt: "select_account",
      }).toString()

    const win = new BrowserWindow({
      width: 480,
      height: 640,
      title: "Sign in with Microsoft",
      autoHideMenuBar: true,
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    })

    let settled = false
    const finish = (fn: () => void): void => {
      if (settled) return
      settled = true
      fn()
      if (!win.isDestroyed()) win.close()
    }

    const inspect = (url: string): void => {
      if (!url.startsWith(REDIRECT_URI)) return
      const params = new URL(url).searchParams
      const code = params.get("code")
      const error = params.get("error")
      if (code) finish(() => resolve(code))
      else if (error) finish(() => reject(new Error(params.get("error_description") ?? error)))
    }

    win.webContents.on("will-redirect", (_e, url) => inspect(url))
    win.webContents.on("will-navigate", (_e, url) => inspect(url))
    win.on("closed", () => {
      if (!settled) reject(new Error("Sign-in window was closed before completing."))
    })

    void win.loadURL(authUrl)
  })
}

async function exchangeCodeForToken(code: string): Promise<MsToken> {
  return postForm("https://login.live.com/oauth20_token.srf", {
    client_id: CLIENT_ID,
    code,
    grant_type: "authorization_code",
    redirect_uri: REDIRECT_URI,
    scope: SCOPE,
  })
}

async function refreshMsToken(refreshToken: string): Promise<MsToken> {
  return postForm("https://login.live.com/oauth20_token.srf", {
    client_id: CLIENT_ID,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
    redirect_uri: REDIRECT_URI,
    scope: SCOPE,
  })
}

async function postForm<T>(url: string, body: Record<string, string>): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  })
  if (!res.ok) throw new Error(`Token endpoint failed (${res.status})`)
  return (await res.json()) as T
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`${url} failed (${res.status})`)
  return (await res.json()) as T
}

interface XblResponse {
  Token: string
  DisplayClaims: { xui: { uhs: string }[] }
}

async function xboxLiveAuth(msAccessToken: string): Promise<XblResponse> {
  return postJson("https://user.auth.xboxlive.com/user/authenticate", {
    Properties: {
      AuthMethod: "RPS",
      SiteName: "user.auth.xboxlive.com",
      RpsTicket: `d=${msAccessToken}`,
    },
    RelyingParty: "http://auth.xboxlive.com",
    TokenType: "JWT",
  })
}

async function xstsAuth(xblToken: string): Promise<XblResponse> {
  const res = await fetch("https://xsts.auth.xboxlive.com/xsts/authorize", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      Properties: { SandboxId: "RETAIL", UserTokens: [xblToken] },
      RelyingParty: "rp://api.minecraftservices.com/",
      TokenType: "JWT",
    }),
  })
  if (res.status === 401) {
    const err = (await res.json()) as { XErr?: number }
    throw new Error(mapXstsError(err.XErr))
  }
  if (!res.ok) throw new Error(`XSTS failed (${res.status})`)
  return (await res.json()) as XblResponse
}

function mapXstsError(xerr?: number): string {
  switch (xerr) {
    case 2148916233:
      return "This Microsoft account has no Xbox profile. Create one first at xbox.com."
    case 2148916235:
      return "Xbox Live is not available in this account's region."
    case 2148916238:
      return "This account is a child and must be added to a Family by an adult."
    default:
      return "Xbox Live authorization failed."
  }
}

interface McLoginResponse {
  access_token: string
  expires_in: number
}

interface McProfile {
  id: string
  name: string
}

async function minecraftLogin(uhs: string, xstsToken: string): Promise<McLoginResponse> {
  return postJson("https://api.minecraftservices.com/authentication/login_with_xbox", {
    identityToken: `XBL3.0 x=${uhs};${xstsToken}`,
  })
}

async function minecraftProfile(accessToken: string): Promise<McProfile> {
  const res = await fetch("https://api.minecraftservices.com/minecraft/profile", {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (res.status === 404) {
    throw new Error("This Microsoft account does not own Minecraft: Java Edition.")
  }
  if (!res.ok) throw new Error(`Profile lookup failed (${res.status})`)
  return (await res.json()) as McProfile
}

/** Format a bare 32-char profile id into a dashed UUID. */
function dashUuid(id: string): string {
  return `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20)}`
}

/** Run the full chain from a fresh MS token to a Minecraft profile + account. */
async function completeChain(msToken: MsToken, existingId?: string): Promise<{ account: Account; mcToken: string }> {
  const xbl = await xboxLiveAuth(msToken.access_token)
  const xsts = await xstsAuth(xbl.Token)
  const uhs = xsts.DisplayClaims.xui[0].uhs
  const mc = await minecraftLogin(uhs, xsts.Token)
  const profile = await minecraftProfile(mc.access_token)

  const account: Account = {
    id: existingId ?? randomUUID(),
    kind: "microsoft",
    username: profile.name,
    uuid: dashUuid(profile.id),
    active: false,
    expiresAt: Date.now() + mc.expires_in * 1000,
    avatarUrl: `https://crafatar.com/avatars/${profile.id}?size=64&overlay`,
  }

  store.setSecret(account.id, msToken.refresh_token)
  return { account, mcToken: mc.access_token }
}

export async function loginMicrosoft(): Promise<Account> {
  const code = await acquireAuthCode()
  const msToken = await exchangeCodeForToken(code)
  const { account } = await completeChain(msToken)

  const accounts = store.getAccounts().filter((a) => a.uuid !== account.uuid)
  accounts.push(account)
  persistWithActive(accounts, account.id)
  return account
}

/**
 * Return a valid Minecraft access token for an account, silently refreshing
 * the Microsoft token when it has expired. Throws if re-consent is required.
 */
export async function getValidMinecraftToken(accountId: string): Promise<string> {
  const refresh = store.getSecret(accountId)
  if (!refresh) throw new Error("This account needs to sign in with Microsoft again.")
  const msToken = await refreshMsToken(refresh)
  const { account, mcToken } = await completeChain(msToken, accountId)
  const accounts = store.getAccounts().map((a) => (a.id === accountId ? { ...a, ...account } : a))
  store.saveAccounts(accounts)
  return mcToken
}

/* ------------------------------------------------------------------ */
/* Account management helpers                                          */
/* ------------------------------------------------------------------ */

function persistWithActive(accounts: Account[], activeId: string): void {
  store.saveAccounts(accounts.map((a) => ({ ...a, active: a.id === activeId })))
}

export function listAccounts(): Account[] {
  return store.getAccounts()
}

export function removeAccount(id: string): void {
  const remaining = store.getAccounts().filter((a) => a.id !== id)
  // Keep exactly one active account when possible.
  if (remaining.length > 0 && !remaining.some((a) => a.active)) {
    remaining[0].active = true
  }
  store.saveAccounts(remaining)
  store.removeSecret(id)
}

export function setActiveAccount(id: string): void {
  const accounts = store.getAccounts()
  if (!accounts.some((a) => a.id === id)) throw new Error("Unknown account.")
  store.saveAccounts(accounts.map((a) => ({ ...a, active: a.id === id })))
}
