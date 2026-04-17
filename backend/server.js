const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
app.use(cors());
app.use(express.json());

const TOKEN = process.env.TOKEN;
const CHAT_ID = process.env.CHAT_ID;

const jugadores = [
  { nombre: "Raúl", puntos: 72, posicion: 1, once: 2 },
  { nombre: "Pedro", puntos: 65, posicion: 2, once: 1 },
  { nombre: "Luis", puntos: 48, posicion: 3, once: 0 },
  { nombre: "Carlos", puntos: 55, posicion: 4, once: 2 }
];

function calcularPagos(data) {
  const premios = {
    1: 1500000,
    2: 1250000,
    3: 1000000,
    4: 750000,
    5: 500000,
    6: 250000
  };

  return data.map(j => {
    const premio = premios[j.posicion] || 0;

    let bonus = 0;
    if (j.puntos > 50) {
      bonus = (Math.floor((j.puntos - 50) / 10) + 1) * 250000;
    }

    const bonusOnce = j.once * 400000;
    const total = premio + bonus + bonusOnce;

    return {
      ...j,
      premio,
      bonus,
      bonusOnce,
      total
    };
  });
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("es-ES") + "€";
}

function getMedal(posicion) {
  if (posicion === 1) return "🥇";
  if (posicion === 2) return "🥈";
  if (posicion === 3) return "🥉";
  return "⚽";
}

app.get("/", (req, res) => {
  res.send("🧆 Banco Croquetero backend OK");
});

app.get("/pagos", (req, res) => {
  res.json(calcularPagos(jugadores));
});

app.get("/confirmar", async (req, res) => {
  const pagos = calcularPagos(jugadores);
  const totalJornada = pagos.reduce((acc, j) => acc + (j.total || 0), 0);

  let mensaje = "🧆 <b>BANCO CROQUETERO</b>\n";
  mensaje += "<i>Croquetas Power</i>\n";
  mensaje += "━━━━━━━━━━━━━━\n";
  mensaje += "💸 <b>Pagos de la jornada</b>\n\n";

  pagos.forEach(j => {
    mensaje += `${getMedal(j.posicion)} <b>${j.nombre}</b> <i>(${j.puntos} pts)</i>\n`;
    mensaje += `• Premio: <b>${formatMoney(j.premio)}</b>\n`;
    mensaje += `• Bonus: <b>${formatMoney(j.bonus)}</b>\n`;
    mensaje += `• Once ideal: <b>${formatMoney(j.bonusOnce)}</b>\n`;
    mensaje += `➡️ TOTAL: <b>+${formatMoney(j.total)}</b>\n\n`;
  });

  mensaje += "━━━━━━━━━━━━━━\n";
  mensaje += `🏦 <b>Total repartido:</b> ${formatMoney(totalJornada)}\n`;
  mensaje += "✅ <b>Pagos realizados</b>";

  try {
    if (!TOKEN || !CHAT_ID) {
      return res.status(500).send("❌ Faltan TOKEN o CHAT_ID");
    }

    await axios.post(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      chat_id: CHAT_ID,
      text: mensaje,
      parse_mode: "HTML"
    });

    res.send("✅ Pagos enviados correctamente");
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).send("❌ Error enviando Telegram");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor funcionando en puerto ${PORT}`);
});
