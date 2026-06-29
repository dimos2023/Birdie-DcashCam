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
          name: string;
          contact_name: string | null;
          email: string | null;
          phone: string | null;
          address: string | null;
          city: string | null;
          country: string | null;
          notes: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          contact_name?: string | null;
          email?: string | null;
          phone?: string | null;
          address?: string | null;
          city?: string | null;
          country?: string | null;
          notes?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
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
          make: string | null;
          model: string | null;
          year: number | null;
          color: string | null;
          vin: string | null;
          status: VehicleStatus;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          customer_id?: string | null;
          plate_number: string;
          make?: string | null;
          model?: string | null;
          year?: number | null;
          color?: string | null;
          vin?: string | null;
          status?: VehicleStatus;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
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
          organization_id: string;
          name: string;
          manufacturer: string;
          type: "dash_cam" | "gps_tracker" | "combo";
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          manufacturer?: string;
          type: "dash_cam" | "gps_tracker" | "combo";
          description?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["device_models"]["Insert"]>;
        Relationships: [];
      };
      devices: {
        Row: {
          id: string;
          organization_id: string;
          device_model_id: string | null;
          serial_number: string;
          imei: string | null;
          sim_number: string | null;
          firmware_version: string | null;
          status: DeviceStatus;
          last_seen_at: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          device_model_id?: string | null;
          serial_number: string;
          imei?: string | null;
          sim_number?: string | null;
          firmware_version?: string | null;
          status?: DeviceStatus;
          last_seen_at?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["devices"]["Insert"]>;
        Relationships: [
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
          organization_id: string;
          vehicle_id: string;
          device_id: string;
          assigned_at: string;
          unassigned_at: string | null;
          is_primary: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          vehicle_id: string;
          device_id: string;
          assigned_at?: string;
          unassigned_at?: string | null;
          is_primary?: boolean;
          created_at?: string;
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
    };
    Views: Record<string, never>;
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
