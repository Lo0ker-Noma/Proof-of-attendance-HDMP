# ⚡ Proof of Attendance (HDMP) — v2

> De un MVP con verificación manual a un sistema completo con **Nostr Wallet Connect (NIP-47)**, **Zaps (NIP-57)**, auditoría criptográfica y pentest de seguridad.

**Construido para la Lightning Hackathon FOUNDATIONS 2026 de La Crypta.**

---

## La historia: de v1 a v2

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

Además, corrimos un **pentest de 22 escenarios de ataque**, encontramos 17 vulnerabilidades, aplicamos fixes y documentamos todo en un reporte formal de seguridad.

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
| 1 | **Evento** | Info del evento, precio, lugares disponibles, badges NWC+Zaps |
| 2 | **Pago** | Invoice NWC, QR, verificación automática con polling, Zap receipt |
| 3 | **Ticket** | QR con código + payment hash + Zap event ID + preimage |
| 4 | **Organizador** | Stats, canjear tickets, balance de wallet, lista de reservas |
| 5 | **Auditoría** | Log de pagos, filtros, stats, export CSV, integrity check |

---

## Seguridad

Corrimos un pentest automatizado de **22 escenarios de ataque** en 7 categorías:

```
RESULTADOS DEL PENTEST
━━━━━━━━━━━━━━━━━━━━━
Tests ejecutados:  22
Ataques bloqueados: 5
Vulnerabilidades:  17  (5 CRITICAL, 6 HIGH, 3 MEDIUM, 3 LOW)
```

**Ataques bloqueados nativamente**: ticket replay (doble canje), payment hash replay, case-insensitive replay, SQL injection, NWC timeout abuse.

**Fixes aplicados post-pentest**:

- `sanitizeInput()` + `escapeHtml()` contra XSS
- Deduplicación por `paymentHash` contra double-spend
- `try/catch` en JSON.parse contra DoS por datos corruptos
- Redacción del NWC secret en console logs

**Vulnerabilidades documentadas** (inherentes a client-side, con recomendaciones):

- localStorage injection (requiere backend para resolver)
- NWC URL en texto plano (requiere Web Crypto API)
- Audit log mutable (requiere hash chain o Nostr relays)

Reporte completo: [`SECURITY-AUDIT.md`](./SECURITY-AUDIT.md)

---

## Tests

```
46 unit tests — 100% passing
22 security pentest scenarios
```

```bash
npm test              # Unit tests
npm run test:security # Pentest
npm run test:all      # Todo
```

Los tests cubren: generación de tickets, CRUD de reservas, payment log, validaciones NWC/NIP-57, sanitización de input, estructura de Zap events, parsing de NWC URLs, y verificación de integridad.

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

Para configurar el evento, editá `EVENT_CONFIG` en `index.html`:

```javascript
const EVENT_CONFIG = {
  name: "Tu evento",
  price: 1000,              // sats
  maxCapacity: 30,
  organizerPubkey: "...",   // hex pubkey para Zaps
  nostrRelays: ["wss://relay.damus.io", "wss://nos.lol"]
};
```

---

## Stack técnico

| Herramienta | Uso |
|---|---|
| **Vite** | Build tool y dev server |
| **@getalby/sdk** | NWC client (NIP-47) — invoices, verificación, balance |
| **nostr-tools** | Creación y firma de eventos Nostr (NIP-57 Zaps) |
| **@noble/hashes** | Utilidades criptográficas |
| **qrcode** | Generación de QR codes |
| **localStorage** | Persistencia (demo) |

---

## Estructura del proyecto

```
├── index.html              # App completa (single-file, ~1600 líneas)
├── PROJECT.md              # Spec del proyecto
├── SECURITY-AUDIT.md       # Reporte formal de auditoría de seguridad
├── package.json            # v2.0.0 con scripts de test
├── vite.config.js          # Config de Vite
├── tests/
│   ├── unit-tests.js       # 46 unit tests
│   └── security-pentest.js # 22 escenarios de pentest
└── src/examples/           # Ejemplos del starter kit original
```

---

## Qué falta (post-hackathon)

- [ ] Backend server-side (resuelve vulnerabilidades de localStorage)
- [ ] Publicar Zaps en relays Nostr reales
- [ ] Hash chain para audit log inmutable
- [ ] Encriptar NWC URL con Web Crypto API
- [ ] Multi-evento
- [ ] App móvil

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
