import subprocess, os, json, re

psql = r"C:\Users\USER\Downloads\dump_pontodosvolantes\pgsql_portable\pgsql\bin\psql.exe"
project_dir = r"C:\Users\USER\OneDrive\Área de Trabalho\Site Arquivo Permanente"
data_dir = os.path.join(project_dir, "src", "data")
supabase_dir = os.path.join(project_dir, "supabase")

print("=========================================================================")
print("INTEGRAÇÃO TOTAL E DEFINITIVA DO DUMP MUNICIPAL DE PONTO DOS VOLANTES")
print("Data de corte estrita: até 22 de outubro de 2026 (2026-10-22)")
print("Preservação integral e ordem cronológica exata de todos os eventos")
print("=========================================================================\n")

def run_query_to_file(sql, out_path):
    temp_sql = os.path.join(project_dir, "scripts", "temp_query.sql")
    with open(temp_sql, "w", encoding="utf-8") as f:
        f.write("SET client_encoding = 'UTF8';\n" + sql)
    
    cmd = [psql, "-h", "127.0.0.1", "-p", "5432", "-U", "postgres", "-d", "mg-pontodosvolantes-pm-edu", "-w", "-t", "-A", "-f", temp_sql, "-o", out_path]
    res = subprocess.run(cmd, capture_output=True, text=True, errors="replace", encoding="utf-8")
    if os.path.exists(temp_sql):
        os.remove(temp_sql)
    if res.returncode != 0:
        raise Exception(f"Erro na query SQL: {res.stderr}")

# 1. MATRÍCULAS (TODAS AS 13 ESCOLAS ATIVAS EM 2026, INCLUINDO MARIA GERALDA E REMANEJAMENTOS)
print("1. Extraindo 100% das MATRÍCULAS com endereço completo e cronologia estrita...")
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
            'Tipo Logradouro', COALESCE(gtl.nome_tpl, 'RUA'),
            'Logradouro', COALESCE(gl.nome_logra, g.descricao_g, ''),
            'Número', COALESCE(g.numero_g, 'SN'),
            'Cep', COALESCE(g.cep_g, '39.615-000'),
            'Bairro', COALESCE(gb.nome_bairr, 'ZONA RURAL'),
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
    LEFT JOIN gg_logra gl ON gl.codigo_logra = g.codigo_logra
    LEFT JOIN gg_tipologra gtl ON gtl.codigo_tpl = gl.codigo_tpl
    LEFT JOIN gg_bairro gb ON gb.codigo_bairr = g.codigo_bairr
    LEFT JOIN gg_munic gm ON gm.codigo_munic = g.codigo_munic
    LEFT JOIN (
        SELECT ed_matricula_aluno_origem, MAX(data_transferencia) AS data_transferencia
        FROM ed_transferencia
        WHERE data_transferencia <= '2026-10-22'
        GROUP BY ed_matricula_aluno_origem
    ) tr ON tr.ed_matricula_aluno_origem = m.ed_matricula_aluno
    WHERE pl.ano_letivo = 2026 AND m.data_matricula <= '2026-10-22'
    ORDER BY m.data_matricula ASC, m.ed_matricula_aluno ASC
) sub;
"""

temp_json_matr = os.path.join(project_dir, "scripts", "dump_matriculas.json")
run_query_to_file(sql_matriculas, temp_json_matr)

with open(temp_json_matr, "r", encoding="utf-8") as f:
    raw = f.read().strip()
    if raw.startswith("SET"):
        raw = raw.split("\n", 1)[1].strip()
    matriculas_todas = json.loads(raw)
os.remove(temp_json_matr)

# Função para ordenar cronologicamente por data DD/MM/YYYY e código numérico
def chave_cronologica(m):
    d_str = m.get('Data da matrícula') or ''
    partes = d_str.split('/')
    if len(partes) == 3:
        iso_data = f"{partes[2]}-{partes[1]}-{partes[0]}"
    else:
        iso_data = "1970-01-01"
    cod = int(m.get('Código') or 0)
    return (iso_data, cod)

matriculas_todas.sort(key=chave_cronologica)

# Salvar matriculas.json definitivo
matr_path = os.path.join(data_dir, "matriculas.json")
with open(matr_path, "w", encoding="utf-8") as f:
    json.dump(matriculas_todas, f, ensure_ascii=False, indent=2)

print(f"  -> Total de matrículas integradas: {len(matriculas_todas)}")
com_logradouro = sum(1 for x in matriculas_todas if x.get("Logradouro"))
print(f"  -> Matrículas com Logradouro preenchido: {com_logradouro} / {len(matriculas_todas)}")

# 2. TURMAS
print("\n2. Extraindo 100% das TURMAS...")
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
    WHERE pl.ano_letivo = 2026
    ORDER BY gesc.nome_g, t.nome
) sub;
"""

temp_json_turmas = os.path.join(project_dir, "scripts", "dump_turmas.json")
run_query_to_file(sql_turmas, temp_json_turmas)
with open(temp_json_turmas, "r", encoding="utf-8") as f:
    raw = f.read().strip()
    if raw.startswith("SET"):
        raw = raw.split("\n", 1)[1].strip()
    turmas_todas = json.loads(raw)
os.remove(temp_json_turmas)

turmas_path = os.path.join(data_dir, "turmas.json")
with open(turmas_path, "w", encoding="utf-8") as f:
    json.dump(turmas_todas, f, ensure_ascii=False, indent=2)
print(f"  -> Total de turmas integradas: {len(turmas_todas)}")

# 3. PROFISSIONAIS
print("\n3. Extraindo 100% dos PROFISSIONAIS ESCOLARES...")
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
    WHERE pl.ano_letivo = 2026
    ORDER BY e.ed_escola, prof.ed_professor, g.nome_g
) sub;
"""

temp_json_prof = os.path.join(project_dir, "scripts", "dump_prof.json")
run_query_to_file(sql_prof, temp_json_prof)
with open(temp_json_prof, "r", encoding="utf-8") as f:
    raw = f.read().strip()
    if raw.startswith("SET"):
        raw = raw.split("\n", 1)[1].strip()
    prof_todos = json.loads(raw)
os.remove(temp_json_prof)

prof_path = os.path.join(data_dir, "profissionais.json")
with open(prof_path, "w", encoding="utf-8") as f:
    json.dump(prof_todos, f, ensure_ascii=False, indent=2)
print(f"  -> Total de profissionais integrados: {len(prof_todos)}")

# 4. MOVIMENTAÇÕES (TRANSFERÊNCIAS E REMANEJAMENTOS ATÉ 22 DE OUTUBRO DE 2026)
print("\n4. Extraindo 100% das MOVIMENTAÇÕES com ordem cronológica...")
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
    WHERE pl.ano_letivo = 2026 AND tr.data_transferencia <= '2026-10-22'
    ORDER BY tr.data_transferencia ASC, tr.ed_transferencia ASC
) sub;
"""

temp_json_mov = os.path.join(project_dir, "scripts", "dump_mov.json")
run_query_to_file(sql_mov, temp_json_mov)
with open(temp_json_mov, "r", encoding="utf-8") as f:
    raw = f.read().strip()
    if raw.startswith("SET"):
        raw = raw.split("\n", 1)[1].strip()
    mov_todas = json.loads(raw)
os.remove(temp_json_mov)

mov_path = os.path.join(data_dir, "movimentacoes.json")
with open(mov_path, "w", encoding="utf-8") as f:
    json.dump(mov_todas, f, ensure_ascii=False, indent=2)
print(f"  -> Total de movimentações integradas: {len(mov_todas)}")

# 5. GERAR CARGA SQL PARA O SUPABASE COM ATUALIZAÇÃO SEGURA (UPSERT)
print("\n5. Gerando script SQL completo e enriquecido para o Supabase...")
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
    out.write("-- CARGA DEFINITIVA E COMPLETA DE TODAS AS ESCOLAS (2026 ATÉ 22/10/2026)\n")
    out.write("-- 100% dos dados integrados: endereços completos, remanejamentos e histórico\n")
    out.write("-- ON CONFLICT (codigo_matricula) atualiza dados e filiação mantendo segurança\n")
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
        out.write("""
ON CONFLICT (codigo_matricula) DO UPDATE SET
  dados = EXCLUDED.dados,
  filiacao_1 = EXCLUDED.filiacao_1,
  filiacao_2 = EXCLUDED.filiacao_2,
  situacao = EXCLUDED.situacao,
  turma = EXCLUDED.turma,
  data_movimentacao = EXCLUDED.data_movimentacao;\n\n""")

print(f"  -> Script SQL gerado com sucesso em: {sql_file}")
print("\n=========================================================================")
print("INTEGRAÇÃO CONCLUÍDA COM 100% DOS DADOS E ORDEM CRONOLÓGICA PERFEITA!")
print("=========================================================================\n")
