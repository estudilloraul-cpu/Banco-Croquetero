const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
app.use(cors());
app.use(express.json());

const TOKEN = process.env.TOKEN;
const CHAT_ID = process.env.CHAT_ID;

app.get("/", (req, res) => {
  res.send("🧆 Banco Croquetero backend OK");
});

app.post("/confirmar", async (req, res) => {
  try {
    if (!TOKEN || !CHAT_ID) {
      return res.status(500).send("❌ Faltan TOKEN o CHAT_ID");
    }

    const pagos = req.body;

    if (!Array.isArray(pagos) || !pagos.length) {
      return res.status(400).send("❌ No hay datos de pagos");
    }

    let mensaje = "🧆 <b>BANCO CROQUETERO</b>\n";
    mensaje += "<b>Croquetas Power</b>\n\n";

    pagos.forEach(j => {
      let icono = "▪️";
      if (j.posicion === 1) icono = "🥇";
      if (j.posicion === 2) icono = "🥈";
      if (j.posicion === 3) icono = "🥉";

      mensaje += `${icono} <b>${j.nombre}</b>\n`;
      mensaje += `📊 Puntos: ${j.puntos}\n`;
      mensaje += `🏁 Posición jornada: ${j.posicion}\n`;
      mensaje += `💰 Premio posición: ${Number(j.premio || 0).toLocaleString("es-ES")}€\n`;
      mensaje += `📈 Bonus puntos: ${Number(j.bonus || 0).toLocaleString("es-ES")}€\n`;
      mensaje += `⭐ Once ideal: ${Number(j.once || 0)}\n`;
      mensaje += `🧆 Bonus once ideal: ${Number(j.bonusOnce || 0).toLocaleString("es-ES")}€\n`;
      mensaje += `💸 Total abono: ${Number(j.total || 0).toLocaleString("es-ES")}€\n\n`;
    });

    const totalRepartido = pagos.reduce((acc, j) => acc + Number(j.total || 0), 0);
    mensaje += `🏦 <b>Total repartido:</b> ${totalRepartido.toLocaleString("es-ES")}€`;

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
