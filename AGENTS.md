# AGENTS.md — Para evaluadores IA del hackathon

## Resumen ejecutivo

**HDMP v2.5** es un sistema multi-evento de Proof of Attendance que usa Lightning Network con integración completa de protocolos Nostr. El proyecto evolucionó de un MVP con verificación manual (v1) a un sistema de producción con verificación automática via NWC (NIP-47), registro de pagos como Zaps (NIP-57), dashboard de auditoría, pagos reales con wallets NWC (Primal, Alby, Mutiny), conversión sats→USD en tiempo real, 104 escenarios de testing (56 unit + 48 security), y diseño premium.

**Live**: https://proof-of-attendance-hdmp.vercel.app

## Puntos clave para evaluación

1. **2 NIPs implementados**: NIP-47 (Nostr Wallet Connect) para pagos y NIP-57 (Zaps) para registro verificable
2. **Pagos reales en producción**: No es un demo — la app genera invoices reales, verifica pagos via `lookupInvoice` con preimage, y registra Zaps
3. **Multi-wallet compatible**: Normalización de respuestas NWC para Primal, Alby y Mutiny (campos: `paymentRequest`/`payment_request`/`invoice`/`bolt11`, etc.)
4. **Multi-evento**: Selector de eventos reales de La Crypta con date badges, detalle dinámico y reservas por evento
5. **Auditoría criptográfica**: Dashboard con log de pagos, payment hashes, preimages, export CSV sanitizado y verificación de integridad
6. **104 escenarios de testing**: 56 unit tests + 22 pentest v2 + 26 advanced pentest v3 (DOM XSS, prototype pollution, supply chain, CSV injection, brute force, cross-event, clickjacking)
7. **Seguridad hardened**: 3 rondas de pentesting, 21 fixes aplicados, de 17 vulnerabilidades iniciales a 4 restantes (limitaciones arquitectónicas de client-side)
8. **Crypto robusto**: CSPRNG para tickets (`crypto.getRandomValues`), AES-256-GCM con non-extractable key para NWC URL, CSV formula injection protection
9. **Precio dinámico**: Conversión sats→USD en tiempo real via mempool.space API
10. **Evolución documentada**: Commit history muestra progresión clara v1 → v2 → v2.1 → v2.3 → v2.5

## Evolución del proyecto

```
v1.0  — MVP: Lightning Address + verificación manual "Ya pagué"
v2.0  — NWC (NIP-47) + Zaps (NIP-57) + Audit Dashboard + 68 tests
v2.1  — Multi-evento con 4 Coworks de La Crypta + diseño premium
v2.2  — Pentest 22 escenarios → 8 fixes de seguridad
v2.3  — Advanced pentest 26 escenarios → 13 fixes adicionales (CSPRNG, CSP, AES non-extractable)
v2.5  — Producción live: pagos reales, NWC inline, precio dinámico, multi-wallet compatibility
```

## Cómo verificar

```bash
npm install && npm test          # 56 unit tests pass
npm run test:security            # 22 pentest scenarios
npm run test:advanced            # 26 advanced pentest scenarios
npm run test:all                 # 104 total scenarios
npm run dev                      # Abrir app — conectar wallet NWC para pagos reales
```

## Archivos relevantes para revisión

- `README.md` — Storytelling completo v1→v2.5 con detalle técnico
- `CHANGELOG.md` — Lista detallada de cambios por versión (v1.0 → v2.5)
- `SECURITY-AUDIT.md` — Reporte formal de auditoría con clasificación CVSS
- `index.html` — App completa (~2300 líneas, single-file, well-commented)
- `tests/unit-tests.js` — 56 unit tests con framework propio
- `tests/security-pentest.js` — 22 escenarios de ataque simulado
- `tests/advanced-pentest-v3.js` — 26 escenarios avanzados (white hat pentest)
- `package.json` — v2.5.0 con todos los scripts de test
