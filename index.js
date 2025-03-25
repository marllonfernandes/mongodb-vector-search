const { MongoClient } = require("mongodb");
const {
  insertDocument,
  searchSimilarDocuments,
  createVectorIndex,
} = require("./vectorSearch");
const { frases } = require("./frases");

const mongoClient = new MongoClient(process.env.MONGO_URI);

(async () => {

  await mongoClient.connect();

  // Verificando se o índice vetorial já existe
  await createVectorIndex();

  // Inserindo alguns documentos
  for (const frase of frases) {
    await insertDocument(frase);
  }
  
  // Fazendo uma busca por similaridade
  await searchSimilarDocuments("Radiante");

  await mongoClient.close();

  process.exit(0);
})();
