app.post("/confirmar", async (req, res) => {
  try {
    if (!TOKEN || !CHAT_ID) {
      return res.status(500).send("❌ Faltan TOKEN o CHAT_ID");
    }

    const pagos = req.body;

    if (!Array.isArray(pagos) || !pagos.length) {
      return res.status(400).send("❌ No hay datos de pagos");
    }

    let mensaje = "🧆 <b>BANCO CROQUETERO</b>\n\n";

    pagos.forEach(j => {
      let icono = "▪️";
      if (j.posicion === 1) icono = "🥇";
      if (j.posicion === 2) icono = "🥈";
      if (j.posicion === 3) icono = "🥉";

      mensaje += `${icono} <b>${j.nombre}</b> (${j.puntos} pts)\n`;
      mensaje += `💸 +${Number(j.total).toLocaleString("es-ES")}€\n\n`;
    });

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
