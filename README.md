# 🐂 Oxi Oxi - Plataforma de Automação de Workflows

Oxi Oxi é uma plataforma open-source e auto-hospedável para criar, visualizar e executar workflows automatizados. Conecte diferentes serviços, APIs e modelos de linguagem para orquestrar tarefas complexas de forma simples e robusta.

## ✨ Tecnologias Principais

| Área         | Tecnologia                                                                                                                                    |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Backend**  | [ElysiaJS](https://elysiajs.com/), [tRPC](https://trpc.io/), [Drizzle ORM](https://orm.drizzle.team/), [TypeScript](https://www.typescriptlang.org/) |
| **Frontend** | [React](https://react.dev/), [Vite](https://vitejs.dev/), [TanStack Router](https://tanstack.com/router/), [shadcn/ui](https://ui.shadcn.com/)    |
| **Base de Dados** | [PostgreSQL](https://www.postgresql.org/)                                                                                                     |
| **Filas & Jobs** | [RabbitMQ](https://www.rabbitmq.com/)                                                                                                         |
| **Runtime**  | [Bun](https://bun.sh/)                                                                                                                          |
| **Monorepo** | [Turborepo](https://turbo.build/repo)                                                                                                             |
| **Container**  | [Docker](https://www.docker.com/)                                                                                                               |

## 🏗️ Arquitetura

O projeto é um monorepo gerenciado pelo Turborepo, contendo duas aplicações principais:

-   `apps/web`: A interface do usuário (frontend) onde você pode construir e monitorar os workflows.
-   `apps/server`: A API (backend) que gerencia os workflows, processa as execuções e se comunica com os serviços.

O ambiente de desenvolvimento é orquestrado com Docker Compose, que gerencia os seguintes serviços:

1.  **PostgreSQL (`db`):** Armazena todos os dados de workflows, execuções e usuários.
2.  **RabbitMQ (`rabbitmq`):** Gerencia a fila de tarefas, garantindo que os jobs sejam processados de forma assíncrona e resiliente.
3.  **Ollama (`ollama`):** Permite a execução de modelos de linguagem (LLMs) localmente como parte de um workflow.

## 🚀 Guia de Instalação e Desenvolvimento Local

Siga estes passos para configurar e rodar o projeto na sua máquina.

### Pré-requisitos

Antes de começar, garanta que você tenha os seguintes softwares instalados:
-   [Bun](https://bun.sh/docs/installation)
-   [Docker](https://docs.docker.com/get-docker/) e [Docker Compose](https://docs.docker.com/compose/install/)
-   [Git](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git)

### Passo a Passo

1.  **Clonar o Repositório**
    ```sh
    git clone <URL_DO_SEU_REPOSITORIO>
    cd oxi-oxi
    ```

2.  **Instalar as Dependências**
    Na raiz do projeto, rode o seguinte comando para instalar todas as dependências do monorepo:
    ```sh
    bun install
    ```

3.  **Configurar Variáveis de Ambiente**
    Copie os arquivos de exemplo `.env.example` para `.env` em ambas as aplicações:
    ```sh
    cp apps/server/.env.example apps/server/.env
    cp apps/web/.env.example apps/web/.env
    ```
    Os valores padrão já estão configurados para o ambiente Docker local.

4.  **Iniciar os Serviços com Docker**
    Este comando irá iniciar o PostgreSQL, RabbitMQ e Ollama em background.
    ```sh
    docker compose up -d
    ```
    > **⚠️ Nota sobre GPU e WSL:** Se você encontrar um erro `nvidia-container-cli` ao rodar o comando acima (comum no Windows com WSL), significa que seu Docker não está configurado para acessar a GPU. Para resolver, você pode rodar o Ollama em modo CPU editando o arquivo `docker-compose.yml` e removendo a seção `deploy` do serviço `ollama`.

5.  **Aplicar o Schema no Banco de Dados**
    Com os serviços rodando, precisamos criar as tabelas no PostgreSQL.
    ```sh
    cd apps/server
    bun run db:push
    ```
    Isso aplicará o schema definido com o Drizzle ao banco de dados.

6.  **Rodar os Servidores de Desenvolvimento**
    Você precisará de dois terminais abertos.

    -   **Terminal 1: Rodar o Backend**
        ```sh
        cd apps/server
        bun run dev
        ```
        O servidor da API estará rodando em `http://localhost:3000`.

    -   **Terminal 2: Rodar o Frontend**
        ```sh
        cd apps/web
        bun run dev
        ```
        A aplicação web estará acessível em `http://localhost:5173`.

Pronto! Agora você pode abrir `http://localhost:5173` no seu navegador e começar a usar a plataforma.

##  scripts Úteis

-   `bun run dev`: Inicia os servidores de desenvolvimento da web e do server simultaneamente (a partir da raiz).
-   `bun run build`: Builda ambas as aplicações para produção.
-   `cd apps/server && bun run db:generate`: Gera um novo arquivo de migração se você alterar os schemas do Drizzle.
-   `cd apps/server && bun run db:studio`: Abre a UI do Drizzle Studio para visualizar e gerenciar seu banco de dados.
-   `docker compose down`: Para e remove os containers dos serviços (PostgreSQL, RabbitMQ, etc.).