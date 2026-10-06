export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      batch_materials: {
        Row: {
          batch_id: string
          created_at: string
          created_by: string
          id: string
          material_name: string
          quantity: number | null
          raw_material_id: string | null
          supplier_batch: string | null
          supplier_id: string | null
          unit: string | null
        }
        Insert: {
          batch_id: string
          created_at?: string
          created_by: string
          id?: string
          material_name: string
          quantity?: number | null
          raw_material_id?: string | null
          supplier_batch?: string | null
          supplier_id?: string | null
          unit?: string | null
        }
        Update: {
          batch_id?: string
          created_at?: string
          created_by?: string
          id?: string
          material_name?: string
          quantity?: number | null
          raw_material_id?: string | null
          supplier_batch?: string | null
          supplier_id?: string | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "batch_materials_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "qc_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_materials_raw_material_id_fkey"
            columns: ["raw_material_id"]
            isOneToOne: false
            referencedRelation: "raw_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_materials_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      calculation_history: {
        Row: {
          batch_size: number | null
          batch_unit: string | null
          calculation_result: Json
          cost_per_unit: number | null
          created_at: string
          created_by: string
          currency: string | null
          department: string | null
          department_id: string | null
          expected_output: number | null
          expected_output_unit: string | null
          id: string
          input_data: Json
          product_id: string | null
          recipe_id: string | null
          recipe_version: number
          total_cost: number | null
          waste_loss: number | null
          waste_loss_unit: string | null
        }
        Insert: {
          batch_size?: number | null
          batch_unit?: string | null
          calculation_result?: Json
          cost_per_unit?: number | null
          created_at?: string
          created_by: string
          currency?: string | null
          department?: string | null
          department_id?: string | null
          expected_output?: number | null
          expected_output_unit?: string | null
          id?: string
          input_data?: Json
          product_id?: string | null
          recipe_id?: string | null
          recipe_version?: number
          total_cost?: number | null
          waste_loss?: number | null
          waste_loss_unit?: string | null
        }
        Update: {
          batch_size?: number | null
          batch_unit?: string | null
          calculation_result?: Json
          cost_per_unit?: number | null
          created_at?: string
          created_by?: string
          currency?: string | null
          department?: string | null
          department_id?: string | null
          expected_output?: number | null
          expected_output_unit?: string | null
          id?: string
          input_data?: Json
          product_id?: string | null
          recipe_id?: string | null
          recipe_version?: number
          total_cost?: number | null
          waste_loss?: number | null
          waste_loss_unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calculation_history_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      capa_actions: {
        Row: {
          action_type: string
          completed_at: string | null
          created_at: string
          created_by: string
          description: string
          due_date: string | null
          effectiveness: string | null
          id: string
          ncr_id: string
          responsible: string | null
          status: string
          updated_at: string
        }
        Insert: {
          action_type?: string
          completed_at?: string | null
          created_at?: string
          created_by: string
          description: string
          due_date?: string | null
          effectiveness?: string | null
          id?: string
          ncr_id: string
          responsible?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          action_type?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string
          description?: string
          due_date?: string | null
          effectiveness?: string | null
          id?: string
          ncr_id?: string
          responsible?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "capa_actions_ncr_id_fkey"
            columns: ["ncr_id"]
            isOneToOne: false
            referencedRelation: "ncr_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          created_at: string
          id: string
          message: Json
          thread_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: Json
          thread_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: Json
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_threads: {
        Row: {
          category: string
          created_at: string
          department_id: string | null
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          department_id?: string | null
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          department_id?: string | null
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_threads_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_data: {
        Row: {
          cost_per_unit: number
          created_at: string
          created_by: string | null
          currency: string
          department: string | null
          effective_date: string
          id: string
          material_id: string | null
          material_name: string
          unit: string
          updated_at: string
        }
        Insert: {
          cost_per_unit?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          department?: string | null
          effective_date?: string
          id?: string
          material_id?: string | null
          material_name: string
          unit?: string
          updated_at?: string
        }
        Update: {
          cost_per_unit?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          department?: string | null
          effective_date?: string
          id?: string
          material_id?: string | null
          material_name?: string
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cost_data_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "raw_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          created_at: string
          desc_ar: string
          desc_en: string
          emoji: string
          gradient: string
          id: string
          is_active: boolean
          is_system: boolean
          key: string
          sort_order: number
          title_ar: string
          title_en: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          desc_ar?: string
          desc_en?: string
          emoji?: string
          gradient?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          key: string
          sort_order?: number
          title_ar: string
          title_en?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          desc_ar?: string
          desc_en?: string
          emoji?: string
          gradient?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          key?: string
          sort_order?: number
          title_ar?: string
          title_en?: string
          updated_at?: string
        }
        Relationships: []
      }
      dept_permissions: {
        Row: {
          can_delete: boolean
          can_edit: boolean
          can_upload: boolean
          can_view: boolean
          category: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          can_delete?: boolean
          can_edit?: boolean
          can_upload?: boolean
          can_view?: boolean
          category: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          can_delete?: boolean
          can_edit?: boolean
          can_upload?: boolean
          can_view?: boolean
          category?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      document_chunks: {
        Row: {
          category: string
          chunk_index: number
          content: string
          created_at: string
          department_id: string | null
          document_id: string
          embedding: string | null
          id: string
          page_number: number | null
        }
        Insert: {
          category: string
          chunk_index?: number
          content: string
          created_at?: string
          department_id?: string | null
          document_id: string
          embedding?: string | null
          id?: string
          page_number?: number | null
        }
        Update: {
          category?: string
          chunk_index?: number
          content?: string
          created_at?: string
          department_id?: string | null
          document_id?: string
          embedding?: string | null
          id?: string
          page_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "document_chunks_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          category: string
          created_at: string
          department_id: string | null
          doc_group_id: string | null
          error_message: string | null
          expires_at: string | null
          file_name: string
          file_size: number | null
          file_type: string
          id: string
          is_current: boolean
          page_count: number | null
          processed_at: string | null
          product_id: string | null
          product_name: string | null
          status: string
          storage_path: string
          title: string
          updated_at: string
          uploaded_by: string
          version: number
        }
        Insert: {
          category: string
          created_at?: string
          department_id?: string | null
          doc_group_id?: string | null
          error_message?: string | null
          expires_at?: string | null
          file_name: string
          file_size?: number | null
          file_type: string
          id?: string
          is_current?: boolean
          page_count?: number | null
          processed_at?: string | null
          product_id?: string | null
          product_name?: string | null
          status?: string
          storage_path: string
          title: string
          updated_at?: string
          uploaded_by: string
          version?: number
        }
        Update: {
          category?: string
          created_at?: string
          department_id?: string | null
          doc_group_id?: string | null
          error_message?: string | null
          expires_at?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string
          id?: string
          is_current?: boolean
          page_count?: number | null
          processed_at?: string | null
          product_id?: string | null
          product_name?: string | null
          status?: string
          storage_path?: string
          title?: string
          updated_at?: string
          uploaded_by?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "documents_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      manufacturing_parameters: {
        Row: {
          batch_size_unit: string | null
          created_at: string
          created_by: string | null
          default_waste_percent: number
          department: string
          id: string
          max_batch_size: number | null
          min_batch_size: number | null
          quality_params: Json
          standard_process: Json
          updated_at: string
        }
        Insert: {
          batch_size_unit?: string | null
          created_at?: string
          created_by?: string | null
          default_waste_percent?: number
          department: string
          id?: string
          max_batch_size?: number | null
          min_batch_size?: number | null
          quality_params?: Json
          standard_process?: Json
          updated_at?: string
        }
        Update: {
          batch_size_unit?: string | null
          created_at?: string
          created_by?: string | null
          default_waste_percent?: number
          department?: string
          id?: string
          max_batch_size?: number | null
          min_batch_size?: number | null
          quality_params?: Json
          standard_process?: Json
          updated_at?: string
        }
        Relationships: []
      }
      material_density: {
        Row: {
          created_at: string
          created_by: string | null
          density_value: number
          department: string | null
          from_unit: string
          id: string
          material_id: string | null
          material_name: string
          to_unit: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          density_value?: number
          department?: string | null
          from_unit: string
          id?: string
          material_id?: string | null
          material_name: string
          to_unit: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          density_value?: number
          department?: string | null
          from_unit?: string
          id?: string
          material_id?: string | null
          material_name?: string
          to_unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_density_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "raw_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      material_substitution: {
        Row: {
          conversion_factor: number
          created_at: string
          created_by: string | null
          department: string | null
          id: string
          is_approved: boolean
          primary_material_id: string
          quality_notes: string | null
          substitute_material_id: string
          updated_at: string
        }
        Insert: {
          conversion_factor?: number
          created_at?: string
          created_by?: string | null
          department?: string | null
          id?: string
          is_approved?: boolean
          primary_material_id: string
          quality_notes?: string | null
          substitute_material_id: string
          updated_at?: string
        }
        Update: {
          conversion_factor?: number
          created_at?: string
          created_by?: string | null
          department?: string | null
          id?: string
          is_approved?: boolean
          primary_material_id?: string
          quality_notes?: string | null
          substitute_material_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_substitution_primary_material_id_fkey"
            columns: ["primary_material_id"]
            isOneToOne: false
            referencedRelation: "raw_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_substitution_substitute_material_id_fkey"
            columns: ["substitute_material_id"]
            isOneToOne: false
            referencedRelation: "raw_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      ncr_reports: {
        Row: {
          assigned_to: string | null
          batch_number: string | null
          category: string | null
          closed_at: string | null
          created_at: string
          department_id: string | null
          description: string
          id: string
          immediate_action: string | null
          ncr_number: number
          product_id: string | null
          product_name: string | null
          reported_at: string
          reported_by: string
          root_cause: string | null
          severity: string
          source: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          batch_number?: string | null
          category?: string | null
          closed_at?: string | null
          created_at?: string
          department_id?: string | null
          description: string
          id?: string
          immediate_action?: string | null
          ncr_number?: number
          product_id?: string | null
          product_name?: string | null
          reported_at?: string
          reported_by: string
          root_cause?: string | null
          severity?: string
          source?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          batch_number?: string | null
          category?: string | null
          closed_at?: string | null
          created_at?: string
          department_id?: string | null
          description?: string
          id?: string
          immediate_action?: string | null
          ncr_number?: number
          product_id?: string | null
          product_name?: string | null
          reported_at?: string
          reported_by?: string
          root_cause?: string | null
          severity?: string
          source?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ncr_reports_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ncr_reports_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_events: {
        Row: {
          actor_id: string | null
          category: string | null
          created_at: string
          department_id: string | null
          detail: string | null
          event_type: string
          id: string
          metadata: Json
          product_id: string | null
          ref_id: string | null
          ref_table: string | null
          title: string
        }
        Insert: {
          actor_id?: string | null
          category?: string | null
          created_at?: string
          department_id?: string | null
          detail?: string | null
          event_type: string
          id?: string
          metadata?: Json
          product_id?: string | null
          ref_id?: string | null
          ref_table?: string | null
          title: string
        }
        Update: {
          actor_id?: string | null
          category?: string | null
          created_at?: string
          department_id?: string | null
          detail?: string | null
          event_type?: string
          id?: string
          metadata?: Json
          product_id?: string | null
          ref_id?: string | null
          ref_table?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_events_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_events_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_versions: {
        Row: {
          category: string
          change_note: string | null
          created_at: string
          created_by: string
          id: string
          product_id: string
          snapshot: Json
          version: number
        }
        Insert: {
          category: string
          change_note?: string | null
          created_at?: string
          created_by: string
          id?: string
          product_id: string
          snapshot?: Json
          version?: number
        }
        Update: {
          category?: string
          change_note?: string | null
          created_at?: string
          created_by?: string
          id?: string
          product_id?: string
          snapshot?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_versions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          base_quantity: number
          base_unit: string
          category: string
          code: string | null
          created_at: string
          created_by: string
          department_id: string | null
          description: string | null
          id: string
          image_url: string | null
          ingredients: Json
          name: string
          notes: string | null
          package_size: string | null
          product_type: string | null
          recipe: Json
          spec: Json
          updated_at: string
        }
        Insert: {
          base_quantity?: number
          base_unit?: string
          category: string
          code?: string | null
          created_at?: string
          created_by: string
          department_id?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          ingredients?: Json
          name: string
          notes?: string | null
          package_size?: string | null
          product_type?: string | null
          recipe?: Json
          spec?: Json
          updated_at?: string
        }
        Update: {
          base_quantity?: number
          base_unit?: string
          category?: string
          code?: string | null
          created_at?: string
          created_by?: string
          department_id?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          ingredients?: Json
          name?: string
          notes?: string | null
          package_size?: string | null
          product_type?: string | null
          recipe?: Json
          spec?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          job_title: string | null
          username: string
        }
        Insert: {
          created_at?: string
          id: string
          job_title?: string | null
          username: string
        }
        Update: {
          created_at?: string
          id?: string
          job_title?: string | null
          username?: string
        }
        Relationships: []
      }
      qc_batches: {
        Row: {
          actual_output: number | null
          actual_output_unit: string | null
          batch_number: string
          category: string
          created_at: string
          created_by: string
          department_id: string | null
          deviations: Json
          expected_output: number | null
          expected_output_unit: string | null
          expiry_date: string | null
          id: string
          notes: string | null
          product_id: string | null
          product_name: string | null
          production_date: string | null
          quantity: number | null
          recipe_id: string | null
          status: string
          unit: string | null
          updated_at: string
          waste_loss: number | null
        }
        Insert: {
          actual_output?: number | null
          actual_output_unit?: string | null
          batch_number: string
          category: string
          created_at?: string
          created_by: string
          department_id?: string | null
          deviations?: Json
          expected_output?: number | null
          expected_output_unit?: string | null
          expiry_date?: string | null
          id?: string
          notes?: string | null
          product_id?: string | null
          product_name?: string | null
          production_date?: string | null
          quantity?: number | null
          recipe_id?: string | null
          status?: string
          unit?: string | null
          updated_at?: string
          waste_loss?: number | null
        }
        Update: {
          actual_output?: number | null
          actual_output_unit?: string | null
          batch_number?: string
          category?: string
          created_at?: string
          created_by?: string
          department_id?: string | null
          deviations?: Json
          expected_output?: number | null
          expected_output_unit?: string | null
          expiry_date?: string | null
          id?: string
          notes?: string | null
          product_id?: string | null
          product_name?: string | null
          production_date?: string | null
          quantity?: number | null
          recipe_id?: string | null
          status?: string
          unit?: string | null
          updated_at?: string
          waste_loss?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "qc_batches_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qc_batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qc_batches_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      qc_results: {
        Row: {
          batch_id: string | null
          category: string
          created_at: string
          created_by: string
          department_id: string | null
          deviation_note: string | null
          id: string
          max_value: number | null
          min_value: number | null
          product_id: string | null
          result: string
          target_text: string | null
          test_name: string
          tested_at: string
          unit: string | null
          updated_at: string
          value_numeric: number | null
          value_text: string | null
        }
        Insert: {
          batch_id?: string | null
          category: string
          created_at?: string
          created_by: string
          department_id?: string | null
          deviation_note?: string | null
          id?: string
          max_value?: number | null
          min_value?: number | null
          product_id?: string | null
          result?: string
          target_text?: string | null
          test_name: string
          tested_at?: string
          unit?: string | null
          updated_at?: string
          value_numeric?: number | null
          value_text?: string | null
        }
        Update: {
          batch_id?: string | null
          category?: string
          created_at?: string
          created_by?: string
          department_id?: string | null
          deviation_note?: string | null
          id?: string
          max_value?: number | null
          min_value?: number | null
          product_id?: string | null
          result?: string
          target_text?: string | null
          test_name?: string
          tested_at?: string
          unit?: string | null
          updated_at?: string
          value_numeric?: number | null
          value_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "qc_results_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "qc_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qc_results_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qc_results_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          alert_type: string
          batch_id: string | null
          category: string | null
          created_at: string
          department_id: string | null
          document_id: string | null
          id: string
          message: string | null
          ncr_id: string | null
          product_id: string | null
          qc_result_id: string | null
          severity: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type: string
          batch_id?: string | null
          category?: string | null
          created_at?: string
          department_id?: string | null
          document_id?: string | null
          id?: string
          message?: string | null
          ncr_id?: string | null
          product_id?: string | null
          qc_result_id?: string | null
          severity?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type?: string
          batch_id?: string | null
          category?: string | null
          created_at?: string
          department_id?: string | null
          document_id?: string | null
          id?: string
          message?: string | null
          ncr_id?: string | null
          product_id?: string | null
          qc_result_id?: string | null
          severity?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quality_alerts_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "qc_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_alerts_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_alerts_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_alerts_ncr_id_fkey"
            columns: ["ncr_id"]
            isOneToOne: false
            referencedRelation: "ncr_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_alerts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_alerts_qc_result_id_fkey"
            columns: ["qc_result_id"]
            isOneToOne: false
            referencedRelation: "qc_results"
            referencedColumns: ["id"]
          },
        ]
      }
      raw_materials: {
        Row: {
          category: string | null
          code: string | null
          created_at: string
          created_by: string
          id: string
          name: string
          notes: string | null
          shelf_life_days: number | null
          spec: Json
          supplier_id: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          code?: string | null
          created_at?: string
          created_by: string
          id?: string
          name: string
          notes?: string | null
          shelf_life_days?: number | null
          spec?: Json
          supplier_id?: string | null
          unit?: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          code?: string | null
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          notes?: string | null
          shelf_life_days?: number | null
          spec?: Json
          supplier_id?: string | null
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "raw_materials_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_versions: {
        Row: {
          change_note: string | null
          created_at: string
          created_by: string
          current_recipe: Json
          id: string
          product_id: string | null
          recipe_id: string
          version: number
        }
        Insert: {
          change_note?: string | null
          created_at?: string
          created_by: string
          current_recipe?: Json
          id?: string
          product_id?: string | null
          recipe_id: string
          version?: number
        }
        Update: {
          change_note?: string | null
          created_at?: string
          created_by?: string
          current_recipe?: Json
          id?: string
          product_id?: string | null
          recipe_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "recipe_versions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_versions_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          base_quantity: number
          base_unit: string
          created_at: string
          created_by: string
          department: string
          department_id: string | null
          id: string
          ingredients: Json
          notes: string | null
          parameters: Json
          product_id: string | null
          recipe_name: string
          specifications: Json
          status: string
          steps: Json
          updated_at: string
          version: number
        }
        Insert: {
          base_quantity?: number
          base_unit?: string
          created_at?: string
          created_by: string
          department: string
          department_id?: string | null
          id?: string
          ingredients?: Json
          notes?: string | null
          parameters?: Json
          product_id?: string | null
          recipe_name: string
          specifications?: Json
          status?: string
          steps?: Json
          updated_at?: string
          version?: number
        }
        Update: {
          base_quantity?: number
          base_unit?: string
          created_at?: string
          created_by?: string
          department?: string
          department_id?: string | null
          id?: string
          ingredients?: Json
          notes?: string | null
          parameters?: Json
          product_id?: string | null
          recipe_name?: string
          specifications?: Json
          status?: string
          steps?: Json
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "recipes_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      report_settings: {
        Row: {
          company_extra_data: string | null
          company_name: string
          created_at: string
          default_report_title: string
          id: string
          logo_path: string | null
          show_company_data: boolean
          show_logo: boolean
          style_mode: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          company_extra_data?: string | null
          company_name?: string
          created_at?: string
          default_report_title?: string
          id?: string
          logo_path?: string | null
          show_company_data?: boolean
          show_logo?: boolean
          style_mode?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          company_extra_data?: string | null
          company_name?: string
          created_at?: string
          default_report_title?: string
          id?: string
          logo_path?: string | null
          show_company_data?: boolean
          show_logo?: boolean
          style_mode?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          created_by: string
          details: string | null
          id: string
          report_date: string
          report_number: number
          rows: Json
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          details?: string | null
          id?: string
          report_date?: string
          report_number?: number
          rows?: Json
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          details?: string | null
          id?: string
          report_date?: string
          report_number?: number
          rows?: Json
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          code: string | null
          contact: string | null
          created_at: string
          created_by: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          rating: number | null
          status: string
          updated_at: string
        }
        Insert: {
          code?: string | null
          contact?: string | null
          created_at?: string
          created_by: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          rating?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          code?: string | null
          contact?: string | null
          created_at?: string
          created_by?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          rating?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      unit_conversions: {
        Row: {
          base_unit: string
          conversion_factor: number
          created_at: string
          created_by: string | null
          department: string | null
          from_unit: string
          id: string
          to_unit: string
          updated_at: string
        }
        Insert: {
          base_unit?: string
          conversion_factor?: number
          created_at?: string
          created_by?: string | null
          department?: string | null
          from_unit: string
          id?: string
          to_unit: string
          updated_at?: string
        }
        Update: {
          base_unit?: string
          conversion_factor?: number
          created_at?: string
          created_by?: string | null
          department?: string | null
          from_unit?: string
          id?: string
          to_unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_dept: {
        Args: { _action: string; _category: string; _user_id: string }
        Returns: boolean
      }
      has_any_role: {
        Args: { _roles: string[]; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      match_document_chunks: {
        Args: {
          filter_category?: string
          match_count?: number
          query_embedding: string
        }
        Returns: {
          chunk_id: string
          content: string
          document_id: string
          file_name: string
          page_number: number
          similarity: number
          title: string
        }[]
      }
      product_quality_score: { Args: { _product_id: string }; Returns: number }
    }
    Enums: {
      app_role:
        | "owner"
        | "user"
        | "admin"
        | "qa_manager"
        | "production_manager"
        | "qa_engineer"
        | "production_engineer"
        | "laboratory"
        | "maintenance"
        | "warehouse"
        | "viewer"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "owner",
        "user",
        "admin",
        "qa_manager",
        "production_manager",
        "qa_engineer",
        "production_engineer",
        "laboratory",
        "maintenance",
        "warehouse",
        "viewer",
      ],
    },
  },
} as const
