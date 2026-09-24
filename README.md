# Guia Escolar — Arquivo Permanente

Sistema de gerenciamento do **Arquivo Permanente Escolar** da  
**E.M. Maria Geralda Miranda Brito Salomão**  
Ponto dos Volantes — MG

---

## Sobre o projeto

Aplicação web para consulta, cadastro, edição e organização dos prontuários do arquivo permanente da escola, além de geração de históricos escolares em formato Word (`.docx`).

### Funcionalidades principais

- **Autenticação** — Login com e-mail e senha (Supabase Auth)
- **Consulta de arquivos** — Busca por nome, pasta ou número + listagem paginada
- **Painel Geral** — Métricas do acervo (total, ativos e arquivados)
- **Visão em Árvore** — Estrutura hierárquica das pastas e alunos
- **Gerenciar alunos** — Cadastro com recomendação inteligente de pasta e número
- **Edição e exclusão** — Modal de edição + confirmação de exclusão
- **Gerador de Históricos** — Preenchimento completo e geração de documento oficial em `.docx`

---

## Tecnologias utilizadas

| Tecnologia              | Uso                              |
|-------------------------|----------------------------------|
| React 19 + TypeScript   | Frontend                         |
| Vite                    | Build e desenvolvimento          |
| Tailwind CSS 4          | Estilização                      |
| Supabase                | Autenticação + Banco de dados    |
| Lucide React            | Ícones                           |
| Docxtemplater + PizZip  | Geração de documentos Word       |
| FileSaver               | Download dos arquivos gerados    |
| vite-plugin-pwa         | Suporte a Progressive Web App    |

---

## Como rodar o projeto localmente

### Pré-requisitos

- Node.js 18+ 
- Conta no [Supabase](https://supabase.com)

### 1. Clone o repositório

```bash
git clone https://github.com/vinisena21/arquivo-permanente-escola.git
cd arquivo-permanente-escola
```

### 2. Instale as dependências

```bash
npm install
```

### 3. Configure as variáveis de ambiente

Crie um arquivo `.env.local` na raiz do projeto:

```env
VITE_SUPABASE_URL=sua_url_do_supabase
VITE_SUPABASE_PUBLISHABLE_KEY=sua_chave_publica_do_supabase
```

### 4. Execute o projeto

```bash
npm run dev
```

Acesse: [http://localhost:5173](http://localhost:5173)

---

## Estrutura do banco de dados (Supabase)

Tabela principal: **`alunos`**

| Coluna            | Tipo          | Descrição                          |
|-------------------|---------------|------------------------------------|
| `id`              | integer       | Identificador único                |
| `nome`            | text          | Nome completo do aluno             |
| `data_nascimento` | date          | Data de nascimento                 |
| `codigo_pasta`    | text          | Código da pasta física             |
| `numero`          | integer       | Número do arquivo dentro da pasta  |
| `status`          | text          | Status do registro (Arquivado, Pendente, Transferido) |

> **Importante:** Ative o Row Level Security (RLS) na tabela e configure as políticas de acesso adequadas.

---

## Scripts disponíveis

| Comando           | Descrição                          |
|-------------------|------------------------------------|
| `npm run dev`     | Inicia o servidor de desenvolvimento |
| `npm run build`   | Gera a build de produção           |
| `npm run preview` | Visualiza a build de produção      |
| `npm run lint`    | Executa o ESLint                   |

---

## Geração de Histórico Escolar

O sistema utiliza o arquivo modelo localizado em:

```
public/modelo_historico.docx
```

Preencha os dados no formulário e o sistema gera automaticamente o documento oficial com as informações do aluno.

---

## Observações

- O sistema foi desenvolvido prioritariamente para uso interno da escola.
- O nome da escola e dados legais estão atualmente fixos no código.
- Para produção, recomenda-se configurar corretamente as políticas de segurança no Supabase.

---

Desenvolvido para a **E.M. Maria Geralda Miranda Brito Salomão**  
Ponto dos Volantes — MG
