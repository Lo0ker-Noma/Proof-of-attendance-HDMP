# ⚡ Proof of Attendance (HDMP)

> Sistema de reservas para eventos con depósito en Lightning Network.
> Construido para la **Lightning Hackathon FOUNDATIONS 2026** de La Crypta.

---

## 🎯 El problema

Los no-shows arruinan los eventos. La gente reserva y no aparece porque **no le cuesta nada**.

Los sistemas actuales (formularios, listas de espera) no tienen ningún mecanismo de compromiso real.

## 💡 La solución

**Proof of Attendance** usa Lightning Network para que reservar un lugar tenga un costo real mínimo:

- ✅ **Reservás** pagando X sats (precio de una consumición)
- ✅ **Si venís** → mostrás tu QR y canjeás tu consumición
- ❌ **Si no venís** → perdés los sats (van al organizador)

El compromiso económico es pequeño pero real. **La fricción justa.**

---

## 🚀 Demo

```bash
git clone https://github.com/Lo0ker-Noma/Proof-of-attendance-HDMP.git
cd Proof-of-attendance-HDMP
npm install
npm run dev
```

Abrí `http://localhost:5173`

---

## 🔄 Flujo completo

```
1. Asistente ve el evento → precio, fecha, lugares disponibles
        ↓
2. Hace clic en "Reservar" → ingresa su nombre
        ↓
3. La app genera un invoice real via Lightning Address del organizador
        ↓
4. Asistente escanea el QR con cualquier wallet Lightning (WoS, Phoenix, etc.)
        ↓
5. Paga en segundos → recibe su QR de ticket único (HDMP-XXXXXX)
        ↓
6. En el evento → muestra el QR → organizador lo canjea en el panel
        ↓
7. ¡Disfruta su consumición! 🍺
```

---

## 📱 Pantallas

### Página del evento
- Nombre, fecha, lugar, precio en sats
- Barra de lugares disponibles en tiempo real
- Botón "Reservar con Lightning ⚡"

### Flujo de pago
- Invoice generado desde Lightning Address del organizador
- QR escaneable con cualquier wallet Lightning
- Código de ticket único al confirmar

### Ticket del asistente
- QR con código único `HDMP-XXXXXX`
- Detalles del evento y consumición incluida
- Botón para compartir

### Panel del organizador
- Stats: total reservas / canjeadas / no-shows
- Canjear ticket por código
- Lista de todos los asistentes con estado

---

## 🛠️ Stack técnico

| Herramienta | Uso |
|---|---|
| **Vite** | Build tool y dev server |
| **@getalby/lightning-tools** | Resolución de Lightning Address y generación de invoices |
| **qrcode** | Generación de QR codes |
| **localStorage** | Persistencia de reservas (demo) |

---

## ⚙️ Configuración

Para usar con tu propia Lightning Address, editá esta línea en `index.html`:

```javascript
const EVENT = {
  name: "Nombre de tu evento",
  date: "Fecha",
  time: "Horario",
  location: "Lugar",
  price: 1000,          // sats
  maxCapacity: 30,      // máximo de asistentes
  organizerAddress: "tu@lightningaddress.com"  // ← tu wallet
};
```

---

## ⚠️ Limitaciones del MVP

Esta versión es un prototipo funcional para demostrar el concepto:

1. **Verificación de pago manual**: El asistente confirma su pago clickeando "Ya pagué". En producción, esto se verificaría automáticamente via:
   - Webhook de la wallet del organizador
   - NWC (Nostr Wallet Connect) para consultar el estado del invoice
   - API de LNbits u otro nodo propio

2. **Persistencia local**: Las reservas se guardan en `localStorage` del browser. En producción usaría una base de datos.

3. **Un solo evento**: La app soporta un evento por instancia. En producción habría un sistema multi-evento.

---

## 🗺️ Roadmap (post-hackathon)

- [ ] Verificación automática de pago via NWC
- [ ] Backend con base de datos real
- [ ] Multi-evento
- [ ] Reembolso parcial si el organizador cancela
- [ ] Integración con Nostr para notificaciones
- [ ] App móvil nativa

---

## 🏆 Hackathon

Proyecto construido para la **Lightning Hackathon FOUNDATIONS** de La Crypta.

- **Tema**: Lightning Payments Basics
- **Fechas**: Marzo 2026
- **Premio**: 1,000,000 sats
- **Info**: [hackaton.lacrypta.ar](https://hackaton.lacrypta.ar)

---

## 👤 Autor

Construido con ⚡ y mucho café durante la Lightning Hackathon 2026.

---

*Hecho con el [Lightning Starter Kit](https://github.com/lacrypta/lightning-starter) de La Crypta*
