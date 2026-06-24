# Setup do Supabase — Gestão Clínica LCR

Passo a passo para ligar o app ao backend Supabase.

## 1. Criar o projeto

1. Acesse https://supabase.com → **New project**.
2. Escolha a região mais próxima (ex.: **South America (São Paulo)**).
3. Defina uma senha forte para o banco (guarde — é a senha do Postgres).

## 2. Pegar as chaves

Em **Project Settings → API**, copie:
- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

> ⚠️ Use a **anon** key, nunca a `service_role`. A segurança vem das policies (RLS).

Crie `gestao/.env.local` (copie de `.env.local.example`) e preencha as duas variáveis.
Reinicie o `npm run dev` depois de criar/alterar o `.env.local`.

## 3. Rodar as migrations

No **SQL Editor** do Supabase, cole e rode **na ordem**:
1. `supabase/migrations/0001_init.sql` — cria tabelas, papéis, trigger de profile e RLS.
2. `supabase/migrations/0002_seed.sql` — *(opcional)* dados de exemplo. Pule se quiser começar limpo.

## 4. Criar usuários e definir papéis

1. **Authentication → Users → Add user** (email + senha). Desmarque "Send invite" se quiser senha direta.
2. O trigger cria automaticamente uma linha em `public.profiles` com papel padrão `secretaria`.
3. Para promover a Dra. a **admin** (ou dentista), rode no SQL Editor:
   ```sql
   update public.profiles set papel = 'admin', nome = 'Dra. Lara Camila'
   where id = (select id from auth.users where email = 'EMAIL_DA_DRA');
   ```
   Papéis disponíveis: `admin`, `dentista`, `secretaria`.

### Regras de acesso (RLS)
- **Pacientes, agenda, prontuário, anamnese, estoque:** todo usuário logado lê/cria/edita; **excluir** só `admin`/`dentista`.
- **Financeiro:** só `admin`/`dentista` (secretária não vê).

## 5. Testar

`npm --prefix gestao run dev` → abra o app, faça login com o usuário criado.
Crie um paciente e confira na tabela `pacientes` do dashboard Supabase.
