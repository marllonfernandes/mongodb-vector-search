const { OpenAI } = require("openai");
const { mongoClient } = require("../db");

// 🔹 Configurar OpenAI e MongoDB
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const db = mongoClient.db(process.env.MONGO_DB_NAME || "vector_db");
const collection = db.collection(process.env.MONGO_COLLECTION || "documents");

/**
 * Constrói uma string descritiva a partir de um objeto de usuário para ser usada no embedding.
 * @param {object} user - O objeto do usuário.
 * @returns {string} Uma string contendo informações relevantes do usuário.
 */
function createUserEmbeddingText(user) {
  const fields = [
    user.name,
    user.email
  ];

  // Concatena os campos, garantindo que não haja valores nulos ou vazios.
  // A descrição é o campo mais importante para a busca semântica.
  return fields.filter(Boolean).join(". ");
}

// 🔹 Função para gerar embeddings
async function generateEmbedding(text) {
  const response = await openai.embeddings.create({
    model: "text-embedding-ada-002",
    input: text,
  });
  return response.data[0].embedding;
}

// 🔹 Inserir documentos com embeddings no MongoDB
async function insertDocument(doc, textField = "text", filter) {
  if (!filter || Object.keys(filter).length === 0) {
    console.error(
      `❌ O filtro para a operação de upsert não foi fornecido ou está vazio.`
    );
    return;
  }

  const textToEmbed = createUserEmbeddingText(doc);
  if (!textToEmbed || typeof textToEmbed !== "string") {
    console.error(
      `❌ O campo "${textField}" não existe ou não é uma string no objeto fornecido.`
    );
    return;
  }

  const embedding = await generateEmbedding(textToEmbed);

  const update = {
    $set: {
      ...doc,
      embedding,
    },
  };
  const options = { upsert: true };

  const result = await collection.updateOne(filter, update, options);

  if (result.upsertedCount > 0) {
    console.log("✅ Documento inserido:", doc.name);
  } else {
    console.log("🔄 Documento atualizado:", doc.name);
  }
}

/**
 * Insere ou atualiza múltiplos documentos em lote, gerando seus embeddings.
 * @param {Array<object>} docs - Um array de documentos para inserir/atualizar.
 * @param {string} uniqueKey - A chave única para identificar os documentos (ex: 'email').
 */
async function insertDocumentsInBatch(
  docs,
  uniqueKey = "email",
  batchSize = 1000
) {
  if (!docs || docs.length === 0) {
    console.log("ℹ️ Nenhum documento para inserir.");
    return;
  }

  console.log(`🚀 Processando ${docs.length} documentos em lotes de ${batchSize}...`);

  let totalUpserted = 0;
  let totalModified = 0;

  for (let i = 0; i < docs.length; i += batchSize) {
    const batchDocs = docs.slice(i, i + batchSize);
    console.log(`📦 Processando lote ${i / batchSize + 1}...`);

    // 1. Validar documentos e preparar textos para embedding
    const validDocs = [];
    const textsToEmbed = [];
    for (const doc of batchDocs) {
      if (!doc[uniqueKey]) {
        console.warn(`⚠️ Documento pulado por falta de chave única "${uniqueKey}":`, doc);
        continue;
      }
      const text = createUserEmbeddingText(doc);
      if (!text || text.trim().length === 0) {
        console.warn(`⚠️ Documento pulado por não gerar texto para embedding:`, doc.email || doc.name);
        continue;
      }
      validDocs.push(doc);
      textsToEmbed.push(text);
    }

    if (validDocs.length === 0) {
      console.log("ℹ️ Nenhum documento válido neste lote.");
      continue; // Pula para o próximo lote
    }

    // 2. Gerar embeddings em lote para os documentos válidos
    const embeddings = await generateEmbeddings(textsToEmbed);

    // 3. Preparar operações de bulk write
    const bulkOperations = validDocs.map((doc, index) => ({
      updateOne: {
        filter: { [uniqueKey]: doc[uniqueKey] },
        update: { $set: { ...doc, embedding: embeddings[index] } },
        upsert: true,
      },
    }));

    // 4. Executar a operação em lote para o chunk atual
    const result = await collection.bulkWrite(bulkOperations);
    console.log(`✅ Lote concluído: ${result.upsertedCount} inseridos, ${result.modifiedCount} atualizados.`);
    totalUpserted += result.upsertedCount;
    totalModified += result.modifiedCount;
  }
  console.log(`🏁 Processo finalizado. Total: ${totalUpserted} inseridos, ${totalModified} atualizados.`);
}

// 🔹 Buscar documentos mais similares
async function searchSimilarDocuments(query, textField = "text") {
  const queryEmbedding = await generateEmbedding(query);

  const results = await collection
    .aggregate([
      {
        $vectorSearch: {
          index: process.env.MONGO_VECTOR_NAME || "vector_index", // Nome do índice no Atlas
          path: "embedding",
          queryVector: queryEmbedding,
          numCandidates: 100, // Número de documentos candidatos
          limit: 3, // Número de documentos retornados
        },
      },
      {
        $project: {
          embedding: 0, // Opcional: remove o campo de embedding do resultado
          score: { $meta: "vectorSearchScore" }, // Inclui a pontuação de similaridade
        },
      },
    ])
    .toArray();

  console.log("🔍 Resultados da busca:");
  results.forEach((doc, i) => {
    console.log(
      `${i + 1}. (Score: ${doc.score.toFixed(4)}) - ${doc[textField]}`
    );
    // Se quiser ver o objeto inteiro:
    // console.log(`${i + 1}. (Score: ${doc.score.toFixed(4)})`, doc);
  });
}

// 🔹 Função para criar o índice vetorial
async function createVectorIndex() {
  try {
    // Check if the index already exists
    const indexExists = await checkVectorIndexExists();
    if (indexExists) {
      console.log(
        `✅ Index "${process.env.MONGO_VECTOR_NAME}" already exists. Skipping creation.`
      );
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

/**
 * Gera embeddings para um lote de textos.
 * @param {Array<string>} texts - Um array de strings para gerar embeddings.
 * @returns {Promise<Array<Array<number>>>} Um array de vetores de embedding.
 */
async function generateEmbeddings(texts) {
  if (!texts || texts.length === 0) return [];
  const response = await openai.embeddings.create({
    model: "text-embedding-ada-002",
    input: texts,
  });
  return response.data.map((d) => d.embedding);
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
  insertDocumentsInBatch,
  searchSimilarDocuments,
  createVectorIndex,
  checkVectorIndexExists,
  createUserEmbeddingText,
};
