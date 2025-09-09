const {
  insertDocumentsInBatch,
  searchSimilarDocuments,
  createVectorIndex
} = require("./utils/vectorSearch");
const { mongoClient } = require("./db");
const { getUsers: getUsersGW } = require("./controllers/gw");
const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function askQuestion(query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function syncUsers() {
  console.log("🚀 Listando usuários do Google Workspace...");
  const usersGW = await getUsersGW();

  // Verificando se o índice vetorial já existe
  await createVectorIndex();

  // Inserindo todos os usuários em lote
  await insertDocumentsInBatch(usersGW, "email");
}

async function searchUser() {
  const query = await askQuestion(
    "❓ Digite o texto para a busca de usuários: "
  );
  if (!query || query.trim() === "") {
    console.log("⚠️ Busca cancelada. Nenhum texto inserido.");
    return;
  }
  console.log(`🚀 Buscando usuários similares a '${query}'...`);
  await searchSimilarDocuments(query, "name");
}

async function mainMenu() {
  await mongoClient.connect();
  console.log("✅ Conectado ao MongoDB.");

  try {
    const choice = await askQuestion(`
Escolha uma opção:
1. Sincronizar usuários do Google Workspace com o MongoDB
2. Pesquisar por um usuário
3. Sair

Sua escolha: `);

    switch (choice.trim()) {
      case "1":
        await syncUsers();
        break;
      case "2":
        await searchUser();
        break;
      case "3":
        console.log("👋 Saindo...");
        break;
      default:
        console.log("❌ Opção inválida. Tente novamente.");
        break;
    }
  } finally {
    await mongoClient.close();
    rl.close();
    console.log("🔌 Conexão com o MongoDB fechada.");
  }
}

mainMenu().catch(console.error);