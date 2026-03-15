# ⚡ Proof of Attendance (HDMP) — v2.2

> De un MVP con verificación manual a un sistema multi-evento con **Nostr Wallet Connect (NIP-47)**, **Zaps (NIP-57)**, auditoría criptográfica, pentest de seguridad y diseño premium.

**Construido para la Lightning Hackathon FOUNDATIONS 2026 de La Crypta.**

**Live demo**: [proof-of-attendance-hdmp.vercel.app](https://proof-of-attendance-hdmp.vercel.app/#demo)

---

## La historia: de v1 a v2.2

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

Pentest completo de 22 escenarios → se encontraron 17 vulnerabilidades → se aplicaron 8 fixes concretos → se redujo a 9 (inherentes a client-side). Detalle completo más abajo.

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

## Seguridad — Pentest & Hardening v2.2

Corrimos un pentest automatizado de **22 escenarios de ataque** en 7 categorías. Después aplicamos fixes y volvimos a correr el pentest para validar las correcciones.

### Resultados comparados

```
                         ANTES (v2.1)         DESPUÉS (v2.2)
                         ────────────         ──────────────
Ataques bloqueados:      5  (23%)             13  (59%)
Vulnerabilidades:        17                   9
  CRITICAL:              5                    3
  HIGH:                  6                    5
  MEDIUM:                3                    1
  LOW:                   3                    0
```

### 8 vulnerabilidades reparadas en v2.2

| # | Vulnerabilidad | Severidad | Fix aplicado |
|---|----------------|-----------|-------------|
| 1 | **Invoice de monto menor** — atacante paga menos sats de los requeridos y obtiene entrada | CRITICAL | Validación de `paymentResult.amount` contra `selectedEvent.price * 1000` en `onPaymentVerified()`. Si no coincide, se rechaza el pago. |
| 2 | **Double-spend por paymentHash** — un solo pago genera múltiples tickets | CRITICAL | `saveReservation()` ahora verifica que no exista otro registro con el mismo `paymentHash` antes de guardar. |
| 3 | **Script injection (XSS)** — `<script>alert("xss")</script>` en el nombre del asistente | HIGH | `sanitizeInput()` mejorado: ahora strip de `<>"'&`, chars de control (`\x00-\x1F`), zero-width Unicode (`\u200B`, `\uFEFF`, etc.), y normalización NFKC. |
| 4 | **JSON malformado crash (DoS)** — inyectar JSON inválido en localStorage crashea la app | MEDIUM | `try/catch` en `getReservations()` y `getPaymentLog()` con fallback a `[]`. |
| 5 | **Null bytes y chars de control** — se almacenan sin filtrar en los datos | LOW | `sanitizeInput()` strip de `\x00-\x1F`, `\x7F` y todos los separadores invisibles Unicode. |
| 6 | **Unicode zero-width spoofing** — caracteres invisibles permiten suplantación visual | LOW | Strip de `\u200B`, `\u200C`, `\u200D`, `\u200E`, `\u200F`, `\uFEFF`, `\u2028`, `\u2029` + normalización `NFKC`. |
| 7 | **Nombres extremadamente largos (DoS)** — strings de 10,000+ chars desbordan UI y localStorage | LOW | `sanitizeInput()` trunca a 100 chars. Input HTML tiene `maxlength="40"`. |
| 8 | **Timestamps falsos** — atacante inyecta fechas del futuro o pasado lejano | MEDIUM | `saveReservation()` valida que `createdAt` esté dentro de ±1 hora del momento actual. Si no, lo sobrescribe con `new Date().toISOString()`. |

### Mejoras adicionales de seguridad en v2.2

| Mejora | Detalle |
|--------|---------|
| **NWC URL encriptado** | El connection string ahora se encripta con **AES-256-GCM** via Web Crypto API antes de almacenar en localStorage. La clave se guarda en `sessionStorage` (se pierde al cerrar tab). Migración automática de URLs legacy en plaintext. |
| **Mutex para localStorage** | `withStorageLock()` previene race conditions en escrituras concurrentes al localStorage (patrón lock async). |
| **Regex estricto en markRedeemed** | El ticket code ahora se valida contra `/^HDMP-[A-HJ-KMNP-Z2-9]{6}$/` antes de buscar. Rechaza SQL injection, XSS payloads y formatos inválidos. |
| **escapeHtml() mejorado** | Maneja inputs no-string (`null`, `undefined`, números) sin crashear. |
| **Console log redactado** | NWC URLs en console.log reemplazan `secret=...` con `secret=REDACTED`. |

### 9 vulnerabilidades restantes (inherentes a client-side)

Estas no se pueden resolver sin un backend server-side. Están documentadas con sus recomendaciones:

| Vulnerabilidad | Por qué no se puede resolver client-side |
|----------------|------------------------------------------|
| Inyectar reserva falsa sin pago | localStorage es siempre manipulable por JS |
| Modificar status a "redeemed" | Requiere autenticación del organizador server-side |
| Alterar montos en payment log | Requiere firma HMAC o hash chain |
| Sustituir invoice por uno propio | Requiere verificación server-side del origen del invoice |
| Event handler injection en nombre | `onmouseover` sobrevive sanitización (mitigado por `escapeHtml()` en render) |
| Race condition en localStorage | Mutex ayuda pero no es atómico como una transacción DB |
| NWC URL en localStorage | Encriptado con AES-GCM pero la key está en sessionStorage |
| Secret en consola (potencial) | Redactado en nuestro código pero libs externas podrían loguearlo |
| Audit log mutable | Requiere hash chain o publicación en Nostr relays |

Reporte formal completo: [`SECURITY-AUDIT.md`](./SECURITY-AUDIT.md)

---

## Tests

```
56 unit tests — 100% passing
22 security pentest scenarios — 13 blocked, 9 documented
```

```bash
npm test              # Unit tests (56)
npm run test:security # Pentest (22)
npm run test:all      # Todo
```

Los tests cubren: generación de tickets, CRUD de reservas, payment log, validaciones NWC/NIP-57, sanitización de input (null bytes, zero-width, Unicode, XSS), estructura de Zap events, parsing de NWC URLs, verificación de integridad, double-spend prevention, y escape de HTML.

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
| **Web Crypto API** | AES-256-GCM para encriptar NWC URL |
| **qrcode** | Generación de QR codes |
| **localStorage** | Persistencia (demo) |

---

## Estructura del proyecto

```
├── index.html              # App completa (single-file, ~2100 líneas)
├── PROJECT.md              # Spec del proyecto
├── CHANGELOG.md            # Historial de cambios v1 → v2.2
├── SECURITY-AUDIT.md       # Reporte formal de auditoría de seguridad
├── AGENTS.md               # Resumen para evaluadores IA
├── package.json            # v2.1.0 con scripts de test
├── vite.config.js          # Config de Vite
├── tests/
│   ├── unit-tests.js       # 56 unit tests
│   └── security-pentest.js # 22 escenarios de pentest
└── src/examples/           # Ejemplos del starter kit original
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
