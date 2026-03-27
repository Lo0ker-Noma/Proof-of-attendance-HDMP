# ⚡ Proof of Attendance (HDMP) — v3.2

> Sistema de **reservas con pagos Lightning reales**, **Zaps publicados en relays Nostr**, **verificación de tickets por staff con QR scanner** y **página de verificación pública** para eventos presenciales. Usa Nostr Wallet Connect (NIP-47) + LNURL fallback, Zaps (NIP-57), backend serverless en Vercel, firmas HMAC-SHA256, 4 rondas de pentesting y publicación real en relays Nostr.

**Construido para la Lightning Hackathon FOUNDATIONS 2026 de La Crypta.**

**Live**: [proof-of-attendance-hdmp.vercel.app](https://proof-of-attendance-hdmp.vercel.app)

---

## La historia: de v1 a v3.1

### v1 — El MVP (semana 1)

Arrancamos con una idea simple: combatir los **no-shows** en eventos usando Lightning Network. Pagás un depósito en sats para reservar tu lugar, y si venís al evento, lo canjeás por una consumición. Si no venís, lo perdés.

La v1 funcionaba, pero tenía limitaciones importantes: el pago se generaba con Lightning Address y la verificación era **manual** (el usuario clickeaba "ya pagué"). Sin verificación criptográfica, sin registro auditable, sin protección contra fraude.

### v2 — Zaps y NWC (semana 2)

Después del primer pitch recibimos feedback claro: **"hacelo con Zaps y NWC"**. Eso cambió todo.

La v2 integra tres protocolos Nostr que transforman la app de un prototipo a un sistema verificable:

```
v1: Lightning Address → Invoice → "Ya pagué" (manual) → Ticket
                                    ↓
v2: NWC (NIP-47)     → Invoice → Verificación automática → Zap (NIP-57) → Ticket
                                  via lookupInvoice          kind 9734 + 9735
                                  con preimage               ↓
                                                          Audit Dashboard
                                                          con export CSV
                                                          + integrity check
```

### v2.1 — Multi-evento + diseño (semana 3)

Sistema multi-evento con 4 Coworks reales de La Crypta, diseño premium con glassmorphism, animaciones y Google Fonts.

### v2.2 → v2.3 — Security Hardening (semana 3)

**3 rondas de pentesting** con 48 escenarios de ataque en 21 categorías. De 17 vulnerabilidades iniciales → 21 fixes aplicados → **4 restantes** (limitaciones arquitectónicas de client-side). Incluye CSPRNG, CSP, AES-256-GCM non-extractable, rate limiting, CSV sanitization.

### v2.5 — Pagos reales en producción (semana 3)

El salto más grande: la app funciona con dinero real. Wallet de La Crypta (Primal) se conecta automáticamente via NWC. Probado en vivo con transacciones reales entre Primal y Wallet of Satoshi.

### v3.0 — Backend serverless + Staff Scanner (semana 4)

Migración de la lógica sensible a **Vercel Serverless Functions**. El NWC secret nunca se expone al cliente. Nuevo sistema de **verificación de tickets por staff** con escáner QR, PIN de acceso y firmas HMAC-SHA256 server-side. Nacido del feedback real del gorilla de La Crypta durante la demo del 24 de marzo.

```
v3.0 — Lo nuevo respecto a v2.5:

✅ Backend serverless (NWC secret server-side, no client-side)
✅ 3 API endpoints: /api/nwc, /api/verify-ticket, /api/staff-verify
✅ Staff QR Scanner con PIN de acceso para puerta y barra
✅ Firma HMAC-SHA256 server-side para cada ticket
✅ QR v3 self-contained (datos completos + firma para verificación cross-device)
✅ Verificación de tickets sin depender del localStorage del comprador
✅ NWC connection con timeout + fallback resiliente (8s max)
✅ Validación de entrada + consumición separadas
✅ Registro de actividad del staff en tiempo real
```

### v3.0.1 — Ronda 4 de Pentest + Security Hardening (semana 4)

Después de implementar el staff scanner, se corrió una **4ta ronda de auditoría de seguridad** específica para las nuevas features. Se encontraron y arreglaron **3 CRITICAL + 4 HIGH**:

```
v3.0.1 — Fixes de seguridad:

🔴 CRITICAL: XSS via paymentHash en onclick → reemplazado con event delegation + data attributes
🔴 CRITICAL: Staff PIN sin rate limiting → 5 intentos / 15 min con bloqueo por IP
🔴 CRITICAL: PIN fallback client-side '1234' → eliminado, fail closed (solo server-side)
🟠 HIGH: PIN comparison no timing-safe → crypto.timingSafeEqual con buffer padding
🟠 HIGH: Tickets sin firma aceptados por staff → rechazados, solo server-signed
🟠 HIGH: Invoice description sin sanitizar → max 500 chars, strip control chars
🟠 HIGH: Error messages revelando info del backend → mensajes genéricos
🟡 MEDIUM: paymentHash validado con regex /^[a-f0-9]{64}$/i en staff-verify
```

### v3.1 — Zaps en relays reales + Verificación pública (semana 4)

Las dos features que cierran el ciclo del proof-of-attendance:

```
v3.1 — Lo nuevo:

✅ Zaps publicados en relays Nostr REALES (relay.damus.io, nos.lol, relay.nostr.band)
✅ SimplePool de nostr-tools para publicación multi-relay
✅ Página de verificación pública: #verify/HDMP-XXXXXXXX
✅ Links a njump.me y nostr.band para verificar Zaps on-chain
✅ Cada ticket incluye URL compartible de verificación
✅ hashchange listener para navegación dinámica de verify links
✅ Ticket muestra status de publicación en relays post-pago
```

### v3.2 — LNURL Fallback + Resiliencia de pagos (semana 4, actual)

La v3.1 dependía 100% del relay NWC de Primal para crear invoices y verificar pagos. Cuando el relay no responde (si la app Primal no está abierta), toda la app se caía. La v3.2 resuelve esto con un sistema de fallback multi-protocolo:

```
v3.2 — Lo nuevo:

✅ LNURL-pay fallback: cuando el relay NWC falla, genera invoices via Lightning Address (HTTP puro)
✅ Decodificación bolt11: extrae payment_hash del invoice sin depender del relay
✅ Timeout server-side: NWC 5s + LNURL 4s = siempre responde antes del límite de Vercel (10s)
✅ JSON seguro: el servidor SIEMPRE devuelve JSON válido, nunca HTML de error
✅ Retry automático: hasta 3 intentos con mensajes "Relay lento — reintentando"
✅ Backoff progresivo: verificación de pago 5s → 8s → 15s cuando el relay está lento
✅ get_info resiliente: devuelve "connected" cuando LNURL está disponible (no depende del relay)
✅ Cleanup WebSocket: cierra conexiones en finally block (previene memory leaks)
```

El flujo ahora es:

```
Generar Invoice:
  1. Intenta NWC (relay) — timeout 5s
  2. Si falla → LNURL-pay (HTTP) — timeout 4s
  3. Si falla → Retry (hasta 3 veces)
  4. Siempre devuelve JSON al cliente

Verificar Pago:
  1. Polling NWC con backoff progresivo (5s → 8s → 15s)
  2. Manejo graceful de errores sin crashear la UI
  3. Mensaje "Relay lento" al usuario
```

---

## Qué hace

Un sistema de reservas para eventos donde:

1. La **wallet del organizador** (La Crypta) se conecta automáticamente via backend NWC
2. El **asistente** reserva → paga escaneando un QR con su wallet → el pago se verifica automáticamente via NWC → se firma el ticket server-side → se publican los Zaps en 3 relays Nostr
3. El asistente recibe un **ticket con QR** + un **link de verificación pública** que cualquiera puede abrir
4. Al llegar al evento, muestra su QR → el **staff** lo escanea con el scanner integrado
5. El staff valida la **entrada** (puerta) y la **consumición** (barra) por separado
6. Todo es **verificable públicamente**: los Zaps se pueden buscar en njump.me o nostr.band

```
Flujo completo v3.2:

Asistente paga sats
        ↓
NWC genera invoice (relay) ──timeout──→ LNURL fallback (HTTP)
        ↓
NWC verifica pago (preimage + settled_at) — con backoff progresivo
        ↓
Server firma ticket con HMAC-SHA256
        ↓
Zap Request (kind 9734) + Zap Receipt (kind 9735)
        ↓
Publicados en relay.damus.io + nos.lol + relay.nostr.band
        ↓
Ticket con QR (datos + firma) + link verificación pública
        ↓
Staff escanea QR → Server verifica firma → ✅ Entrada + 🍺 Consumición
        ↓
Cualquiera puede verificar: njump.me/{zapReceiptId}
```

---

## Flujo del asistente

```
1. Entrá a la app → ves los eventos de La Crypta
2. Elegí un evento → tocá "Reservar mi plaza"
3. Completá tu nombre y npub → "Generar Invoice"
4. Escaneá el QR con tu wallet (WoS, Phoenix, Primal, Zeus, etc.)
5. El pago se verifica automáticamente (preimage + settled_at)
6. Los Zaps se publican en 3 relays Nostr (verificable públicamente)
7. El ticket se firma server-side (HMAC-SHA256) → imposible de falsificar
8. Recibís tu ticket con QR + link de verificación pública
```

Los asistentes no necesitan configurar nada. Solo una wallet Lightning para pagar.

---

## 📡 Zaps en Nostr — Verificación pública

### Cómo funciona

Cada pago genera y **publica** dos eventos Nostr firmados criptográficamente en relays reales:

- **Kind 9734** (Zap Request) — La solicitud de pago con tags `p` (recipient), `amount` (millisats), `relays`
- **Kind 9735** (Zap Receipt) — La confirmación del pago con `bolt11` invoice y `preimage`

Los eventos se publican simultáneamente en 3 relays usando `SimplePool` de nostr-tools:

```
wss://relay.damus.io
wss://nos.lol
wss://relay.nostr.band
```

### Verificar un Zap

Después de pagar, el ticket muestra links directos para verificar el Zap:

- **njump.me**: `https://njump.me/{zapReceiptEventId}` — Vista del evento Nostr
- **nostr.band**: `https://nostr.band/?q={zapReceiptEventId}` — Búsqueda en el indexer

Esto convierte cada pago en un **registro público e inmutable** en el protocolo Nostr. No dependés de la app para verificar que un pago existió.

---

## 🔍 Verificación pública de tickets

### URL de verificación

Cada ticket incluye un link compartible:

```
https://proof-of-attendance-hdmp.vercel.app/#verify/HDMP-K7N4X2M9
```

### Qué muestra

La página de verificación pública muestra:

- Código del ticket y nombre del asistente
- Evento, fecha y monto pagado
- Payment hash completo (64 chars hex)
- Preimage (prueba criptográfica del pago)
- Estado de la firma servidor (HMAC-SHA256)
- Estado de canjeo (pendiente / canjeado + fecha)
- Links a los Zap events en Nostr (njump.me / nostr.band)

### Para qué sirve

- **Jurado del hackathon**: verificar que los pagos son reales, no simulados
- **Asistentes**: compartir proof-of-attendance en redes sociales
- **Organizadores**: auditoría independiente sin acceso al panel admin
- **Cualquier persona**: verificar que un ticket es legítimo

---

## 🔑 Sistema de Staff — Verificación de Tickets

### Qué es

Un panel integrado para que el **staff de La Crypta** (puerta y barra) pueda escanear y validar tickets QR de los asistentes. Accesible desde la pestaña **🔑 Staff** en el header. Nacido del feedback del gorilla de La Crypta durante la demo del 24 de marzo.

### Cómo acceder

1. Abrí la app en cualquier dispositivo (celular del staff ideal)
2. Tocá **🔑 Staff** en el header
3. Ingresá el **PIN de 4 dígitos**: `1234`
4. El PIN se verifica server-side via `/api/staff-verify`
5. Se abre el escáner QR de cámara automáticamente

### PIN de Staff

| Variable | Valor por defecto | Dónde se configura |
|----------|------------------|--------------------|
| `STAFF_PIN` | `1234` | Vercel → Settings → Environment Variables |

Para cambiar el PIN en producción, editá la variable `STAFF_PIN` en el dashboard de Vercel y redeploy.

### Seguridad del PIN

- Verificación **solo server-side** (sin fallback client-side)
- Comparación con `crypto.timingSafeEqual` (resistente a timing attacks)
- Rate limiting: **5 intentos por IP cada 15 minutos**
- Después de 5 intentos fallidos → HTTP 429 Too Many Requests
- Sin PIN en env var → acceso staff denegado (fail closed)

### Flujo de verificación

```
Staff escanea QR del asistente
        ↓
QR v3 contiene: código, eventId, nombre, paymentHash, monto, timestamp, firma HMAC
        ↓
Staff app envía datos a /api/staff-verify (action: validate-ticket)
        ↓
Server verifica firma HMAC-SHA256 con TICKET_SECRET
        ↓
  ✅ Firma válida → "Ticket Válido" (verde)
  ⚠️ Sin firma → "Ticket sin firma servidor" (amarillo) — se puede validar con precaución
  ❌ Firma inválida → "Ticket inválido" (rojo)
        ↓
Staff toca: [✅ Validar Entrada] o [🍺 Validar Consumición]
        ↓
Se registra en hdmp_staff_validations (localStorage del staff)
```

### Funcionalidades del staff

| Función | Descripción |
|---------|-------------|
| **Escáner QR** | Usa cámara del dispositivo para escanear tickets (html5-qrcode) |
| **Lookup manual** | Ingresá un código HDMP-XXXXXXXX manualmente |
| **Validar entrada** | Registra que el asistente llegó (puerta) |
| **Validar consumición** | Registra que canjeó su drink (barra) |
| **Doble validación bloqueada** | No se puede validar dos veces lo mismo |
| **Log de actividad** | Historial en tiempo real de todas las validaciones |
| **Contadores** | Entradas, consumiciones y total en tiempo real |
| **Logout** | Cierra sesión y limpia el scanner |

### QR v3 — Self-contained

A diferencia de v2 donde el QR solo tenía un código corto, el QR v3 contiene **todos los datos necesarios** para verificación sin acceso al localStorage del comprador:

```json
{
  "v": 3,
  "code": "HDMP-K7N4X2M9",
  "eventId": "cowork-mar17",
  "name": "Satoshi",
  "paymentHash": "a1b2c3d4e5f6...64chars",
  "amount": 2100,
  "timestamp": 1710700000000,
  "signature": "hmac-sha256...64chars",
  "zap": "nostr-event-id-16chars"
}
```

Esto permite que el staff use **cualquier dispositivo** para escanear — no necesita ser el mismo browser donde se compró el ticket.

---

## NIPs implementados

### NIP-47 — Nostr Wallet Connect (NWC)

El corazón de los pagos. NWC reemplaza la Lightning Address como backend:

- **`makeInvoice`** — Crear invoices desde la wallet del organizador (server-side)
- **`lookupInvoice`** — Verificar automáticamente si un pago fue completado (polling con preimage)
- **`getBalance`** — Mostrar el balance de la wallet en el panel del organizador
- **`getInfo`** — Verificar conexión con la wallet (con timeout 5s + LNURL fallback)

La wallet del organizador (La Crypta / Primal) se conecta automáticamente al cargar la app. Compatible con **Primal**, **Alby**, **Mutiny** y cualquier wallet NIP-47. Normalización robusta de respuestas: `paymentRequest`/`payment_request`/`invoice`/`bolt11`, `preimage`/`payment_preimage`, `settled_at`/`settledAt`/`state`/`status`.

### LNURL-pay — Fallback HTTP (v3.2)

Cuando el relay NWC no responde (frecuente con Primal si la app no está abierta), el backend cae automáticamente a **LNURL-pay** usando la Lightning Address del NWC URL (`lud16`). El flujo LNURL es 100% HTTP (sin WebSocket), mucho más rápido y confiable:

- **Resolve Lightning Address** — `user@domain` → `https://domain/.well-known/lnurlp/user`
- **Fetch callback URL** — Obtiene `callback`, `minSendable`, `maxSendable`
- **Request invoice** — Llama al callback con `amount` y `comment`
- **Decode payment_hash** — Extrae el payment hash del bolt11 con decoder bech32 custom
- **No requiere relay** — Funciona aunque el relay NWC esté caído

### NIP-57 — Zaps (publicados en relays reales)

Cada pago genera y **publica** dos eventos Nostr en `relay.damus.io`, `nos.lol` y `relay.nostr.band`:

- **Kind 9734** (Zap Request) — La solicitud de pago con tags `p` (recipient), `amount` (millisats), `relays`, y el mensaje de la reserva
- **Kind 9735** (Zap Receipt) — La confirmación del pago con el `bolt11` invoice y `preimage`

Esto crea un **registro verificable e inmutable** de cada pago en el protocolo Nostr. Cualquiera puede verificar en njump.me o nostr.band.

---

## Arquitectura v3.2

```
┌─────────────────────────────────────────────────────────────┐
│  FRONTEND (index.html — single-page app)                    │
│                                                             │
│  ┌────────┐ ┌──────┐ ┌────────┐ ┌───────┐ ┌────────┐       │
│  │ Evento │ │ Pago │ │ Ticket │ │ Staff │ │ Verify │       │
│  │  view  │ │ view │ │  view  │ │ view  │ │  view  │       │
│  └────────┘ └──────┘ └────────┘ └───────┘ └────────┘       │
│       │          │         │         │          │           │
│       └──────────┴─────────┴─────────┴──────────┘           │
│                            │                                │
└────────────────────────────┼────────────────────────────────┘
                             │ HTTPS
┌────────────────────────────┼────────────────────────────────┐
│  BACKEND (Vercel Serverless Functions)                       │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐      │
│  │ /api/nwc     │  │ /api/verify  │  │ /api/staff    │      │
│  │ NWC + LNURL  │  │ -ticket      │  │ -verify       │      │
│  │ make_invoice │  │ sign (HMAC)  │  │ verify PIN    │      │
│  │ lookup_inv   │  │ verify sig   │  │ validate tix  │      │
│  │ get_balance  │  │              │  │ rate limiting  │      │
│  │ get_info     │  │              │  │ timingSafeEq   │      │
│  │ bolt11 decode│  │              │  │               │      │
│  └──────┬───────┘  └──────────────┘  └───────────────┘      │
│         │                                                   │
│  env: NWC_URL, TICKET_SECRET, STAFF_PIN                     │
└─────────┼───────────────────────────────────────────────────┘
          │ WSS (NIP-47) + HTTPS (LNURL fallback)
┌─────────┴───────────────────────────────────────────────────┐
│  NWC RELAY (wss://relay.primal.net)    ← NWC payments       │
│  LNURL (primal.net/lnurlp/*)          ← HTTP fallback       │
│  PUBLISH RELAYS:                       ← Zap events         │
│    wss://relay.damus.io                                     │
│    wss://nos.lol                                            │
│    wss://relay.nostr.band                                   │
│                                                             │
│  ┌──────────────────────────────────────────────┐           │
│  │  Primal Wallet (La Crypta)                   │           │
│  │  Recibe pagos Lightning via NWC              │           │
│  └──────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

---

## Almacenamiento de datos

### Client-side (localStorage del comprador)

| Key | Contenido |
|-----|-----------|
| `hdmp_reservations` | Array de reservas con ticketCode, eventId, paymentHash, serverSignature, zapReceiptId, zapPublished, etc. |
| `hdmp_payment_log` | Log de pagos para auditoría (preimage, verified, verificationMethod, zapPublished, zapRelaysAccepted) |

### Client-side (localStorage del staff)

| Key | Contenido |
|-----|-----------|
| `hdmp_staff_validations` | Array de validaciones: entrada y consumición por paymentHash |

### Server-side (Vercel Environment Variables)

| Variable | Uso |
|----------|-----|
| `NWC_URL` | Nostr Wallet Connect URL (nunca se expone al cliente) |
| `TICKET_SECRET` | Clave para firmas HMAC-SHA256 de tickets |
| `STAFF_PIN` | PIN de acceso al panel de staff |

### Flujo de datos cross-device

```
Comprador paga → NWC verifica → Server firma ticket (HMAC) → Zaps publicados en Nostr
                                         ↓                           ↓
                                   QR con datos + firma    Verificable en njump.me
                                         ↓
                     Staff escanea QR → /api/staff-verify → Server re-calcula HMAC
                                                                    ↓
                                                           ¿Firma coincide? → ✅ / ❌
```

---

## Las pantallas

| # | Pantalla | Qué hace |
|---|----------|----------|
| 1 | **Evento** | Selección multi-evento, status de wallet, precio dinámico sats+USD, badges NIP-47/NIP-57 |
| 2 | **Pago** | Invoice NWC, QR code, verificación automática con polling 5s, publicación Zaps en relays |
| 3 | **Ticket** | QR v3 self-contained + payment hash + preimage + Zap event ID + links Nostr + link verificación pública |
| 4 | **🔑 Staff** | PIN server-side → escáner QR → validar entrada/consumición → log de actividad + contadores |
| 5 | **🔍 Verificación** | Página pública #verify/CODE: payment hash, preimage, firma, Zap links, estado canjeo |
| 6 | **Auditoría** | Log de pagos, filtros, stats, export CSV, integrity check (accesible via `#audit`) |
| 7 | **Organizador** | Balance wallet, canjear tickets, reconfigurar NWC (accesible via `#organizer`) |

---

## Seguridad — 4 rondas de Pentest + Backend Hardening

Se corrieron **4 rondas de pentesting** (3 automatizadas + 1 manual post-staff) con **48+ escenarios de ataque** en 21+ categorías. Cada ronda fue seguida de fixes y re-verificación.

### Evolución de seguridad

```
              v2.1          v2.2           v2.3           v3.0           v3.0.1 (actual)
              (antes)       (pentest 1)    (pentest 2)    (staff added)  (pentest 4)
              ──────        ───────────    ───────────    ───────────    ───────────────
Tests:        22            22             26             48             48+
Bloqueados:   5  (23%)      13  (59%)      22  (85%)      44  (92%)      48  (98%)
Vulns:        17            9              4              7              2
  CRITICAL:   5             3              1              3 (+staff)     0 ✅
  HIGH:       6             5              0              4 (+staff)     0 ✅
  MEDIUM:     3             1              2              0              1
  LOW:        3             0              1              0              1
```

### Timeline de fixes

**Ronda 1 — Pentest inicial (v2.2)**

| Fix | Qué resuelve |
|-----|-------------|
| **CSPRNG ticket codes** | `crypto.getRandomValues()` — 8 chars, 656B combinaciones |
| **AES-256-GCM non-extractable** | NWC URL encriptada con key `extractable: false` |
| **CSP + X-Frame-Options** | Content Security Policy, clickjacking prevention |
| **escapeHtml()** | Prevención de DOM XSS en nombres y datos de usuario |

**Ronda 2 — Advanced pentest (v2.3)**

| Fix | Qué resuelve |
|-----|-------------|
| **CSV formula injection** | `csvSanitize()` prefija `=`, `+`, `-`, `@` con apóstrofe |
| **Rate limiting** | Max 5 intentos de canjeo por minuto con ventana deslizante |
| **Cross-event isolation** | `markRedeemed()` verifica `eventId === selectedEvent.id` |
| **Strict payment verification** | Solo acepta preimage (32+ chars), settled_at, o state="settled" |

**Ronda 3 — Backend migration (v3.0)**

| Fix | Qué resuelve |
|-----|-------------|
| **NWC secret server-side** | NWC URL nunca se expone al cliente — solo en env vars de Vercel |
| **HMAC-SHA256 ticket signing** | Cada ticket tiene firma criptográfica server-side |
| **QR v3 self-contained** | Datos completos + firma permiten verificación cross-device |
| **NWC timeout 8s** | `Promise.race` evita que la app se cuelgue si el relay no responde |

**Ronda 4 — Post-staff audit (v3.0.1)**

| Fix | Qué resuelve |
|-----|-------------|
| **XSS en onclick handlers** | Reemplazado string interpolation con event delegation + `data-staff-action` |
| **PIN rate limiting** | 5 intentos/15min por IP con `pinAttempts` in-memory tracking |
| **timingSafeEqual para PIN** | `crypto.timingSafeEqual` con buffer padding a 64 bytes |
| **Eliminado PIN fallback** | Sin fallback client-side `'1234'` — fail closed, solo server |
| **Reject unsigned tickets** | Staff API rechaza tickets sin `signature` — previene localStorage forgery |
| **Sanitize invoice description** | Max 500 chars, strip control characters `[\x00-\x1f\x7f]` |
| **Generic error messages** | NWC API devuelve mensajes genéricos, sin leak de info del backend |
| **paymentHash regex** | `/^[a-f0-9]{64}$/i` validation en staff-verify endpoint |

### Vulnerabilidades restantes (arquitectónicas)

| Vuln | Severidad | Status |
|------|-----------|--------|
| ESM imports sin SRI hashes | MEDIUM | Mitigado con version pinning |
| Funciones en window scope | LOW | Mitigado — funciones críticas usan server validation |

---

## Tests

```
56 unit tests          — 100% passing
22 security pentest v2 — 12 blocked, 10 documented
26 advanced pentest v3 — 22 blocked, 4 remaining (architectural)
─────────────────────────────────────────
104 total test scenarios
```

```bash
npm test              # Unit tests (56)
npm run test:security # Pentest v2 (22)
npm run test:advanced # Advanced Pentest v3 (26)
npm run test:all      # Todo (104)
```

Los tests cubren: generación de tickets (CSPRNG), CRUD de reservas, payment log, validaciones NWC/NIP-57, sanitización de input (null bytes, zero-width, Unicode, XSS), estructura de Zap events, parsing de NWC URLs, verificación de integridad, double-spend prevention, escape de HTML, DOM XSS, prototype pollution, supply chain, CSV injection, brute force, cross-event leakage, clickjacking, CSP, y rate limiting.

---

## Variables de entorno (Vercel)

| Variable | Ejemplo | Requerida |
|----------|---------|-----------|
| `NWC_URL` | `nostr+walletconnect://pubkey?relay=wss://...&secret=...` | Sí |
| `TICKET_SECRET` | `hdmp-lacrypta-foundations2026-ticket-secret-v3` | Sí |
| `STAFF_PIN` | `1234` | No (default denegado sin env var) |

---

## Cómo correr

```bash
git clone https://github.com/Lo0ker-Noma/Proof-of-attendance-HDMP.git
cd Proof-of-attendance-HDMP
npm install
npm run dev
```

Abrí `http://localhost:5173` — la wallet del organizador se conecta automáticamente.

Para producción con Vercel:
```bash
vercel env add NWC_URL        # Tu NWC connection string
vercel env add TICKET_SECRET  # Secret para firmas HMAC
vercel env add STAFF_PIN      # PIN del staff
vercel --prod
```

---

## Stack técnico

| Herramienta | Uso |
|---|---|
| **Vite** | Build tool y dev server |
| **@getalby/sdk@3.5.1** | NWC client (NIP-47) — invoices, verificación, balance + LNURL-pay fallback |
| **nostr-tools@2.7.0** | Creación, firma y **publicación** de eventos Nostr (NIP-57 Zaps) |
| **nostr-tools/pool** | `SimplePool` para publicar en múltiples relays simultáneamente |
| **@noble/hashes** | Utilidades criptográficas (client-side) |
| **Web Crypto API** | AES-256-GCM non-extractable key + CSPRNG (`getRandomValues`) |
| **Node crypto** | HMAC-SHA256 + timingSafeEqual (backend) |
| **html5-qrcode** | Escáner QR para staff (dynamic import desde esm.sh) |
| **mempool.space API** | Conversión BTC→USD en tiempo real |
| **qrcode** | Generación de QR codes |
| **Vercel Functions** | Backend serverless (3 endpoints) |

---

## Estructura del proyecto

```
├── index.html                    # App completa (single-file, ~3200 líneas)
├── api/
│   ├── nwc.js                    # Backend NWC proxy (make_invoice, lookup, balance, info)
│   ├── verify-ticket.js          # Firma y verificación HMAC-SHA256 de tickets
│   └── staff-verify.js           # PIN verification + ticket validation + rate limiting
├── vercel.json                   # Config de Vercel (functions, CORS headers)
├── package.json                  # v3.0.0 con scripts de test
├── vite.config.js                # Config de Vite
├── PROJECT.md                    # Spec del proyecto
├── CHANGELOG.md                  # Historial de cambios v1 → v3.2
├── SECURITY-AUDIT.md             # Reporte formal de auditoría de seguridad
├── CLAUDE.md                     # Contexto técnico para evaluadores
├── AGENTS.md                     # Resumen para evaluadores IA
├── tests/
│   ├── unit-tests.js             # 56 unit tests
│   ├── security-pentest.js       # 22 escenarios de pentest v2
│   └── advanced-pentest-v3.js    # 26 escenarios avanzados (white hat)
└── src/examples/                 # Ejemplos del starter kit original
```

---

## Qué falta (post-hackathon)

- [ ] Base de datos server-side (reemplazar localStorage por Vercel KV o Supabase)
- [x] ~~Publicar Zaps en relays Nostr reales~~ ✅ Implementado v3.1
- [x] ~~LNURL fallback para resiliencia~~ ✅ Implementado v3.2
- [x] ~~Manejo de relay lento / caído~~ ✅ Implementado v3.2
- [ ] Hash chain para audit log inmutable
- [ ] SRI (Subresource Integrity) hashes via bundler
- [ ] NIP-58 Nostr badges como proof-of-attendance nativo
- [ ] LNURL-verify para verificar pagos sin relay (si Primal lo soporta)
- [ ] App móvil nativa con scanner QR
- [ ] Dashboard live para proyector durante el evento

---

## Hackathon

**Lightning Hackathon FOUNDATIONS** — La Crypta, Buenos Aires

- **Tema**: Lightning Payments Basics
- **Premio**: 1,000,000 sats
- **Fechas**: Marzo 2026
- **Info**: [hackaton.lacrypta.ar](https://hackaton.lacrypta.ar)

---

## Autor

Construido con ⚡ y mucho café durante la Lightning Hackathon 2026.

[@Lo0ker-Noma](https://github.com/Lo0ker-Noma)

---

*Evolución del [Lightning Starter Kit](https://github.com/lacrypta/lightning-starter) de La Crypta*
