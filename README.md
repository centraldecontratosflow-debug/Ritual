# Dashboard Ritual

Dashboard estático com cinco visões: Central de Contratos, Backlog, Auditoria TS, Vendas e Analítico de Vendas. A interface mantém as cores e a estrutura do painel original. Os dados são uma fotografia da planilha enviada em 06/11/2026, sem dependência do antigo Apps Script e sem fallback de demonstração.

## Atualizar os dados

Com Python e `openpyxl` disponíveis, execute:

```bash
python scripts/extract_workbook.py /caminho/Dashboard_Backlog_Central_de_Contratos.xlsx
node scripts/verify_dashboard.cjs
```

Publique `index.html`, `app.js` e `data.json` na mesma pasta do GitHub Pages. Não publique a planilha original: `data.json` contém somente agregados por data, sala e categorias necessárias ao painel. Nomes de clientes, CPF, documentos, identificadores e observações livres são excluídos. O botão Atualizar recarrega o snapshot publicado; alterações no Excel exigem nova extração e publicação.

## Definições

| Visão | Fonte | Data utilizada | Unidade |
| --- | --- | --- | --- |
| Central | Dados_Central | DATAPROP | Linha/proposta |
| Backlog | Dados_Backlog | DATA DA SOLICITAÇÃO | Linha de solicitação |
| Auditoria TS | Dados_Auditoria TS | DATA | Registro de auditoria |
| Vendas | Dados_Vendas | DataProp | Linha/proposta |
| Analítico | Analítico de Vendas | DataProp | Linha/ChaveProposta |

Os filtros incluem as duas datas-limite e aplicam-se à aba ativa. Sem filtro, toda a cobertura da respectiva fonte é exibida. Registros sem data são incluídos somente sem filtro temporal. Cada aba informa sua cobertura e seus critérios na interface. Bases distintas não são somadas ou unidas.

Contagens preservam linhas preenchidas da fonte, sem deduplicação implícita. Na Auditoria TS, 891 linhas correspondem a 764 números de proposta distintos: os 127 registros adicionais são preservados. Os campos de prospect único da planilha não são utilizados para inferir auditorias únicas. O status de auditoria vazio é classificado como Pendente.

Na Central, o percentual de propostas vendidas é Vendida / Total de propostas. Não representa conversão comercial de atendimentos, pois a fonte contém apenas Vendida e Confirmada. No Backlog, grafias de tipos e status são normalizadas; o tipo Erros permanece identificado como Erros, e não como uma contagem da aba Auditoria TS. Restituído e VGV são as somas das respectivas colunas numéricas. Nos painéis de vendas, VGV e ticket usam somente linhas com StatusProp = Vendida; o ticket é VGV vendido / quantidade vendida.

O Analítico contém histórico de 2021 a 2026; Vendas e Central têm cobertura distinta. O filtro usa a data da proposta, mesmo quando DataVend está preenchida com outra data. Isso também vale para os gráficos mensais.

`data.json` registra a aba, os totais de controle, cobertura temporal, data da importação e SHA-256 da origem. O script de extração documenta o processamento reproduzível. Os testes verificam cálculos e ligações da interface sem navegador; a inspeção visual requer um navegador com acesso à prévia.
