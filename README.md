# M&R Controle Financeiro — App Familiar (PWA)

App mobile-first, instalável, para a família controlar ganhos, gastos, cartões, metas e relatórios — com dados compartilhados em tempo real, modo offline, PIN e notificações push.

**Stack:** React 19 + Vite (JavaScript) · react-router-dom v6 · CSS puro com variáveis · gráficos em SVG próprio · Supabase (Auth, Postgres + RLS, Realtime, Edge Functions) · vite-plugin-pwa · lucide-react.

---

## 1. Rodar localmente

```bash
npm install
cp .env.example .env      # preencha as variáveis (veja abaixo)
npm run dev               # http://localhost:5173
```

Sem o `.env`, o app abre uma tela explicando o que falta configurar.

| Variável | Onde encontrar |
|---|---|
| `VITE_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → `anon` `public` |
| `VITE_VAPID_PUBLIC_KEY` | Chave **pública** VAPID (seção 4). Opcional: sem ela as notificações ficam desativadas |

> O service worker (offline, instalação, push) só é registrado no build de produção:
> `npm run build && npm run preview`.

### Prévia com dados de exemplo (sem Supabase)
Com `npm run dev` rodando, abra `http://localhost:5173/preview.html?rota=/relatorio&tema=dark`. As telas abrem com uma casa fictícia (`src/preview/mockData.js`), o que serve para conferir o layout no celular e no computador. Essa página não entra no build de produção.

## 2. Banco de dados (Supabase)

1. Crie um projeto em <https://supabase.com>.
2. Rode as migrations **em ordem**, por uma destas formas:
   - **SQL Editor:** cole e execute `supabase/migrations/20261124000001_schema.sql`, depois `..._rls.sql`, `..._functions.sql`, `..._grants.sql` (libera as tabelas para a API; sem ele aparece “Você não tem permissão”) e `..._avatars.sql` (bucket de fotos de perfil no Storage) e `..._goals_split_receipts.sql` (objetivos, divisão do casal, comprovantes e paleta suave).
   - **CLI:** `npx supabase login`, `npx supabase link --project-ref SEU_REF`, `npx supabase db push`.
3. Em **Authentication → URL Configuration**, coloque a URL do app em *Site URL* (ex.: `http://localhost:5173` e, depois, a de produção) e adicione `https://SEU-DOMINIO/nova-senha` em *Redirect URLs* (link de recuperação de senha).
4. (Opcional) Em **Authentication → Providers → Email**, desative “Confirm email” para testar mais rápido.

### O que as migrations criam
- **Tabelas:** `profiles`, `households`, `household_members`, `household_invites`, `accounts`, `credit_cards`, `categories`, `transactions`, `recurring_rules`, `budgets`, `push_subscriptions`, `notification_log`.
- **RLS em todas as tabelas.** `is_member(household_id)` libera leitura e escrita dos dados da casa a qualquer membro; `is_admin()` restringe a gestão de membros e convites.
- **Funções:** `create_household` (cria a casa, o admin e as categorias padrão), `accept_invite`, `my_invites`, `generate_recurring` (idempotente) e `month_summary`. Há ainda as views `monthly_totals` e `category_monthly_totals` e um gatilho que calcula a fatura (`invoice_month`) de cada compra no cartão.
- **Índices:** `(household_id, date)`, por fatura de cartão, por parcelamento e um índice **único** `(recurring_id, mês)`, que impede gerar a mesma recorrência duas vezes.
- **Realtime** habilitado nas tabelas da casa.

## 3. Agendamentos (cron)

1. Em **Database → Extensions**, habilite `pg_cron` e `pg_net`.
2. Edite `supabase/cron.sql` (troque `<PROJECT_REF>` e `<CRON_SECRET>`) e rode no SQL Editor.
   - `generate-recurring-daily`: gera os fixos todo dia (o app também gera ao abrir).
   - `send-push-hourly`: chama a função de push de hora em hora; cada pessoa recebe no horário que escolheu.

## 4. Notificações push (VAPID + Edge Functions)

```bash
npx web-push generate-vapid-keys          # gera a chave pública e a privada

npx supabase secrets set \
  VAPID_PUBLIC_KEY=... \
  VAPID_PRIVATE_KEY=... \
  VAPID_SUBJECT=mailto:voce@exemplo.com \
  CRON_SECRET=uma-senha-longa-aleatoria

npx supabase functions deploy send-push --no-verify-jwt
npx supabase functions deploy generate-recurring --no-verify-jwt
```

Coloque a chave **pública** em `VITE_VAPID_PUBLIC_KEY` no `.env` (e nas variáveis do deploy).
As funções usam `--no-verify-jwt` porque validam o próprio `CRON_SECRET`.

**Testar o envio na hora** (ignora o horário escolhido):
```bash
curl -X POST "https://SEU_REF.supabase.co/functions/v1/send-push?force=1" -H "Authorization: Bearer SEU_CRON_SECRET"
```

**iPhone/iPad:** o Web Push só funciona com o app instalado na Tela de Início (iOS 16.4+). A tela de Configurações mostra esse aviso automaticamente.

## 5. Deploy na Vercel

O projeto já vem configurado (`vercel.json`): build do Vite, rotas da SPA redirecionadas para `index.html`, service worker sem cache (para as atualizações chegarem) e assets com cache longo.

1. Em <https://vercel.com/new>, importe o repositório do GitHub. O framework **Vite** é detectado sozinho; não precisa mudar build nem output.
2. Em **Settings → Environment Variables**, adicione (para *Production* e *Preview*):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_VAPID_PUBLIC_KEY` (opcional, para notificações)
3. Clique em **Deploy**. Se mudar alguma variável depois, faça **Redeploy**: elas entram no build.
4. No Supabase, em **Authentication → URL Configuration**:
   - *Site URL*: `https://SEU-APP.vercel.app` (ou seu domínio)
   - *Redirect URLs*: `https://SEU-APP.vercel.app/**`
5. Pronto. Cada `git push` na `main` publica uma nova versão, e o app avisa “Nova versão disponível”.

Outras hospedagens também funcionam (build `npm run build`, saída `dist`, redirecionar todas as rotas para `/index.html`, HTTPS obrigatório).

## 6. Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção (+ service worker e manifest) |
| `npm run preview` | Serve o build (para testar PWA, offline e push) |
| `npm run lint` | oxlint |
| `npm run icons` | Gera os ícones PWA e o favicon em `public/icons` a partir de `public/brand/logo-branca.png` |

---

## Etapas entregues e como testar cada uma

1. **Estrutura, tema, rotas e layout:** navegação inferior com 6 itens e o “+” central, que abre o lançamento rápido. Teste o tema em *Mais → Configurações → Aparência* (Claro/Escuro/Sistema) e a área segura do iPhone com o app instalado.
2. **SQL e cliente:** rode as migrations. Com dois usuários diferentes, confirme que um não vê os dados da casa do outro (RLS).
3. **Auth, onboarding e família:** crie uma conta. O onboarding pede a casa, a primeira conta e as categorias. Em *Família → Convidar*, gere um código; com outra conta, use *Tenho um código* ou abra o link `/familia?codigo=XXXX`. Lance algo num aparelho e veja aparecer no outro (Realtime).
4. **Ganhos, gastos, categorias e contas:** cadastre pelos formulários de `/ganhos` e `/gastos`. Deslize um item para a esquerda para editar ou excluir (há “Desfazer” no toast). Categorias ficam em *Configurações → Categorias*.
5. **Controle, metas, recorrentes e parcelamentos:** em `/controle`, teste busca, filtros, agrupamento por dia, comparação com o mês anterior e o toque no ícone para marcar como pago. Crie uma meta em `/metas` e lance gastos até passar de 80% e de 100%. Lance um gasto “Repetir todo mês” e um “Parcelado” em 10× e avance os meses. Edite uma parcela escolhendo “Esta e as próximas”.
6. **Cartões e faturas:** em `/contas`, crie um cartão (fechamento dia 5, por exemplo). Uma compra no dia 6 cai na fatura do mês seguinte. A compra no cartão não mexe no saldo da conta. Em *Pagar fatura*, a saída é lançada na conta e os itens ficam pagos.
7. **Dashboard, insights e relatório:** o Dashboard mostra o saldo animado, a rosca por categoria, metas em risco, vencimentos, faturas, insights e os últimos lançamentos. Em `/relatorio`, troque o período, toque no gráfico de linhas e exporte CSV ou PDF (impressão).
8. **PIN, push e offline:** defina um PIN em Configurações, feche e reabra o app. Após 5 erros vem um bloqueio temporário; “Esqueci o PIN” faz logout. Para o offline, use `npm run preview`, abra o app, ative o modo avião (ou DevTools → Offline) e lance um gasto: ele entra na fila e sincroniza ao reconectar.
9. **Polimento:** microanimações (respeitam `prefers-reduced-motion`), skeletons, estados vazios ilustrados, toasts com vibração leve.

---

## Versão 2 — redesign e novas funções

- **Visual:** tema claro por padrão (o escuro, em marrom médio, é opcional em Configurações). Fontes *Playfair Display* (títulos e valores, combinando com a logo) + *DM Sans* (texto), fundo off-white, cards brancos e paleta de categorias em tons da marca.
- **Navegação:** celular com 4 itens + “+” (Início, Lançamentos, Relatório, Mais); computador com menu lateral e conteúdo em colunas.
- **Lançamentos** (`/lancamentos`): junta Ganhos, Gastos e Controle, com lista ou **calendário**. Os endereços antigos (`/ganhos`, `/gastos`, `/controle`) redirecionam para ela.
- **Lançamento rápido:** o “+” abre um teclado de calculadora, com categoria, conta e data em chips e “Mais opções” (pago, repetir, parcelas, quem pagou, dividir, comprovante). No computador dá para digitar o valor direto no teclado.
- **Fechamento do mês:** resumo automático nos primeiros dias do mês, também disponível no Relatório.
- **Objetivos** (`/objetivos`): caixinhas com meta, prazo, “guardar/retirar” e histórico.
- **Divisão do casal** (`/divisao`): cada gasto tem “pago por” e “dividir com a casa”. O app mostra quem deve a quem e registra acertos.
- **Comprovantes:** foto ou PDF anexado ao lançamento (bucket privado `receipts`, visível só para membros da casa).
- **Importar extrato** (`/importar`): CSV ou OFX do banco ou do cartão, com categoria sugerida pela descrição e aviso de possíveis duplicados.

## Decisões e suposições

Quando algo não estava definido, escolhi a opção mais simples:

- **Nomes de colunas em inglês** (`amount`, `date`, `paid`…) para manter o código consistente; a interface é toda em pt-BR.
- **Navegação:** 6 itens (Início, Ganhos, Gastos, Controle, Relatório, Mais) com o “+” no centro, para ficar simétrico e incluir o menu “Mais” (o avatar no topo também leva a ele).
- **Competência x caixa:** os totais do mês contam o lançamento pela **data da compra**. Uma compra no cartão entra como gasto no mês em que foi feita, mas só sai da conta quando a fatura é paga. O pagamento da fatura (`kind = 'invoice_payment'`) reduz o saldo da conta e **não** conta como gasto de categoria, para não contar duas vezes.
- **Fatura:** compra até o dia de fechamento → fatura daquele mês; depois → mês seguinte. Vencimento: se o dia de vencimento for maior que o de fechamento, vence no mesmo mês; senão, no mês seguinte.
- **Parcelas:** o valor digitado é o **total**, dividido em centavos exatos (a 1ª parcela absorve a diferença). A parcela *i* recebe a data da compra + *i* meses e cai na fatura correspondente.
- **Recorrentes:** o lançamento digitado é a 1ª ocorrência. `generate_recurring` cria as próximas até o fim do mês seguinte, sempre como **pendentes**. `last_generated` impede recriar ocorrências excluídas, e o índice único impede duplicatas.
- **Saldo da conta** = saldo inicial + ganhos recebidos − gastos pagos (incluindo pagamentos de fatura).
- **Dados no cliente:** o app carrega todos os lançamentos da casa (paginado de 1000 em 1000) e calcula insights e relatórios no navegador. O volume de uma família é pequeno.
- **Offline:** os dados ficam em cache no `localStorage`. Mudanças feitas offline vão para uma fila (com IDs gerados no cliente) e são reenviadas em ordem ao reconectar. Se o servidor recusar uma operação (ex.: RLS), ela sai da fila e aparece um aviso.
- **Convites:** o Supabase não envia e-mail de convite sem service role, então o convite gera um **código + link** para compartilhar (Web Share / copiar). Um convite com e-mail só pode ser usado por esse e-mail, e a pessoa também o vê no onboarding. Sem e-mail, vale para qualquer pessoa com o código por 7 dias.
- **PIN:** PBKDF2-SHA256 (210 mil iterações) + salt aleatório, guardado só no `localStorage` do aparelho. Após 5 erros o bloqueio dura 30 s, dobrando a cada novo bloqueio (máx. 15 min). Logo após um login com senha o PIN não é pedido.
- **Push:** a Edge Function roda de hora em hora (para respeitar o horário escolhido) e grava em `notification_log` para não repetir o mesmo aviso.
- **Contraste AA:** a cor `--brand` (#A48374) com texto branco fica em 3,4:1. Por isso os botões preenchidos usam `--brand-fill` (#8F6E60, 4,6:1) e os textos da marca usam `--brand-strong`. A cor `--brand` original continua nos destaques, ícones, barras e no `theme_color`.
- **Fontes:** Playfair Display + DM Sans via Google Fonts, guardadas em cache pelo service worker.
- **Objetivos não mexem no saldo das contas:** a caixinha registra quanto foi separado. Se o dinheiro sair da conta corrente, lance também o gasto ou a transferência.
- **Divisão em partes iguais** entre os membros atuais da casa. Gastos marcados como pessoais ficam fora. Pagamentos de fatura não entram na divisão (as compras do cartão já entram). Os fixos gerados automaticamente contam como pagos por quem criou a regra.
- **Importação:** no cartão, valores positivos após o ajuste de sinal (pagamentos e estornos da fatura) vêm desmarcados. “Já lançado?” compara data + valor + conta/cartão.

## Estrutura

```
src/
  main.jsx, App.jsx, routes.jsx
  lib/        supabaseClient, dates, format, finance, insights, pin, push, offlineQueue, errors, csv
  context/    Auth, Household, Data (cache/offline/realtime), Theme, Lock, Month, Toast, Confirm, Install
  hooks/      useMonth, useLookups, useFinanceActions, useTxEditor
  components/ BottomNav, QuickAdd (+), MonthPicker, MoneyInput, CategoryPicker, TransactionItem,
              TransactionForm, DonutChart, BarChart, LineChart, ProgressBar, InsightCard, PinPad,
              LockScreen, Sheet, Toast, EmptyState, Skeleton, AnimatedNumber, ...
  pages/      Dashboard, Ganhos, Gastos, Controle, Relatorio, Contas, Metas, Recorrentes,
              Familia, Config, Mais, Login, Cadastro, RecuperarSenha, NovaSenha, Onboarding
  styles/     global.css (variáveis + primitivas), theme.css (escuro), animations.css
public/       brand/ (logo.png original e logo-branca.png), icons/ (PWA, gerados da logo), push-sw.js
supabase/     migrations/, functions/send-push, functions/generate-recurring, cron.sql
scripts/      gen-icons.mjs
```
