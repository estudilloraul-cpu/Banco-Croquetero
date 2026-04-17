const express = require("express");
const axios = require("axios");
const puppeteer = require("puppeteer-core");

const app = express();
app.use(express.json());

const TOKEN = process.env.TELEGRAM_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

// TEST
app.get("/", (req, res) => {
  res.send("🧆 Banco Croquetero backend OK");
});

// 🔥 SCRAPER COMUNIATE
app.get("/sync-comuniate", async (req, res) => {
  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    const page = await browser.newPage();

    await page.goto("https://www.comuniate.com/puntos/comunio", {
      waitUntil: "networkidle2"
    });

    await page.waitForTimeout(5000);

    const data = await page.evaluate(() => {
      const resultados = [];

      const filas = document.querySelectorAll("*");

      filas.forEach(el => {
        const txt = el.innerText?.trim();

        if (!txt) return;

        const match = txt.match(/^(\d{1,2})\s+([A-Za-zÁÉÍÓÚÑñ\s]+)\s+\d{1,3}(?:\.\d{3})+(?:€)?\s+11\s+[\d.]+\s+(\d{1,3})/);

        if (match) {
          resultados.push({
            nombre: match[2].trim(),
            puntos: Number(match[3]),
            once: 0
          });
        }
      });

      // quitar duplicados
      const únicos = [];
      const vistos = new Set();

      resultados.forEach(j => {
        if (!vistos.has(j.nombre)) {
          vistos.add(j.nombre);
          únicos.push(j);
        }
      });

      return únicos;
    });

    await browser.close();

    res.json(data);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error scraping Comuniate" });
  }
});

// TELEGRAM
app.post("/confirmar", async (req, res) => {
  try {
    const pagos = req.body;

    let mensaje = "🧆 BANCO CROQUETERO\n\n";

    pagos.forEach(j => {
      mensaje += `${j.nombre}: +${j.total.toLocaleString()}€\n`;
    });

    await axios.post(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      chat_id: CHAT_ID,
      text: mensaje
    });

    res.send("OK");
  } catch (e) {
    res.status(500).send("Error Telegram");
  }
});

app.listen(process.env.PORT || 3000);
