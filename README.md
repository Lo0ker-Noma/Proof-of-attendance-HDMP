# ⚡ Proof of Attendance (HDMP) — v3.0

> Sistema de **reservas con pagos Lightning reales** + **verificación de tickets por staff** para eventos presenciales. Usa Nostr Wallet Connect (NIP-47), Zaps (NIP-57), backend serverless en Vercel, firmas HMAC-SHA256 y escáner QR para validación en puerta y barra.

**Construido para la Lightning Hackathon FOUNDATIONS 2026 de La Crypta.**

**Live**: [proof-of-attendance-hdmp.vercel.app](https://proof-of-attendance-hdmp.vercel.app)

---

## La historia: de v1 a v3.0

### v1 — El MVP (semana 1)

Arrancamos con una idea simple: combatir los **no-shows** en eventos usando Lightning Network. Pagás un depósito en sats para reservar tu lugar, y si venís al evento, lo canjeás por una consumición. Si no venís, lo perdés.

La v1 funcionaba, pero tenía limitaciones importantes: el pago se generaba con Lightning Address y la verificación era **manual** (el usuario clickeaba "ya pagué"). Sin verificación criptográfica, sin registro auditable, sin protección contra fraude.

### v2 — El upgrade (semana 2)

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

### v2.5 — Pagos reales en producción

El salto más grande: la app funciona con dinero real. Wallet de La Crypta (Primal) se conecta automáticamente via NWC. Probado en vivo con transacciones reales entre Primal y Wallet of Satoshi.

### v3.0 — Backend serverless + Staff Scanner (actual)

Migración de la lógica sensible a **Vercel Serverless Functions**. El NWC secret nunca se expone al cliente. Nuevo sistema de **verificación de tickets por staff** con escáner QR, PIN de acceso y firmas HMAC-SHA256 server-side.

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

---

## Qué hace

Un sistema de reservas para eventos donde:

1. La **wallet del organizador** (La Crypta) se conecta automáticamente via backend NWC
2. El **asistente** reserva → paga escaneando un QR con su wallet → el pago se verifica automáticamente via NWC → se firma el ticket server-side → se genera un Zap en Nostr
3. Al llegar al evento, muestra su QR → el **staff** lo escanea con el scanner integrado
4. El staff valida la **entrada** (puerta) y la **consumición** (barra) por separado
5. Todo queda registrado: audit dashboard con payment hashes, preimages, firmas server-side y log de validaciones

---

## Flujo del asistente

```
1. Entrá a la app → ves los eventos de La Crypta
2. Elegí un evento → tocá "Reservar mi plaza"
3. Completá tu nombre y npub → "Generar Invoice"
4. Escaneá el QR con tu wallet (WoS, Phoenix, Primal, Zeus, etc.)
5. El pago se verifica automáticamente (preimage + settled_at)
6. El ticket se firma server-side (HMAC-SHA256) → imposible de falsificar
7. Recibís tu ticket con QR que contiene todos los datos + firma
```

Los asistentes no necesitan configurar nada. Solo una wallet Lightning para pagar.

---

## 🔑 Sistema de Staff — Verificación de Tickets

### Qué es

Un panel integrado para que el **staff de La Crypta** (puerta y barra) pueda escanear y validar tickets QR de los asistentes. Accesible desde la pestaña **🔑 Staff** en el header.

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

### Flujo de verificación

```
Staff escanea QR del asistente
        ↓
QR contiene: código, eventId, nombre, paymentHash, monto, timestamp, firma HMAC
        ↓
Staff app envía datos a /api/staff-verify (action: validate-ticket)
        ↓
Server verifica firma HMAC-SHA256 con TICKET_SECRET
        ↓
  ✅ Firma válida → "Ticket Válido" (verde)
  ⚠️ Sin firma → "Ticket encontrado, sin firma servidor" (amarillo)
  ❌ Firma inválida → "Ticket inválido" (rojo)
        ↓
Staff toca: [✅ Validar Entrada] o [🍺 Validar Consumición]
        ↓
Se registra en hdmp_staff_validations (localStorage del staff)
```

### Funcionalidades del staff

| Función | Descripción |
|---------|-------------|
| **Escáner QR** | Usa cámara del dispositivo para escanear tickets |
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

- **`makeInvoice`** — Crear invoices desde la wallet del organizador
- **`lookupInvoice`** — Verificar automáticamente si un pago fue completado (polling con preimage)
- **`getBalance`** — Mostrar el balance de la wallet en el panel del organizador
- **`getInfo`** — Verificar conexión con la wallet

La wallet del organizador (La Crypta / Primal) se conecta automáticamente al cargar la app. Compatible con **Primal**, **Alby**, **Mutiny** y cualquier wallet NIP-47. Normalización robusta de respuestas: `paymentRequest`/`payment_request`/`invoice`/`bolt11`, `preimage`/`payment_preimage`, `settled_at`/`settledAt`/`state`/`status`.

### NIP-57 — Zaps

Cada pago genera dos eventos Nostr firmados criptográficamente:

- **Kind 9734** (Zap Request) — La solicitud de pago con tags `p` (recipient), `amount` (millisats), `relays`, y el mensaje de la reserva
- **Kind 9735** (Zap Receipt) — La confirmación del pago con el `bolt11` invoice y `preimage`

Esto crea un **registro verificable e inmutable** de cada pago en el protocolo Nostr.

---

## Arquitectura v3.0

```
┌─────────────────────────────────────────────────────────┐
│  FRONTEND (index.html — single-page app)                │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐  │
│  │  Evento  │  │  Pago    │  │  Ticket  │  │  Staff │  │
│  │  view    │  │  view    │  │  view    │  │  view  │  │
│  └──────────┘  └──────────┘  └──────────┘  └────────┘  │
│       │              │             │             │       │
│       └──────────────┴─────────────┴─────────────┘      │
│                          │                              │
└──────────────────────────┼──────────────────────────────┘
                           │ HTTPS
┌──────────────────────────┼──────────────────────────────┐
│  BACKEND (Vercel Serverless Functions)                   │
│                                                         │
│  ┌────────────────┐  ┌──────────────┐  ┌─────────────┐  │
│  │  /api/nwc      │  │  /api/verify │  │  /api/staff │  │
│  │  NWC proxy     │  │  -ticket     │  │  -verify    │  │
│  │  make_invoice  │  │  sign ticket │  │  verify PIN │  │
│  │  lookup_inv    │  │  verify sig  │  │  validate   │  │
│  │  get_balance   │  │  HMAC-SHA256 │  │  ticket     │  │
│  │  get_info      │  │              │  │             │  │
│  └───────┬────────┘  └──────────────┘  └─────────────┘  │
│          │                                              │
│  env: NWC_URL, TICKET_SECRET, STAFF_PIN                 │
└──────────┼──────────────────────────────────────────────┘
           │ WSS (NIP-47)
┌──────────┴──────────────────────────────────────────────┐
│  NOSTR RELAY (wss://relay.primal.net)                   │
│                                                         │
│  ┌──────────────────────────────────────────────┐       │
│  │  Primal Wallet (La Crypta)                   │       │
│  │  Recibe pagos Lightning via NWC              │       │
│  └──────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────┘
```

---

## Almacenamiento de datos

### Client-side (localStorage del comprador)

| Key | Contenido |
|-----|-----------|
| `hdmp_reservations` | Array de reservas con ticketCode, eventId, paymentHash, serverSignature, etc. |
| `hdmp_payment_log` | Log de pagos para auditoría (preimage, verified, verificationMethod) |

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
Comprador paga → Server firma ticket (HMAC) → QR con datos + firma
                                                      ↓
Staff escanea QR → Datos van a /api/staff-verify → Server re-calcula HMAC
                                                      ↓
                                              ¿Firma coincide? → ✅ / ❌
```

El QR es **self-contained**: el staff no necesita acceso al localStorage del comprador.

---

## Las pantallas

| # | Pantalla | Qué hace |
|---|----------|----------|
| 1 | **Evento** | Selección multi-evento, status de wallet, precio dinámico sats+USD, badges NIP-47/NIP-57 |
| 2 | **Pago** | Invoice NWC, QR code, verificación automática con polling 5s, Zap receipt |
| 3 | **Ticket** | QR v3 self-contained + payment hash + preimage + Zap event ID |
| 4 | **🔑 Staff** | PIN de acceso → escáner QR → validar entrada/consumición → log de actividad |
| 5 | **Auditoría** | Log de pagos, filtros, stats, export CSV, integrity check (accesible via URL hash) |
| 6 | **Organizador** | Balance wallet, canjear tickets, reconfigurar NWC (accesible via URL hash) |

Las pantallas Auditoría y Organizador están ocultas del menú pero accesibles via `#audit` y `#organizer` en la URL.

---

## Seguridad — 3 rondas de Pentest + Backend Hardening

Se corrieron **3 rondas de pentesting automatizado** con **48 escenarios de ataque** en 21 categorías.

### Evolución de seguridad

```
                    v2.1 (antes)    v2.2 (pentest 1)   v2.3 (pentest 2)   v3.0 (actual)
                    ────────────    ────────────────    ────────────────    ─────────────
Tests:              22              22                  26                  48+
Ataques bloqueados: 5  (23%)        13  (59%)           22  (85%)          46  (96%)
Vulnerabilidades:   17              9                   4                   2
  CRITICAL:         5               3                   1                   0
  HIGH:             6               5                   0                   0
  MEDIUM:           3               1                   2                   1
  LOW:              3               0                   1                   1
```

### Fixes v3.0

| Fix | Qué resuelve |
|-----|-------------|
| **NWC secret server-side** | NWC URL nunca se expone al cliente — solo en env vars de Vercel |
| **HMAC-SHA256 ticket signing** | Cada ticket tiene firma criptográfica server-side, imposible de falsificar |
| **timingSafeEqual** | Comparación de firmas resistente a timing attacks |
| **Staff PIN server-side** | PIN verificado via API, no hardcodeado en el cliente |
| **QR v3 self-contained** | Datos completos + firma permiten verificación cross-device |
| **NWC timeout 8s** | Evita que la app se cuelgue si el relay no responde |

### Fixes de rondas anteriores

| Fix | Qué resuelve |
|-----|-------------|
| **CSPRNG ticket codes** | `crypto.getRandomValues()` — 8 chars, 656B combinaciones |
| **AES-256-GCM non-extractable** | NWC URL encriptada con key `extractable: false` |
| **CSP + X-Frame-Options** | Content Security Policy, clickjacking prevention |
| **CSV formula injection** | `csvSanitize()` prefija `=`, `+`, `-`, `@` con apóstrofe |
| **Rate limiting** | Max 5 intentos de canjeo por minuto con ventana deslizante |
| **Cross-event isolation** | `markRedeemed()` verifica `eventId === selectedEvent.id` |
| **Strict payment verification** | Solo acepta preimage (32+ chars), settled_at, o state="settled" |

---

## Variables de entorno (Vercel)

| Variable | Ejemplo | Requerida |
|----------|---------|-----------|
| `NWC_URL` | `nostr+walletconnect://pubkey?relay=wss://...&secret=...` | Sí |
| `TICKET_SECRET` | `hdmp-lacrypta-foundations2026-ticket-secret-v3` | Sí |
| `STAFF_PIN` | `1234` | No (default: 1234) |

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
vercel env add STAFF_PIN      # PIN del staff (default: 1234)
vercel --prod
```

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

---

## Stack técnico

| Herramienta | Uso |
|---|---|
| **Vite** | Build tool y dev server |
| **@getalby/sdk@3.5.1** | NWC client (NIP-47) — invoices, verificación, balance |
| **nostr-tools** | Creación y firma de eventos Nostr (NIP-57 Zaps) |
| **@noble/hashes** | Utilidades criptográficas |
| **Web Crypto API** | AES-256-GCM non-extractable key + CSPRNG (`getRandomValues`) |
| **Node crypto** | HMAC-SHA256 + timingSafeEqual (backend) |
| **html5-qrcode** | Escáner QR para staff (dynamic import desde esm.sh) |
| **mempool.space API** | Conversión BTC→USD en tiempo real |
| **qrcode** | Generación de QR codes |
| **Vercel Functions** | Backend serverless (3 endpoints) |

---

## Estructura del proyecto

```
├── index.html                    # App completa (single-file, ~3000 líneas)
├── api/
│   ├── nwc.js                    # Backend NWC proxy (make_invoice, lookup, balance, info)
│   ├── verify-ticket.js          # Firma y verificación HMAC-SHA256 de tickets
│   └── staff-verify.js           # Verificación de PIN + validación de tickets para staff
├── vercel.json                   # Config de Vercel (functions, CORS headers)
├── package.json                  # v3.0.0 con scripts de test
├── vite.config.js                # Config de Vite
├── PROJECT.md                    # Spec del proyecto
├── CHANGELOG.md                  # Historial de cambios v1 → v3.0
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
- [ ] Publicar Zaps en relays Nostr reales
- [ ] Hash chain para audit log inmutable
- [ ] SRI (Subresource Integrity) hashes via bundler
- [ ] App móvil nativa con scanner QR

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
