export type AccountType = "cliente" | "barbeiro" | "proprietario" | "admin";
export type AppointmentStatus = "agendado" | "confirmado" | "concluido" | "cancelado" | "nao_compareceu";
export type BusinessDay = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type PaymentStatus = "nao_exigido" | "pendente" | "informado" | "pago" | "dispensado";
export type WaitlistStatus = "aguardando" | "notificado" | "convertido" | "cancelado";
export type PublicBarber = Pick<Barber, "id" | "nome" | "horario_inicio" | "horario_fim" | "dias_trabalho">;
export type AvailableSlot = { horario: string; horario_fim: string; duracao: number };
export type PaymentMethod = "dinheiro" | "pix" | "debito" | "credito" | "online" | "outro";
export type FinancialEntryType = "receita" | "despesa" | "estorno";
export type FinancialEntryStatus = "pendente" | "pago" | "cancelado";
export type BrandIcon = "tesoura" | "coroa" | "barba" | "estrela" | "calendario" | "loja";

export type AdminMetrics = {
  unidades_total: number;
  unidades_ativas: number;
  profissionais: number;
  clientes: number;
  usuarios: number;
  agendamentos_hoje: number;
  receita_mes: number;
  sinais_pendentes: number;
  avaliacao_media: number;
  avaliacoes_total: number;
  erros_24h: number;
  exclusoes_pendentes: number;
};

export type AdminUnitSummary = {
  id: string;
  nome: string;
  slug: string;
  ativa: boolean;
  agendamento_publico: boolean;
  profissionais: number;
  agendamentos: number;
  receita_mes: number;
  avaliacao_media: number;
};

export type AdminDashboardSummary = {
  metricas: AdminMetrics;
  unidades: AdminUnitSummary[];
  gerado_em: string;
};

export type AdminUserDirectoryEntry = {
  id: string;
  nome: string;
  telefone: string | null;
  email: string;
  tipo: AccountType;
  created_at: string;
};

export type AdminClientDirectoryEntry = {
  id: number;
  nome: string;
  telefone: string;
  email: string | null;
  agendamentos: number;
  ultimo_atendimento: string | null;
  total_gasto: number;
  faltas: number;
  pontos_fidelidade: number;
};

type Relationship = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};

export interface Database {
  public: {
    Tables: {
      barbearias: {
        Row: { id: string; proprietario_id: string; nome: string; slug: string; endereco: string | null; telefone: string | null; logo_url: string | null; agendamento_publico: boolean; cancelamento_horas: number; sinal_percentual: number; pix_chave: string | null; pix_beneficiario: string | null; lembrete_email: boolean; lembrete_whatsapp: boolean; lembrete_push: boolean; bloquear_apos_faltas: number; dias_bloqueio: number; responsavel_legal: string | null; documento_legal: string | null; email_privacidade: string | null; prazo_retencao_meses: number; cor_primaria: string; cor_secundaria: string; icone: BrandIcon; antecedencia_minutos: number; intervalo_grade_minutos: number; horizonte_agendamento_dias: number; stripe_account_id: string | null; stripe_onboarding_status: "nao_conectado" | "pendente" | "ativo" | "restrito"; ativa: boolean; created_at: string; updated_at: string };
        Insert: { id?: string; proprietario_id: string; nome: string; slug: string; endereco?: string | null; telefone?: string | null; logo_url?: string | null; agendamento_publico?: boolean; cancelamento_horas?: number; sinal_percentual?: number; pix_chave?: string | null; pix_beneficiario?: string | null; lembrete_email?: boolean; lembrete_whatsapp?: boolean; lembrete_push?: boolean; bloquear_apos_faltas?: number; dias_bloqueio?: number; responsavel_legal?: string | null; documento_legal?: string | null; email_privacidade?: string | null; prazo_retencao_meses?: number; cor_primaria?: string; cor_secundaria?: string; icone?: BrandIcon; antecedencia_minutos?: number; intervalo_grade_minutos?: number; horizonte_agendamento_dias?: number; stripe_account_id?: string | null; stripe_onboarding_status?: "nao_conectado" | "pendente" | "ativo" | "restrito"; ativa?: boolean; created_at?: string; updated_at?: string };
        Update: { nome?: string; slug?: string; endereco?: string | null; telefone?: string | null; logo_url?: string | null; agendamento_publico?: boolean; cancelamento_horas?: number; sinal_percentual?: number; pix_chave?: string | null; pix_beneficiario?: string | null; lembrete_email?: boolean; lembrete_whatsapp?: boolean; lembrete_push?: boolean; bloquear_apos_faltas?: number; dias_bloqueio?: number; responsavel_legal?: string | null; documento_legal?: string | null; email_privacidade?: string | null; prazo_retencao_meses?: number; cor_primaria?: string; cor_secundaria?: string; icone?: BrandIcon; antecedencia_minutos?: number; intervalo_grade_minutos?: number; horizonte_agendamento_dias?: number; stripe_account_id?: string | null; stripe_onboarding_status?: "nao_conectado" | "pendente" | "ativo" | "restrito"; ativa?: boolean; updated_at?: string };
        Relationships: [Relationship];
      };
      configuracoes_plataforma: {
        Row: { id: true; nome_site: string; subtitulo: string; nome_direitos: string; email_suporte: string | null; aviso_global: string | null; modo_manutencao: boolean; taxa_plataforma_percentual: number; updated_at: string; updated_by: string | null };
        Insert: { id?: true; nome_site?: string; subtitulo?: string; nome_direitos?: string; email_suporte?: string | null; aviso_global?: string | null; modo_manutencao?: boolean; taxa_plataforma_percentual?: number; updated_at?: string; updated_by?: string | null };
        Update: { nome_site?: string; subtitulo?: string; nome_direitos?: string; email_suporte?: string | null; aviso_global?: string | null; modo_manutencao?: boolean; taxa_plataforma_percentual?: number; updated_at?: string; updated_by?: string | null };
        Relationships: [Relationship];
      };
      terminais_pagamento: {
        Row: { id: number; barbearia_id: string; apelido: string; provedor: string; identificador: string | null; aceita_debito: boolean; aceita_credito: boolean; aceita_aproximacao: boolean; ativa: boolean; created_at: string; updated_at: string };
        Insert: { id?: never; barbearia_id: string; apelido: string; provedor: string; identificador?: string | null; aceita_debito?: boolean; aceita_credito?: boolean; aceita_aproximacao?: boolean; ativa?: boolean; created_at?: string; updated_at?: string };
        Update: { apelido?: string; provedor?: string; identificador?: string | null; aceita_debito?: boolean; aceita_credito?: boolean; aceita_aproximacao?: boolean; ativa?: boolean; updated_at?: string };
        Relationships: [Relationship];
      };
      planos_mensais: {
        Row: { id: number; barbearia_id: string; nome: string; descricao: string | null; preco: number; atendimentos_inclusos: number; desconto_excedente: number; ativo: boolean; created_at: string; updated_at: string };
        Insert: { id?: never; barbearia_id: string; nome: string; descricao?: string | null; preco: number; atendimentos_inclusos?: number; desconto_excedente?: number; ativo?: boolean; created_at?: string; updated_at?: string };
        Update: { nome?: string; descricao?: string | null; preco?: number; atendimentos_inclusos?: number; desconto_excedente?: number; ativo?: boolean; updated_at?: string };
        Relationships: [Relationship];
      };
      assinaturas_clientes: {
        Row: { id: number; plano_id: number; cliente_id: number; status: "pendente" | "ativa" | "pausada" | "inadimplente" | "cancelada"; inicio_em: string; proxima_cobranca_em: string | null; atendimentos_usados: number; referencia_externa: string | null; created_at: string; updated_at: string };
        Insert: { id?: never; plano_id: number; cliente_id: number; status?: "pendente" | "ativa" | "pausada" | "inadimplente" | "cancelada"; inicio_em?: string; proxima_cobranca_em?: string | null; atendimentos_usados?: number; referencia_externa?: string | null; created_at?: string; updated_at?: string };
        Update: { status?: "pendente" | "ativa" | "pausada" | "inadimplente" | "cancelada"; proxima_cobranca_em?: string | null; atendimentos_usados?: number; referencia_externa?: string | null; updated_at?: string };
        Relationships: [Relationship, Relationship];
      };
      movimentacoes_financeiras: {
        Row: { id: number; barbearia_id: string; agendamento_id: number | null; tipo: FinancialEntryType; categoria: string; metodo: PaymentMethod; status: FinancialEntryStatus; valor_bruto: number; taxa: number; valor_liquido: number; descricao: string | null; referencia_externa: string | null; ocorrido_em: string; criado_por: string; created_at: string };
        Insert: { id?: never; barbearia_id: string; agendamento_id?: number | null; tipo: FinancialEntryType; categoria: string; metodo: PaymentMethod; status?: FinancialEntryStatus; valor_bruto: number; taxa?: number; descricao?: string | null; referencia_externa?: string | null; ocorrido_em?: string; criado_por: string; created_at?: string };
        Update: { categoria?: string; metodo?: PaymentMethod; status?: FinancialEntryStatus; valor_bruto?: number; taxa?: number; descricao?: string | null; referencia_externa?: string | null; ocorrido_em?: string };
        Relationships: [Relationship, Relationship, Relationship];
      };
      checkouts_pagamento: {
        Row: { id: string; barbearia_id: string; usuario_id: string; agendamento_id: number | null; plano_id: number | null; tipo: "sinal" | "servico" | "assinatura"; valor: number; moeda: string; status: "criado" | "pago" | "expirado" | "cancelado" | "falhou"; stripe_session_id: string; stripe_payment_intent_id: string | null; stripe_subscription_id: string | null; stripe_customer_id: string | null; livemode: boolean; expires_at: string | null; pago_em: string | null; created_at: string; updated_at: string };
        Insert: { id?: string; barbearia_id: string; usuario_id: string; agendamento_id?: number | null; plano_id?: number | null; tipo: "sinal" | "servico" | "assinatura"; valor: number; moeda?: string; status?: "criado" | "pago" | "expirado" | "cancelado" | "falhou"; stripe_session_id: string; stripe_payment_intent_id?: string | null; stripe_subscription_id?: string | null; stripe_customer_id?: string | null; livemode?: boolean; expires_at?: string | null; pago_em?: string | null; created_at?: string; updated_at?: string };
        Update: { status?: "criado" | "pago" | "expirado" | "cancelado" | "falhou"; stripe_payment_intent_id?: string | null; stripe_subscription_id?: string | null; stripe_customer_id?: string | null; expires_at?: string | null; pago_em?: string | null; updated_at?: string };
        Relationships: [Relationship, Relationship, Relationship, Relationship];
      };
      usuarios: {
        Row: { id: string; nome: string; telefone: string | null; tipo: AccountType; created_at: string; termos_aceitos_em: string | null; marketing_opt_in: boolean; lembretes_email: boolean; lembretes_whatsapp: boolean; lembretes_push: boolean };
        Insert: { id: string; nome: string; telefone?: string | null; tipo: AccountType; created_at?: string; termos_aceitos_em?: string | null; marketing_opt_in?: boolean; lembretes_email?: boolean; lembretes_whatsapp?: boolean; lembretes_push?: boolean };
        Update: { nome?: string; telefone?: string | null; tipo?: AccountType; termos_aceitos_em?: string | null; marketing_opt_in?: boolean; lembretes_email?: boolean; lembretes_whatsapp?: boolean; lembretes_push?: boolean };
        Relationships: [];
      };
      configuracoes_negocio: {
        Row: { id: true; nome: string; endereco: string | null; telefone: string | null; logo_url: string | null; updated_at: string; slug: string; agendamento_publico: boolean; cancelamento_horas: number; sinal_percentual: number; pix_chave: string | null; pix_beneficiario: string | null; lembrete_email: boolean; lembrete_whatsapp: boolean; lembrete_push: boolean; bloquear_apos_faltas: number; dias_bloqueio: number; responsavel_legal: string | null; documento_legal: string | null; email_privacidade: string | null; prazo_retencao_meses: number };
        Insert: { id?: true; nome?: string; endereco?: string | null; telefone?: string | null; logo_url?: string | null; slug?: string; agendamento_publico?: boolean; cancelamento_horas?: number; sinal_percentual?: number; pix_chave?: string | null; pix_beneficiario?: string | null; lembrete_email?: boolean; lembrete_whatsapp?: boolean; lembrete_push?: boolean; bloquear_apos_faltas?: number; dias_bloqueio?: number; responsavel_legal?: string | null; documento_legal?: string | null; email_privacidade?: string | null; prazo_retencao_meses?: number };
        Update: { nome?: string; endereco?: string | null; telefone?: string | null; logo_url?: string | null; updated_at?: string; slug?: string; agendamento_publico?: boolean; cancelamento_horas?: number; sinal_percentual?: number; pix_chave?: string | null; pix_beneficiario?: string | null; lembrete_email?: boolean; lembrete_whatsapp?: boolean; lembrete_push?: boolean; bloquear_apos_faltas?: number; dias_bloqueio?: number; responsavel_legal?: string | null; documento_legal?: string | null; email_privacidade?: string | null; prazo_retencao_meses?: number };
        Relationships: [];
      };
      feriados_negocio: {
        Row: { barbearia_id: string; data: string; descricao: string; criado_por: string; created_at: string };
        Insert: { barbearia_id: string; data: string; descricao: string; criado_por: string };
        Update: { data?: string; descricao?: string };
        Relationships: [Relationship];
      };
      bloqueios_agenda: {
        Row: { id: number; barbeiro_id: number; data_inicio: string; data_fim: string; hora_inicio: string | null; hora_fim: string | null; tipo: "pausa" | "folga" | "ferias"; motivo: string; created_at: string };
        Insert: { id?: never; barbeiro_id: number; data_inicio: string; data_fim: string; hora_inicio?: string | null; hora_fim?: string | null; tipo?: "pausa" | "folga" | "ferias"; motivo?: string };
        Update: { data_inicio?: string; data_fim?: string; hora_inicio?: string | null; hora_fim?: string | null; tipo?: "pausa" | "folga" | "ferias"; motivo?: string };
        Relationships: [Relationship];
      };
      barbeiros: {
        Row: { id: number; barbearia_id: string; nome: string; telefone: string | null; usuario_id: string; horario_inicio: string; horario_fim: string; horario_almoco_inicio: string | null; horario_almoco_fim: string | null; dias_trabalho: BusinessDay[]; ativo: boolean };
        Insert: { id?: never; barbearia_id: string; nome: string; telefone?: string | null; usuario_id: string; horario_inicio?: string; horario_fim?: string; horario_almoco_inicio?: string | null; horario_almoco_fim?: string | null; dias_trabalho?: BusinessDay[]; ativo?: boolean };
        Update: { nome?: string; telefone?: string | null; horario_inicio?: string; horario_fim?: string; horario_almoco_inicio?: string | null; horario_almoco_fim?: string | null; dias_trabalho?: BusinessDay[]; ativo?: boolean };
        Relationships: [Relationship];
      };
      clientes: {
        Row: { id: number; nome: string; telefone: string; email: string | null; usuario_id: string; faltas: number; bloqueado_ate: string | null; observacoes: string | null; pontos_fidelidade: number };
        Insert: { id?: never; nome: string; telefone: string; email?: string | null; usuario_id: string; faltas?: number; bloqueado_ate?: string | null; observacoes?: string | null; pontos_fidelidade?: number };
        Update: { nome?: string; telefone?: string; email?: string | null; faltas?: number; bloqueado_ate?: string | null; observacoes?: string | null; pontos_fidelidade?: number };
        Relationships: [Relationship];
      };
      clientes_barbearias: {
        Row: { barbearia_id: string; cliente_id: number; faltas: number; bloqueado_ate: string | null; pontos_fidelidade: number; created_at: string; updated_at: string };
        Insert: { barbearia_id: string; cliente_id: number; faltas?: number; bloqueado_ate?: string | null; pontos_fidelidade?: number; created_at?: string; updated_at?: string };
        Update: { faltas?: number; bloqueado_ate?: string | null; pontos_fidelidade?: number; updated_at?: string };
        Relationships: [Relationship, Relationship];
      };
      servicos: {
        Row: { id: number; nome: string; preco: number; duracao: number; barbeiro_id: number };
        Insert: { id?: never; nome: string; preco: number; duracao: number; barbeiro_id: number };
        Update: { nome?: string; preco?: number; duracao?: number };
        Relationships: [Relationship];
      };
      agendamentos: {
        Row: {
          id: number;
          data: string;
          horario: string;
          status: AppointmentStatus;
          cliente_id: number;
          barbeiro_id: number;
          servico_id: number;
          servico_nome: string | null;
          servico_preco: number | null;
          servico_duracao: number | null;
          barbeiro_nome: string | null;
          cliente_nome: string | null;
          cliente_telefone: string | null;
          created_at: string;
          cancelado_at: string | null;
          origem: "painel" | "link_publico";
          sinal_valor: number;
          sinal_status: PaymentStatus;
          pagamento_online_status: "nao_iniciado" | "processando" | "pago" | "estornado";
          cancelamento_tardio: boolean;
          public_token: string;
          pontos_creditados: boolean;
        };
        Insert: never;
        Update: { status?: AppointmentStatus; cancelado_at?: string | null; sinal_status?: PaymentStatus; pagamento_online_status?: "nao_iniciado" | "processando" | "pago" | "estornado"; pontos_creditados?: boolean };
        Relationships: [Relationship, Relationship, Relationship];
      };
      fila_espera: {
        Row: { id: number; cliente_id: number; barbeiro_id: number; servico_id: number; data: string; periodo: "manha" | "tarde" | "noite" | "qualquer"; status: WaitlistStatus; notificado_em: string | null; created_at: string };
        Insert: { id?: never; cliente_id: number; barbeiro_id: number; servico_id: number; data: string; periodo?: "manha" | "tarde" | "noite" | "qualquer"; status?: WaitlistStatus; notificado_em?: string | null };
        Update: { periodo?: "manha" | "tarde" | "noite" | "qualquer"; status?: WaitlistStatus; notificado_em?: string | null };
        Relationships: [Relationship, Relationship, Relationship];
      };
      notificacoes: {
        Row: { id: number; usuario_id: string | null; agendamento_id: number | null; canal: "email" | "whatsapp" | "push" | "in_app"; tipo: "confirmacao" | "lembrete_24h" | "lembrete_2h" | "status" | "fila_espera"; status: "pendente" | "processando" | "enviada" | "erro" | "ignorada"; agendado_para: string; tentativas: number; payload: Record<string, unknown>; ultimo_erro: string | null; enviada_em: string | null; lida_em: string | null; lease_id: string | null; lease_expires_at: string | null; created_at: string };
        Insert: { id?: never; usuario_id?: string | null; agendamento_id?: number | null; canal: "email" | "whatsapp" | "push" | "in_app"; tipo: "confirmacao" | "lembrete_24h" | "lembrete_2h" | "status" | "fila_espera"; status?: "pendente" | "processando" | "enviada" | "erro" | "ignorada"; agendado_para?: string; tentativas?: number; payload?: Record<string, unknown>; ultimo_erro?: string | null; enviada_em?: string | null; lida_em?: string | null; lease_id?: string | null; lease_expires_at?: string | null };
        Update: { status?: "pendente" | "processando" | "enviada" | "erro" | "ignorada"; tentativas?: number; payload?: Record<string, unknown>; ultimo_erro?: string | null; enviada_em?: string | null; lida_em?: string | null; lease_id?: string | null; lease_expires_at?: string | null };
        Relationships: [Relationship, Relationship];
      };
      booking_intents: {
        Row: { token: string; action: "book" | "waitlist"; barber_id: number; service_id: number; booking_date: string; booking_time: string | null; period: "manha" | "tarde" | "noite" | "qualquer"; customer_name: string; customer_phone: string; customer_email: string; terms_accepted: true; expires_at: string; consumed_at: string | null; created_at: string };
        Insert: { token?: string; action: "book" | "waitlist"; barber_id: number; service_id: number; booking_date: string; booking_time?: string | null; period?: "manha" | "tarde" | "noite" | "qualquer"; customer_name: string; customer_phone: string; customer_email: string; terms_accepted: true; expires_at?: string; consumed_at?: string | null; created_at?: string };
        Update: { consumed_at?: string | null; expires_at?: string };
        Relationships: [Relationship, Relationship];
      };
      api_rate_limits: {
        Row: { key_hash: string; window_started_at: string; requests: number; updated_at: string };
        Insert: { key_hash: string; window_started_at?: string; requests?: number; updated_at?: string };
        Update: { window_started_at?: string; requests?: number; updated_at?: string };
        Relationships: [];
      };
      avaliacoes: {
        Row: { id: number; agendamento_id: number; usuario_id: string; barbeiro_id: number; nota: number; comentario: string | null; qualidade: number | null; atendimento: number | null; pontualidade: number | null; recomendaria: boolean | null; created_at: string; updated_at: string };
        Insert: { id?: never; agendamento_id: number; usuario_id: string; barbeiro_id: number; nota: number; comentario?: string | null; qualidade?: number | null; atendimento?: number | null; pontualidade?: number | null; recomendaria?: boolean | null; created_at?: string; updated_at?: string };
        Update: { nota?: number; comentario?: string | null; qualidade?: number | null; atendimento?: number | null; pontualidade?: number | null; recomendaria?: boolean | null; updated_at?: string };
        Relationships: [Relationship, Relationship, Relationship];
      };
      push_subscriptions: {
        Row: { id: string; usuario_id: string; endpoint: string; p256dh: string; auth_key: string; user_agent: string | null; created_at: string; updated_at: string };
        Insert: { id?: string; usuario_id: string; endpoint: string; p256dh: string; auth_key: string; user_agent?: string | null; created_at?: string; updated_at?: string };
        Update: { p256dh?: string; auth_key?: string; user_agent?: string | null; updated_at?: string };
        Relationships: [Relationship];
      };
      telemetria_eventos: {
        Row: { id: number; usuario_id: string | null; tipo: "erro_cliente" | "erro_servidor" | "web_vital"; rota: string; mensagem: string; contexto: Record<string, unknown>; created_at: string };
        Insert: { id?: never; usuario_id?: string | null; tipo: "erro_cliente" | "erro_servidor" | "web_vital"; rota?: string; mensagem: string; contexto?: Record<string, unknown> };
        Update: { mensagem?: string; contexto?: Record<string, unknown> };
        Relationships: [Relationship];
      };
      solicitacoes_exclusao: {
        Row: { usuario_id: string; status: "pendente" | "processando" | "concluida" | "cancelada"; solicitada_em: string; processada_em: string | null };
        Insert: { usuario_id: string; status?: "pendente" | "processando" | "concluida" | "cancelada" };
        Update: { status?: "pendente" | "processando" | "concluida" | "cancelada"; processada_em?: string | null };
        Relationships: [Relationship];
      };
      admin_audit_logs: {
        Row: { id: number; admin_id: string; acao: string; entidade: string; entidade_id: string | null; detalhes: Record<string, unknown>; created_at: string };
        Insert: never;
        Update: never;
        Relationships: [Relationship];
      };
    };
    Views: Record<string, never>;
    Functions: {
      criar_agendamento: {
        Args: { p_barbeiro_id: number; p_servico_id: number; p_data: string; p_horario: string };
        Returns: Database["public"]["Tables"]["agendamentos"]["Row"];
      };
      criar_agendamento_com_origem: {
        Args: { p_barbeiro_id: number; p_servico_id: number; p_data: string; p_horario: string; p_origem?: "painel" | "link_publico" };
        Returns: Database["public"]["Tables"]["agendamentos"]["Row"];
      };
      buscar_horarios_disponiveis: {
        Args: { p_barbeiro_id: number; p_servico_id: number; p_data: string };
        Returns: AvailableSlot[];
      };
      atualizar_status_agendamento: {
        Args: { p_agendamento_id: number; p_status: AppointmentStatus };
        Returns: undefined;
      };
      cancelar_meu_agendamento: {
        Args: { p_agendamento_id: number };
        Returns: undefined;
      };
      listar_barbeiros_publicos: {
        Args: { p_barbearia_id: string };
        Returns: PublicBarber[];
      };
      listar_meus_agendamentos: {
        Args: { p_barbeiro_id: number };
        Returns: Database["public"]["Tables"]["agendamentos"]["Row"][];
      };
      listar_meus_agendamentos_barbearia: {
        Args: { p_barbearia_id: string; p_barbeiro_id: number };
        Returns: Database["public"]["Tables"]["agendamentos"]["Row"][];
      };
      criar_convite_barbeiro: {
        Args: { p_barbearia_id: string };
        Returns: string;
      };
      atualizar_meu_perfil: {
        Args: { p_nome: string; p_telefone: string };
        Returns: Database["public"]["Tables"]["usuarios"]["Row"];
      };
      confirmar_meu_agendamento: {
        Args: { p_agendamento_id: number };
        Returns: undefined;
      };
      criar_bloqueio_agenda: {
        Args: { p_barbeiro_id: number; p_data_inicio: string; p_data_fim: string; p_hora_inicio: string | null; p_hora_fim: string | null; p_tipo: "pausa" | "folga" | "ferias"; p_motivo: string };
        Returns: Database["public"]["Tables"]["bloqueios_agenda"]["Row"];
      };
      obter_catalogo_publico: {
        Args: { p_slug: string };
        Returns: PublicCatalog;
      };
      listar_minhas_barbearias: { Args: Record<string, never>; Returns: Database["public"]["Tables"]["barbearias"]["Row"][] };
      listar_barbearias_publicas: { Args: Record<string, never>; Returns: Pick<Database["public"]["Tables"]["barbearias"]["Row"], "id" | "nome" | "slug" | "endereco" | "telefone" | "logo_url">[] };
      obter_barbearia_autenticada: { Args: { p_barbearia_id: string }; Returns: Database["public"]["Tables"]["barbearias"]["Row"] | null };
      criar_barbearia: { Args: { p_nome: string; p_slug: string }; Returns: Database["public"]["Tables"]["barbearias"]["Row"] };
      marcar_notificacoes_lidas: { Args: { p_ids: number[] }; Returns: number };
      obter_status_cliente_barbearia: { Args: { p_barbearia_id: string }; Returns: { cliente_id: number; faltas: number; bloqueado_ate: string | null; pontos_fidelidade: number }[] };
      entrar_fila_espera: {
        Args: { p_barbeiro_id: number; p_servico_id: number; p_data: string; p_periodo?: "manha" | "tarde" | "noite" | "qualquer" };
        Returns: Database["public"]["Tables"]["fila_espera"]["Row"];
      };
      cancelar_fila_espera: { Args: { p_fila_id: number }; Returns: undefined };
      listar_fila_profissional: { Args: { p_barbeiro_id: number }; Returns: ProfessionalWaitlistEntry[] };
      informar_pagamento_sinal: { Args: { p_agendamento_id: number }; Returns: undefined };
      atualizar_sinal_agendamento: { Args: { p_agendamento_id: number; p_status: "pendente" | "informado" | "pago" | "dispensado" }; Returns: undefined };
      eh_admin_global: { Args: Record<string, never>; Returns: boolean };
      obter_resumo_admin: { Args: Record<string, never>; Returns: AdminDashboardSummary };
      listar_usuarios_admin: {
        Args: { p_busca?: string | null; p_tipo?: AccountType | null; p_limite?: number };
        Returns: AdminUserDirectoryEntry[];
      };
      listar_clientes_admin: {
        Args: { p_barbearia_id: string; p_busca?: string | null; p_limite?: number };
        Returns: AdminClientDirectoryEntry[];
      };
      admin_alterar_status_barbearia: {
        Args: { p_barbearia_id: string; p_ativa: boolean };
        Returns: Database["public"]["Tables"]["barbearias"]["Row"];
      };
      obter_configuracao_publica: { Args: Record<string, never>; Returns: PlatformPublicSettings };
      listar_estabelecimentos_publicos: { Args: Record<string, never>; Returns: PublicEstablishment[] };
      listar_planos_publicos: { Args: { p_slug: string }; Returns: PublicMonthlyPlan[] };
      admin_atualizar_tipo_usuario: { Args: { p_usuario_id: string; p_tipo: AccountType }; Returns: Database["public"]["Tables"]["usuarios"]["Row"] };
      admin_atribuir_proprietario_barbearia: { Args: { p_barbearia_id: string; p_proprietario_id: string }; Returns: Database["public"]["Tables"]["barbearias"]["Row"] };
      registrar_movimentacao_financeira: {
        Args: { p_barbearia_id: string; p_agendamento_id: number | null; p_tipo: FinancialEntryType; p_categoria: string; p_metodo: PaymentMethod; p_valor_bruto: number; p_taxa: number; p_status: FinancialEntryStatus; p_descricao: string | null };
        Returns: Database["public"]["Tables"]["movimentacoes_financeiras"]["Row"];
      };
      obter_resumo_financeiro: { Args: { p_barbearia_id: string; p_inicio: string; p_fim: string }; Returns: FinancialSummary };
      alterar_status_profissional: { Args: { p_barbeiro_id: number; p_ativo: boolean }; Returns: Database["public"]["Tables"]["barbeiros"]["Row"] };
      atualizar_preferencias_comunicacao: {
        Args: { p_email: boolean; p_whatsapp: boolean; p_push: boolean; p_marketing: boolean };
        Returns: Database["public"]["Tables"]["usuarios"]["Row"];
      };
      atualizar_configuracoes_avancadas: {
        Args: { p_slug: string; p_agendamento_publico: boolean; p_cancelamento_horas: number; p_sinal_percentual: number; p_pix_chave: string; p_pix_beneficiario: string; p_lembrete_email: boolean; p_lembrete_whatsapp: boolean; p_lembrete_push: boolean; p_bloquear_apos_faltas: number; p_dias_bloqueio: number };
        Returns: Database["public"]["Tables"]["configuracoes_negocio"]["Row"];
      };
      solicitar_exclusao_conta: { Args: Record<string, never>; Returns: Database["public"]["Tables"]["solicitacoes_exclusao"]["Row"] };
      consume_api_rate_limit: {
        Args: { p_key_hash: string; p_max_requests: number; p_window_seconds: number };
        Returns: boolean;
      };
      claim_due_notifications: {
        Args: { p_limit: number; p_lease_id: string; p_lease_seconds?: number };
        Returns: Database["public"]["Tables"]["notificacoes"]["Row"][];
      };
      atualizar_informacoes_legais: {
        Args: { p_responsavel_legal: string; p_documento_legal: string; p_email_privacidade: string; p_prazo_retencao_meses: number };
        Returns: Database["public"]["Tables"]["configuracoes_negocio"]["Row"];
      };
      obter_informacoes_legais_publicas: {
        Args: Record<string, never>;
        Returns: PublicLegalInformation | null;
      };
      obter_informacoes_legais_barbearia: {
        Args: { p_slug: string };
        Returns: PublicLegalInformation | null;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type UserProfile = Database["public"]["Tables"]["usuarios"]["Row"];
export type Barber = Database["public"]["Tables"]["barbeiros"]["Row"];
export type Service = Database["public"]["Tables"]["servicos"]["Row"];
export type Appointment = Database["public"]["Tables"]["agendamentos"]["Row"];
export type BusinessSettings = Database["public"]["Tables"]["configuracoes_negocio"]["Row"];
export type Barbershop = Database["public"]["Tables"]["barbearias"]["Row"];
export type BusinessHoliday = Database["public"]["Tables"]["feriados_negocio"]["Row"];
export type ScheduleBlock = Database["public"]["Tables"]["bloqueios_agenda"]["Row"];
export type WaitlistEntry = Database["public"]["Tables"]["fila_espera"]["Row"];
export type Notification = Database["public"]["Tables"]["notificacoes"]["Row"];
export type PushSubscriptionRow = Database["public"]["Tables"]["push_subscriptions"]["Row"];
export type PaymentTerminal = Database["public"]["Tables"]["terminais_pagamento"]["Row"];
export type MonthlyPlan = Database["public"]["Tables"]["planos_mensais"]["Row"];
export type ClientSubscription = Database["public"]["Tables"]["assinaturas_clientes"]["Row"];
export type FinancialEntry = Database["public"]["Tables"]["movimentacoes_financeiras"]["Row"];
export type PaymentCheckout = Database["public"]["Tables"]["checkouts_pagamento"]["Row"];

export type PublicBusiness = Pick<Barbershop, "id" | "nome" | "endereco" | "telefone" | "logo_url" | "slug" | "agendamento_publico" | "cancelamento_horas" | "sinal_percentual" | "pix_chave" | "pix_beneficiario" | "cor_primaria" | "cor_secundaria" | "icone" | "antecedencia_minutos" | "intervalo_grade_minutos" | "horizonte_agendamento_dias">;
export type PublicHoliday = Pick<BusinessHoliday, "data" | "descricao">;
export type PublicCatalog = { negocio: PublicBusiness | null; barbeiros: PublicBarber[]; servicos: Service[]; feriados: PublicHoliday[] };
export type ProfessionalWaitlistEntry = { id: number; data: string; periodo: string; status: string; cliente_nome: string; cliente_telefone: string; servico_nome: string; created_at: string };
export type PublicLegalInformation = Pick<BusinessSettings, "nome" | "responsavel_legal" | "documento_legal" | "email_privacidade" | "telefone" | "endereco" | "prazo_retencao_meses">;
export type PlatformPublicSettings = { nome_site: string; subtitulo: string; nome_direitos: string; email_suporte: string | null; aviso_global: string | null; modo_manutencao: boolean };
export type PublicEstablishment = Pick<Barbershop, "id" | "nome" | "slug" | "endereco" | "telefone" | "logo_url" | "cor_primaria" | "cor_secundaria" | "icone"> & { profissionais: number; avaliacao_media: number };
export type PublicMonthlyPlan = Pick<MonthlyPlan, "id" | "nome" | "descricao" | "preco" | "atendimentos_inclusos" | "desconto_excedente">;
export type FinancialSummary = { receitas: number; despesas: number; estornos: number; taxas: number; saldo: number; pendentes: number; movimentacoes: number };
