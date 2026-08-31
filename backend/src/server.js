const express = require('express');
const app = express();
const PORT = 3000;

app.get('/', (req, res) => {
    res.json({ mensagem: "Servidor do SpeakFlow rodando com sucesso!" });
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT} (http://localhost:${PORT})`);
});


