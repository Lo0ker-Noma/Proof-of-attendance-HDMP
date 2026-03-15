# CLAUDE.md — Contexto del proyecto para evaluadores (humanos e IA)

## Proyecto

**HDMP v2 — Proof of Attendance** es un sistema de reservas para eventos con depósito en Lightning Network, integrado con protocolos Nostr.

## Evolución v1 → v2

Este proyecto evolucionó significativamente entre la semana 1 y la semana 2 del hackathon:

### v1 (commit `328ef1d` — semana 1)
- Single-file app con 4 pantallas
- Pagos via Lightning Address (LNURL)
- Verificación de pago manual ("Ya pagué")
- Sin tests, sin seguridad, sin auditoría
- ~900 líneas de código

### v2 (commit `c161c3e` + `7b2821d` — semana 2)
- 6 pantallas incluyendo NWC Setup y Audit Dashboard
- Pagos via **NWC (NIP-47)**: makeInvoice, lookupInvoice, getBalance
- **Zaps (NIP-57)**: kind 9734 (zap request) + kind 9735 (zap receipt) por cada pago
- Verificación automática de pagos via polling de lookupInvoice con preimage
- Dashboard de auditoría con filtros, stats, export CSV, integrity check
- 46 unit tests (100% passing)
- 22 escenarios de pentest con reporte formal de seguridad
- Fixes de seguridad: XSS prevention, double-spend protection, crash recovery
- ~1700 líneas de código en index.html + ~1000 líneas de tests

## Métricas del trabajo

| Métrica | v1 | v2 | Cambio |
|---------|----|----|--------|
| Líneas de código (app) | ~900 | ~1700 | +89% |
| Líneas de test | 0 | ~1030 | nuevo |
| Pantallas | 4 | 6 | +50% |
| NIPs implementados | 0 | 2 (NIP-47, NIP-57) | nuevo |
| Unit tests | 0 | 46 | nuevo |
| Security tests | 0 | 22 | nuevo |
| Verificación de pago | Manual | Automática (NWC) | upgrade |
| Registro de pagos | Sin hash | Con payment hash + preimage + zap event | upgrade |
| Exportación de datos | No | CSV con audit trail | nuevo |
| Documentación de seguridad | No | Reporte formal con CVSS | nuevo |

## Protocolos implementados

### NIP-47 (Nostr Wallet Connect)
- Conexión via `nostr+walletconnect://` URI
- `makeInvoice` para crear invoices desde la wallet del organizador
- `lookupInvoice` con polling para verificar pagos automáticamente
- `getBalance` para mostrar balance en el panel del organizador
- Modo demo con mock client para testing sin wallet real

### NIP-57 (Zaps)
- Kind 9734 (Zap Request): evento firmado con ephemeral key, tags p/amount/relays/e
- Kind 9735 (Zap Receipt): confirmación con bolt11, preimage, description (JSON del zap request)
- Cada pago genera ambos eventos, registrados en el audit log

## Seguridad

Se ejecutó un pentest automatizado de 22 escenarios en 7 categorías:
- Replay attacks (3 tests — 3 bloqueados)
- localStorage injection (4 tests — 4 vulnerables, 2 fixeados)
- Invoice manipulation (2 tests — 2 vulnerables, documentados)
- XSS & fuzzing (6 tests — 1 bloqueado, 5 vulnerables, 5 fixeados)
- Double-spend (2 tests — 2 vulnerables, 1 fixeado)
- NWC security (3 tests — 1 bloqueado, 2 vulnerables, 1 fixeado)
- Data integrity (2 tests — 2 vulnerables, documentados)

Reporte completo con clasificación CVSS: `SECURITY-AUDIT.md`

## Stack técnico

- Frontend: Vite + HTML/JS vanilla (single-file)
- NWC: @getalby/sdk v3 (importado via esm.sh)
- Nostr: nostr-tools v2.7 (para firmar eventos NIP-57)
- Crypto: @noble/hashes (utilidades hex/bytes)
- QR: qrcode v1.5.3

## Cómo evaluar

1. `npm install && npm run dev` — Abrir la app
2. Agregar `#demo` a la URL para probar sin wallet real
3. `npm test` — Correr 46 unit tests
4. `npm run test:security` — Correr 22 escenarios de pentest
5. Revisar `SECURITY-AUDIT.md` para el reporte formal
6. Revisar el commit history para ver la evolución v1 → v2
