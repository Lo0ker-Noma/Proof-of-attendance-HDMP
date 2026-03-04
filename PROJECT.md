# ⚡ Proof of Attendance (HDMP)

## Descripción
Sistema de reservas para eventos con depósito en sats (Lightning Network).
- El asistente paga X sats para reservar su lugar
- Si asiste al evento → canjea los sats por una consumición real
- Si NO asiste → pierde los sats (quedan para el organizador)

## Problema que resuelve
Los no-shows en eventos/bares/meetups. La gente reserva y no aparece porque no le cuesta nada. Con un depósito mínimo en Lightning el compromiso es real e instantáneo.

## Flujo de usuario

```
ORGANIZADOR crea el evento (nombre, fecha, lugar, precio en sats)
        ↓
ASISTENTE ve la página del evento → paga X sats → recibe QR único
        ↓
    ¿Fue al evento?
       /        \
     SÍ          NO
      ↓            ↓
 Muestra QR    Pierde los sats
 en la puerta  (quedan para el organizador)
      ↓
 Canjea por consumición ✅
```

## Las 3 pantallas del MVP

1. **Página del evento** (pública)
   - Foto del evento, fecha, lugar, precio en sats
   - Botón "Reservar con Lightning ⚡"

2. **Flujo de pago** (asistente)
   - QR de Lightning para pagar
   - Confirmación instantánea al pagar
   - QR único de entrada generado desde el payment hash

3. **Panel del organizador** (privado)
   - Lista de reservas (pagadas)
   - Botón "Canjear" al momento de la entrada
   - Stats: reservados / canjeados / no-shows

## Stack técnico
- **Frontend**: Vite + HTML/JS vanilla (ya configurado en el starter)
- **Pagos**: WebLN + @getalby/sdk (NWC)
- **Wallet**: Alby (extensión de browser)
- **QR codes**: qrcode.js o similar

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

## Entregables finales
1. ✅ Código en GitHub
2. ✅ README con descripción y screenshots
3. ✅ Demo (video o screenshots)
4. ✅ Pitch de 3 minutos
5. ✅ PR al repo de la hackathon en `data/projects/foundations.json`

## Estado actual
- [ ] Alby Wallet instalada y configurada
- [ ] npm install ejecutado
- [ ] Flujo de pago funcionando
- [ ] Panel del organizador funcionando
- [ ] Página del evento funcionando
- [ ] Testing con pagos reales
- [ ] README y pitch listos
- [ ] Subido a GitHub + PR hecho
