# MongoDB Vector Search com OpenAI e Google Workspace

Este projeto é uma aplicação de console em Node.js que demonstra a integração de busca vetorial do MongoDB Atlas com a geração de embeddings da OpenAI. A ferramenta permite sincronizar usuários de uma conta do Google Workspace, gerar vetores de embedding para seus dados e realizar buscas por similaridade semântica.

## Funcionalidades

-   **Sincronização de Usuários**: Busca a lista de usuários do Google Workspace e os insere/atualiza em uma coleção do MongoDB.
-   **Geração de Embeddings**: Cria vetores de embedding para cada usuário usando o modelo `text-embedding-ada-002` da OpenAI.
-   **Busca Vetorial**: Realiza buscas por similaridade para encontrar usuários com base em uma consulta de texto livre.
-   **CLI Interativa**: Oferece um menu no terminal para que o usuário escolha a ação a ser executada.

## Pré-requisitos

-   Node.js (v20.6.0 ou superior, para suporte nativo a `--env-file`).
-   Uma conta no MongoDB Atlas com um cluster M0 ou superior.
-   Uma chave de API da OpenAI.
-   Credenciais da API do Google Workspace (`credentials.json`) e um token (`token.json`) para autenticação.

## Configuração

1.  **Clonar o repositório**
    ```bash
    git clone <URL_DO_SEU_REPOSITORIO>
    cd mongodb-vector-search
    ```

2.  **Instalar dependências**
    ```bash
    npm install
    ```

3.  **Configurar Variáveis de Ambiente**
    Crie um arquivo `.env` na raiz do projeto e preencha com suas credenciais.

    ```env
    # Chave de API da OpenAI para gerar os embeddings
    OPENAI_API_KEY="sk-..."

    # String de conexão do seu cluster MongoDB Atlas
    MONGO_URI="mongodb+srv://<user>:<password>@cluster.mongodb.net/"

    # Nome do banco de dados no MongoDB
    MONGO_DB_NAME="vector_db"

    # Nome da coleção onde os documentos serão armazenados
    MONGO_COLLECTION="documents"

    # Nome do índice vetorial a ser criado no MongoDB Atlas
    MONGO_VECTOR_NAME="vector_index"
    ```

### Desenvolvimento Local com Docker (Opcional)

Se preferir, você pode executar uma imagem local do MongoDB Atlas usando Docker para desenvolvimento. Isso evita a necessidade de um cluster na nuvem.

1.  Crie um arquivo `docker-compose.yml` na raiz do projeto com o seguinte conteúdo:

    ```yaml
    services:
      mongodb:
        container_name: mongodb-atlas-local
        hostname: mongodb
        image: mongodb/mongodb-atlas-local
        restart: always
        environment:
          - MONGODB_INITDB_ROOT_USERNAME=user
          - MONGODB_INITDB_ROOT_PASSWORD=pass
        ports:
          - 27019:27017
        volumes:
          - data:/data/db
          - config:/data/configdb
    volumes:
      data:
      config:
    ```

2.  Inicie o container (é necessário ter o Docker instalado):

    ```bash
    docker-compose up -d
    ```

3.  Atualize sua variável `MONGO_URI` no arquivo `.env` para se conectar ao container local:

    ```env
    MONGO_URI="mongodb://user:pass@localhost:27019/"
    ```

## Como Executar

Para iniciar a aplicação, execute o seguinte comando no seu terminal:

```bash
npm start
```

Você será apresentado a um menu interativo com as seguintes opções:

1.  **Sincronizar usuários do Google Workspace com o MongoDB**: Esta opção buscará todos os usuários do Google Workspace, gerará seus embeddings e os salvará no MongoDB. Um índice vetorial será criado automaticamente se não existir.
2.  **Pesquisar por um usuário**: Solicitará um texto para busca e retornará os usuários mais similares encontrados no banco de dados.
3.  **Sair**: Encerra a aplicação.