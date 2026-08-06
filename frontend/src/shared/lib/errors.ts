export type ErrorSeverity = 'critical' | 'bypass' | 'unknown'

export type AppError = {
    id: string
    code: string
    severity: ErrorSeverity
    title: string
    message: string
    hint: string
    detail: string
    at: string
}

type Reading = {title: string; hint: string}

const GO_ENVELOPE = /^\[Err\](?: Type: (\S+) -)? Message: ([\s\S]*) - Critical: (critical|bypass)$/

const FALLBACK_TITLE = 'Something went wrong'

const READINGS: Record<string, Reading> = {
    err_cannot_get_auth_info: {
        title: 'Stored credentials could not be read',
        hint: 'Authorize the server again in Settings › MCP.',
    },
    err_mcp_not_found: {
        title: 'That server is not configured',
        hint: 'The roster comes from config.yaml. Add the server there and restart the app.',
    },
    err_mcp_discovery_failed: {
        title: 'The server did not say how to authorize',
        hint: 'Check the server URL in config.yaml, then try again.',
    },
    err_mcp_registration_failed: {
        title: 'The server refused to register this app',
        hint: 'Check the server URL in config.yaml, then try again.',
    },
    err_mcp_authorize_failed: {
        title: 'Authorization did not finish',
        hint: 'Start it again and approve in the browser tab that opens.',
    },
    err_mcp_authorize_timeout: {
        title: 'Authorization timed out',
        hint: 'The approval took too long. Start it again and finish in the browser tab that opens.',
    },
    err_mcp_token_exchange: {
        title: 'The server rejected the login',
        hint: 'Start the authorization again. If it keeps failing, the client id in config.yaml is wrong.',
    },
    err_mcp_store_credentials: {
        title: 'The credentials could not be saved',
        hint: 'Check that the app data directory is writable, then authorize again.',
    },
    err_mcp_not_authenticated: {
        title: 'That server is not authorized yet',
        hint: 'Authorize it in Settings › MCP before an agent can call it.',
    },
    err_mcp_credentials_expired: {
        title: 'The credentials expired',
        hint: 'Authorize the server again in Settings › MCP.',
    },
    err_mcp_forbidden_request: {
        title: 'The proxy blocked that request',
        hint: 'An agent asked for a URL the proxy does not forward. Nothing was sent.',
    },
    err_mcp_request_failed: {
        title: 'The server did not answer',
        hint: 'Check your connection, then try again.',
    },
    err_mcp_token_required: {
        title: 'That server needs an access token',
        hint: 'Paste a token for it in Settings › MCP.',
    },
}

export function errorMessage(error: unknown): string {
    if (!error) return ''
    return error instanceof Error ? error.message : String(error)
}

function readable(text: string) {
    const trimmed = text.trim()
    if (!trimmed) return ''

    const opened = /^[a-z]+\b/.test(trimmed)
        ? trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
        : trimmed

    return /[.!?)]$/.test(opened) ? opened : `${opened}.`
}

function framesOf(error: unknown) {
    if (!(error instanceof Error) || !error.stack) return ''

    return error.stack
        .split('\n')
        .filter((line) => line.trim().startsWith('at '))
        .join('\n')
}

export function toAppError(cause: unknown, action = ''): AppError {
    const raw = errorMessage(cause) || String(cause)
    const envelope = GO_ENVELOPE.exec(raw)

    const code = envelope?.[1] ?? ''
    const message = envelope?.[2] ?? raw
    const severity = (envelope?.[3] as ErrorSeverity) ?? 'unknown'
    const reading = READINGS[code]

    return {
        id: crypto.randomUUID(),
        code,
        severity,
        title: reading?.title || action || FALLBACK_TITLE,
        message: readable(message),
        hint: reading?.hint ?? '',
        detail: [raw, framesOf(cause)].filter(Boolean).join('\n\n'),
        at: new Date().toISOString(),
    }
}

export function errorReport(error: AppError): string {
    const rows = [
        `Title: ${error.title}`,
        `Message: ${error.message}`,
        error.code ? `Code: ${error.code}` : '',
        `Severity: ${error.severity}`,
        `Time: ${error.at}`,
    ].filter(Boolean)

    return `${rows.join('\n')}\n\n${error.detail}\n`
}
