export type AccountType = "cliente" | "barbeiro";
export type AppointmentStatus = "agendado" | "confirmado" | "concluido" | "cancelado" | "nao_compareceu";
export type BusinessDay = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type PaymentStatus = "nao_exigido" | "pendente" | "informado" | "pago" | "dispensado";
export type WaitlistStatus = "aguardando" | "notificado" | "convertido" | "cancelado";
export type PublicBarber = Pick<Barber, "id" | "nome" | "horario_inicio" | "horario_fim" | "dias_trabalho">;

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
        Row: { data: string; descricao: string; criado_por: string; created_at: string };
        Insert: { data: string; descricao: string; criado_por: string };
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
        Row: { id: number; nome: string; telefone: string | null; usuario_id: string; horario_inicio: string; horario_fim: string; horario_almoco_inicio: string | null; horario_almoco_fim: string | null; dias_trabalho: BusinessDay[] };
        Insert: { id?: never; nome: string; telefone?: string | null; usuario_id: string; horario_inicio?: string; horario_fim?: string; horario_almoco_inicio?: string | null; horario_almoco_fim?: string | null; dias_trabalho?: BusinessDay[] };
        Update: { nome?: string; telefone?: string | null; horario_inicio?: string; horario_fim?: string; horario_almoco_inicio?: string | null; horario_almoco_fim?: string | null; dias_trabalho?: BusinessDay[] };
        Relationships: [Relationship];
      };
      clientes: {
        Row: { id: number; nome: string; telefone: string; email: string | null; usuario_id: string; faltas: number; bloqueado_ate: string | null; observacoes: string | null; pontos_fidelidade: number };
        Insert: { id?: never; nome: string; telefone: string; email?: string | null; usuario_id: string; faltas?: number; bloqueado_ate?: string | null; observacoes?: string | null; pontos_fidelidade?: number };
        Update: { nome?: string; telefone?: string; email?: string | null; faltas?: number; bloqueado_ate?: string | null; observacoes?: string | null; pontos_fidelidade?: number };
        Relationships: [Relationship];
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
          cancelamento_tardio: boolean;
          public_token: string;
          pontos_creditados: boolean;
        };
        Insert: never;
        Update: never;
        Relationships: [Relationship, Relationship, Relationship];
      };
      fila_espera: {
        Row: { id: number; cliente_id: number; barbeiro_id: number; servico_id: number; data: string; periodo: "manha" | "tarde" | "noite" | "qualquer"; status: WaitlistStatus; notificado_em: string | null; created_at: string };
        Insert: { id?: never; cliente_id: number; barbeiro_id: number; servico_id: number; data: string; periodo?: "manha" | "tarde" | "noite" | "qualquer"; status?: WaitlistStatus; notificado_em?: string | null };
        Update: { periodo?: "manha" | "tarde" | "noite" | "qualquer"; status?: WaitlistStatus; notificado_em?: string | null };
        Relationships: [Relationship, Relationship, Relationship];
      };
      notificacoes: {
        Row: { id: number; usuario_id: string | null; agendamento_id: number | null; canal: "email" | "whatsapp" | "push"; tipo: "confirmacao" | "lembrete_24h" | "lembrete_2h" | "status" | "fila_espera"; status: "pendente" | "processando" | "enviada" | "erro" | "ignorada"; agendado_para: string; tentativas: number; payload: Record<string, unknown>; ultimo_erro: string | null; enviada_em: string | null; lease_id: string | null; lease_expires_at: string | null; created_at: string };
        Insert: { id?: never; usuario_id?: string | null; agendamento_id?: number | null; canal: "email" | "whatsapp" | "push"; tipo: "confirmacao" | "lembrete_24h" | "lembrete_2h" | "status" | "fila_espera"; status?: "pendente" | "processando" | "enviada" | "erro" | "ignorada"; agendado_para?: string; tentativas?: number; payload?: Record<string, unknown>; ultimo_erro?: string | null; enviada_em?: string | null; lease_id?: string | null; lease_expires_at?: string | null };
        Update: { status?: "pendente" | "processando" | "enviada" | "erro" | "ignorada"; tentativas?: number; payload?: Record<string, unknown>; ultimo_erro?: string | null; enviada_em?: string | null; lease_id?: string | null; lease_expires_at?: string | null };
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
        Row: { id: number; agendamento_id: number; usuario_id: string; barbeiro_id: number; nota: number; comentario: string | null; created_at: string; updated_at: string };
        Insert: { id?: never; agendamento_id: number; usuario_id: string; barbeiro_id: number; nota: number; comentario?: string | null; created_at?: string; updated_at?: string };
        Update: { nota?: number; comentario?: string | null; updated_at?: string };
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
        Returns: { horario: string }[];
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
        Args: Record<string, never>;
        Returns: PublicBarber[];
      };
      listar_meus_agendamentos: {
        Args: Record<string, never>;
        Returns: Database["public"]["Tables"]["agendamentos"]["Row"][];
      };
      criar_convite_barbeiro: {
        Args: Record<string, never>;
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
        Args: { p_data_inicio: string; p_data_fim: string; p_hora_inicio: string | null; p_hora_fim: string | null; p_tipo: "pausa" | "folga" | "ferias"; p_motivo: string };
        Returns: Database["public"]["Tables"]["bloqueios_agenda"]["Row"];
      };
      obter_catalogo_publico: {
        Args: Record<string, never>;
        Returns: PublicCatalog;
      };
      entrar_fila_espera: {
        Args: { p_barbeiro_id: number; p_servico_id: number; p_data: string; p_periodo?: "manha" | "tarde" | "noite" | "qualquer" };
        Returns: Database["public"]["Tables"]["fila_espera"]["Row"];
      };
      cancelar_fila_espera: { Args: { p_fila_id: number }; Returns: undefined };
      listar_fila_profissional: { Args: Record<string, never>; Returns: ProfessionalWaitlistEntry[] };
      informar_pagamento_sinal: { Args: { p_agendamento_id: number }; Returns: undefined };
      atualizar_sinal_agendamento: { Args: { p_agendamento_id: number; p_status: "pendente" | "informado" | "pago" | "dispensado" }; Returns: undefined };
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
export type BusinessHoliday = Database["public"]["Tables"]["feriados_negocio"]["Row"];
export type ScheduleBlock = Database["public"]["Tables"]["bloqueios_agenda"]["Row"];
export type WaitlistEntry = Database["public"]["Tables"]["fila_espera"]["Row"];
export type Notification = Database["public"]["Tables"]["notificacoes"]["Row"];
export type PushSubscriptionRow = Database["public"]["Tables"]["push_subscriptions"]["Row"];

export type PublicBusiness = Pick<BusinessSettings, "nome" | "endereco" | "telefone" | "logo_url" | "slug" | "agendamento_publico" | "cancelamento_horas" | "sinal_percentual" | "pix_chave" | "pix_beneficiario">;
export type PublicHoliday = Pick<BusinessHoliday, "data" | "descricao">;
export type PublicCatalog = { negocio: PublicBusiness | null; barbeiros: PublicBarber[]; servicos: Service[]; feriados: PublicHoliday[] };
export type ProfessionalWaitlistEntry = { id: number; data: string; periodo: string; status: string; cliente_nome: string; cliente_telefone: string; servico_nome: string; created_at: string };
export type PublicLegalInformation = Pick<BusinessSettings, "nome" | "responsavel_legal" | "documento_legal" | "email_privacidade" | "telefone" | "endereco" | "prazo_retencao_meses">;
