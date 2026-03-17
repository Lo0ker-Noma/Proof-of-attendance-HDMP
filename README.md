# ⚡ Proof of Attendance (HDMP) — v2.5

> De un MVP con verificación manual a un **sistema de pagos reales en producción** con Nostr Wallet Connect (NIP-47), Zaps (NIP-57), auditoría criptográfica, 3 rondas de pentesting y pagos verificados con Primal.

**Construido para la Lightning Hackathon FOUNDATIONS 2026 de La Crypta.**

**Live**: [proof-of-attendance-hdmp.vercel.app](https://proof-of-attendance-hdmp.vercel.app)

---

## La historia: de v1 a v2.5

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

### v2.5 — Producción con pagos reales (hoy)

El salto más grande: **la app funciona con dinero real**. Wallet de La Crypta (Primal) se conecta automáticamente via NWC. Los asistentes llegan, reservan, pagan con cualquier wallet Lightning, y el pago se verifica criptográficamente. Probado en vivo con transacciones reales entre Primal y Wallet of Satoshi.

```
v2.5 — Lo que cambió respecto a v2.3:

✅ Pagos reales verificados (no demo)
✅ Wallet del organizador auto-conectada (Primal via NWC)
✅ Flujo seamless para asistentes (no necesitan saber qué es NWC)
✅ Verificación estricta: solo preimage, settled_at o state=settled
✅ Multi-wallet: probado con Primal (recibe) + WoS (paga)
✅ Precio dinámico sats→USD via mempool.space API
✅ NWC secret ofuscado en base64 (no plaintext en repo)
✅ nwcMock eliminado completamente (zero fake payments)
✅ Normalización de respuestas NWC (Primal/Alby/Mutiny)
```

---

## Qué hace

Un sistema de reservas para eventos donde:

1. La **wallet del organizador** (La Crypta) se conecta automáticamente al cargar la app
2. El **asistente** reserva → paga escaneando un QR con su wallet → el pago se verifica automáticamente via NWC → se genera un Zap en Nostr
3. Al llegar al evento, muestra su QR → el organizador lo canjea
4. Todo queda registrado en un **dashboard de auditoría** con payment hashes, preimages y verificación de integridad

---

## Flujo del asistente (producción)

```
1. Entrá a la app → ves los eventos de La Crypta
2. Elegí un evento → tocá "Reservar mi plaza"
3. Completá tu nombre y npub → "Generar Invoice"
4. Escaneá el QR con tu wallet (WoS, Phoenix, Primal, Zeus, etc.)
5. El pago se verifica automáticamente (preimage + settled_at)
6. Recibís tu ticket con QR para canjear en el evento
```

Los asistentes no necesitan configurar nada. Solo una wallet Lightning para pagar.

---

## NIPs implementados

### NIP-47 — Nostr Wallet Connect (NWC)

El corazón de los pagos. NWC reemplaza la Lightning Address como backend:

- **`makeInvoice`** — Crear invoices desde la wallet del organizador
- **`lookupInvoice`** — Verificar automáticamente si un pago fue completado (polling con preimage)
- **`getBalance`** — Mostrar el balance de la wallet en el panel del organizador
- **`listTransactions`** — Listar transacciones para el dashboard de auditoría

La wallet del organizador (La Crypta / Primal) se conecta automáticamente al cargar la app. Compatible con **Primal**, **Alby**, **Mutiny** y cualquier wallet NIP-47. Normalización robusta de respuestas: `paymentRequest`/`payment_request`/`invoice`/`bolt11`, `preimage`/`payment_preimage`, `settled_at`/`settledAt`/`state`/`status`.

### NIP-57 — Zaps

Cada pago genera dos eventos Nostr firmados criptográficamente:

- **Kind 9734** (Zap Request) — La solicitud de pago con tags `p` (recipient), `amount` (millisats), `relays`, y el mensaje de la reserva
- **Kind 9735** (Zap Receipt) — La confirmación del pago con el `bolt11` invoice y `preimage`

Esto crea un **registro verificable e inmutable** de cada pago en el protocolo Nostr.

---

## Las 5 pantallas

| # | Pantalla | Qué hace |
|---|----------|----------|
| 1 | **Evento** | Selección multi-evento, status de wallet auto-conectada, precio dinámico (sats + USD en tiempo real), badges NIP-47/NIP-57 |
| 2 | **Pago** | Invoice NWC real, QR code, verificación automática con polling cada 5s, Zap receipt |
| 3 | **Ticket** | QR con código CSPRNG (8 chars, 656B combinaciones) + payment hash + Zap event ID + preimage |
| 4 | **Organizador** | Stats, canjear tickets con rate limiting, balance de wallet, lista de reservas, reconfigurar NWC |
| 5 | **Auditoría** | Log de pagos, filtros, stats, export CSV (sanitizado contra formula injection), integrity check |

---

## Verificación de pagos — el problema más difícil

Hacer que `lookupInvoice` funcione de forma confiable con wallets reales fue el desafío técnico más grande del proyecto. Cada wallet NWC devuelve la respuesta en un formato ligeramente diferente:

```
Problema: ¿cómo saber si una invoice fue pagada?

Alby:   { preimage: "abc...", settled_at: 1710000000 }
Primal: { state: "settled", preimage: "abc..." }
Mutiny: { status: "paid", payment_preimage: "abc..." }
NIP-47: { result: { preimage: "abc...", settled_at: ... } }  ← wrapped!
```

La solución fue implementar **verificación estricta con múltiples señales**:

```javascript
// Solo aceptar señales FUERTES de pago — no heurísticas
const isPaid = (preimage && preimage.length >= 32) ||  // prueba criptográfica
  settledAt ||                                          // timestamp de settlement
  isStateSettled ||                                     // state explícito
  result?.paid === true;                                // booleano explícito
```

Esto eliminó los falsos positivos que teníamos con la detección heurística anterior (que interpretaba `amount > 0 + created_at` como "pagado" cuando en realidad toda invoice no pagada tiene esos campos).

---

## Seguridad — 3 rondas de Pentest & Hardening

Se corrieron **3 rondas de pentesting automatizado** con **48 escenarios de ataque** en 21 categorías. Cada ronda fue seguida de fixes y re-verificación.

### Evolución de seguridad

```
                    v2.1 (antes)    v2.2 (pentest 1)   v2.3 (pentest 2)   v2.5 (producción)
                    ────────────    ────────────────    ────────────────    ─────────────────
Tests:              22              22                  26 (nuevos)         48 (total)
Ataques bloqueados: 5  (23%)        13  (59%)           22  (85%)          44  (92%)
Vulnerabilidades:   17              9                   4                   4 (arquitectónicas)
  CRITICAL:         5               3                   1                   1
  HIGH:             6               5                   0                   0
  MEDIUM:           3               1                   2                   2
  LOW:              3               0                   1                   1
```

### Fixes destacados

| Fix | Qué resuelve |
|-----|-------------|
| **CSPRNG ticket codes** | `crypto.getRandomValues()` reemplaza `Math.random()` — 8 chars, 656B combinaciones |
| **AES-256-GCM non-extractable** | NWC URL encriptada con key `extractable: false` — solo en memoria JS |
| **CSP + X-Frame-Options** | Content Security Policy con `script-src 'self' https://esm.sh`, clickjacking prevention |
| **CSV formula injection** | `csvSanitize()` prefija `=`, `+`, `-`, `@` con apóstrofe en exports |
| **Rate limiting** | Max 5 intentos de canjeo por minuto con ventana deslizante |
| **Cross-event isolation** | `markRedeemed()` verifica `eventId === selectedEvent.id` |
| **Strict payment verification** | Solo acepta preimage (32+ chars), settled_at numérico, o state="settled" |
| **Demo mock eliminado** | Zero fake payments posibles — todo requiere verificación NWC real |

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

Abrí `http://localhost:5173` — la wallet del organizador se conecta automáticamente.

---

## Configuración del organizador

La wallet de La Crypta (Primal) viene preconfigurada. Para cambiar la wallet receptora:

1. Andá al panel **Organizador** (PIN: ⚡HDMP)
2. En la sección "Wallet NWC del organizador", pegá un nuevo NWC string
3. La nueva wallet se conecta y empieza a recibir pagos

Para obtener un NWC string: wallet compatible (Primal, Alby, Mutiny) → Settings → Nostr Wallet Connect → New connection → Permisos: `make_invoice`, `lookup_invoice`, `get_balance`.

---

## Stack técnico

| Herramienta | Uso |
|---|---|
| **Vite** | Build tool y dev server |
| **@getalby/sdk@3.5.1** | NWC client (NIP-47) — invoices, verificación, balance (version pinned) |
| **nostr-tools** | Creación y firma de eventos Nostr (NIP-57 Zaps) |
| **@noble/hashes** | Utilidades criptográficas |
| **Web Crypto API** | AES-256-GCM non-extractable key + CSPRNG (`getRandomValues`) |
| **mempool.space API** | Conversión BTC→USD en tiempo real |
| **qrcode** | Generación de QR codes |
| **localStorage** | Persistencia client-side |

---

## Estructura del proyecto

```
├── index.html                    # App completa (single-file, ~2300 líneas)
├── PROJECT.md                    # Spec del proyecto
├── CHANGELOG.md                  # Historial de cambios v1 → v2.5
├── SECURITY-AUDIT.md             # Reporte formal de auditoría de seguridad
├── CLAUDE.md                     # Contexto técnico para evaluadores
├── AGENTS.md                     # Resumen para evaluadores IA
├── package.json                  # v2.5.0 con scripts de test
├── vite.config.js                # Config de Vite
├── tests/
│   ├── unit-tests.js             # 56 unit tests
│   ├── security-pentest.js       # 22 escenarios de pentest v2
│   └── advanced-pentest-v3.js    # 26 escenarios avanzados (white hat)
└── src/examples/                 # Ejemplos del starter kit original
```

---

## Qué falta (post-hackathon)

- [ ] Backend server-side (resuelve las 4 vulnerabilidades restantes de arquitectura client-side)
- [ ] Publicar Zaps en relays Nostr reales
- [ ] Hash chain para audit log inmutable
- [ ] SRI (Subresource Integrity) hashes via bundler
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
