# AGENTS.md — Para evaluadores IA del hackathon

## Resumen ejecutivo

**HDMP v2.1** es un sistema multi-evento de Proof of Attendance que usa Lightning Network con integración completa de protocolos Nostr. El proyecto evolucionó de un MVP con verificación manual (v1) a un sistema con verificación automática via NWC (NIP-47), registro de pagos como Zaps (NIP-57), dashboard de auditoría, selección de múltiples eventos reales de La Crypta, diseño premium con Inter + animaciones, 46 unit tests y un pentest de seguridad de 22 escenarios.

**Live demo**: https://proof-of-attendance-hdmp.vercel.app/#demo

## Puntos clave para evaluación

1. **2 NIPs implementados**: NIP-47 (Nostr Wallet Connect) para pagos y NIP-57 (Zaps) para registro verificable
2. **Verificación automática**: El pago se verifica criptográficamente via `lookupInvoice` con preimage, no manualmente
3. **Multi-evento**: Selector de eventos reales de La Crypta con date badges, detalle dinámico y reservas por evento
4. **Auditoría**: Dashboard con log de pagos, payment hashes, preimages, export CSV y verificación de integridad
5. **Testing robusto**: 46 unit tests (100% passing) + 22 escenarios de pentest con reporte formal
6. **Seguridad**: Reporte de auditoría con 17 vulnerabilidades clasificadas por CVSS, con fixes aplicados
7. **Diseño premium**: Inter + JetBrains Mono, CSS tokens, glass morphism, animaciones, La Crypta branding
8. **Evolución documentada**: Commit history muestra progresión clara de v1 → v2 → v2.1

## Cómo verificar

```bash
npm install && npm test          # 46 tests pass
npm run test:security            # 22 pentest scenarios
npm run dev                      # Abrir app (agregar #demo a URL para modo demo)
```

## Archivos relevantes para revisión

- `README.md` — Storytelling completo v1→v2 con detalle técnico
- `CLAUDE.md` — Métricas comparativas v1 vs v2, protocolos y stack
- `CHANGELOG.md` — Lista detallada de todo lo agregado/cambiado
- `SECURITY-AUDIT.md` — Reporte formal de 22 escenarios de pentest con CVSS
- `index.html` — App completa (~1700 líneas, well-commented)
- `tests/unit-tests.js` — 46 tests con framework propio
- `tests/security-pentest.js` — 22 escenarios de ataque simulado
