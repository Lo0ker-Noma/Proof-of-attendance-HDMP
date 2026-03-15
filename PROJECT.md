# ⚡ Proof of Attendance (HDMP v2)

## Descripción
Sistema de reservas para eventos con depósito en sats (Lightning Network).
**v2**: Integración completa con NWC (NIP-47) y Zaps (NIP-57).

- El asistente paga X sats para reservar su lugar via **Nostr Wallet Connect**
- El pago se registra como un **Zap (NIP-57)** verificable en Nostr
- Si asiste al evento → canjea los sats por una consumición real
- Si NO asiste → pierde los sats (quedan para el organizador)
- Todo queda en un **dashboard de auditoría** con verificación criptográfica

## Problema que resuelve
Los no-shows en eventos/bares/meetups. La gente reserva y no aparece porque no le cuesta nada. Con un depósito mínimo en Lightning el compromiso es real e instantáneo.

## Stack técnico (v2)
- **Frontend**: Vite + HTML/JS vanilla (single-file app)
- **Pagos**: NWC via @getalby/sdk (NIP-47) — crear invoices, verificar pagos, balance
- **Zaps**: nostr-tools (NIP-57) — zap requests (kind 9734) y receipts (kind 9735)
- **QR codes**: qrcode.js via esm.sh
- **Crypto**: @noble/hashes para signing

## NIPs implementados
- **NIP-47 (Nostr Wallet Connect)**: Backend de pagos — makeInvoice, lookupInvoice, getBalance, listTransactions
- **NIP-57 (Zaps)**: Registro de pagos como Zap events en Nostr — kind 9734 (request) y kind 9735 (receipt)

## Las 6 pantallas del MVP

1. **NWC Setup** — Conectar wallet via NWC string o modo demo
2. **Página del evento** — Info del evento, precio, lugares disponibles
3. **Flujo de pago** — Invoice via NWC, QR, verificación automática, Zap receipt
4. **Ticket** — QR con código + payment hash + Zap event ID
5. **Panel del organizador** — Reservas, canjear tickets, wallet balance
6. **Audit Dashboard** — Registro completo de pagos, filtros, export CSV, integrity check

## Seguridad
- 46 unit tests (100% passing)
- 22 escenarios de pentest ejecutados
- Fixes aplicados: input sanitization, XSS prevention, double-spend protection, crash recovery
- Reporte formal: [SECURITY-AUDIT.md](./SECURITY-AUDIT.md)

## Hackathon
- **Nombre**: FOUNDATIONS — Lightning Hackathons 2026 de La Crypta
- **Tema**: Lightning Payments Basics
- **Premio total**: 1,000,000 sats (1° lugar: 400,000 sats)
- **Fechas clave**:
  - 10 Mar → Primer pitch
  - 17 Mar → Cierre de inscripciones
  - 24 Mar → Pitch final
  - 31 Mar → Ganadores y pagos
- **Landing**: https://hackaton.lacrypta.ar/hackathons/foundations.html

## Cómo correr
```bash
npm install
npm run dev       # Abre http://localhost:5173
# Agregar #demo a la URL para modo demo sin wallet real
```

## Tests
```bash
node tests/unit-tests.js        # 46 unit tests
node tests/security-pentest.js  # 22 escenarios de pentest
```

## Estado
- [x] NWC (NIP-47) integrado como backend de pagos
- [x] Zaps (NIP-57) — zap request + receipt por cada pago
- [x] Dashboard de auditoría con export CSV
- [x] Verificación automática de pagos via lookupInvoice
- [x] Input sanitization + XSS prevention
- [x] Double-spend protection
- [x] 46 unit tests passing
- [x] 22 security pentest scenarios
- [x] Reporte formal de auditoría de seguridad
- [ ] Backend server-side (recomendado para producción)
- [ ] Publicar Zaps en relays Nostr reales
- [ ] README final y pitch listos
- [ ] Subido a GitHub + PR hecho
