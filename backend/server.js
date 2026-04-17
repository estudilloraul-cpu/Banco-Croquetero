const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
app.use(cors());
app.use(express.json());

// 🔔 CONFIGURA ESTO
const TOKEN = "AQUI_TU_TOKEN";
const CHAT_ID = "AQUI_TU_CHAT_ID";

// 🧪 DATOS DE PRUEBA
const jugadores = [
  { nombre: "Raúl", puntos: 72, posicion: 1, once: 2 },
  { nombre: "Pedro", puntos: 65, posicion: 2, once: 1 },
  { nombre: "Luis", puntos: 48, posicion: 3, once: 0 },
  { nombre: "Carlos", puntos: 55, posicion: 4, once: 2 }
];

function calcularPagos(data) {
  const premios = {1:1500000,2:1250000,3:1000000,4:750000,5:500000,6:250000};

  return data.map(j => {
    const premio = premios[j.posicion] || 0;

    let bonus = 0;
    if (j.puntos > 50) {
      bonus = (Math.floor((j.puntos - 50) / 10) + 1) * 250000;
    }

    const bonusOnce = j.once * 400000;
    const total = premio + bonus + bonusOnce;

    return {...j, total};
  });
}

app.get("/pagos", (req, res) => {
  res.json(calcularPagos(jugadores));
});

app.get("/confirmar", async (req, res) => {
  const pagos = calcularPagos(jugadores);

  let mensaje = "🧆 BANCO CROQUETERO\n\nPagos jornada:\n\n";

  pagos.forEach(j => {
    mensaje += `${j.nombre}: +${j.total.toLocaleString()}€\n`;
  });

  try {
    await axios.post(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      chat_id: CHAT_ID,
      text: mensaje
    });

    res.send("✅ Pagos confirmados y notificación enviada");
  } catch (error) {
    res.status(500).send("❌ Error enviando Telegram");
  }
});

app.listen(3000, () => {
  console.log("🚀 Servidor en http://127.0.0.1:3000");
});
