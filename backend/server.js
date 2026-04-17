const express = require("express");
const cors = require("cors");
const axios = require("axios");
const puppeteer = require("puppeteer");

const app = express();
app.use(cors());
app.use(express.json());

const TOKEN = process.env.TOKEN;
const CHAT_ID = process.env.CHAT_ID;

const COMUNIO_USER = process.env.COMUNIO_USER;
const COMUNIO_PASSWORD = process.env.COMUNIO_PASSWORD;

// Cambia esto si tu URL de liga es otra
const COMUNIO_LOGIN_URL = "https://www.comunio.es/login";
const COMUNIO_BASE_URL = "https://www.comunio.es";

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

    const bonusOnce = (j.once || 0) * 400000;
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

function euros(n) {
  return Number(n || 0).toLocaleString("es-ES") + "€";
}

function icono(pos) {
  if (pos === 1) return "🥇";
  if (pos === 2) return "🥈";
  if (pos === 3) return "🥉";
  return "▪️";
}

/**
 * IMPORTANTE:
 * Los selectores de Comunio pueden cambiar.
 * Este bloque intenta una lectura genérica y seguramente habrá que ajustarlo
 * viendo el HTML real de tu cuenta.
 */
async function obtenerDatosComunio() {
  if (!COMUNIO_USER || !COMUNIO_PASSWORD) {
    throw new Error("Faltan COMUNIO_USER o COMUNIO_PASSWORD");
  }

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 1200 });

    await page.goto(COMUNIO_LOGIN_URL, { waitUntil: "networkidle2", timeout: 60000 });

    // Ajusta estos selectores si no coinciden
    const userSelectors = [
      'input[name="login"]',
      'input[name="username"]',
      '#login_username',
      'input[type="text"]'
    ];

    const passSelectors = [
      'input[name="password"]',
      '#login_password',
      'input[type="password"]'
    ];

    async function typeFirst(selectors, value) {
      for (const selector of selectors) {
        const exists = await page.$(selector);
        if (exists) {
          await page.click(selector, { clickCount: 3 });
          await page.type(selector, value);
          return true;
        }
      }
      return false;
    }

    const typedUser = await typeFirst(userSelectors, COMUNIO_USER);
    const typedPass = await typeFirst(passSelectors, COMUNIO_PASSWORD);

    if (!typedUser || !typedPass) {
      throw new Error("No encuentro los campos de login de Comunio");
    }

    const submitSelectors = [
      'button[type="submit"]',
      'input[type="submit"]',
      'button',
    ];

    let submitted = false;
    for (const selector of submitSelectors) {
      const el = await page.$(selector);
      if (el) {
        await Promise.allSettled([
          page.waitForNavigation({ waitUntil: "networkidle2", timeout: 20000 }),
          page.click(selector)
        ]);
        submitted = true;
        break;
      }
    }

    if (!submitted) {
      throw new Error("No encuentro el botón de login de Comunio");
    }

    // Espera extra por si hay redirecciones
    await page.waitForTimeout(3000);

    // Intento 1: leer una tabla genérica de clasificación/puntos
    let jugadores = await page.evaluate(() => {
      const filas = Array.from(document.querySelectorAll("table tr"));
      const resultados = [];

      filas.forEach((tr, index) => {
        const tds = Array.from(tr.querySelectorAll("td")).map(td => td.innerText.trim());
        if (tds.length >= 2) {
          const nombre = tds.find(x => /[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(x) && !/pts|puntos/i.test(x));
          const puntosTxt = tds.find(x => /^\d+$/.test(x));
          if (nombre && puntosTxt) {
            resultados.push({
              nombre,
              puntos: Number(puntosTxt),
              posicion: resultados.length + 1,
              once: 0
            });
          }
        }
      });

      return resultados;
    });

    // Intento 2: si la home no sirve, prueba una página típica de clasificación
    if (!jugadores.length) {
      const posiblesRutas = [
        "/ranking",
        "/standings",
        "/table",
        "/points",
        "/"
      ];

      for (const ruta of posiblesRutas) {
        try {
          await page.goto(COMUNIO_BASE_URL + ruta, { waitUntil: "networkidle2", timeout: 25000 });

          jugadores = await page.evaluate(() => {
            const filas = Array.from(document.querySelectorAll("table tr"));
            const resultados = [];

            filas.forEach((tr) => {
              const tds = Array.from(tr.querySelectorAll("td")).map(td => td.innerText.trim());
              if (tds.length >= 2) {
                const nombre = tds.find(x => /[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(x) && !/pts|puntos/i.test(x));
                const puntosTxt = tds.find(x => /^\d+$/.test(x));
                if (nombre && puntosTxt) {
                  resultados.push({
                    nombre,
                    puntos: Number(puntosTxt),
                    posicion: resultados.length + 1,
                    once: 0
                  });
                }
              }
            });

            return resultados;
          });

          if (jugadores.length) break;
        } catch (_) {}
      }
    }

    if (!jugadores.length) {
      throw new Error("No he podido extraer la clasificación de Comunio. Hay que ajustar selectores.");
    }

    return jugadores;
  } finally {
    await browser.close();
  }
}

app.get("/", (req, res) => {
  res.send("🧆 Banco Croquetero backend OK");
});

app.get("/pagos", async (req, res) => {
  try {
    const jugadores = await obtenerDatosComunio();
    const pagos = calcularPagos(jugadores);
    res.json(pagos);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get("/confirmar", async (req, res) => {
  try {
    if (!TOKEN || !CHAT_ID) {
      return res.status(500).send("❌ Faltan TOKEN o CHAT_ID");
    }

    const jugadores = await obtenerDatosComunio();
    const pagos = calcularPagos(jugadores);

    let mensaje = `🧆 <b>BANCO CROQUETERO</b>\n\n`;
    pagos.forEach(j => {
      mensaje += `${icono(j.posicion)} <b>${j.nombre}</b> (${j.puntos} pts)\n`;
      mensaje += `💸 +${j.total.toLocaleString("es-ES")}€\n\n`;
    });

    await axios.post(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      chat_id: CHAT_ID,
      text: mensaje,
      parse_mode: "HTML"
    });

    res.send("✅ Pagos enviados correctamente");
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).send(`❌ ${error.message}`);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor funcionando en puerto ${PORT}`);
});
