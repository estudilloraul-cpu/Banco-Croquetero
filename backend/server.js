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

const COMUNIO_LOGIN_URL = "https://classic.comunio.es/";
const COMUNIO_FALLBACK_URLS = [
  "https://www.comunio.es/login",
  "https://www.comunio.es/",
  "https://classic.comunio.es/"
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

function icono(pos) {
  if (pos === 1) return "🥇";
  if (pos === 2) return "🥈";
  if (pos === 3) return "🥉";
  return "▪️";
}

async function typeFirst(page, selectors, value) {
  for (const selector of selectors) {
    const el = await page.$(selector);
    if (el) {
      await page.click(selector, { clickCount: 3 });
      await page.type(selector, value);
      return selector;
    }
  }
  return null;
}

async function clickFirst(page, selectors) {
  for (const selector of selectors) {
    const el = await page.$(selector);
    if (el) {
      await Promise.allSettled([
        page.waitForNavigation({ waitUntil: "networkidle2", timeout: 20000 }),
        page.click(selector)
      ]);
      return selector;
    }
  }
  return null;
}

async function extraerJugadoresDesdeTablas(page) {
  return await page.evaluate(() => {
    const filas = Array.from(document.querySelectorAll("table tr"));
    const resultados = [];

    filas.forEach((tr) => {
      const tds = Array.from(tr.querySelectorAll("td")).map(td =>
        td.innerText.trim().replace(/\s+/g, " ")
      );

      if (tds.length < 2) return;

      let nombre = null;
      let puntos = null;

      for (const celda of tds) {
        if (!nombre && /[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(celda) && !/pts|puntos/i.test(celda)) {
          nombre = celda;
        }

        if (puntos === null && /^-?\d+$/.test(celda)) {
          puntos = Number(celda);
        }
      }

      if (nombre && Number.isFinite(puntos)) {
        resultados.push({
          nombre,
          puntos,
          posicion: resultados.length + 1,
          once: 0
        });
      }
    });

    const unicos = [];
    const vistos = new Set();

    for (const j of resultados) {
      const key = `${j.nombre}-${j.puntos}`;
      if (!vistos.has(key)) {
        vistos.add(key);
        unicos.push({
          ...j,
          posicion: unicos.length + 1
        });
      }
    }

    return unicos;
  });
}

async function intentarLoginEnPagina(page) {
  const userSelectors = [
    'input[name="login"]',
    'input[name="username"]',
    'input[name="user"]',
    'input[name="nick"]',
    'input[name="user_login"]',
    '#login_username',
    '#username',
    '#user',
    'input[type="text"]'
  ];

  const passSelectors = [
    'input[name="password"]',
    'input[name="pass"]',
    'input[name="user_password"]',
    '#login_password',
    '#password',
    'input[type="password"]'
  ];

  const submitSelectors = [
    'button[type="submit"]',
    'input[type="submit"]',
    'button[name="login"]',
    'button'
  ];

  const userSelector = await typeFirst(page, userSelectors, COMUNIO_USER);
  const passSelector = await typeFirst(page, passSelectors, COMUNIO_PASSWORD);

  if (!userSelector || !passSelector) {
    return false;
  }

  const submitSelector = await clickFirst(page, submitSelectors);
  if (!submitSelector) {
    throw new Error("No encuentro el botón de login de Comunio");
  }

  await new Promise(resolve => setTimeout(resolve, 3000));
  return true;
}

async function obtenerDatosComunio() {
  if (!COMUNIO_USER || !COMUNIO_PASSWORD) {
    throw new Error("Faltan COMUNIO_USER o COMUNIO_PASSWORD");
  }

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: puppeteer.executablePath(),
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 1200 });

    let loginHecho = false;

    for (const url of [COMUNIO_LOGIN_URL, ...COMUNIO_FALLBACK_URLS]) {
      try {
        await page.goto(url, {
          waitUntil: "networkidle2",
          timeout: 60000
        });

        loginHecho = await intentarLoginEnPagina(page);
        if (loginHecho) break;
      } catch (e) {}
    }

    if (!loginHecho) {
      throw new Error("No encuentro los campos de login de Comunio");
    }

    let jugadores = await extraerJugadoresDesdeTablas(page);

    const posiblesRutas = [
      "/ranking",
      "/standings",
      "/table",
      "/points",
      "/"
    ];

    if (!jugadores.length) {
      for (const ruta of posiblesRutas) {
        try {
          await page.goto("https://classic.comunio.es" + ruta, {
            waitUntil: "networkidle2",
            timeout: 25000
          });

          jugadores = await extraerJugadoresDesdeTablas(page);
          if (jugadores.length) break;
        } catch (e) {}
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

app.get("/pagos", async (req, res) => {
  res.json({ status: "ok", mensaje: "Backend vivo" });
});
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

    let mensaje = "🧆 <b>BANCO CROQUETERO</b>\n\n";

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
