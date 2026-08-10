const app = require('./app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Marketplace API rodando em http://localhost:${PORT}`);
  console.log(`Documentação de rotas: http://localhost:${PORT}/api`);
});
