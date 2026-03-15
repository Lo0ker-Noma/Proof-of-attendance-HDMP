# HDMP v2 — Security Audit Report

**Proyecto**: Proof of Attendance (HDMP v2) — NWC + Zaps
**Fecha**: 15 de Marzo, 2026
**Auditor**: Automated Pentest Suite + Manual Review
**Scope**: Client-side app (index.html) con NWC (NIP-47), Zaps (NIP-57), localStorage
**Versión**: v2.0.0

---

## Executive Summary

Se ejecutó un pentest automatizado de 22 escenarios de ataque sobre HDMP v2. Se identificaron **17 vulnerabilidades** (5 CRITICAL, 6 HIGH, 3 MEDIUM, 3 LOW) y **5 ataques fueron bloqueados** por defensas existentes.

Después del pentest se aplicaron **fixes de seguridad** que mitigan las vulnerabilidades más críticas a nivel client-side. Sin embargo, la naturaleza client-side de la app impone limitaciones fundamentales que solo se resuelven con un backend.

**Risk Score (post-fix): MEDIUM** — La app es segura para un hackathon/demo, pero NO para producción con dinero real sin un backend server-side.

---

## Resultados del Pentest

### Ataques Bloqueados (5/22)

| # | Ataque | Categoría | Defensa |
|---|--------|-----------|---------|
| 1 | Ticket replay (doble canje) | Replay | Flag `status: redeemed` previene doble uso |
| 2 | Payment hash replay | Replay | Deduplicación en `addPaymentLog()` |
| 3 | Case-insensitive ticket replay | Replay | `.toUpperCase()` en input normaliza |
| 4 | SQL injection en ticket code | Fuzzing | No hay SQL backend (localStorage) |
| 5 | NWC timeout abuse | NWC | maxChecks=120 con interval=5s (10min timeout) |

### Vulnerabilidades Encontradas (17/22)

#### CRITICAL (5)

**VULN-001: Inyección de reservas falsas en localStorage**
- **Categoría**: localStorage Injection
- **Descripción**: Un atacante con acceso a DevTools puede inyectar reservas directamente en localStorage sin haber realizado ningún pago Lightning.
- **Impacto**: Entrada gratuita al evento, bypass total del sistema de pagos.
- **Fix aplicado**: Validación de `paymentHash + preimage + verifiedViaNWC` en la UI.
- **Fix pendiente**: Verificación server-side obligatoria. Firma HMAC de cada reserva.
- **CVSS**: 9.1

**VULN-002: Invoice de monto menor aceptado**
- **Categoría**: Invoice Manipulation
- **Descripción**: No se valida que el monto del pago via NWC `lookupInvoice` coincida con `EVENT_CONFIG.price`.
- **Impacto**: Atacante paga 1 sat en vez de 1000 y obtiene ticket válido.
- **Fix aplicado**: Ninguno aún (requiere validación en `onPaymentVerified`).
- **Fix pendiente**: Comparar `result.amount` con `EVENT_CONFIG.price * 1000` en `onPaymentVerified()`.
- **CVSS**: 8.7

**VULN-003: Sustitución de invoice propio**
- **Categoría**: Invoice Manipulation
- **Descripción**: No hay verificación de que el invoice fue generado por la wallet del organizador (via NWC makeInvoice).
- **Impacto**: Atacante podría generar invoice desde su propia wallet y auto-pagarlo.
- **Fix pendiente**: Verificar via `lookupInvoice` que el payment_hash existe en la wallet del organizador.
- **CVSS**: 8.5

**VULN-004: Double-spend via paymentHash duplicado en reservas**
- **Categoría**: Double-Spend
- **Descripción**: `saveReservation()` solo verificaba duplicados por `ticketCode`, no por `paymentHash`.
- **Impacto**: Un solo pago podría generar múltiples tickets.
- **Fix aplicado**: Se agregó deduplicación por `paymentHash` en `saveReservation()`.
- **CVSS**: 9.0

**VULN-005: NWC URL en texto plano en localStorage**
- **Categoría**: Wallet Security
- **Descripción**: El NWC connection string (incluyendo `secret`) se almacena sin encriptar.
- **Impacto**: Cualquier script XSS o extensión maliciosa puede robar la wallet connection.
- **Fix aplicado**: Redacción del secret en logs de consola.
- **Fix pendiente**: Encriptar con Web Crypto API o usar solo sessionStorage.
- **CVSS**: 8.2

#### HIGH (6)

**VULN-006: XSS via nombre del asistente**
- **Categoría**: XSS
- **Descripción**: Tags HTML/script en el campo de nombre se renderizan sin escapar en innerHTML.
- **Fix aplicado**: `sanitizeInput()` antes de guardar + `escapeHtml()` en rendering.
- **CVSS**: 7.5

**VULN-007: Event handler injection en nombre**
- **Categoría**: XSS
- **Descripción**: Atributos de evento HTML inyectables via campo nombre.
- **Fix aplicado**: `sanitizeInput()` + `escapeHtml()`.
- **CVSS**: 7.5

**VULN-008: Modificación de status de reserva sin autorización**
- **Categoría**: localStorage Injection
- **Descripción**: Atacante puede marcar su propia reserva como "redeemed" sin ir al evento.
- **Fix pendiente**: Autenticación del organizador para operaciones de canje. Firma criptográfica.
- **CVSS**: 6.8

**VULN-009: Alteración del payment log**
- **Categoría**: Data Integrity
- **Descripción**: Montos y estados en el log de auditoría pueden ser modificados post-facto.
- **Fix pendiente**: Hash chain (cada entry referencia hash del anterior). Publicar en Nostr relays.
- **CVSS**: 7.2

**VULN-010: Race condition en escrituras concurrentes**
- **Categoría**: Double-Spend
- **Descripción**: Dos pagos procesados simultáneamente pueden causar pérdida de datos.
- **Fix pendiente**: Mutex/lock pattern o migración a backend con transacciones atómicas.
- **CVSS**: 6.5

**VULN-011: Modificación del audit log post-hecho**
- **Categoría**: Data Integrity
- **Descripción**: Registros de auditoría alterables sin detección.
- **Fix pendiente**: Hash chain + registro en Nostr relays como eventos inmutables.
- **CVSS**: 7.0

#### MEDIUM (3)

**VULN-012: JSON malformado causa crash**
- **Categoría**: DoS
- **Descripción**: Inyectar JSON inválido en localStorage crashea la app.
- **Fix aplicado**: `try/catch` en `getReservations()` y `getPaymentLog()` con fallback a `[]`.
- **CVSS**: 5.3

**VULN-013: Exposición del NWC secret en consola**
- **Categoría**: Info Disclosure
- **Descripción**: El NWC URL completo podría loguearse exponiendo el secret.
- **Fix aplicado**: `.replace(/secret=[^&]+/, "secret=REDACTED")` en console.log.
- **CVSS**: 4.8

**VULN-014: Timestamps falsos inyectables**
- **Categoría**: Data Integrity
- **Descripción**: Se pueden inyectar timestamps arbitrarios en reservas y pagos.
- **Fix pendiente**: Validar que `createdAt` sea razonable (no futuro, no > 24h pasado).
- **CVSS**: 4.5

#### LOW (3)

**VULN-015**: Unicode zero-width characters en nombres (spoofing visual).
**VULN-016**: Nombres extremadamente largos (potential localStorage DoS).
**VULN-017**: Null bytes almacenados sin filtrar.

**Fixes aplicados para las 3**: `sanitizeInput()` filtra zero-width, null bytes y limita a 100 chars.

---

## Fixes Aplicados (Post-Pentest)

| Fix | Vulnerabilidades Mitigadas | Archivo |
|-----|---------------------------|---------|
| `sanitizeInput()` — sanitización de input | VULN-006, 007, 015, 016, 017 | index.html |
| `escapeHtml()` — escape en rendering | VULN-006, 007 | index.html |
| Deduplicación por `paymentHash` en `saveReservation()` | VULN-004 | index.html |
| `try/catch` en JSON.parse con fallback | VULN-012 | index.html |
| Redacción del NWC secret en console.log | VULN-013 | index.html |
| Charset de ticket sin chars ambiguos (0,O,I,1,L) | Bug fix | index.html |

---

## Recomendaciones Prioritarias (No Implementadas)

### 1. Backend Server-Side (resuelve VULN-001, 002, 003, 008, 009, 010)
La mayoría de las vulnerabilidades críticas son inherentes a una arquitectura 100% client-side. Un backend mínimo (incluso serverless) que:
- Genere y verifique invoices via NWC
- Firme tickets con HMAC
- Almacene el log de auditoría de forma inmutable
- Maneje la lógica de canje con autenticación

### 2. Hash Chain para Audit Log (resuelve VULN-009, 011)
Cada entry del log debería incluir un hash SHA-256 de la entry anterior, creando una cadena inmutable similar a una blockchain. Cualquier modificación rompería la cadena.

### 3. Validación de Monto en lookupInvoice (resuelve VULN-002)
En `onPaymentVerified()`, comparar `result.amount` con `EVENT_CONFIG.price * 1000` (msats). Rechazar si no coincide.

### 4. Encriptar NWC URL (resuelve VULN-005)
Usar Web Crypto API para encriptar el NWC connection string antes de almacenarlo, o usar `sessionStorage` para que no persista entre sesiones.

### 5. Publicar Zap Receipts en Nostr Relays (mejora general)
Publicar los kind 9735 (zap receipts) en relays Nostr reales crea un registro público e inmutable de todos los pagos, verificable por cualquiera.

---

## Conclusión

HDMP v2 implementa defensas adecuadas contra los ataques más comunes (replay, duplicados, XSS básico), y los fixes post-pentest mejoran significativamente la postura de seguridad. Sin embargo, la arquitectura client-side presenta limitaciones fundamentales que hacen que la app **NO sea apta para producción con dinero real** sin un backend. Para un **hackathon/demo**, el nivel de seguridad actual es aceptable.

**Tests**: 46/46 unit tests pasando, 5/22 ataques bloqueados nativamente.

---

*Generado el 15 de Marzo, 2026 — HDMP v2 Security Audit Suite*
