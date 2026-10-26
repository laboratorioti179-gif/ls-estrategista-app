# LS | IA Estrategista — aplicação web

Painel React + Vite ligado ao Supabase, com autenticação, chat, estratégias, conteúdos, calendário e aprovação. A Edge Function validará o usuário associado ao perfil antes de consultar as tabelas ou enviar comandos ao n8n.

## 1. Supabase

1. Use **o mesmo projeto Supabase usado pelo workflow n8n** (`LS Content AI`), preservando as tabelas existentes: `ai_profile`, `ai_daily_context`, `ai_content_plan` e `ai_content_items`.
2. Execute `supabase/setup.sql` no SQL Editor. Se as policies já existirem, não rode o SQL novamente sem revisar (o comando `create policy` não usa `if not exists`).
3. Em **Authentication > Users**, crie o usuário da aplicação. Copie o UUID.
4. Execute no SQL Editor:

```sql
insert into public.ai_app_members(profile_key, user_id)
values ('jonathan_ceo_ls', 'COLE_O_UUID_DO_USUARIO_AQUI')
on conflict do nothing;
```

## 2. Edge Function segura

Requer Supabase CLI autenticado e projeto associado. Dentro da pasta do projeto:

```bash
supabase login
supabase link --project-ref SEU_PROJECT_REF
supabase functions deploy strategist-api
```

Em **Supabase > Edge Functions > Secrets**, configure os segredos abaixo (nunca no navegador):

```text
N8N_APP_WEBHOOK_URL=https://SEU-N8N/webhook/ls-estrategista-app
N8N_APP_WEBHOOK_HEADER_NAME=NOME_DO_HEADER_CONFIGURADO_NA_CREDENCIAL_HEADER_AUTH
N8N_APP_WEBHOOK_HEADER_VALUE=SEGREDO_DO_HEADER_AUTH
```

O `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` normalmente são disponibilizados automaticamente à função hospedada no Supabase. Mantenha **Verify JWT ativado** na função. Nunca use a service role no front-end.

## 3. n8n

1. Importe `LS_IA_Estrategista_Aplicacao_v1.json` como workflow separado (não substitua o fluxo em produção).
2. Confira as credenciais existentes do Supabase e OpenAI. O workflow importado pode exigir reatribuição.
3. No nó `APP | RECEBER COMANDO`, configure uma **credencial Header Auth** com o mesmo nome e valor configurados nos segredos da Edge Function.
4. Verifique que o endereço de produção termina em `/webhook/ls-estrategista-app` (use o endereço gerado pelo próprio n8n).
5. Ative o workflow apenas após executar testes.
6. O nó `INICIAR ESTRATÉGIA` ainda é um gatilho **manual**; o botão de geração via app usa o ramo de comandos existente `GERAR_CONTEUDO` / `GERAR_NOVO`. Valide separadamente esses dois comandos na sua instalação.

## 4. Aplicação React

Crie `.env` com base em `.env.example`, usando a **Project URL** e **publishable/anon key** do mesmo Supabase:

```bash
npm install
npm run dev
```

Acesse o endereço mostrado pelo Vite. Para gerar versão de produção:

```bash
npm run build
```

Na Vercel, importe o repositório, defina as duas variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`, escolha Vite (build `npm run build`, output `dist`). O `vercel.json` já permite rotas SPA.

## 5. Pontos de atenção

- A interface consulta o Supabase a cada **15 segundos**; mensagens não são exibidas instantaneamente por streaming.
- O webhook do n8n responde ao **recebimento**, não ao término da execução. Sucesso ao clicar significa comando aceito, não conteúdo produzido.
- A aprovação/alteração/rejeição no JSON atual trabalha sobre o **plano pendente mais recente**, não pelo `plan_id` fornecido. A Edge Function impede operação sobre outro plano quando informado, mas ainda é necessário corrigir o workflow para edição por ID caso você queira gerenciar múltiplos planos pendentes livremente.
- O frontend não permite acesso direto às tabelas editoriais; leituras são realizadas pela Edge Function após verificar `ai_app_members`.
- Acesso inicial é do perfil `jonathan_ceo_ls` apenas; para vários perfis, generalizar a autorização por perfil e separar dados.
- O SQL de base do n8n existente não foi refeito, pois o esquema completo e as políticas anteriores dessas tabelas não constam no arquivo original.
- A aparência está pronta, mas integração e funcionamento precisam ser verificados no seu ambiente antes de produção.
