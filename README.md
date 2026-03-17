# ⚡ Proof of Attendance (HDMP) — v2.3

> De un MVP con verificación manual a un sistema multi-evento con **Nostr Wallet Connect (NIP-47)**, **Zaps (NIP-57)**, auditoría criptográfica, pentest de seguridad y diseño premium.

**Construido para la Lightning Hackathon FOUNDATIONS 2026 de La Crypta.**

**Live demo**: [proof-of-attendance-hdmp.vercel.app](https://proof-of-attendance-hdmp.vercel.app/#demo)

---

## La historia: de v1 a v2.3

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

### v2.2 — Security Hardening (semana 3)

Pentest completo de 22 escenarios → se encontraron 17 vulnerabilidades → se aplicaron 8 fixes concretos → se redujo a 9 (inherentes a client-side).

### v2.3 — Advanced White Hat Pentest + Deep Hardening (semana 3)

Pentest avanzado de **26 escenarios adicionales** en 14 categorías (DOM XSS, prototype pollution, supply chain, crypto, CSV injection, brute force, cross-event, clickjacking). Se encontraron **17 vulnerabilidades nuevas** → se aplicaron **13 fixes** → se redujo a **4 (limitaciones arquitectónicas)**.

---

## Qué hace

Un sistema de reservas para eventos donde:

1. El **organizador** conecta su wallet via NWC y crea el evento
2. El **asistente** paga X sats → la app genera el invoice via NWC, verifica el pago automáticamente, y registra un Zap en Nostr
3. Al llegar al evento, muestra su QR → el organizador lo canjea
4. Todo queda registrado en un **dashboard de auditoría** con hashes, preimages y verificación de integridad

---

## NIPs implementados

### NIP-47 — Nostr Wallet Connect (NWC)

El corazón de los pagos. NWC reemplaza la Lightning Address como backend:

- **`makeInvoice`** — Crear invoices desde la wallet del organizador
- **`lookupInvoice`** — Verificar automáticamente si un pago fue completado (polling con preimage)
- **`getBalance`** — Mostrar el balance de la wallet en el panel del organizador
- **`listTransactions`** — Listar transacciones para el dashboard de auditoría

La conexión se establece con un NWC string (`nostr+walletconnect://...`) que el organizador obtiene de Alby u otra wallet compatible.

### NIP-57 — Zaps

Cada pago genera dos eventos Nostr firmados criptográficamente:

- **Kind 9734** (Zap Request) — La solicitud de pago con tags `p` (recipient), `amount` (millisats), `relays`, y el mensaje de la reserva
- **Kind 9735** (Zap Receipt) — La confirmación del pago con el `bolt11` invoice y `preimage`

Esto crea un **registro verificable e inmutable** de cada pago en el protocolo Nostr.

---

## Las 6 pantallas

| # | Pantalla | Qué hace |
|---|----------|----------|
| 0 | **NWC Setup** | Conectar wallet via NWC string o activar modo demo |
| 1 | **Evento** | Selección multi-evento, info, precio, lugares, badges NWC+Zaps |
| 2 | **Pago** | Invoice NWC, QR, verificación automática con polling, Zap receipt |
| 3 | **Ticket** | QR con código + payment hash + Zap event ID + preimage |
| 4 | **Organizador** | Stats, canjear tickets, balance de wallet, lista de reservas |
| 5 | **Auditoría** | Log de pagos, filtros, stats, export CSV, integrity check |

---

## Seguridad — Pentest & Hardening v2.2 → v2.3

Se corrieron **3 rondas de pentesting automatizado** con **48 escenarios de ataque** en 21 categorías. Cada ronda de pentest fue seguida de fixes y re-verificación.

### Evolución de seguridad

```
                    v2.1 (antes)    v2.2 (pentest 1)   v2.3 (pentest 2)
                    ────────────    ────────────────    ────────────────
Tests:              22              22                  26 (nuevos)
Ataques bloqueados: 5  (23%)        13  (59%)           22  (85%)
Vulnerabilidades:   17              9                   4
  CRITICAL:         5               3                   1
  HIGH:             6               5                   0
  MEDIUM:           3               1                   2
  LOW:              3               0                   1
```

### 8 vulnerabilidades reparadas en v2.2

| # | Vulnerabilidad | Severidad | Fix aplicado |
|---|----------------|-----------|-------------|
| 1 | **Invoice de monto menor** — atacante paga menos sats de los requeridos | CRITICAL | Validación de `paymentResult.amount` contra `selectedEvent.price * 1000` en `onPaymentVerified()` |
| 2 | **Double-spend por paymentHash** — un solo pago genera múltiples tickets | CRITICAL | `saveReservation()` verifica que no exista otro registro con el mismo `paymentHash` |
| 3 | **Script injection (XSS)** — `<script>` en el nombre del asistente | HIGH | `sanitizeInput()` v2.2: strip `<>"'&`, control chars, zero-width Unicode, NFKC |
| 4 | **JSON malformado crash (DoS)** — JSON inválido en localStorage | MEDIUM | `try/catch` en `getReservations()` y `getPaymentLog()` con fallback a `[]` |
| 5 | **Null bytes y chars de control** | LOW | `sanitizeInput()` strip `\x00-\x1F`, `\x7F` y separadores Unicode |
| 6 | **Unicode zero-width spoofing** | LOW | Strip + normalización `NFKC` |
| 7 | **Nombres extremadamente largos (DoS)** | LOW | Truncado a 100 chars + `maxlength="40"` en HTML |
| 8 | **Timestamps falsos** | MEDIUM | Validación ±1 hora en `saveReservation()` |

### 13 vulnerabilidades reparadas en v2.3 (Advanced White Hat Pentest)

| # | Vulnerabilidad | Severidad | Fix aplicado |
|---|----------------|-----------|-------------|
| 1 | **Sin Content Security Policy (CSP)** — cualquier script externo se ejecuta | HIGH | `<meta http-equiv="Content-Security-Policy">` con `script-src 'self' https://esm.sh`, `frame-ancestors 'none'` |
| 2 | **Sin X-Frame-Options (Clickjacking)** — app embebible en iframe | MEDIUM | `<meta http-equiv="X-Frame-Options" content="DENY">` + `X-Content-Type-Options: nosniff` + `Referrer-Policy` |
| 3 | **Math.random() para ticket codes** — predecible, no CSPRNG | HIGH | Reemplazado por `crypto.getRandomValues(new Uint8Array(8))` |
| 4 | **Entropy insuficiente (6 chars × 30)** — 729M combos, brute-forceable | MEDIUM | Aumentado a **8 caracteres** (30^8 = 656 billion combinaciones) |
| 5 | **AES-GCM key en sessionStorage** — accesible via XSS | HIGH | Key ahora es `extractable: false` y se almacena solo en **memoria JS** (variable `_nwcCryptoKey`), no en sessionStorage |
| 6 | **innerHTML en audit rows sin escapar** — XSS via paymentHash | HIGH | `escapeHtml()` aplicado a `hashShort` antes de insertarlo en innerHTML |
| 7 | **CSV Formula Injection** — `=CMD\|` en nombres ejecuta fórmulas en Excel | HIGH | Nueva función `csvSanitize()`: prefija `=`, `+`, `-`, `@` con apóstrofe |
| 8 | **CSV delimiter injection** — comillas en paymentHash rompen CSV | MEDIUM | `csvSanitize()` escapa comillas dobles (`"` → `""`) |
| 9 | **@getalby/sdk sin version pin** — `@3` permite versiones maliciosas | HIGH | Pineado a versión exacta `@getalby/sdk@3.5.1` |
| 10 | **Cross-event ticket reuse** — ticket de un evento funciona en otro | HIGH | `markRedeemed()` ahora verifica `reservation.eventId === selectedEvent.id` |
| 11 | **clearAllData sin autenticación** — XSS borra todos los datos | HIGH | Requiere PIN del organizador (`⚡HDMP`) además de `confirm()` |
| 12 | **Sin rate limiting en redeemTicket** — brute force viable | HIGH | Rate limiting: max 5 intentos por minuto (`_redeemAttempts` con ventana de 60s) |
| 13 | **copyInvoice sin validación** — clipboard hijacking | MEDIUM | Validación de formato Lightning invoice (`/^ln(bc|tb|tbs)[a-z0-9]+$/i`) antes de copiar |

### 4 vulnerabilidades restantes (limitaciones arquitectónicas)

| Vulnerabilidad | Severidad | Por qué no se puede resolver |
|----------------|-----------|------------------------------|
| ESM imports sin SRI hashes | CRITICAL | Requiere bundler (Vite build) para generar integrity hashes — esm.sh no soporta SRI nativo |
| Funciones expuestas en window scope | MEDIUM | Requiere refactor a ES modules con `addEventListener` — no compatible con inline `onclick` en HTML |
| Reservas sin segregación por eventId | MEDIUM | Requiere migración de datos existentes en localStorage — riesgo de pérdida de datos |
| QR payload injection (en memoria) | LOW | Impacto mínimo — QR readers modernos no ejecutan javascript: URIs |

Reporte formal completo: [`SECURITY-AUDIT.md`](./SECURITY-AUDIT.md)

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

## Cómo correr

```bash
git clone https://github.com/Lo0ker-Noma/Proof-of-attendance-HDMP.git
cd Proof-of-attendance-HDMP
npm install
npm run dev
```

Abrí `http://localhost:5173`

Para **modo demo** sin wallet real: agregá `#demo` a la URL.

---

## Configuración

Para usar con tu propia wallet, necesitás un NWC connection string:

1. Andá a tu wallet NWC compatible (Alby, Mutiny, etc.)
2. Settings → Nostr Wallet Connect → New connection
3. Permisos: `make_invoice`, `lookup_invoice`, `get_balance`, `list_transactions`
4. Copiá el string que empieza con `nostr+walletconnect://`
5. Pegalo en la pantalla de NWC Setup de la app

Para configurar eventos, editá `EVENTS_LIST` en `index.html`:

```javascript
const EVENTS_LIST = [
  {
    id: 'mi-evento',
    name: 'Mi Evento',
    price: 1000,              // sats
    maxCapacity: 30,
    date: 'Martes 17 de Marzo, 2026',
    time: '16:00hs',
    location: 'Buenos Aires',
    organizerPubkey: "...",   // hex pubkey para Zaps
    nostrRelays: ["wss://relay.damus.io", "wss://nos.lol"]
  }
];
```

---

## Stack técnico

| Herramienta | Uso |
|---|---|
| **Vite** | Build tool y dev server |
| **@getalby/sdk** | NWC client (NIP-47) — invoices, verificación, balance |
| **nostr-tools** | Creación y firma de eventos Nostr (NIP-57 Zaps) |
| **@noble/hashes** | Utilidades criptográficas |
| **Web Crypto API** | AES-256-GCM (non-extractable key) para encriptar NWC URL |
| **qrcode** | Generación de QR codes |
| **localStorage** | Persistencia (demo) |

---

## Estructura del proyecto

```
├── index.html                    # App completa (single-file, ~2200 líneas)
├── PROJECT.md                    # Spec del proyecto
├── CHANGELOG.md                  # Historial de cambios v1 → v2.3
├── SECURITY-AUDIT.md             # Reporte formal de auditoría de seguridad
├── AGENTS.md                     # Resumen para evaluadores IA
├── package.json                  # v2.3.0 con scripts de test
├── vite.config.js                # Config de Vite
├── tests/
│   ├── unit-tests.js             # 56 unit tests
│   ├── security-pentest.js       # 22 escenarios de pentest v2
│   └── advanced-pentest-v3.js    # 26 escenarios avanzados (white hat)
└── src/examples/                 # Ejemplos del starter kit original
```

---

## Qué falta (post-hackathon)

- [ ] Backend server-side (resuelve las 9 vulnerabilidades restantes de localStorage)
- [ ] Publicar Zaps en relays Nostr reales
- [ ] Hash chain para audit log inmutable
- [ ] Multi-wallet support
- [ ] App móvil con scanner QR nativo

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
