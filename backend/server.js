const express = require("express");
const cors = require("cors");
const axios = require("axios");
const puppeteer = require("puppeteer-core");

const app = express();
app.use(cors());
app.use(express.json());

const TOKEN = process.env.TOKEN || process.env.TELEGRAM_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

app.get("/", (req, res) => {
  res.send("🧆 Banco Croquetero backend OK");
});

app.get("/sync-comuniate", async (req, res) => {
  let browser;

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    const page = await browser.newPage();

    await page.goto("https://www.comuniate.com/puntos/comunio", {
      waitUntil: "networkidle2",
      timeout: 60000
    });

    await page.waitForTimeout(5000);

    const data = await page.evaluate(() => {
      function limpiar(txt) {
        return String(txt || "").replace(/\s+/g, " ").trim();
      }

      const texto = limpiar(document.body.innerText || "");
      const lineas = texto
        .split("\n")
        .map(limpiar)
        .filter(Boolean);

      const resultados = [];

      for (const linea of lineas) {
        const m = linea.match(/^(\d{1,2})\s+(.+?)\s+\d{1,3}(?:\.\d{3})+(?:€)?\s+11\s*=?\s*[\d.,]+\s+(-?\d{1,3})\s+(\d{1,5})$/i);
        if (!m) continue;

        const posicion = Number(m[1]);
        const nombre = limpiar(m[2]);
        const puntos = Number(m[3]);

        if (!nombre || !Number.isFinite(puntos)) continue;

        resultados.push({
          nombre,
          puntos,
          once: 0,
          posicionOriginal: posicion
        });
      }

      const unicos = [];
      const vistos = new Set();

      for (const j of resultados) {
        const key = j.nombre.toUpperCase();
        if (!vistos.has(key)) {
          vistos.add(key);
          unicos.push(j);
        }
      }

      return unicos;
    });

    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.status(200).send(JSON.stringify(data));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error scraping Comuniate" });
  } finally {
    if (browser) await browser.close();
  }
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

app.listen(process.env.PORT || 3000, () => {
  console.log("Servidor arrancado");
});
