# Security Policy

## Supported versions

| Version | Supported          |
| ------- | ------------------ |
| 0.x     | ⚠️ Under development |

For production deployments, wait for a stable 1.0.0 release with the auth layer.

## Reporting a vulnerability

Found a security issue? Please report it responsibly.

**Do not open a public issue** for security vulnerabilities. Instead:

1. Email the maintainer directly (see commit history for contact info)
2. Or use GitHub's **Private vulnerability reporting** (available under the repository's Security tab → " Advisories" → "Report a vulnerability")

## What to report

- Path traversal in workspace file routes
- Authentication bypass in any API route
- Secret leakage in logs, error messages, or stored plaintext
- Arbitrary file read/write via workspace tools
- Any other vulnerability that affects confidentiality, integrity, or availability of a self-hosted deployment

## What to expect

- Acknowledgment within 48 hours
- A non-public issue created for tracking
- A fix in a private branch with a timeline
- Credit in the release notes (if you consent)

## Security best practices for self-hosting

- Set `DASHBOARD_SECRET` before exposing port 4111 publicly
- Use a reverse proxy (Nginx, Caddy) with TLS termination in front of the API server
- Store `OPENROUTER_API_KEY` and `TELEGRAM_BOT_TOKEN` in environment variables in production, not in the database
- Keep `DATABASE_URL` on a filesystem with restricted permissions
- Monitor the logs for repeated failed auth attempts

## Known limitations (Phase 3 fixes planned)

- No built-in auth — see README Security section
- Secrets stored plaintext in LibSQL — encryption at rest coming
- Single-tenant only for now — multi-tenant wiring not yet complete
