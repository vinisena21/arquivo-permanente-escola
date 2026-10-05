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
- **Painel Geral** — Métricas do acervo (total, arquivados, pendentes e transferidos)
- **Visão em Árvore** — Estrutura hierárquica das pastas e alunos
- **Gerenciar alunos** — Cadastro com recomendação inteligente de pasta e número
- **Edição e exclusão** — Modal de edição + confirmação de exclusão
- **Gerador de Históricos** — Preenchimento completo e geração de documento oficial em `.docx`
- **Alunos da Secretaria** — Importação da Listagem de Matrícula exportada do sistema municipal (`.xls`, `.xlsx` ou `.csv`), com prévia das alterações, consulta, ficha completa e exportação

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
| SheetJS (`xlsx`)        | Leitura/exportação de planilhas  |
| FileSaver               | Download dos arquivos gerados    |
| vite-plugin-pwa         | Suporte a Progressive Web App    |

---

## Design System

O projeto possui um pequeno Design System centralizado em:

```
src/styles/tokens.css
```

Ele define tokens de design (variáveis CSS) para:

- **Cores** (primárias, semânticas e neutras)
- **Tipografia** (fontes, tamanhos e pesos)
- **Espaçamentos** (escala de 4px)
- **Raios de borda**
- **Sombras**
- **Transições**
- **Z-index**

Os tokens são mapeados para utilitários do Tailwind CSS 4 via `@theme` no arquivo `src/index.css`.

**Como usar:**

```css
/* CSS puro */
background: var(--color-primary-600);
border-radius: var(--radius-lg);

/* Ou com classes Tailwind */
bg-primary-600 rounded-lg
```

Isso facilita manter a consistência visual em todo o sistema.

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

## Alunos da Secretaria (importação da Listagem de Matrícula)

A aba **Alunos da Secretaria** importa a planilha "Listagem de Matrícula" exportada do sistema municipal (EL Sistemas) e guarda **todas as colunas** no Supabase, para que o Gerador de Históricos preencha os dados do aluno automaticamente.

### 1. Crie a tabela no Supabase (uma única vez)

1. Abra o painel do projeto no [Supabase](https://supabase.com/dashboard) → **SQL Editor** → **New query**.
2. Cole todo o conteúdo do arquivo [`supabase/alunos_secretaria.sql`](supabase/alunos_secretaria.sql) e clique em **Run**.
3. Isso cria a tabela `alunos_secretaria` (com RLS: apenas usuários autenticados leem/gravam). O script pode ser executado novamente sem problemas.

### 2. Importe a planilha

1. No sistema da Secretaria, exporte a **Listagem de Matrícula** (arquivo `.xls`).
2. No Guia Escolar, abra a aba **Alunos da Secretaria** → **Selecionar arquivo**.
3. O arquivo é lido **no próprio navegador**. A linha de cabeçalho é detectada automaticamente (a que contém "Código do estudante" e "Nome"); o bloco de cabeçalho da prefeitura e o rodapé são ignorados.
4. Confira a prévia: **novos**, **situação alterada** (mostra a situação anterior → nova), **outros dados alterados** e **sem alteração**.
5. Clique em **Confirmar importação**. Os registros são gravados em lotes usando o **Código** da matrícula como chave. Matrículas que já estão no banco e não aparecem no arquivo **não são excluídas**.

Cada linha da planilha é uma **matrícula** (coluna "Código"). O mesmo estudante ("Código do estudante") pode ter mais de uma matrícula (ex.: transferido e rematriculado).

### 3. Consulta, ficha completa e exportação

- Busque por nome ou código e filtre por período, turma e situação.
- **Detalhes** mostra todas as colunas da planilha (a coluna "Falecido", que aparece duas vezes na exportação, vira "Falecido (Filiação 1)" e "Falecido (Filiação 2)").
- **Exportar XLSX / CSV** baixa a lista filtrada com todas as colunas.

### 4. Uso no Gerador de Históricos

No Gerador, use **Buscar aluno da secretaria** (ou o botão **Usar no Gerador de Históricos** na ficha do aluno). São preenchidos: nome, data de nascimento, nacionalidade, sexo, naturalidade (cidade) e UF, nome da mãe (**Filiação 1**), nome do pai (**Filiação 2**), RG (Identidade), status (NORMAL/CLASSIFICADO → CURSANDO, TRANSFERIDO → TRANSFERIDO) e série atual (Período). Se o formulário já tiver dados diferentes, o sistema pergunta antes de substituir. As notas continuam sendo preenchidas manualmente.

> **Privacidade (LGPD):** a planilha contém dados pessoais de alunos e responsáveis. Não coloque o arquivo exportado dentro do repositório.

---

## Conferir Histórico (frente e verso)

A aba **Conferir Histórico** recebe um PDF de exatamente duas páginas ou duas imagens
PNG, JPG ou WebP, na ordem frente e verso (até 25 MB por arquivo). A digitalização
é feita no aplicativo do scanner; esta versão não aciona a impressora diretamente.

As imagens são lidas em português com Tesseract.js no navegador. O PDF é renderizado
com PDF.js. Os arquivos e o texto reconhecido não são enviados ao Supabase ou a
serviços de IA. Na primeira leitura, há download do mecanismo e do modelo de OCR;
é necessário acesso à internet. O documento permanece em memória enquanto a sessão
estiver aberta, inclusive ao alternar abas. Uma nova leitura bem-sucedida substitui
a conferência anterior. Recarregar a página ou sair encerra esse estado.

A extração sugere apenas linhas inequívocas do modelo de **Ensino Fundamental**
presente neste repositório. Layouts diferentes, linhas duplicadas, valores sem
separação clara e células não reconhecidas ficam pendentes de transcrição/revisão.
Mesmo valores sugeridos precisam ser comparados com a imagem original.

- As cargas são informadas em **H:MM** ou horas inteiras. Não se interpretam
  decimais ambíguos, como `166,40`, como horas e minutos.
- O cálculo usa minutos inteiros: `0:40 + 0:40 = 1:20`.
- Do 1º ao 5º ano, o modelo traz carga global repetida; essas repetições não são somadas.
- Do 6º ao 9º ano, as cargas por disciplina são somadas, incluindo cargas complementares
  adicionadas pelo responsável. A distribuição pode ser alterada por ano.
- Comparam-se a soma/carga global, o total impresso e a carga anual; qualquer divergência
  é apontada. Campo vazio não equivale a zero e impede a conclusão do cálculo.
- Cada ano pode ser incluído/excluído da conferência conforme a trajetória do aluno.
- Alterar um valor desfaz a confirmação de sua transcrição.
- O relatório distingue **erros**, **dúvidas** e **valores que conferem**. É possível
  imprimir ou baixar o relatório JSON, que contém os dados transcritos e o texto OCR.

**Escopo:** a conferência automática cobre cargas horárias e inconsistências de
preenchimento. Dados pessoais, correspondência entre as páginas, assinaturas,
carimbos, notas, frequência, situação, dias letivos e fundamento legal exigem
conferência humana. Normas escolares não foram fornecidas para automatizar esses
critérios. O relatório não certifica autenticidade nem conformidade legal.

**Validação:** `npm run test:conferencia` executa os testes dos cálculos e da extração
conservadora (Node.js 22.6+ com suporte a remoção de tipos; testado no Node.js 24).
`npm run build` e `npm run lint` verificam a aplicação.

## Observações

- O sistema foi desenvolvido prioritariamente para uso interno da escola.
- O nome da escola e dados legais estão atualmente fixos no código.
- Para produção, recomenda-se configurar corretamente as políticas de segurança no Supabase.

---

Desenvolvido para a **E.M. Maria Geralda Miranda Brito Salomão**  
Ponto dos Volantes — MG
