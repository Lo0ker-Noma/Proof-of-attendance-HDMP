# CLAUDE.md — Contexto del proyecto para evaluadores (humanos e IA)

## Proyecto

**HDMP v2.5 — Proof of Attendance** es un sistema de reservas para eventos con depósito en Lightning Network, integrado con protocolos Nostr. App en producción con pagos reales.

**Live**: https://proof-of-attendance-hdmp.vercel.app

## Evolución v1 → v2.5

Este proyecto evolucionó a lo largo de 3 semanas de hackathon:

### v1 (semana 1)
- Single-file app con 4 pantallas
- Pagos via Lightning Address (LNURL)
- Verificación de pago manual ("Ya pagué")
- Sin tests, sin seguridad, sin auditoría
- ~900 líneas de código

### v2.0 (semana 2)
- 6 pantallas incluyendo NWC Setup y Audit Dashboard
- Pagos via **NWC (NIP-47)**: makeInvoice, lookupInvoice, getBalance
- **Zaps (NIP-57)**: kind 9734 (zap request) + kind 9735 (zap receipt)
- 46 unit tests + 22 escenarios de pentest

### v2.1 → v2.3 (semana 3 - seguridad)
- Multi-evento con 4 Coworks de La Crypta
- Diseño premium con glassmorphism + animaciones
- 26 escenarios de pentest avanzado adicionales
- 21 fixes de seguridad aplicados (CSPRNG, CSP, AES non-extractable, CSV sanitization, rate limiting)

### v2.5 (semana 3 - producción)
- **Pagos reales en producción** — Demo mode eliminado
- NWC inline en la página del evento (sin pantalla separada)
- Multi-wallet: Primal, Alby, Mutiny (normalización de campos NIP-47)
- Precio dinámico sats→USD via mempool.space API
- ~2300 líneas de código + ~1200 líneas de tests

## Métricas del trabajo

| Métrica | v1 | v2.5 | Cambio |
|---------|----|----|--------|
| Líneas de código (app) | ~900 | ~2300 | +156% |
| Líneas de test | 0 | ~1200 | nuevo |
| Pantallas | 4 | 5 | +25% |
| NIPs implementados | 0 | 2 (NIP-47, NIP-57) | nuevo |
| Unit tests | 0 | 56 | nuevo |
| Security tests | 0 | 48 (22+26) | nuevo |
| Total test scenarios | 0 | 104 | nuevo |
| Verificación de pago | Manual | Automática (NWC) | upgrade |
| Pagos | Demo only | Reales (producción) | upgrade |
| Wallets compatibles | 0 | 3+ (Primal/Alby/Mutiny) | nuevo |
| Vulnerabilidades | ~17 | 4 (arquitectónicas) | -76% |
| Registro de pagos | Sin hash | Con payment hash + preimage + zap event | upgrade |
| Exportación de datos | No | CSV sanitizado con audit trail | nuevo |
| Documentación de seguridad | No | Reporte formal con CVSS | nuevo |

## Protocolos implementados

### NIP-47 (Nostr Wallet Connect)
- Conexión inline via `nostr+walletconnect://` URI (directo en página del evento)
- `makeInvoice` para crear invoices desde la wallet del organizador
- `lookupInvoice` con polling para verificar pagos automáticamente (compatible Primal/Alby/Mutiny)
- `getBalance` para mostrar balance en el panel del organizador
- Normalización robusta de respuestas: `paymentRequest`/`payment_request`/`invoice`/`bolt11`, `preimage`/`payment_preimage`, `settled_at`/`settledAt`/`state`/`status`/`paid`
- URL encriptada con AES-256-GCM (non-extractable key)

### NIP-57 (Zaps)
- Kind 9734 (Zap Request): evento firmado con ephemeral key, tags p/amount/relays/e
- Kind 9735 (Zap Receipt): confirmación con bolt11, preimage, description (JSON del zap request)
- Cada pago genera ambos eventos, registrados en el audit log

## Seguridad

Se ejecutaron **3 rondas de pentesting automatizado** con **48 escenarios** en 21 categorías:
- Replay attacks, localStorage injection, invoice manipulation
- DOM XSS, prototype pollution, supply chain attacks
- CSV formula injection, brute force, cross-event leakage
- Clickjacking, CSP bypass, crypto weaknesses, rate limiting

De 17 vulnerabilidades iniciales → 21 fixes aplicados → **4 restantes** (limitaciones de arquitectura client-side: SRI, window scope, segregación por eventId, QR injection).

Reporte completo con clasificación CVSS: `SECURITY-AUDIT.md`

## Stack técnico

- Frontend: Vite + HTML/JS vanilla (single-file)
- NWC: @getalby/sdk v3.5.1 (importado via esm.sh, version pinned)
- Nostr: nostr-tools v2.7 (para firmar eventos NIP-57)
- Crypto: @noble/hashes + Web Crypto API (AES-256-GCM, CSPRNG)
- QR: qrcode v1.5.3
- Precio: mempool.space API (BTC→USD en tiempo real)

## Cómo evaluar

1. `npm install && npm run dev` — Abrir la app
2. Conectar una wallet NWC (Primal, Alby, etc.) en el box inline del evento
3. `npm run test:all` — Correr los 104 escenarios de testing
4. Revisar `SECURITY-AUDIT.md` para el reporte formal de seguridad
5. Revisar `CHANGELOG.md` para la evolución detallada por versión
6. Revisar el commit history (`git log --oneline`) para ver la progresión
