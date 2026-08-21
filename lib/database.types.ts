export type AccountType = "cliente" | "barbeiro";
export type AppointmentStatus = "agendado" | "confirmado" | "concluido" | "cancelado" | "nao_compareceu";
export type BusinessDay = 0 | 1 | 2 | 3 | 4 | 5 | 6;
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
        Row: { id: string; nome: string; telefone: string | null; tipo: AccountType; created_at: string };
        Insert: { id: string; nome: string; telefone?: string | null; tipo: AccountType; created_at?: string };
        Update: { nome?: string; telefone?: string | null; tipo?: AccountType };
        Relationships: [];
      };
      configuracoes_negocio: {
        Row: { id: true; nome: string; endereco: string | null; telefone: string | null; logo_url: string | null; updated_at: string };
        Insert: { id?: true; nome?: string; endereco?: string | null; telefone?: string | null; logo_url?: string | null };
        Update: { nome?: string; endereco?: string | null; telefone?: string | null; logo_url?: string | null; updated_at?: string };
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
        Row: { id: number; nome: string; telefone: string; email: string | null; usuario_id: string };
        Insert: { id?: never; nome: string; telefone: string; email?: string | null; usuario_id: string };
        Update: { nome?: string; telefone?: string; email?: string | null };
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
        };
        Insert: never;
        Update: never;
        Relationships: [Relationship, Relationship, Relationship];
      };
    };
    Views: Record<string, never>;
    Functions: {
      criar_agendamento: {
        Args: { p_barbeiro_id: number; p_servico_id: number; p_data: string; p_horario: string };
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
