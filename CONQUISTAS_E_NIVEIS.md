# 🏆 Pigo — Guia de Níveis, Conquistas e Customização

Este documento lista **todos os níveis**, a **fórmula de progressão de XP**, todas as **108 conquistas** do sistema com seus IDs, nomes e metas, além do **guia visual para criação de imagens e ícones** de conquistas.

---

## 🎨 Tamanho Ideal e Especificações das Imagens de Conquistas

Quando você for criar ou encomendar imagens/badges ilustrados para as conquistas do Pigo:

| Propriedade | Especificação Recomendada | Por quê? |
| :--- | :--- | :--- |
| **Dimensão do Arquivo** | **256 × 256 px** (ou **512 × 512 px** em alta definição) | Garante nitidez cristalina em telas Retina/4K e não pesa na memória do app. |
| **Proporção** | **1:1 (Quadrada)** | Encaixa perfeitamente nos cards, badges e slots do aplicativo. |
| **Formato** | **PNG com fundo transparente** ou **WebP** | Permite que o brilho e o fundo em degradê do card da conquista apareçam atrás da arte. |
| **Margem de Segurança (Padding)** | **10% a 15% de respiro interno** | Evita que pontas de coroas, espadas ou troféus encostem na borda ao aplicar efeito de lente/vidro. |
| **Tamanhos de Exibição na Interface** | • **48 × 48 px** (Grade da Sala de Troféus)<br>• **64 × 64 px** (Card expandido de detalhes)<br>• **128 × 128 px** (Modal de Comemoração / Level-up) | O arquivo de 256px ou 512px cobre todos esses tamanhos com redução suave (sem serrilhamento). |

> 💡 **Onde o código lê as conquistas?**  
> O arquivo principal que gerencia o catálogo é:  
> [`electron/gamificationEngine.cjs`](file:///c:/Users/Pichau/Desktop/Financeiro/electron/gamificationEngine.cjs#L540-L750)  
> Para alterar o nome ou a descrição de qualquer conquista, basta editar o campo `name` ou `description` no array `getAchievementDefinitions()`.

---

## ⚡ Tabela de Fontes de XP no Pigo

| Ação do Usuário | Ganho de XP |
| :--- | :--- |
| **Importar Extrato OFX/CSV** | `+50 XP` por extrato |
| **Categorizar Lançamento** | `+2 XP` por transação |
| **Fechar o Mês no Azul (Receitas > Despesas)** | `+200 XP` no fechamento mensal |
| **Aporte na Reserva de Emergência** | `+50 XP` base (até `+250 XP` bônus dependendo do valor) |
| **Cumprir Teto de Orçamento no Mês** | `+50 XP` por categoria respeitada |
| **Pagar Fatura de Cartão em Dia** | `+80 XP` por fatura |
| **Check-in de Hábito Diário** | `+5 XP` por hábito marcado |
| **Dia Perfeito (100% dos Hábitos Concluídos)** | `+25 XP` bônus no dia |
| **Concluir Missão da Semana** | `+100` a `+150 XP` por missão |
| **Desbloquear Conquista Comum** | `+15 XP` |
| **Desbloquear Conquista Rara** | `+35 XP` |
| **Desbloquear Conquista Épica** | `+75 XP` |
| **Desbloquear Conquista Lendária** | `+150 XP` |

---

## 📈 Sistema de Níveis e Títulos

### Fórmula de Progressão
Para subir do nível $N$ para o nível $N+1$, o XP necessário é:
$$\text{XP para Próximo Nível} = 100 + 50 \times (N - 1)$$

### Títulos por Faixa de Nível

| Faixa de Nível | Título Oficial |
| :---: | :--- |
| **Nível 1 a 2** | 🐷 Porquinho Curioso |
| **Nível 3 a 5** | 🪙 Poupador Aprendiz |
| **Nível 6 a 9** | 🛡️ Guardião do Cofre |
| **Nível 10 a 14** | 📊 Estrategista Financeiro |
| **Nível 15 a 19** | 💎 Investidor Disciplinado |
| **Nível 20 a 29** | 👑 Mestre das Finanças |
| **Nível 30+** | 🌟 Lenda do Pigo |

### Tabela Progressiva dos Primeiros 30 Níveis

| Nível | Título | XP do Nível | XP Total Acumulado |
| :---: | :--- | :---: | :---: |
| **1** | Porquinho Curioso | 100 XP | 0 XP |
| **2** | Porquinho Curioso | 150 XP | 100 XP |
| **3** | Poupador Aprendiz | 200 XP | 250 XP |
| **4** | Poupador Aprendiz | 250 XP | 450 XP |
| **5** | Poupador Aprendiz | 300 XP | 700 XP |
| **6** | Guardião do Cofre | 350 XP | 1.000 XP |
| **7** | Guardião do Cofre | 400 XP | 1.350 XP |
| **8** | Guardião do Cofre | 450 XP | 1.750 XP |
| **9** | Guardião do Cofre | 500 XP | 2.200 XP |
| **10** | Estrategista Financeiro | 550 XP | 2.700 XP |
| **11** | Estrategista Financeiro | 600 XP | 3.250 XP |
| **12** | Estrategista Financeiro | 650 XP | 3.850 XP |
| **13** | Estrategista Financeiro | 700 XP | 4.500 XP |
| **14** | Estrategista Financeiro | 750 XP | 5.200 XP |
| **15** | Investidor Disciplinado | 800 XP | 5.950 XP |
| **16** | Investidor Disciplinado | 850 XP | 6.750 XP |
| **17** | Investidor Disciplinado | 900 XP | 7.600 XP |
| **18** | Investidor Disciplinado | 950 XP | 8.500 XP |
| **19** | Investidor Disciplinado | 1.000 XP | 9.450 XP |
| **20** | Mestre das Finanças | 1.050 XP | 10.450 XP |
| **21** | Mestre das Finanças | 1.100 XP | 11.500 XP |
| **22** | Mestre das Finanças | 1.150 XP | 12.600 XP |
| **23** | Mestre das Finanças | 1.200 XP | 13.750 XP |
| **24** | Mestre das Finanças | 1.250 XP | 14.950 XP |
| **25** | Mestre das Finanças | 1.300 XP | 16.200 XP |
| **26** | Mestre das Finanças | 1.350 XP | 17.500 XP |
| **27** | Mestre das Finanças | 1.400 XP | 18.850 XP |
| **28** | Mestre das Finanças | 1.450 XP | 20.250 XP |
| **29** | Mestre das Finanças | 1.500 XP | 21.700 XP |
| **30** | Lenda do Pigo | 1.550 XP | 23.200 XP |

---

## 🏛️ Catálogo Completo das 108 Conquistas

### 1. Extratos e Importações Bancárias (`imports`)

| ID | Nome | Descrição | Raridade | XP | Meta |
| :--- | :--- | :--- | :---: | :---: | :---: |
| `primeiro_extrato` | Primeiro Extrato | Importe seu primeiro extrato OFX/CSV. | Comum | 15 | 1 |
| `extratos_3` | Iniciando a Jornada | Importe 3 extratos bancários. | Comum | 15 | 3 |
| `extratos_5` | Colecionador de Extratos | Importe 5 extratos bancários. | Comum | 15 | 5 |
| `extratos_10` | Arquivista | Importe 10 extratos. | Raro | 35 | 10 |
| `extratos_25` | Historiador Financeiro | Importe 25 extratos. | Raro | 35 | 25 |
| `extratos_50` | Guardião do Histórico | Importe 50 extratos. | Épico | 75 | 50 |
| `extratos_100` | Biblioteca Central | Importe 100 extratos. | Lendário | 150 | 100 |
| `semanas_2` | Ritmo Semanal | 2 semanas seguidas importando extratos. | Comum | 15 | 2 |
| `semanas_4` | Disciplina de Ferro | 4 semanas seguidas importando extratos. | Raro | 35 | 4 |
| `semanas_8` | Hábito Inquebrável | 8 semanas seguidas importando extratos. | Raro | 35 | 8 |
| `semanas_12` | Relógio Suíço | 12 semanas seguidas importando extratos. | Épico | 75 | 12 |
| `semanas_24` | Pontualidade Suprema | 24 semanas seguidas com importações ativas. | Lendário | 150 | 24 |

---

### 2. Categorização e Caixa de Entrada Zero (`categorization`)

| ID | Nome | Descrição | Raridade | XP | Meta |
| :--- | :--- | :--- | :---: | :---: | :---: |
| `categorizador_10` | Primeiros Lançamentos | Tenha 10 lançamentos categorizados. | Comum | 15 | 10 |
| `categorizador_50` | Aprendiz da Classificação | Tenha 50 lançamentos categorizados. | Comum | 15 | 50 |
| `categorizador_100` | Organizador | Tenha 100 lançamentos categorizados. | Comum | 15 | 100 |
| `categorizador_250` | Mestre da Ordem | Tenha 250 lançamentos categorizados. | Raro | 35 | 250 |
| `categorizador_500` | Taxonomista | Tenha 500 lançamentos categorizados. | Raro | 35 | 500 |
| `categorizador_1000` | Big Data Pessoal | 1.000 lançamentos categorizados. | Épico | 75 | 1.000 |
| `categorizador_2000` | Professor do Pigo | 2.000 lançamentos categorizados treinando o app. | Épico | 75 | 2.000 |
| `categorizador_5000` | Oráculo das Contas | 5.000 lançamentos categorizados com maestria. | Lendário | 150 | 5.000 |
| `caixa_zero_20` | Mesa Organizada | Nenhum lançamento sem categoria (mínimo 20 transações). | Comum | 15 | 1 |
| `caixa_zero` | Caixa de Entrada Zero | Nenhum lançamento sem categoria (mínimo 50 lançamentos). | Raro | 35 | 1 |
| `caixa_zero_100` | Perfeccionismo Total | Nenhum lançamento sem categoria (mínimo 100 transações). | Épico | 75 | 1 |
| `caixa_zero_250` | Mestre da Limpeza | Nenhum lançamento sem categoria (mínimo 250 transações). | Lendário | 150 | 1 |

---

### 3. Meses no Azul & Consistência de Poupança (`positive_months`)

| ID | Nome | Descrição | Raridade | XP | Meta |
| :--- | :--- | :--- | :---: | :---: | :---: |
| `mes_azul` | No Azul | Feche um mês com resultado positivo. | Comum | 15 | 1 |
| `azul_2` | Caminho Seguro | 2 meses seguidos no azul. | Comum | 15 | 2 |
| `azul_3` | Trimestre Azul | 3 meses seguidos no azul. | Raro | 35 | 3 |
| `azul_6` | Semestre Impecável | 6 meses seguidos no azul. | Épico | 75 | 6 |
| `azul_9` | Nove Meses Invictos | 9 meses seguidos no azul. | Épico | 75 | 9 |
| `azul_12` | Ano de Ouro | 12 meses seguidos no azul. | Lendário | 150 | 12 |
| `azul_18` | Lenda da Consistência | 18 meses seguidos no azul. | Lendário | 150 | 18 |
| `total_meses_azul_3` | Três Vitórias | Acumule 3 meses no azul no histórico. | Comum | 15 | 3 |
| `total_meses_azul_6` | Meio Ano Vitorioso | Acumule 6 meses no azul no histórico. | Raro | 35 | 6 |
| `total_meses_azul_12` | Doze Meses Positivos | Acumule 12 meses no azul no histórico. | Épico | 75 | 12 |
| `total_meses_azul_24` | Dois Anos de Sucesso | Acumule 24 meses no azul no histórico. | Lendário | 150 | 24 |

---

### 4. Reserva de Emergência & Blindagem (`reserve`)

| ID | Nome | Descrição | Raridade | XP | Meta |
| :--- | :--- | :--- | :---: | :---: | :---: |
| `primeira_reserva` | Primeiro Tijolo | Faça seu primeiro aporte na reserva. | Comum | 15 | 1 |
| `aportes_3` | Hábito de Guardar | Faça 3 aportes na reserva de emergência. | Comum | 15 | 3 |
| `aportes_6` | Poupança Ativa | Faça 6 aportes na reserva de emergência. | Raro | 35 | 6 |
| `aportes_12` | Aportador Constante | Faça 12 aportes na reserva de emergência. | Raro | 35 | 12 |
| `aportes_24` | Muralha de Aportes | Faça 24 aportes na reserva de emergência. | Épico | 75 | 24 |
| `reserva_meio_mes` | Primeiro Fôlego | Reserva cobrindo metade (0.5) de um mês de custo de vida. | Comum | 15 | 0.5 |
| `reserva_1` | Um Mês de Paz | Reserva cobrindo 1 mês de custo de vida. | Raro | 35 | 1 |
| `reserva_2` | Duplo Escudo | Reserva cobrindo 2 meses de custo de vida. | Raro | 35 | 2 |
| `reserva_3` | Colchão Seguro | Reserva cobrindo 3 meses de custo de vida. | Épico | 75 | 3 |
| `reserva_6` | Escudo Blindado | Reserva cobrindo 6 meses de custo de vida. | Épico | 75 | 6 |
| `reserva_completa` | Fortaleza | Atinja a meta completa estabelecida para sua reserva. | Lendário | 150 | 1 |
| `contas_multiplas` | Visão Multi-Bancos | Cadastre 3 ou mais contas bancárias ou carteiras. | Comum | 15 | 3 |

---

### 5. Cartões de Crédito & Faturas (`invoices`)

| ID | Nome | Descrição | Raridade | XP | Meta |
| :--- | :--- | :--- | :---: | :---: | :---: |
| `fatura_1` | Primeira Fatura Paga | Pague sua primeira fatura de cartão em dia. | Comum | 15 | 1 |
| `fatura_3` | Pagador Pontual | Pague 3 faturas de cartão até o vencimento. | Comum | 15 | 3 |
| `fatura_6` | Cartão Sob Controle | Pague 6 faturas de cartão até o vencimento. | Raro | 35 | 6 |
| `fatura_12` | Crédito de Ouro | Pague 12 faturas até o vencimento. | Épico | 75 | 12 |
| `fatura_18` | Mestre dos Vencimentos | Pague 18 faturas até o vencimento. | Épico | 75 | 18 |
| `fatura_24` | Score Perfeito | Pague 24 faturas até o vencimento. | Lendário | 150 | 24 |

---

### 6. Tetos de Orçamento (`budgets`)

| ID | Nome | Descrição | Raridade | XP | Meta |
| :--- | :--- | :--- | :---: | :---: | :---: |
| `orcamento_1` | Primeiro Teto Cumprido | Cumpra seu primeiro teto de orçamento mensal. | Comum | 15 | 1 |
| `orcamento_3` | Disciplina Orçamentária | Cumpra 3 tetos de orçamento mensais. | Comum | 15 | 3 |
| `orcamento_5` | Dentro do Teto | Cumpra 5 tetos de orçamento mensais. | Raro | 35 | 5 |
| `orcamento_10` | Mestre do Orçamento | Cumpra 10 tetos de orçamento mensais. | Épico | 75 | 10 |
| `orcamento_15` | Guardião dos Gastos | Cumpra 15 tetos de orçamento mensais. | Épico | 75 | 15 |
| `orcamento_25` | Controle Absoluto | Cumpra 25 tetos de orçamento mensais. | Lendário | 150 | 25 |

---

### 7. Missões Semanais (`missions`)

| ID | Nome | Descrição | Raridade | XP | Meta |
| :--- | :--- | :--- | :---: | :---: | :---: |
| `missoes_1` | Primeira Missão | Conclua sua primeira missão semanal. | Comum | 15 | 1 |
| `missoes_3` | Desbravador de Desafios | Conclua 3 missões semanais. | Comum | 15 | 3 |
| `missoes_5` | Foco Semanal | Conclua 5 missões semanais. | Comum | 15 | 5 |
| `missoes_10` | Caçador de Missões | Conclua 10 missões semanais. | Raro | 35 | 10 |
| `missoes_25` | Veterano de Missões | Conclua 25 missões semanais. | Épico | 75 | 25 |
| `missoes_50` | Campeão do Pigo | Conclua 50 missões semanais. | Lendário | 150 | 50 |

---

### 8. Detecção Inteligente & Assinaturas (`intelligence`)

| ID | Nome | Descrição | Raridade | XP | Meta |
| :--- | :--- | :--- | :---: | :---: | :---: |
| `detetive_1` | Olho Clínico | O Pigo identificou 1 despesa recorrente nos seus lançamentos. | Comum | 15 | 1 |
| `detetive_3` | Radar de Assinaturas | 3 despesas recorrentes identificadas. | Comum | 15 | 3 |
| `detetive` | Detetive de Assinaturas | O Pigo identificou 5 despesas recorrentes nos seus extratos. | Raro | 35 | 5 |
| `detetive_10` | Inspetor Implacável | 10 despesas recorrentes mapeadas no sistema. | Épico | 75 | 10 |

---

### 9. Hábitos, Check-ins e Consistência (`habits`)

| ID | Nome | Descrição | Raridade | XP | Meta |
| :--- | :--- | :--- | :---: | :---: | :---: |
| `habito_primeiro` | O Começo de Tudo | Crie seu primeiro hábito diário no Pigo Hábitos. | Comum | 15 | 1 |
| `habito_diversidade_3` | Tríade Diária | Tenha 3 ou mais hábitos ativos na sua rotina. | Comum | 15 | 3 |
| `habito_diversidade_5` | Rotina Completa | Tenha 5 ou mais hábitos ativos na sua grade diária. | Raro | 35 | 5 |
| `habito_checkin_1` | Primeiro Check-in | Conclua seu primeiro hábito no dia. | Comum | 15 | 1 |
| `habito_checkin_7` | Semana de Hábitos | 7 check-ins de hábitos concluídos. | Comum | 15 | 7 |
| `habito_checkin_21` | Regra dos 21 Dias | 21 check-ins de hábitos acumulados. | Raro | 35 | 21 |
| `habito_checkin_50` | Mente Focada | 50 check-ins de hábitos completados. | Raro | 35 | 50 |
| `habito_checkin_100` | Centenário da Disciplina | 100 check-ins de hábitos completados. | Épico | 75 | 100 |
| `habito_checkin_250` | Mestre da Rotina | 250 check-ins de hábitos completados. | Lendário | 150 | 250 |
| `dia_perfeito_1` | Primeiro Dia Perfeito | Conclua 100% dos seus hábitos ativos em um mesmo dia. | Comum | 15 | 1 |
| `dia_perfeito_7` | Semana 100% Impecável | Alcance 7 Dias Perfeitos (100% dos hábitos concluídos). | Raro | 35 | 7 |
| `dia_perfeito_15` | Quinzena de Elite | Alcance 15 Dias Perfeitos cumprindo toda a grade. | Épico | 75 | 15 |
| `dia_perfeito_30` | Mês de Alta Performance | Alcance 30 Dias Perfeitos cumprindo todos os hábitos. | Lendário | 150 | 30 |
| `habito_streak_7` | Fogo Sagrado | Mantenha 7 dias consecutivos cumprindo hábitos. | Raro | 35 | 7 |
| `habito_streak_14` | Duas Semanas de Fogo | Mantenha 14 dias consecutivos cumprindo hábitos. | Raro | 35 | 14 |
| `habito_streak_21` | Inabalável | Mantenha 21 dias consecutivos cumprindo hábitos. | Épico | 75 | 21 |
| `habito_streak_30` | Trinta Dias de Aço | Mantenha 30 dias consecutivos cumprindo hábitos. | Épico | 75 | 30 |
| `habito_streak_60` | Disciplina Inabalável | Mantenha 60 dias consecutivos cumprindo hábitos. | Lendário | 150 | 60 |

---

### 10. Metas Financeiras (`goals`)

| ID | Nome | Descrição | Raridade | XP | Meta |
| :--- | :--- | :--- | :---: | :---: | :---: |
| `meta_criada` | Sonhador Estratégico | Crie sua primeira meta financeira no Pigo. | Comum | 15 | 1 |
| `meta_concluida_1` | Sonho Realizado | Atinja 100% de uma meta financeira. | Raro | 35 | 1 |
| `meta_concluida_3` | Conquistador de Sonhos | Atinja 100% em 3 metas financeiras. | Épico | 75 | 3 |
| `meta_concluida_5` | Arquiteto do Futuro | Atinja 100% em 5 metas financeiras. | Lendário | 150 | 5 |

---

### 11. Segundo Cérebro: Anotações & Ideias (`tools`)

| ID | Nome | Descrição | Raridade | XP | Meta |
| :--- | :--- | :--- | :---: | :---: | :---: |
| `nota_primeira` | Primeira Ideia no Papel | Crie sua primeira anotação nas Ferramentas do Pigo. | Comum | 15 | 1 |
| `nota_fixada` | Foco Prioritário | Fixe uma anotação importante no topo do seu quadro. | Comum | 15 | 1 |
| `notas_5` | Bloco de Ideias Ativo | Mantenha 5 anotações organizadas no Pigo. | Comum | 15 | 5 |
| `notas_15` | Segundo Cérebro | Construa uma base sólida com 15 anotações salvas. | Raro | 35 | 15 |
| `notas_30` | Enciclopédia Pessoal | Alcance 30 anotações salvas no seu Segundo Cérebro. | Épico | 75 | 30 |

---

### 12. Mapas Mentais & Estratégia Visual (`tools`)

| ID | Nome | Descrição | Raridade | XP | Meta |
| :--- | :--- | :--- | :---: | :---: | :---: |
| `mapa_primeiro` | Arquiteto de Ideias | Crie seu primeiro Mapa Mental interativo. | Comum | 15 | 1 |
| `mapa_ramificado_6` | Pensamento Ramificado | Construa um Mapa Mental com pelo menos 6 nós conectados. | Raro | 35 | 6 |
| `mapa_ramificado_12` | Teia Estratégica | Construa um Mapa Mental complexo com 12 ou mais nós. | Épico | 75 | 12 |
| `mapas_3` | Estrategista Visual | Tenha 3 quadros de Mapas Mentais criados. | Raro | 35 | 3 |
| `mapas_5` | Mente Cartográfica | Mantenha 5 quadros de Mapas Mentais estruturados. | Épico | 75 | 5 |

---

### 13. Cofre de Senhas & Segurança Digital (`tools`)

| ID | Nome | Descrição | Raridade | XP | Meta |
| :--- | :--- | :--- | :---: | :---: | :---: |
| `cofre_primeira` | Cofre Blindado | Guarde sua primeira credencial criptografada no Cofre de Senhas. | Comum | 15 | 1 |
| `cofre_5` | Chaveiro Seguro | Proteja 5 senhas no Cofre Criptografado do Pigo. | Comum | 15 | 5 |
| `cofre_15` | Guardião Digital | Proteja 15 credenciais no Cofre de Senhas. | Raro | 35 | 15 |
| `cofre_30` | Fortaleza Criptografada | Mantenha 30 senhas protegidas com criptografia AES-256. | Épico | 75 | 30 |

---

### 14. Domínio Completo da Plataforma (`tools`)

| ID | Nome | Descrição | Raridade | XP | Meta |
| :--- | :--- | :--- | :---: | :---: | :---: |
| `mestre_4_pilares` | Mestre dos 4 Pilares | Use ativamente Finanças, Hábitos, Notas/Mapas e Cofre de Senhas no Pigo! | Lendário | 150 | 4 |

---

## 🛠️ Como Adicionar Novas Conquistas ou Mudar Nomes no Código

1. Abra o arquivo [`electron/gamificationEngine.cjs`](file:///c:/Users/Pichau/Desktop/Financeiro/electron/gamificationEngine.cjs#L540).
2. Procure pela função `getAchievementDefinitions()`.
3. Para **mudar o nome** de uma conquista existente, basta trocar o valor da propriedade `name: 'Novo Nome Aqui'`.
4. Para **mudar a descrição**, edite `description: 'Nova descrição...'`.
5. Para **criar uma nova conquista**, adicione um novo objeto no array seguindo este padrão:

```javascript
{
  id: 'meu_novo_id_unico',
  name: 'Nome da Conquista',
  description: 'Explicação clara do objetivo a ser alcançado.',
  rarity: 'comum', // 'comum' (15 XP) | 'raro' (35 XP) | 'epico' (75 XP) | 'lendario' (150 XP)
  icon: 'Trophy',   // Ícone Lucide padrão (ou imagem customizada)
  category: 'tools',// imports | categorization | positive_months | reserve | invoices | budgets | missions | intelligence | habits | goals | tools
  metric: 'notesCount', // Nome da métrica calculada em collectFacts
  target: 10        // Quantidade necessária para desbloquear
}
```
