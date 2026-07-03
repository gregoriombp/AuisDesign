// Fixture do feed de notificações — substituir por endpoint real quando o
// backend expor o feed. Itens em ordem do mais recente para o mais antigo.

export type NotificationKind =
  | "billing"
  | "agent"
  | "team"
  | "security"
  | "system";

/** Rótulo legível da categoria, para o cabeçalho do detalhe e os filtros. */
export const KIND_LABEL: Record<NotificationKind, string> = {
  billing: "Cobrança",
  agent: "Agentes",
  team: "Equipe",
  security: "Segurança",
  system: "Sistema",
};

export type AppNotification = {
  id: string;
  kind: NotificationKind;
  title: string;
  description: string;
  /** Rótulo de tempo já formatado em pt-BR. */
  timeLabel: string;
  /** Rota aberta ao clicar na notificação. Ausente = item informativo. */
  href?: string;
  /** Eventos que exigem ação imediata — cobrança vencida, queda de número.
   * Quando não-lidos, sobem num aviso fixo no topo do inbox. */
  critical?: boolean;
  read: boolean;
};

export const NOTIFICATIONS: AppNotification[] = [
  {
    id: "n-waba-caiu",
    kind: "agent",
    title: "Número de WhatsApp desconectado",
    description:
      "O número +55 11 9 9999-0000 foi desconectado pela Meta e os agentes pararam de responder por WhatsApp. Reconecte para retomar o atendimento.",
    timeLabel: "há 12 minutos",
    href: "/canais",
    critical: true,
    read: false,
  },
  {
    id: "n-cobranca-falhou",
    kind: "billing",
    title: "Falha na cobrança da fatura INV-2026-03-0987",
    description:
      "O boleto de R$ 5.268,49 venceu sem pagamento. Regularize para não suspender os serviços.",
    timeLabel: "há 1 hora",
    href: "/settings/financeiro/historico-faturas",
    critical: true,
    read: false,
  },
  {
    id: "n-aria-aprovacao",
    kind: "agent",
    title: "Aria pediu aprovação para um disparo",
    description:
      "Autorize o envio de uma campanha para 1.245 contatos antes que a janela expire.",
    timeLabel: "há 3 horas",
    read: false,
  },
  {
    id: "n-marina-entrou",
    kind: "team",
    title: "Marina Alves entrou no workspace",
    description:
      "O convite foi aceito e ela já faz parte do grupo Atendimento.",
    timeLabel: "há 6 horas",
    href: "/settings/equipe-permissoes",
    read: false,
  },
  {
    id: "n-novo-acesso",
    kind: "security",
    title: "Novo acesso à sua conta",
    description:
      "Login pelo Chrome em São Paulo, BR. Não reconhece? Revise suas sessões.",
    timeLabel: "ontem · 21:14",
    href: "/settings/perfil/sessoes-ativas",
    read: true,
  },
  {
    id: "n-atlas-treinou",
    kind: "agent",
    title: "Atlas terminou de treinar",
    description:
      "A base de conhecimento foi reindexada e o agente já responde com o conteúdo novo.",
    timeLabel: "ontem · 14:02",
    read: true,
  },
  {
    id: "n-voucher-rapido",
    kind: "billing",
    title: "Voucher esgotando rápido",
    description:
      "O Bônus Black Friday Setup está sendo consumido 2,3× acima do previsto.",
    timeLabel: "16 mai · 09:30",
    href: "/settings/financeiro/saldo-creditos",
    read: true,
  },
  {
    id: "n-convite-expira",
    kind: "team",
    title: "Convite pendente expira amanhã",
    description:
      "O convite para joao@parceiro.com.br ainda não foi aceito e vence em 24h.",
    timeLabel: "15 mai · 11:20",
    href: "/settings/equipe-permissoes/convites",
    read: true,
  },
  {
    id: "n-manutencao",
    kind: "system",
    title: "Manutenção programada",
    description:
      "Os relatórios ficam indisponíveis no domingo, das 2h às 4h (GMT−03).",
    timeLabel: "13 mai · 17:00",
    read: true,
  },
];
