/** Minimal GIS + token client typings used by Lingrow auth. */

interface GoogleTokenResponse {
  access_token: string
  expires_in: number
  scope: string
  token_type: string
  error?: string
  error_description?: string
}

interface GoogleTokenClientConfig {
  client_id: string
  scope: string
  callback: (response: GoogleTokenResponse) => void
  error_callback?: (error: { type?: string; message?: string }) => void
  prompt?: "" | "none" | "consent" | "select_account"
}

interface GoogleTokenClient {
  requestAccessToken: (overrideConfig?: { prompt?: string }) => void
}

interface GoogleAccountsOAuth2 {
  initTokenClient: (config: GoogleTokenClientConfig) => GoogleTokenClient
  revoke: (token: string, done?: () => void) => void
}

interface GoogleAccountsId {
  initialize: (config: {
    client_id: string
    callback: (response: { credential: string }) => void
    auto_select?: boolean
  }) => void
  renderButton: (
    parent: HTMLElement,
    options: Record<string, string | number | boolean>
  ) => void
  prompt: () => void
  disableAutoSelect: () => void
}

interface GoogleAccounts {
  id: GoogleAccountsId
  oauth2: GoogleAccountsOAuth2
}

interface Google {
  accounts: GoogleAccounts
}

interface Window {
  google?: Google
}
