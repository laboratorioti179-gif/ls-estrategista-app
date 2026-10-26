import { createClient } from 'npm:@supabase/supabase-js@2';
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const respond = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const PROFILE = 'jonathan_ceo_ls';
Deno.serve(async (req) => {
 if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
 if (req.method !== 'POST') return respond({ error: 'Método não permitido' }, 405);
 try {
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return respond({ error: 'Sessão necessária' }, 401);
  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) return respond({ error: 'Sessão inválida' }, 401);
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: member, error: memberError } = await admin.from('ai_app_members').select('profile_key').eq('user_id', user.id).eq('profile_key', PROFILE).maybeSingle();
  if (memberError) throw memberError;
  if (!member) return respond({ error: 'Seu usuário ainda não foi autorizado para este perfil. Solicite associação em ai_app_members.' }, 403);
  const body = await req.json().catch(() => ({}));
  if (body.operation === 'dashboard') {
   const selections = [
    admin.from('ai_app_events').select('id,event_type,message,actions_json,created_at').eq('profile_key', PROFILE).order('created_at', { ascending: false }).limit(100),
    admin.from('ai_content_plan').select('*').eq('profile_key', PROFILE).order('created_at', { ascending: false }).limit(100),
    admin.from('ai_content_items').select('*').eq('profile_key', PROFILE).order('sequence_order', { ascending: true }).limit(400),
    admin.from('ai_daily_context').select('*').eq('profile_key', PROFILE).order('created_at', { ascending: false }).limit(40),
   ];
   const [events, plans, items, context] = await Promise.all(selections);
   for (const r of [events, plans, items, context]) if (r.error) throw r.error;
   return respond({ events: events.data || [], plans: plans.data || [], items: items.data || [], context: context.data || [] });
  }
  if (body.operation === 'command') {
   const allowed = ['CONTEXTO','APROVAR','ALTERAR','REJEITAR','GERAR_CONTEUDO','GERAR_NOVO','USAR_EXISTENTE'];
   const action = String(body.action || '').toUpperCase();
   if (!allowed.includes(action)) return respond({ error: 'Ação não permitida' }, 400);
   const value = String(body.text || '').trim();
   const feedback = String(body.feedback || '').trim();
   if (action === 'CONTEXTO' && (!value || value.length > 5000)) return respond({ error: 'Escreva um contexto de até 5.000 caracteres.' }, 400);
   if ((action === 'ALTERAR' || action === 'REJEITAR') && (!feedback || feedback.length > 5000)) return respond({ error: 'Informe o motivo ou alteração (até 5.000 caracteres).' }, 400);
   if (body.plan_id) {
    const { data: plan, error } = await admin.from('ai_content_plan').select('id,status').eq('profile_key', PROFILE).eq('id', body.plan_id).maybeSingle();
    if (error) throw error;
    if (!plan) return respond({ error: 'Plano não encontrado' }, 404);
    if (['APROVAR','ALTERAR','REJEITAR'].includes(action) && plan.status !== 'pending_approval') return respond({ error: 'Este plano não está pendente de aprovação.' }, 409);
    // O workflow existente ainda escolhe o plano pendente mais recente. Não aceita-se seleção ambígua.
    if (['APROVAR','ALTERAR','REJEITAR'].includes(action)) {
     const { data: newest } = await admin.from('ai_content_plan').select('id').eq('profile_key',PROFILE).eq('status','pending_approval').order('created_at',{ascending:false}).limit(1).maybeSingle();
     if (newest?.id !== plan.id) return respond({ error: 'O fluxo n8n atual opera sobre o plano pendente mais recente. Abra esse plano para decidir.' }, 409);
    }
   }
   const endpoint = Deno.env.get('N8N_APP_WEBHOOK_URL');
   const headerName = Deno.env.get('N8N_APP_WEBHOOK_HEADER_NAME');
   const headerValue = Deno.env.get('N8N_APP_WEBHOOK_HEADER_VALUE');
   if (!endpoint || !headerName || !headerValue) return respond({ error: 'Configure N8N_APP_WEBHOOK_URL, N8N_APP_WEBHOOK_HEADER_NAME e N8N_APP_WEBHOOK_HEADER_VALUE nos segredos da Edge Function.' }, 503);
   const upstream = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', [headerName]: headerValue }, body: JSON.stringify({ profile_key: PROFILE, action, text: value, feedback, plan_id: body.plan_id || null, user_id: user.id, source: 'ls_estrategista_app' }), signal: AbortSignal.timeout(20000) });
   if (!upstream.ok) return respond({ error: `O n8n recusou o comando (HTTP ${upstream.status}).` }, 502);
   return respond({ received: true, action });
  }
  return respond({ error: 'Operação desconhecida' }, 400);
 } catch (error) {
  console.error(error);
  return respond({ error: error instanceof Error ? error.message : 'Erro interno' }, 500);
 }
});
