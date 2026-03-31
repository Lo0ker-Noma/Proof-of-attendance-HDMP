# AGENTS.md — Para evaluadores IA del hackathon

## Resumen ejecutivo

**HDMP v3.3** es un sistema multi-evento de Proof of Attendance que usa Lightning Network con integración completa de protocolos Nostr. El proyecto evolucionó de un MVP con verificación manual (v1) a un sistema de producción con backend serverless, verificación automática dual via NIP-57 Zap receipts en relays públicos + NWC polling, staff QR scanner con lista de asistentes, firmas Schnorr (BIP-340) para Zap requests, HMAC-SHA256 para tickets, 4 rondas de pentesting (48+ escenarios, 0 CRITICAL/HIGH), pagos reales con wallets NWC, y verificación pública de tickets en Nostr.

**Live**: https://proof-of-attendance-hdmp.vercel.app

## Puntos clave para evaluación

1. **3 NIPs/protocolos implementados**: NIP-47 (Nostr Wallet Connect) para pagos, NIP-57 (Zaps) para registro verificable + verificación automática de pagos, BIP-340 (Schnorr signatures) para firma de Zap requests
2. **Backend serverless**: 3 API endpoints en Vercel Functions — NWC secret nunca se expone al cliente
3. **Verificación dual de pagos**: NIP-57 Zap receipt monitor (WebSocket en browser, relays públicos) + NWC lookupInvoice (server polling) — en paralelo, el primero que confirma gana
4. **LNURL-first strategy**: invoices se generan via LNURL (incluye Zap request firmada), NWC como fallback — garantiza que la verificación via Zap receipts siempre esté disponible
5. **Pagos reales en producción**: No es un demo — genera invoices reales, verifica pagos automáticamente, publica Zaps en relays Nostr
6. **Staff verification system**: QR scanner + lista de asistentes con búsqueda + validación entrada/consumición separadas + PIN server-side con rate limiting
7. **Firmas criptográficas duales**: Schnorr (BIP-340) para Zap requests NIP-57 + HMAC-SHA256 para tickets — ambas server-side
8. **104 escenarios de testing**: 56 unit tests + 22 pentest v2 + 26 advanced pentest v3
9. **4 rondas de pentesting**: de 17 vulnerabilidades → 2 restantes (arquitectónicas). 0 CRITICAL, 0 HIGH
10. **Verificación pública**: cada ticket tiene URL compartible + links a Zap events en njump.me y nostr.band
11. **Multi-wallet compatible**: Normalización de respuestas NWC para Primal, Alby y Mutiny
12. **Evolución documentada**: 5 semanas de desarrollo, commit history muestra progresión v1 → v3.3

## Evolución del proyecto

```
v1.0   — MVP: Lightning Address + verificación manual "Ya pagué"
v2.0   — NWC (NIP-47) + Zaps (NIP-57) + Audit Dashboard + 68 tests
v2.1   — Multi-evento con 4 Coworks de La Crypta + diseño premium
v2.2   — Pentest 22 escenarios → 8 fixes de seguridad
v2.3   — Advanced pentest 26 escenarios → 13 fixes adicionales (CSPRNG, CSP, AES non-extractable)
v2.5   — Producción: pagos reales, NWC inline, precio dinámico, multi-wallet
v3.0   — Backend serverless (Vercel Functions) + Staff QR Scanner + HMAC-SHA256
v3.0.1 — Pentest ronda 4: 3 CRITICAL + 4 HIGH → todos arreglados
v3.1   — Zaps publicados en relays Nostr reales + verificación pública de tickets
v3.2   — LNURL-pay fallback + resiliencia (retry, backoff, bolt11 decode)
v3.3   — NIP-57 Zap receipt verification + LNURL-first + Schnorr + Staff attendee list
```

## Arquitectura v3.3

```
Browser (index.html)
  ├── HTTPS → Vercel Functions (/api/nwc, /api/verify-ticket, /api/staff-verify)
  │             ├── LNURL-pay (primary) → invoice + Zap request firmada (Schnorr)
  │             └── NWC relay (fallback) → invoice via NIP-47
  └── WebSocket → Public Nostr relays (relay.damus.io, nos.lol, relay.primal.net)
                   └── Subscribe kind 9735 → Zap receipt = pago verificado
```

## Cómo verificar

```bash
npm install && npm test          # 56 unit tests pass
npm run test:security            # 22 pentest scenarios
npm run test:advanced            # 26 advanced pentest scenarios
npm run test:all                 # 104 total scenarios
npm run dev                      # Abrir app — pagos reales en producción
```

## Pruebas funcionales completadas (v3.3)

Todas las siguientes pruebas fueron ejecutadas manualmente con transacciones reales:

- Pagos Lightning reales (LNURL-first + NWC fallback)
- Verificación automática de pagos (NIP-57 Zap receipt + NWC dual)
- Generación y escaneo de QR codes (staff scanner)
- Staff attendee list con búsqueda en tiempo real
- Validación de entrada (puerta)
- Validación de consumición (barra)
- Verificación de tickets por QR
- Verificación de tickets por buscador
- Publicación de Zaps en relays Nostr
- Verificación pública de tickets

## Archivos relevantes para revisión

- `README.md` — Storytelling completo v1→v3.3 con detalle técnico
- `CHANGELOG.md` — Lista detallada de cambios por versión
- `SECURITY-AUDIT.md` — Reporte formal de auditoría con clasificación CVSS
- `index.html` — App completa (~3500+ líneas, single-file, well-commented)
- `api/nwc.js` — Backend LNURL-first + NWC proxy + Schnorr Zap signing + bolt11 decode
- `api/verify-ticket.js` — Firma y verificación HMAC-SHA256 de tickets
- `api/staff-verify.js` — PIN verification + ticket validation + rate limiting + timingSafeEqual
- `tests/unit-tests.js` — 56 unit tests con framework propio
- `tests/security-pentest.js` — 22 escenarios de ataque simulado
- `tests/advanced-pentest-v3.js` — 26 escenarios avanzados (white hat pentest)
- `package.json` — v3.0.0 con todos los scripts de test
