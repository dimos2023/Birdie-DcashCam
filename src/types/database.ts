export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = "super_admin" | "org_admin" | "operator" | "viewer";
export type DeviceStatus = "active" | "inactive" | "maintenance" | "decommissioned";
export type VehicleStatus = "active" | "inactive" | "maintenance";
export type StreamType = "webrtc" | "hls";
export type MessageDirection = "inbound" | "outbound";
export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "login"
  | "logout"
  | "assign"
  | "unassign"
  | "stream_start"
  | "stream_stop";

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string;
          logo_url: string | null;
          timezone: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          logo_url?: string | null;
          timezone?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["organizations"]["Insert"]>;
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          organization_id: string;
          email: string;
          full_name: string;
          avatar_url: string | null;
          role: UserRole;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          organization_id: string;
          email: string;
          full_name: string;
          avatar_url?: string | null;
          role?: UserRole;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      customers: {
        Row: {
          id: string;
          organization_id: string;
          full_name: string;
          phone: string | null;
          whatsapp_number: string | null;
          email: string | null;
          city: string | null;
          consent_status: "pending" | "granted" | "declined";
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          full_name: string;
          phone?: string | null;
          whatsapp_number?: string | null;
          email?: string | null;
          city?: string | null;
          consent_status?: "pending" | "granted" | "declined";
          notes?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["customers"]["Insert"]>;
        Relationships: [];
      };
      vehicles: {
        Row: {
          id: string;
          organization_id: string;
          customer_id: string | null;
          plate_number: string;
          brand: string | null;
          model: string | null;
          year: number | null;
          color: string | null;
          status: VehicleStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          customer_id?: string | null;
          plate_number: string;
          brand?: string | null;
          model?: string | null;
          year?: number | null;
          color?: string | null;
          status?: VehicleStatus;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["vehicles"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "vehicles_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "vehicles_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      device_models: {
        Row: {
          id: string;
          name: string;
          category: string;
          cameras_count: number;
          supports_audio: boolean;
          supports_two_way_audio: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          category: string;
          cameras_count?: number;
          supports_audio?: boolean;
          supports_two_way_audio?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["device_models"]["Insert"]>;
        Relationships: [];
      };
      devices: {
        Row: {
          id: string;
          organization_id: string;
          customer_id: string | null;
          device_model_id: string | null;
          serial_number: string;
          imei: string | null;
          sim_number: string | null;
          status: DeviceStatus;
          activation_date: string | null;
          warranty_start: string | null;
          warranty_end: string | null;
          last_seen_at: string | null;
          last_latitude: number | null;
          last_longitude: number | null;
          last_speed_kmh: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          customer_id?: string | null;
          device_model_id?: string | null;
          serial_number: string;
          imei?: string | null;
          sim_number?: string | null;
          status?: DeviceStatus;
          activation_date?: string | null;
          warranty_start?: string | null;
          warranty_end?: string | null;
          last_seen_at?: string | null;
          last_latitude?: number | null;
          last_longitude?: number | null;
          last_speed_kmh?: number | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["devices"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "devices_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "devices_device_model_id_fkey";
            columns: ["device_model_id"];
            isOneToOne: false;
            referencedRelation: "device_models";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "devices_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      vehicle_devices: {
        Row: {
          id: string;
          vehicle_id: string;
          device_id: string;
          assigned_at: string;
          is_active: boolean;
        };
        Insert: {
          id?: string;
          vehicle_id: string;
          device_id: string;
          assigned_at?: string;
          is_active?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["vehicle_devices"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "vehicle_devices_vehicle_id_fkey";
            columns: ["vehicle_id"];
            isOneToOne: false;
            referencedRelation: "vehicles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "vehicle_devices_device_id_fkey";
            columns: ["device_id"];
            isOneToOne: false;
            referencedRelation: "devices";
            referencedColumns: ["id"];
          },
        ];
      };
      vehicle_locations: {
        Row: {
          id: string;
          organization_id: string;
          vehicle_id: string;
          device_id: string | null;
          latitude: number;
          longitude: number;
          speed_kmh: number | null;
          heading: number | null;
          altitude_m: number | null;
          accuracy_m: number | null;
          ignition_on: boolean | null;
          recorded_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          vehicle_id: string;
          device_id?: string | null;
          latitude: number;
          longitude: number;
          speed_kmh?: number | null;
          heading?: number | null;
          altitude_m?: number | null;
          accuracy_m?: number | null;
          ignition_on?: boolean | null;
          recorded_at?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["vehicle_locations"]["Insert"]>;
        Relationships: [];
      };
      camera_streams: {
        Row: {
          id: string;
          organization_id: string;
          vehicle_id: string;
          device_id: string | null;
          channel_name: string;
          stream_type: StreamType;
          stream_url: string | null;
          webrtc_signaling_url: string | null;
          is_live: boolean;
          thumbnail_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          vehicle_id: string;
          device_id?: string | null;
          channel_name: string;
          stream_type?: StreamType;
          stream_url?: string | null;
          webrtc_signaling_url?: string | null;
          is_live?: boolean;
          thumbnail_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["camera_streams"]["Insert"]>;
        Relationships: [];
      };
      whatsapp_conversations: {
        Row: {
          id: string;
          organization_id: string;
          customer_id: string | null;
          vehicle_id: string | null;
          wa_phone_number: string;
          contact_name: string | null;
          last_message_at: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          customer_id?: string | null;
          vehicle_id?: string | null;
          wa_phone_number: string;
          contact_name?: string | null;
          last_message_at?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["whatsapp_conversations"]["Insert"]>;
        Relationships: [];
      };
      whatsapp_messages: {
        Row: {
          id: string;
          organization_id: string;
          conversation_id: string;
          direction: MessageDirection;
          body: string;
          wa_message_id: string | null;
          status: string | null;
          sent_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          conversation_id: string;
          direction: MessageDirection;
          body: string;
          wa_message_id?: string | null;
          status?: string | null;
          sent_at?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["whatsapp_messages"]["Insert"]>;
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string | null;
          action: AuditAction;
          entity_type: string;
          entity_id: string | null;
          metadata: Json;
          ip_address: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id?: string | null;
          action: AuditAction;
          entity_type: string;
          entity_id?: string | null;
          metadata?: Json;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["audit_logs"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "audit_logs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      gps51_webhook_logs: {
        Row: {
          id: string;
          received_at: string;
          headers: Json;
          payload: Json;
          parsed_device_id: string | null;
          parsed_latitude: number | null;
          parsed_longitude: number | null;
          parsed_speed_kmh: number | null;
          parsed_address: string | null;
          parsed_gps_status: string | null;
          status: string;
          error_message: string | null;
        };
        Insert: {
          id?: string;
          received_at?: string;
          headers?: Json;
          payload?: Json;
          parsed_device_id?: string | null;
          parsed_latitude?: number | null;
          parsed_longitude?: number | null;
          parsed_speed_kmh?: number | null;
          parsed_address?: string | null;
          parsed_gps_status?: string | null;
          status?: string;
          error_message?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["gps51_webhook_logs"]["Insert"]>;
        Relationships: [];
      };
      gps51_device_mappings: {
        Row: {
          id: string;
          gps51_device_id: string;
          device_id: string | null;
          vehicle_id: string | null;
          customer_id: string | null;
          display_name: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          gps51_device_id: string;
          device_id?: string | null;
          vehicle_id?: string | null;
          customer_id?: string | null;
          display_name?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["gps51_device_mappings"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "gps51_device_mappings_device_id_fkey";
            columns: ["device_id"];
            isOneToOne: false;
            referencedRelation: "devices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "gps51_device_mappings_vehicle_id_fkey";
            columns: ["vehicle_id"];
            isOneToOne: false;
            referencedRelation: "vehicles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "gps51_device_mappings_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
        ];
      };
      jt_terminals: {
        Row: {
          id: string;
          organization_id: string;
          device_id: string | null;
          vehicle_id: string | null;
          customer_id: string | null;
          display_name: string | null;
          terminal_no: string;
          media_sim_no: string | null;
          imei: string | null;
          terminal_id_code: string | null;
          manufacturer_id: string | null;
          protocol_version: "auto" | "2011" | "2019";
          timezone_offset_minutes: number;
          allow_auto_registration: boolean;
          is_enabled: boolean;
          expected_video_channels: number | null;
          registration_state: string;
          is_online: boolean;
          last_seen_at: string | null;
          plate_number: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          device_id?: string | null;
          vehicle_id?: string | null;
          customer_id?: string | null;
          display_name?: string | null;
          terminal_no: string;
          media_sim_no?: string | null;
          imei?: string | null;
          terminal_id_code?: string | null;
          manufacturer_id?: string | null;
          protocol_version?: "auto" | "2011" | "2019";
          timezone_offset_minutes?: number;
          allow_auto_registration?: boolean;
          is_enabled?: boolean;
          expected_video_channels?: number | null;
        };
        Update: Partial<Database["public"]["Tables"]["jt_terminals"]["Insert"]>;
        Relationships: [];
      };
      jt_commands: {
        Row: {
          id: string;
          organization_id: string;
          terminal_id: string;
          stream_session_id: string | null;
          command_name: string;
          message_id: number;
          payload: Json;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          terminal_id: string;
          stream_session_id?: string | null;
          command_name: string;
          message_id: number;
          payload?: Json;
          status?: string;
          created_by?: string | null;
          expires_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["jt_commands"]["Insert"]>;
        Relationships: [];
      };
      jt_stream_sessions: {
        Row: {
          id: string;
          organization_id: string;
          terminal_id: string;
          vehicle_id: string | null;
          session_key: string;
          mode: string;
          logical_channel: number;
          data_type: string;
          stream_type: string;
          status: string;
          playback_url: string | null;
          request_command_id: string | null;
          stop_command_id: string | null;
          playback_start: string | null;
          playback_end: string | null;
          media_sim_no: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          terminal_id: string;
          vehicle_id?: string | null;
          session_key: string;
          mode: string;
          logical_channel: number;
          data_type?: string;
          stream_type?: string;
          status?: string;
          playback_start?: string | null;
          playback_end?: string | null;
          request_command_id?: string | null;
          stop_command_id?: string | null;
        };
        Update: {
          status?: string;
          playback_url?: string | null;
          request_command_id?: string | null;
          stop_command_id?: string | null;
          playback_start?: string | null;
          playback_end?: string | null;
          mode?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      jt_terminal_live: {
        Row: {
          terminal_id: string;
          organization_id: string;
          device_id: string | null;
          vehicle_id: string | null;
          customer_id: string | null;
          display_name: string | null;
          terminal_no: string;
          media_sim_no: string | null;
          imei: string | null;
          terminal_model: string | null;
          plate_number: string | null;
          protocol_version: string;
          registration_state: string;
          is_enabled: boolean;
          is_online: boolean;
          last_seen_at: string | null;
          located_at: string | null;
          position_received_at: string | null;
          latitude: number | null;
          longitude: number | null;
          altitude_m: number | null;
          speed_kmh: number | null;
          direction_deg: number | null;
          acc_on: boolean | null;
          positioned: boolean | null;
          moving: boolean | null;
          alarm_bits: number | null;
          status_bits: number | null;
          mileage_km: number | null;
          fuel_l: number | null;
          signal_strength: number | null;
          satellite_count: number | null;
        };
        Relationships: [];
      };
      gps51_web_device_live: {
        Row: {
          gps51_device_id: string;
          organization_id: string;
          account_id: string;
          source_device_id: string;
          device_name: string | null;
          imei: string | null;
          sim_no: string | null;
          group_path: string | null;
          birdie_device_id: string | null;
          vehicle_id: string | null;
          customer_id: string | null;
          online_status: "online" | "offline" | "unknown";
          source_updated_at: string | null;
          source_located_at: string | null;
          last_seen_at: string | null;
          received_at: string | null;
          latitude: number | null;
          longitude: number | null;
          speed_kmh: number | null;
          acc_on: boolean | null;
          status_text: string | null;
          address: string | null;
          satellite_count: number | null;
          cellular_signal_percent: number | null;
          mileage_km: number | null;
          source_position_id: number | null;
          altitude_m: number | null;
          direction_deg: number | null;
          status_bits: number | null;
          alarm_bits: number | null;
          positioned: boolean | null;
          moving: boolean | null;
          media_channels: Json;
          last_scraped_at: string | null;
        };
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
    CompositeTypes: Record<string, never>;
    Enums: {
      user_role: UserRole;
      device_status: DeviceStatus;
      vehicle_status: VehicleStatus;
      stream_type: StreamType;
      message_direction: MessageDirection;
      audit_action: AuditAction;
    };
  };
}

export type Organization = Database["public"]["Tables"]["organizations"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Customer = Database["public"]["Tables"]["customers"]["Row"];
export type Vehicle = Database["public"]["Tables"]["vehicles"]["Row"];
export type DeviceModel = Database["public"]["Tables"]["device_models"]["Row"];
export type Device = Database["public"]["Tables"]["devices"]["Row"];
export type VehicleDevice = Database["public"]["Tables"]["vehicle_devices"]["Row"];
export type VehicleLocation = Database["public"]["Tables"]["vehicle_locations"]["Row"];
export type CameraStream = Database["public"]["Tables"]["camera_streams"]["Row"];
export type WhatsappConversation = Database["public"]["Tables"]["whatsapp_conversations"]["Row"];
export type WhatsappMessage = Database["public"]["Tables"]["whatsapp_messages"]["Row"];
export type AuditLog = Database["public"]["Tables"]["audit_logs"]["Row"];
export type Gps51WebhookLog = Database["public"]["Tables"]["gps51_webhook_logs"]["Row"];
export type Gps51DeviceMapping = Database["public"]["Tables"]["gps51_device_mappings"]["Row"];
export type JtTerminal = Database["public"]["Tables"]["jt_terminals"]["Row"];
export type JtCommand = Database["public"]["Tables"]["jt_commands"]["Row"];
export type JtStreamSession = Database["public"]["Tables"]["jt_stream_sessions"]["Row"];
export type JtTerminalLive = Database["public"]["Views"]["jt_terminal_live"]["Row"];
export type Gps51WebDeviceLive = Database["public"]["Views"]["gps51_web_device_live"]["Row"];
