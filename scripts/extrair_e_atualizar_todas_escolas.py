import subprocess, os, json

psql = r"C:\Users\USER\Downloads\dump_pontodosvolantes\pgsql_portable\pgsql\bin\psql.exe"
data_dir = r"C:\Users\USER\OneDrive\Área de Trabalho\Site Arquivo Permanente\src\data"
backup_dir = r"C:\Users\USER\OneDrive\Área de Trabalho\Site Arquivo Permanente\backup_seguro_pre_importacao_20261118"
supabase_dir = r"C:\Users\USER\OneDrive\Área de Trabalho\Site Arquivo Permanente\supabase"

def query_pgsql(sql):
    temp_file = os.path.join(data_dir, "temp_query.sql")
    with open(temp_file, "w", encoding="utf-8") as f:
        f.write("SET client_encoding = 'UTF8';\n" + sql)
    res = subprocess.run([psql, "-p", "5432", "-U", "postgres", "-d", "mg-pontodosvolantes-pm-edu", "-t", "-A", "-f", temp_file],
                         capture_output=True, text=True, errors="replace", encoding="utf-8")
    if os.path.exists(temp_file):
        os.remove(temp_file)
    if res.stderr and "ERRO" in res.stderr:
        raise Exception(f"Erro no PostgreSQL: {res.stderr}")
    raw = res.stdout.strip()
    lines = raw.split("\n", 1)
    clean = lines[1].strip() if len(lines) > 1 and lines[0].strip() == "SET" else raw
    return json.loads(clean) if clean and clean != "SET" else []

print("=================================================================")
print("IMPORTACAO CIRURGICA - DUMP MUNICIPAL PONTO DOS VOLANTES (2026)")
print("Limite cronologico estrito: ate 22 de outubro de 2026 (2026-10-22)")
print("Preservacao total: dados de Maria Geralda 100% intactos")
print("=================================================================\n")

# 1. MATRICULAS
print("1. Processando MATRICULAS...")
with open(os.path.join(backup_dir, "matriculas.json"), "r", encoding="utf-8") as f:
    matriculas_mg = json.load(f)

for m in matriculas_mg:
    m["Escola"] = "EM MARIA GERALDA MIRANDA BRITO SALOMÃO"
    m["Código Escola"] = "22"

sql_matriculas = """
SELECT json_agg(sub.item)
FROM (
    SELECT (
        jsonb_build_object(
            'Código', m.ed_matricula_aluno::text,
            'Código do estudante', a.ed_aluno::text,
            'Registro do estudante (RA)', COALESCE(a.registro_aluno, '-'),
            'Nome', g.nome_g,
            'Data de Nascimento', COALESCE(to_char(g.data_nascimento_g, 'DD/MM/YYYY'), ''),
            'Identificação CENSO', COALESCE(e.cod_inep, ''),
            'Período', COALESCE(p.nome, ''),
            'Turma', t.nome,
            'Descrição', COALESCE(t.descricao, t.nome),
            'Turno', COALESCE(tu.descricao, 'MATUTINO'),
            'Situação', COALESCE(s.descricao, 'NORMAL'),
            'Data da matrícula', COALESCE(to_char(m.data_matricula, 'DD/MM/YYYY'), ''),
            'Data da movimentação', COALESCE(to_char(tr.data_transferencia, 'DD/MM/YYYY'), ''),
            'Idade na matrícula', CASE WHEN g.data_nascimento_g IS NOT NULL AND m.data_matricula IS NOT NULL THEN (EXTRACT(YEAR FROM age(m.data_matricula, g.data_nascimento_g)))::text ELSE '' END,
            'Idade na data atual', CASE WHEN g.data_nascimento_g IS NOT NULL THEN (EXTRACT(YEAR FROM age(CURRENT_DATE, g.data_nascimento_g)))::text ELSE '' END,
            'Nacionalidade', COALESCE(g.nacionalidade, 'Brasileira'),
            'Naturalidade', COALESCE(g.codigo_munic_natural, 'PONTO DOS VOLANTES - MINAS GERAIS'),
            'Sexo', CASE WHEN g.sexo_g = 'M' THEN 'Masculino' WHEN g.sexo_g = 'F' THEN 'Feminino' ELSE COALESCE(g.sexo_g, '') END,
            'Cor', COALESCE(g.cor_g, ''),
            'CPF', COALESCE(g.cpf_g, ''),
            'Identidade', COALESCE(g.num_ident_g, ''),
            'Número da certidão', COALESCE(g.cert_nasc_g, ''),
            'Livro da certidão', COALESCE(g.livro_nasc_g, ''),
            'Folha da certidão', COALESCE(g.folha_nasc_g, ''),
            'Data emissão certidão nascimento', COALESCE(to_char(a.data_emiss_cert_nascimento, 'DD/MM/YYYY'), '')
        ) ||
        jsonb_build_object(
            'Município do cartório', COALESCE(a.munic_ibge_cartorio_nascimento, ''),
            'Nome do cartório', COALESCE(a.cartorio_nascimento, ''),
            'Bolsa Família', CASE WHEN m.bolsa_familia IS TRUE THEN 'Sim' ELSE 'Não' END,
            'Número do bolsa família', COALESCE(a.numero_bolsa_familia, ''),
            'Matrícula Nova', CASE WHEN m.matricula_nova IS TRUE THEN 'Sim' ELSE 'Não' END,
            'Número do PIS/PASEP/NIS', COALESCE(g.num_pis_g, ''),
            'Nº do Cartão Nacional do SUS', COALESCE(g.num_pis_g, ''),
            'Contato 1', COALESCE(g.celular_g, g.telefone_g, ''),
            'E-mail', COALESCE(g.email_g, ''),
            'Filiação 1', COALESCE(gmae.nome_g, ''),
            'CPF Filiação 1', COALESCE(gmae.cpf_g, ''),
            'Contato Filiação 1', COALESCE(gmae.celular_g, gmae.telefone_g, ''),
            'Falecido', CASE WHEN g.falecido IS TRUE THEN 'Sim' ELSE 'Não' END,
            'Filiação 2', COALESCE(gpai.nome_g, ''),
            'CPF Filiação 2', COALESCE(gpai.cpf_g, ''),
            'Contato Filiação 2', COALESCE(gpai.celular_g, gpai.telefone_g, ''),
            'Responsável', '-',
            'CPF do responsável', '-',
            'Tipo Logradouro', COALESCE(g.codigo_logra, 'RUA'),
            'Logradouro', COALESCE(g.descricao_g, ''),
            'Número', COALESCE(g.numero_g, ''),
            'Cep', COALESCE(g.cep_g, '39.615-000'),
            'Bairro', COALESCE(gb.nome_bairr, ''),
            'Município', COALESCE(gm.nome_munic, 'PONTO DOS VOLANTES'),
            'Estado', COALESCE(gm.codigo_estad, 'MINAS GERAIS')
        ) ||
        jsonb_build_object(
            'País de residência (CENSO)', 'BRASIL',
            'Localização da Residência (CENSO)', COALESCE(a.zona, 'Zona Rural'),
            'Utiliza transporte', CASE WHEN m.utiliza_transporte IS TRUE THEN 'Sim' ELSE 'Não' END,
            'Rota', COALESCE(m.rota, ''),
            'Ponto / Local de embarque', COALESCE(m.local_embarque, ''),
            'Avaliado por PDI/PEI/PDP', CASE WHEN m.avaliado_pdi IS TRUE THEN 'Sim' ELSE 'Não' END,
            'Frequenta a APAE', CASE WHEN m.frequenta_apae IS TRUE THEN 'Sim' ELSE 'Não' END,
            'Ano que ingressou na escola', COALESCE(m.ano_ingressou_escola, '2026'),
            'Entregou histórico?', CASE WHEN m.entregou_historico IS TRUE THEN 'Sim' ELSE 'Não' END,
            'Confirmou rematrícula', CASE WHEN m.confirmou_rematricula IS TRUE THEN 'Sim' ELSE 'Não' END,
            'Tamanho do uniforme', COALESCE(m.tamanho_uniforme, ''),
            'Retorno sem documentação', CASE WHEN m.retorno_sem_documentacao IS TRUE THEN 'Sim' ELSE 'Não' END,
            'Ponto de referência', COALESCE(g.ponto_referencia, ''),
            'Escola', gesc.nome_g,
            'Código Escola', e.ed_escola::text
        )
    ) AS item
    FROM ed_matricula_aluno m
    JOIN ed_aluno a ON a.ed_aluno = m.ed_aluno
    JOIN gg_geral g ON a.codigo_g = g.codigo_g
    JOIN ed_turma t ON t.ed_turma = m.ed_turma
    JOIN ed_periodo_letivo pl ON pl.ed_periodo_letivo = t.ed_periodo_letivo
    JOIN ed_escola e ON e.ed_escola = pl.ed_escola
    JOIN gg_geral gesc ON gesc.codigo_g = e.codigo_g_escola
    LEFT JOIN ed_periodo p ON p.ed_periodo = t.ed_periodo
    LEFT JOIN ed_turno tu ON tu.ed_turno = t.ed_turno
    LEFT JOIN ed_situacao s ON s.ed_situacao = m.ed_situacao
    LEFT JOIN gg_geral gmae ON gmae.codigo_g = g.codigo_g_mae
    LEFT JOIN gg_geral gpai ON gpai.codigo_g = g.codigo_g_pai
    LEFT JOIN gg_bairro gb ON gb.codigo_bairr = g.codigo_bairr
    LEFT JOIN gg_munic gm ON gm.codigo_munic = g.codigo_munic
    LEFT JOIN (
        SELECT ed_matricula_aluno_origem, MAX(data_transferencia) AS data_transferencia
        FROM ed_transferencia
        WHERE data_transferencia <= '2026-10-22'
        GROUP BY ed_matricula_aluno_origem
    ) tr ON tr.ed_matricula_aluno_origem = m.ed_matricula_aluno
    WHERE pl.ano_letivo = 2026 AND m.data_matricula <= '2026-10-22' AND e.ed_escola != 22
    ORDER BY gesc.nome_g ASC, g.nome_g ASC, a.ed_aluno ASC, m.data_matricula ASC, m.ed_matricula_aluno ASC
) sub;
"""
matriculas_outras = query_pgsql(sql_matriculas)
matriculas_todas = matriculas_mg + matriculas_outras
with open(os.path.join(data_dir, "matriculas.json"), "w", encoding="utf-8") as f:
    json.dump(matriculas_todas, f, ensure_ascii=False, indent=2)
print(f"  - Registros de Maria Geralda preservados: {len(matriculas_mg)}")
print(f"  - Registros das outras escolas extraidos do dump: {len(matriculas_outras)}")
print(f"  - Total gravado em matriculas.json: {len(matriculas_todas)}\n")

# 2. TURMAS
print("2. Processando TURMAS...")
with open(os.path.join(backup_dir, "turmas.json"), "r", encoding="utf-8") as f:
    turmas_mg = json.load(f)
for t in turmas_mg:
    t["Escola"] = "EM MARIA GERALDA MIRANDA BRITO SALOMÃO"
    t["Código Escola"] = "22"

sql_turmas = """
SELECT json_agg(sub.item)
FROM (
    SELECT json_build_object(
        'Identificação CENSO', COALESCE(t.cod_inep, ''),
        'Carga horária', COALESCE(t.carga_horaria, '0800:00'),
        'Dias letivos', COALESCE(t.dias_letivos::text, '200'),
        'Período', COALESCE(p.nome, ''),
        'Turma', t.nome,
        'Sala', '',
        'Descrição', COALESCE(t.descricao, t.nome),
        'Turno', COALESCE(tu.descricao, 'MATUTINO'),
        'Tipo', COALESCE(t.tipo::text, 'NORMAL'),
        'Código da Etapa', COALESCE(t.codigo_etapa_censo, ''),
        'Profissional de turma', COALESCE(gp.nome_g, '-'),
        'Função na Turma', '-',
        'Tipos de Regime de Contratação', '-',
        'Tipo de agrupamento da presença', 'Geral',
        'Tipo de agrupamento do conteúdo', 'Personalizado',
        'Tipo de ordenação das matrículas', 'Por Ordem Alfabética',
        'Mínimo de estudantes', COALESCE(t.qtd_minima_matricula::text, '1'),
        'Máximo de estudantes', COALESCE(t.qtd_maxima_matricula::text, '35'),
        'Resultado aprovado', 'APROVADO',
        'Resultado reprovado', 'REPROVADA',
        'Migrar turma para o CENSO?', 'Sim',
        'Dias da semana', 'SEGUNDA' || chr(10) || 'TERÇA' || chr(10) || 'QUARTA' || chr(10) || 'QUINTA' || chr(10) || 'SEXTA',
        'Organização curricular da turma', 'Série/ano (séries anuais)',
        'Escola', gesc.nome_g,
        'Código Escola', e.ed_escola::text
    ) AS item
    FROM ed_turma t
    JOIN ed_periodo_letivo pl ON pl.ed_periodo_letivo = t.ed_periodo_letivo
    JOIN ed_escola e ON e.ed_escola = pl.ed_escola
    JOIN gg_geral gesc ON gesc.codigo_g = e.codigo_g_escola
    LEFT JOIN ed_periodo p ON p.ed_periodo = t.ed_periodo
    LEFT JOIN ed_turno tu ON tu.ed_turno = t.ed_turno
    LEFT JOIN ed_professor prof ON prof.ed_professor = t.ed_professor
    LEFT JOIN gg_geral gp ON gp.codigo_g = prof.codigo_g
    WHERE pl.ano_letivo = 2026 AND e.ed_escola != 22
    ORDER BY gesc.nome_g, t.nome
) sub;
"""
turmas_outras = query_pgsql(sql_turmas)
turmas_todas = turmas_mg + turmas_outras
with open(os.path.join(data_dir, "turmas.json"), "w", encoding="utf-8") as f:
    json.dump(turmas_todas, f, ensure_ascii=False, indent=2)
print(f"  - Turmas de Maria Geralda preservadas: {len(turmas_mg)}")
print(f"  - Turmas das outras escolas extraidas do dump: {len(turmas_outras)}")
print(f"  - Total gravado em turmas.json: {len(turmas_todas)}\n")

# 3. PROFISSIONAIS
print("3. Processando PROFISSIONAIS...")
with open(os.path.join(backup_dir, "profissionais.json"), "r", encoding="utf-8") as f:
    prof_mg = json.load(f)
for p in prof_mg:
    p["Escola"] = "EM MARIA GERALDA MIRANDA BRITO SALOMÃO"
    p["Código Escola"] = "22"

sql_prof = """
SELECT json_agg(prof_data)
FROM (
    SELECT DISTINCT ON (e.ed_escola, prof.ed_professor) json_build_object(
        'Código', COALESCE(prof.cod_professor, prof.ed_professor::text),
        'Nome', g.nome_g,
        'Usuário', COALESCE(g.cpf_g, ''),
        'Identificação CENSO', COALESCE(prof.cod_inep, ''),
        'Data de Nascimento', COALESCE(to_char(g.data_nascimento_g, 'DD/MM/YYYY'), ''),
        'Idade', CASE WHEN g.data_nascimento_g IS NOT NULL THEN (EXTRACT(YEAR FROM age(CURRENT_DATE, g.data_nascimento_g)))::text ELSE '' END,
        'CPF', COALESCE(g.cpf_g, ''),
        'Identidade', COALESCE(g.num_ident_g, ''),
        'Profissão', COALESCE(prof.funcao, 'PROFESSOR'),
        'Naturalidade', COALESCE(g.codigo_munic_natural, 'PONTO DOS VOLANTES'),
        'Sexo', CASE WHEN g.sexo_g = 'M' THEN 'Masculino' WHEN g.sexo_g = 'F' THEN 'Feminino' ELSE COALESCE(g.sexo_g, '') END,
        'Cor', COALESCE(g.cor_g, ''),
        'Contato 1', COALESCE(g.celular_g, g.telefone_g, ''),
        'E-mail', COALESCE(g.email_g, ''),
        'Filiação 1', COALESCE(gmae.nome_g, ''),
        'Filiação 2', COALESCE(gpai.nome_g, ''),
        'Estado', 'MINAS GERAIS',
        'Município', 'PONTO DOS VOLANTES',
        'Número', COALESCE(g.numero_g, ''),
        'Cep', COALESCE(g.cep_g, '39.615-000'),
        'Ativo', 'Sim',
        'Escolaridade', COALESCE(prof.escolaridade, 'Educação Superior'),
        'Curso superior', COALESCE(ppl.cargo, prof.funcao, 'Docente'),
        'Tipo de instituição', 'PÚBLICA',
        'Instituição', '',
        'Escola', gesc.nome_g,
        'Código Escola', e.ed_escola::text
    ) AS prof_data
    FROM ed_professor_periodo_letivo ppl
    JOIN ed_periodo_letivo pl ON pl.ed_periodo_letivo = ppl.ed_periodo_letivo
    JOIN ed_escola e ON e.ed_escola = pl.ed_escola
    JOIN gg_geral gesc ON gesc.codigo_g = e.codigo_g_escola
    JOIN ed_professor prof ON prof.ed_professor = ppl.ed_professor
    JOIN gg_geral g ON g.codigo_g = prof.codigo_g
    LEFT JOIN gg_geral gmae ON gmae.codigo_g = g.codigo_g_mae
    LEFT JOIN gg_geral gpai ON gpai.codigo_g = g.codigo_g_pai
    WHERE pl.ano_letivo = 2026 AND e.ed_escola != 22
    ORDER BY e.ed_escola, prof.ed_professor, g.nome_g
) sub;
"""
prof_outras = query_pgsql(sql_prof)
prof_todas = prof_mg + prof_outras
with open(os.path.join(data_dir, "profissionais.json"), "w", encoding="utf-8") as f:
    json.dump(prof_todas, f, ensure_ascii=False, indent=2)
print(f"  - Profissionais de Maria Geralda preservados: {len(prof_mg)}")
print(f"  - Profissionais das outras escolas extraidos do dump: {len(prof_outras)}")
print(f"  - Total gravado em profissionais.json: {len(prof_todas)}\n")

# 4. MOVIMENTACOES
print("4. Processando MOVIMENTACOES...")
with open(os.path.join(backup_dir, "movimentacoes.json"), "r", encoding="utf-8") as f:
    mov_mg = json.load(f)
for m in mov_mg:
    m["Escola"] = "EM MARIA GERALDA MIRANDA BRITO SALOMÃO"
    m["Código Escola"] = "22"

sql_mov = """
SELECT json_agg(sub.item)
FROM (
    SELECT json_build_object(
        'Código', tr.ed_transferencia::text,
        'Estudante', g.nome_g,
        'Período de Origem', COALESCE(porig.nome, ''),
        'Turma origem', torig.nome,
        'Escola destino', COALESCE(tr.nome_escola_destino, ''),
        'Período destino', '',
        'Turma destino', '',
        'Município destino', COALESCE(tr.munic_destino, ''),
        'Data da Movimentação', to_char(tr.data_transferencia, 'DD/MM/YYYY'),
        'Motivo', COALESCE(tm.descricao, 'MUDANÇA DE ENDEREÇO'),
        'Responsável', COALESCE(gresp.nome_g, ''),
        'Situação', COALESCE(s.descricao, 'TRANSFERIDO'),
        'Escola', gesc.nome_g,
        'Código Escola', e.ed_escola::text
    ) AS item
    FROM ed_transferencia tr
    JOIN ed_matricula_aluno m ON m.ed_matricula_aluno = tr.ed_matricula_aluno_origem
    JOIN ed_aluno a ON a.ed_aluno = m.ed_aluno
    JOIN gg_geral g ON g.codigo_g = a.codigo_g
    JOIN ed_turma torig ON torig.ed_turma = m.ed_turma
    JOIN ed_periodo_letivo pl ON pl.ed_periodo_letivo = torig.ed_periodo_letivo
    JOIN ed_escola e ON e.ed_escola = pl.ed_escola
    JOIN gg_geral gesc ON gesc.codigo_g = e.codigo_g_escola
    LEFT JOIN ed_periodo porig ON porig.ed_periodo = torig.ed_periodo
    LEFT JOIN ed_transferencia_motivo tm ON tm.ed_transferencia_motivo = tr.ed_transferencia_motivo
    LEFT JOIN gg_geral gresp ON gresp.codigo_g = tr.codigo_g_resp
    LEFT JOIN ed_situacao s ON s.ed_situacao = tr.ed_situacao
    WHERE pl.ano_letivo = 2026 AND tr.data_transferencia <= '2026-10-22' AND e.ed_escola != 22
    ORDER BY gesc.nome_g, tr.data_transferencia, g.nome_g
) sub;
"""
mov_outras = query_pgsql(sql_mov)
mov_todas = mov_mg + mov_outras
with open(os.path.join(data_dir, "movimentacoes.json"), "w", encoding="utf-8") as f:
    json.dump(mov_todas, f, ensure_ascii=False, indent=2)
print(f"  - Movimentacoes de Maria Geralda preservadas: {len(mov_mg)}")
print(f"  - Movimentacoes das outras escolas extraidas do dump: {len(mov_outras)}")
print(f"  - Total gravado em movimentacoes.json: {len(mov_todas)}\n")

# 5. GERACAO SQL SUPABASE COM ON CONFLICT DO NOTHING
print("5. Gerando script SQL seguro para o Supabase...")
def esc(val):
    if val is None or val == "":
        return "NULL"
    s = str(val).replace("'", "''")
    return f"'{s}'"

def data_iso(d):
    if not d: return "NULL"
    partes = str(d).split("/")
    if len(partes) == 3:
        return f"'{partes[2]}-{partes[1]}-{partes[0]}'"
    return "NULL"

sql_file = os.path.join(supabase_dir, "carga_todas_escolas_2026_ate_out22.sql")
with open(sql_file, "w", encoding="utf-8") as out:
    out.write("-- ====================================================================\n")
    out.write("-- CARGA DE TODAS AS ESCOLAS DO MUNICIPIO DE PONTO DOS VOLANTES (2026)\n")
    out.write("-- Limite cronologico estrito: ate 22 de outubro de 2026 (2026-10-22)\n")
    out.write("-- Cláusula ON CONFLICT (codigo_matricula) DO NOTHING assegura protecao\n")
    out.write("-- absoluta de qualquer registro previamente existente na base de dados.\n")
    out.write("-- ====================================================================\n\n")
    
    LOTE = 200
    for i in range(0, len(matriculas_todas), LOTE):
        lote = matriculas_todas[i:i+LOTE]
        out.write(f"-- LOTE {i // LOTE + 1} ({len(lote)} registros)\n")
        out.write("INSERT INTO public.alunos_secretaria (\n")
        out.write("  codigo_matricula, codigo_estudante, ra, nome, data_nascimento, periodo, turma, descricao,\n")
        out.write("  turno, situacao, data_matricula, data_movimentacao, nacionalidade, naturalidade,\n")
        out.write("  uf_naturalidade, sexo, identidade, filiacao_1, filiacao_2, escola, dados\n")
        out.write(") VALUES\n")
        
        linhas = []
        for m in lote:
            dados_json = json.dumps(m, ensure_ascii=False).replace("'", "''")
            linha = f"({esc(m.get('Código'))}, {esc(m.get('Código do estudante'))}, {esc(m.get('Registro do estudante (RA)'))}, {esc(m.get('Nome'))}, {data_iso(m.get('Data de Nascimento'))}, {esc(m.get('Período'))}, {esc(m.get('Turma'))}, {esc(m.get('Descrição'))}, {esc(m.get('Turno'))}, {esc(m.get('Situação'))}, {data_iso(m.get('Data da matrícula'))}, {data_iso(m.get('Data da movimentação'))}, {esc(m.get('Nacionalidade'))}, {esc(m.get('Naturalidade'))}, 'MG', {esc(m.get('Sexo'))}, {esc(m.get('Identidade'))}, {esc(m.get('Filiação 1'))}, {esc(m.get('Filiação 2'))}, {esc(m.get('Escola'))}, '{dados_json}'::jsonb)"
            linhas.append(linha)
        out.write(",\n".join(linhas))
        out.write("\nON CONFLICT (codigo_matricula) DO NOTHING;\n\n")

print(f"  -> Script SQL gerado com sucesso em: {sql_file}")
print("\n=================================================================")
print("SUCESSO TOTAL! TODOS OS DADOS FORAM EXTRAIDOS E ATUALIZADOS!")
print("=================================================================")
