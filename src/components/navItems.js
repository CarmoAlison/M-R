import {
  ChartLine, CreditCard, Download, House, ListChecks, Menu, PiggyBank, Repeat, Scale, Settings, Target, Users,
} from 'lucide-react'

/** Barra inferior (celular): 4 itens + botão "+" no centro. */
export const BOTTOM_LEFT = [
  { to: '/', label: 'Início', icon: House, end: true },
  { to: '/lancamentos', label: 'Lançamentos', icon: ListChecks },
]
export const BOTTOM_RIGHT = [
  { to: '/relatorio', label: 'Relatório', icon: ChartLine },
  { to: '/mais', label: 'Mais', icon: Menu },
]

/** Menu lateral (computador), agrupado. */
export const SIDEBAR_GROUPS = [
  {
    title: null,
    items: [
      { to: '/', label: 'Início', icon: House, end: true },
      { to: '/lancamentos', label: 'Lançamentos', icon: ListChecks },
      { to: '/relatorio', label: 'Relatório', icon: ChartLine },
    ],
  },
  {
    title: 'Planejamento',
    items: [
      { to: '/objetivos', label: 'Objetivos', icon: PiggyBank },
      { to: '/metas', label: 'Metas', icon: Target },
      { to: '/recorrentes', label: 'Fixos e parcelas', icon: Repeat },
      { to: '/divisao', label: 'Divisão do casal', icon: Scale },
    ],
  },
  {
    title: 'Cadastros',
    items: [
      { to: '/contas', label: 'Contas e cartões', icon: CreditCard },
      { to: '/importar', label: 'Importar extrato', icon: Download },
    ],
  },
  {
    title: 'Casa',
    items: [
      { to: '/familia', label: 'Família', icon: Users },
      { to: '/config', label: 'Configurações', icon: Settings },
    ],
  },
]
