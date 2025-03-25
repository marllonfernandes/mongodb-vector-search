const { OpenAI } = require("openai");
const { MongoClient } = require("mongodb");

// 🔹 Configurar OpenAI e MongoDB
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const mongoClient = new MongoClient(process.env.MONGO_URI);
const db = mongoClient.db(process.env.MONGO_DB_NAME || "vector_db");
const collection = db.collection(process.env.MONGO_COLLECTION || "documents");

// 🔹 Função para gerar embeddings
async function generateEmbedding(text) {
  const response = await openai.embeddings.create({
    model: "text-embedding-ada-002",
    input: text,
  });
  return response.data[0].embedding;
}

// 🔹 Inserir documentos com embeddings no MongoDB
async function insertDocument(text) {
  const embedding = await generateEmbedding(text);

  await collection.insertOne({
    text,
    embedding,
  });

  console.log("✅ Documento inserido:", text);
}
// 🔹 Buscar documentos mais similares
async function searchSimilarDocuments(query) {
  const queryEmbedding = await generateEmbedding(query);

  const results = await collection
    .aggregate([
      {
        $vectorSearch: {
          index: process.env.MONGO_VECTOR_NAME, // Nome do índice no Atlas
          path: "embedding",
          queryVector: queryEmbedding,
          numCandidates: 10, // Número de documentos candidatos
          limit: 3, // Número de documentos retornados
        },
      },
    ])
    .toArray();

  console.log("🔍 Resultados da busca:");
  results.forEach((doc, i) => console.log(`${i + 1}. ${doc.text}`));
}

// 🔹 Função para criar o índice vetorial
async function createVectorIndex() {
  try {
    // Check if the index already exists
    const indexExists = await checkVectorIndexExists();
    if (indexExists) {
    //   console.log(
    //     `✅ Index "${process.env.MONGO_VECTOR_NAME}" already exists. Skipping creation.`
    //   );
      return;
    }

    await db.command({
      createSearchIndexes: process.env.MONGO_COLLECTION || "documents",
      indexes: [
        {
          name: process.env.MONGO_VECTOR_NAME,
          type: "vectorSearch",
          definition: {
            mappings: {
              dynamic: true,
            },
            fields: [
              {
                type: "vector",
                path: "embedding",
                numDimensions: 1536,
                similarity: "cosine",
              },
            ],
          },
        },
      ],
    });

    console.log("✅ Índice vetorial criado com sucesso!");
  } catch (error) {
    console.error("❌ Erro ao criar o índice vetorial:", error.message);
  }
}

// 🔹 Função para verificar se o índice existe
async function checkVectorIndexExists() {
  try {
    const indexName = process.env.MONGO_VECTOR_NAME;
    const indexes = await collection.listSearchIndexes().toArray();
    const indexExists = indexes.some((index) => index.name === indexName);
    return indexExists;
  } catch (error) {
    return false;
  }
}

module.exports = {
  insertDocument,
  searchSimilarDocuments,
  createVectorIndex,
  checkVectorIndexExists,
};
