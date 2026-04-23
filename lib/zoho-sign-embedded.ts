/**
 * Zoho Sign embedded signing via REST + OAuth refresh token.
 *
 * Flow:
 * - refresh access token
 * - create request (multipart with file + data, with is_embedded: true)
 * - submit request
 * - generate embedtoken URL (sign_url)
 */

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing ${name}`)
  return v
}

function accountsHost(): string {
  return (process.env.ZOHO_ACCOUNTS_HOST || "https://accounts.zoho.com").replace(/\/$/, "")
}

function signApiBase(): string {
  const configured = (process.env.ZOHO_SIGN_API_BASE || "").trim().replace(/\/$/, "")
  if (!configured) return "https://sign.zoho.com"
  if (/^https?:\/\/www\.zoho\.com$/i.test(configured)) return "https://sign.zoho.com"
  return configured
}

async function getAccessToken(): Promise<string> {
  const clientId = requireEnv("ZOHO_SIGN_CLIENT_ID")
  const clientSecret = requireEnv("ZOHO_SIGN_CLIENT_SECRET")
  const refreshToken = requireEnv("ZOHO_SIGN_REFRESH_TOKEN")

  const tokenUrl = `${accountsHost()}/oauth/v2/token`
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
  })

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  })

  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Zoho OAuth failed: ${res.status} ${t}`)
  }

  const data = (await res.json()) as { access_token?: string }
  if (!data.access_token) throw new Error("Zoho token response missing access_token")
  return data.access_token
}

type ZohoRequestGetResponse = {
  status?: string
  message?: string
  requests?: {
    request_id?: string
    request_status?: string
    actions?: Array<{
      action_id?: string
      recipient_email?: string
      recipient_name?: string
      action_type?: string
      is_embedded?: boolean
    }>
  }
}

async function loadAuthorizationPdfBuffer(opts: {
  primaryUrl: string
  fallbackUrl?: string
}): Promise<Buffer> {
  const tryFetch = async (u: string) => {
    const r = await fetch(u)
    return { r, u }
  }

  const primary = await tryFetch(opts.primaryUrl)
  if (primary.r.ok) return Buffer.from(await primary.r.arrayBuffer())

  if (opts.fallbackUrl && opts.fallbackUrl !== opts.primaryUrl) {
    const fb = await tryFetch(opts.fallbackUrl)
    if (fb.r.ok) return Buffer.from(await fb.r.arrayBuffer())
  }

  throw new Error(`Could not load authorization PDF (${primary.r.status})`)
}

function maybeRedirectPages(returnUrl: string) {
  // Zoho Sign rejects non-https redirect URLs (commonly shows "Url has invalid scheme").
  // In local dev we often run on http://localhost, so omit redirects there.
  if (!/^https:\/\//i.test(returnUrl)) return undefined
  return {
    sign_success: returnUrl,
    sign_completed: returnUrl,
    sign_declined: returnUrl,
    sign_later: returnUrl,
  }
}

type ZohoCreateResponse = {
  status?: string
  message?: string
  requests?: {
    request_id?: string
    request_status?: string
    document_ids?: Array<{ document_id?: string; document_name?: string }>
    actions?: Array<{ action_id?: string; recipient_email?: string; recipient_name?: string; action_type?: string }>
  }
}

type ZohoEmbedTokenResponse = {
  status?: string
  message?: string
  sign_url?: string
}

type ZohoTemplateGetResponse = {
  status?: string
  message?: string
  templates?: {
    template_id?: string
    template_name?: string
    actions?: Array<{
      action_id?: string
      action_type?: string
      role?: string
      recipient_name?: string
      recipient_email?: string
    }>
  }
}

type ZohoTemplateCreateDocumentResponse = {
  status?: string
  message?: string
  requests?: {
    request_id?: string
    actions?: Array<{ action_id?: string; action_type?: string; recipient_email?: string }>
  }
}

async function generateEmbedSigningUrl(params: {
  requestId: string
  actionId: string
  returnUrl: string
  publicOrigin?: string
}): Promise<{ signingUrl: string; requestId: string; actionId: string }> {
  const accessToken = await getAccessToken()
  const base = signApiBase()

  const explicitHost = (process.env.ZOHO_SIGN_EMBED_HOST || "").trim().replace(/\/$/, "")
  const appUrl =
    params.publicOrigin?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    ""
  const host = explicitHost || appUrl || new URL(params.returnUrl).origin

  // Zoho Sign requires an https host for embedded signing.
  // Localhost http URLs will be rejected with "Url has invalid scheme".
  if (!/^https:\/\//i.test(host)) {
    throw new Error(
      `Zoho Sign embedded signing requires an https host. Set ZOHO_SIGN_EMBED_HOST or NEXT_PUBLIC_APP_URL to your public https domain (e.g. https://hr.nexusmedpro.com), not "${host}".`
    )
  }

  const embedBody = new URLSearchParams({ host })

  const embedRes = await fetch(
    `${base}/api/v1/requests/${encodeURIComponent(params.requestId)}/actions/${encodeURIComponent(params.actionId)}/embedtoken`,
    {
      method: "POST",
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: embedBody.toString(),
    }
  )

  const embedText = await embedRes.text()
  const embedJson = (() => {
    try {
      return JSON.parse(embedText) as ZohoEmbedTokenResponse
    } catch {
      return {} as ZohoEmbedTokenResponse
    }
  })()

  if (!embedRes.ok || embedJson.status !== "success" || !embedJson.sign_url) {
    throw new Error(
      `Zoho Sign embedtoken failed: ${embedRes.status} ${embedJson.message || embedText || "Unknown error"}`
    )
  }

  return { signingUrl: embedJson.sign_url, requestId: params.requestId, actionId: params.actionId }
}

export async function createZohoEmbeddedSigningUrlForExistingRequest(params: {
  requestId: string
  /** if omitted, will pick first SIGN action or match by recipientEmail */
  actionId?: string
  recipientEmail?: string
  returnUrl: string
  publicOrigin?: string
}): Promise<{ signingUrl: string; requestId: string; actionId: string }> {
  const accessToken = await getAccessToken()
  const base = signApiBase()

  const reqRes = await fetch(`${base}/api/v1/requests/${encodeURIComponent(params.requestId)}`, {
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
  })
  const reqText = await reqRes.text()
  const reqJson = (() => {
    try {
      return JSON.parse(reqText) as ZohoRequestGetResponse
    } catch {
      return {} as ZohoRequestGetResponse
    }
  })()

  if (!reqRes.ok || reqJson.status !== "success") {
    throw new Error(
      `Zoho Sign get request failed: ${reqRes.status} ${reqJson.message || reqText || "Unknown error"}`
    )
  }

  const actions = reqJson.requests?.actions || []
  let actionId = params.actionId?.trim() || ""

  if (!actionId) {
    const targetEmail = (params.recipientEmail || "").trim().toLowerCase()
    const match =
      (targetEmail
        ? actions.find((a) => (a.recipient_email || "").trim().toLowerCase() === targetEmail)
        : undefined) || actions.find((a) => a.action_type === "SIGN") || actions[0]
    actionId = (match?.action_id || "").trim()
  }

  if (!actionId) throw new Error("Could not determine Zoho Sign action_id for embedded signing")

  return await generateEmbedSigningUrl({
    requestId: params.requestId,
    actionId,
    returnUrl: params.returnUrl,
    publicOrigin: params.publicOrigin,
  })
}

export async function createZohoEmbeddedSigningFromTemplate(params: {
  templateId: string
  email: string
  name: string
  returnUrl: string
  publicOrigin?: string
}): Promise<{ signingUrl: string; requestId: string; actionId: string }> {
  const accessToken = await getAccessToken()
  const base = signApiBase()

  // Fetch template to get the template action_id(s)
  const tRes = await fetch(`${base}/api/v1/templates/${encodeURIComponent(params.templateId)}`, {
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
  })
  const tText = await tRes.text()
  const tJson = (() => {
    try {
      return JSON.parse(tText) as ZohoTemplateGetResponse
    } catch {
      return {} as ZohoTemplateGetResponse
    }
  })()

  if (!tRes.ok || tJson.status !== "success") {
    throw new Error(
      `Zoho Sign get template failed: ${tRes.status} ${tJson.message || tText || "Unknown error"}`
    )
  }

  const templateActionId =
    (tJson.templates?.actions || []).find((a) => a.action_type === "SIGN")?.action_id ||
    tJson.templates?.actions?.[0]?.action_id ||
    ""

  if (!templateActionId) throw new Error("Zoho Sign template missing action_id")

  // Create a request from the template (quicksend so it’s ready for signing)
  const createData = {
    templates: {
      request_name: tJson.templates?.template_name || "Authorization release form",
      field_data: {
        field_text_data: {},
        field_boolean_data: {},
        field_date_data: {},
      },
      actions: [
        {
          action_id: String(templateActionId),
          action_type: "SIGN",
          recipient_name: params.name,
          recipient_email: params.email,
          verify_recipient: false,
          verification_type: "EMAIL",
          is_embedded: true,
        },
      ],
      notes: "",
      ...(maybeRedirectPages(params.returnUrl)
        ? { redirect_pages: maybeRedirectPages(params.returnUrl) }
        : {}),
    },
  }

  const createBody = new URLSearchParams({
    data: JSON.stringify(createData),
  })

  const createRes = await fetch(
    `${base}/api/v1/templates/${encodeURIComponent(params.templateId)}/createdocument?is_quicksend=true`,
    {
      method: "POST",
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: createBody.toString(),
    }
  )

  const cText = await createRes.text()
  const cJson = (() => {
    try {
      return JSON.parse(cText) as ZohoTemplateCreateDocumentResponse
    } catch {
      return {} as ZohoTemplateCreateDocumentResponse
    }
  })()

  if (!createRes.ok || cJson.status !== "success") {
    throw new Error(
      `Zoho Sign createdocument failed: ${createRes.status} ${cJson.message || cText || "Unknown error"}`
    )
  }

  const requestId = (cJson.requests?.request_id || "").trim()
  const actionId =
    (cJson.requests?.actions || []).find((a) => a.action_type === "SIGN")?.action_id ||
    cJson.requests?.actions?.[0]?.action_id ||
    ""

  if (!requestId || !actionId) throw new Error("Zoho Sign createdocument response missing request_id/action_id")

  return await generateEmbedSigningUrl({
    requestId,
    actionId: String(actionId),
    returnUrl: params.returnUrl,
    publicOrigin: params.publicOrigin,
  })
}

export async function createZohoEmbeddedSigningSession(params: {
  email: string
  name: string
  /** used only for client-side correlation; not required by Zoho Sign */
  clientUserId: string
  /** absolute return URL (Zoho redirect page) */
  returnUrl: string
  /** Resolved site origin — used to load /docs/Auth Release form.pdf when env is unset */
  publicOrigin?: string
}): Promise<{ signingUrl: string; requestId: string; actionId: string }> {
  const appUrl =
    params.publicOrigin?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    ""

  const localPdfUrl = appUrl ? `${appUrl}/docs/Auth%20Release%20form.pdf` : ""
  const pdfUrl = process.env.AUTHORIZATION_PDF_URL?.trim() || localPdfUrl

  if (!pdfUrl) {
    throw new Error(
      "Set AUTHORIZATION_PDF_URL, or host the PDF at /docs/Auth Release form.pdf (needs a resolvable app origin)."
    )
  }

  const pdfBuffer = await loadAuthorizationPdfBuffer({
    primaryUrl: pdfUrl,
    fallbackUrl: localPdfUrl || undefined,
  })

  const accessToken = await getAccessToken()
  const base = signApiBase()

  const requestName = "Auth Release form — please sign"

  const dataJson = {
    requests: {
      request_name: requestName,
      is_sequential: true,
      actions: [
        {
          recipient_name: params.name,
          recipient_email: params.email,
          action_type: "SIGN",
          signing_order: 0,
          verify_recipient: false,
          is_embedded: true,
          private_notes: `clientUserId=${params.clientUserId}`,
        },
      ],
      ...(maybeRedirectPages(params.returnUrl)
        ? { redirect_pages: maybeRedirectPages(params.returnUrl) }
        : {}),
    },
  }

  const fd = new FormData()
  fd.append("data", JSON.stringify(dataJson))
  fd.append(
    "file",
    new Blob([new Uint8Array(pdfBuffer)], { type: "application/pdf" }),
    "Auth Release form.pdf"
  )

  const createRes = await fetch(`${base}/api/v1/requests`, {
    method: "POST",
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
    },
    body: fd,
  })

  const createText = await createRes.text()
  const createJson = (() => {
    try {
      return JSON.parse(createText) as ZohoCreateResponse
    } catch {
      return {} as ZohoCreateResponse
    }
  })()

  if (!createRes.ok || createJson.status !== "success") {
    throw new Error(
      `Zoho Sign create request failed: ${createRes.status} ${createJson.message || createText || "Unknown error"}`
    )
  }

  const requestId = createJson.requests?.request_id
  const actionId = createJson.requests?.actions?.[0]?.action_id
  if (!requestId || !actionId) throw new Error("Zoho Sign create request response missing request_id/action_id")
  const documentId = createJson.requests?.document_ids?.[0]?.document_id
  if (!documentId) throw new Error("Zoho Sign create request response missing document_id")

  // Submit (send) the request for signing
  const submitBody = new URLSearchParams({
    data: JSON.stringify({
      requests: {
        actions: [
          {
            action_id: actionId,
            action_type: "SIGN",
            // Zoho requires at least one signer field before submit; add a signature field.
            // Coordinates are in percentage-like units used by Zoho APIs (x_value/y_value/width/height).
            // This places the signature near the bottom-right of page 1 (page_no=0) by default.
            fields: [
              {
                field_type_name: "Signature",
                action_id: actionId,
                document_id: documentId,
                field_name: "Signature",
                field_label: "Signature",
                field_category: "image",
                page_no: 0,
                x_value: "68.5",
                y_value: "84.0",
                width: "22.0",
                height: "2.5",
              },
            ],
          },
        ],
      },
    }),
  })

  const submitRes = await fetch(`${base}/api/v1/requests/${encodeURIComponent(requestId)}/submit`, {
    method: "POST",
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: submitBody.toString(),
  })

  if (!submitRes.ok) {
    const t = await submitRes.text()
    throw new Error(`Zoho Sign submit failed: ${submitRes.status} ${t}`)
  }

  // Generate the embedded signing URL (valid for 2 minutes)
  const host = appUrl || new URL(params.returnUrl).origin
  const embedBody = new URLSearchParams({ host })

  const embedRes = await fetch(
    `${base}/api/v1/requests/${encodeURIComponent(requestId)}/actions/${encodeURIComponent(actionId)}/embedtoken`,
    {
      method: "POST",
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: embedBody.toString(),
    }
  )

  const embedText = await embedRes.text()
  const embedJson = (() => {
    try {
      return JSON.parse(embedText) as ZohoEmbedTokenResponse
    } catch {
      return {} as ZohoEmbedTokenResponse
    }
  })()

  if (!embedRes.ok || embedJson.status !== "success" || !embedJson.sign_url) {
    throw new Error(
      `Zoho Sign embedtoken failed: ${embedRes.status} ${embedJson.message || embedText || "Unknown error"}`
    )
  }

  return { signingUrl: embedJson.sign_url, requestId, actionId }
}

