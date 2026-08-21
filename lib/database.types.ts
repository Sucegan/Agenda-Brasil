export type AccountType = "cliente" | "barbeiro";
export type AppointmentStatus = "agendado" | "confirmado" | "concluido" | "cancelado";
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
      barbeiros: {
        Row: { id: number; nome: string; telefone: string | null; usuario_id: string; horario_inicio: string; horario_fim: string; dias_trabalho: BusinessDay[] };
        Insert: { id?: never; nome: string; telefone?: string | null; usuario_id: string; horario_inicio?: string; horario_fim?: string; dias_trabalho?: BusinessDay[] };
        Update: { nome?: string; telefone?: string | null; horario_inicio?: string; horario_fim?: string; dias_trabalho?: BusinessDay[] };
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
      criar_convite_barbeiro: {
        Args: Record<string, never>;
        Returns: string;
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
