const GIS_SRC = "https://accounts.google.com/gsi/client"

let loading: Promise<void> | null = null

export function loadGoogleIdentityServices(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Identity Services requires a browser"))
  }
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  if (loading) return loading

  loading = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SRC}"]`)
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true })
      existing.addEventListener("error", () => reject(new Error("Failed to load Google script")), {
        once: true,
      })
      if (window.google?.accounts?.oauth2) resolve()
      return
    }

    const script = document.createElement("script")
    script.src = GIS_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => {
      loading = null
      reject(new Error("Failed to load Google Identity Services"))
    }
    document.head.appendChild(script)
  })

  return loading
}

export interface GoogleUserInfo {
  sub: string
  email: string
  name: string
  picture?: string
}

export async function fetchGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    throw new Error("Could not load Google profile")
  }
  const data = (await res.json()) as {
    sub?: string
    email?: string
    name?: string
    picture?: string
  }
  if (!data.sub || !data.email || !data.name) {
    throw new Error("Google profile was incomplete")
  }
  return {
    sub: data.sub,
    email: data.email,
    name: data.name,
    picture: data.picture,
  }
}
