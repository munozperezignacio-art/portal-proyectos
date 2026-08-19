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
      acreditaciones_config_docs: {
        Row: {
          company_docs: Json
          empresa: string
          equipo_docs: Json
          id: number
          supplier_docs: Json
          supplier_equipo_docs: Json
          supplier_worker_docs: Json
          updated_at: string
          worker_docs: Json
        }
        Insert: {
          company_docs?: Json
          empresa: string
          equipo_docs?: Json
          id?: number
          supplier_docs?: Json
          supplier_equipo_docs?: Json
          supplier_worker_docs?: Json
          updated_at?: string
          worker_docs?: Json
        }
        Update: {
          company_docs?: Json
          empresa?: string
          equipo_docs?: Json
          id?: number
          supplier_docs?: Json
          supplier_equipo_docs?: Json
          supplier_worker_docs?: Json
          updated_at?: string
          worker_docs?: Json
        }
        Relationships: []
      }
      acreditaciones_proveedores: {
        Row: {
          companyDocs: Json
          correo_contacto: string | null
          created_at: string
          credencial_pass: string
          empresa: string
          empresa_nombre: string
          equiposList: Json
          estado: string
          estado_cumplimiento: number
          id: number
          obra_asociada: string | null
          personalList: Json
          rut_empresa: string
          token_acceso: string
          updated_at: string
        }
        Insert: {
          companyDocs?: Json
          correo_contacto?: string | null
          created_at?: string
          credencial_pass: string
          empresa: string
          empresa_nombre: string
          equiposList?: Json
          estado?: string
          estado_cumplimiento?: number
          id?: number
          obra_asociada?: string | null
          personalList?: Json
          rut_empresa: string
          token_acceso: string
          updated_at?: string
        }
        Update: {
          companyDocs?: Json
          correo_contacto?: string | null
          created_at?: string
          credencial_pass?: string
          empresa?: string
          empresa_nombre?: string
          equiposList?: Json
          estado?: string
          estado_cumplimiento?: number
          id?: number
          obra_asociada?: string | null
          personalList?: Json
          rut_empresa?: string
          token_acceso?: string
          updated_at?: string
        }
        Relationships: []
      }
      acreditaciones_resumen_obra: {
        Row: {
          categoria: string
          empresa: string
          estado: string
          id: string
          obra_id: number | null
          obra_nombre: string
          observacion: string | null
          proximo_vencimiento: string | null
          total_aprobados: number
          total_recibidos: number
          total_requeridos: number
          updated_at: string
        }
        Insert: {
          categoria: string
          empresa: string
          estado?: string
          id?: string
          obra_id?: number | null
          obra_nombre: string
          observacion?: string | null
          proximo_vencimiento?: string | null
          total_aprobados?: number
          total_recibidos?: number
          total_requeridos?: number
          updated_at?: string
        }
        Update: {
          categoria?: string
          empresa?: string
          estado?: string
          id?: string
          obra_id?: number | null
          obra_nombre?: string
          observacion?: string | null
          proximo_vencimiento?: string | null
          total_aprobados?: number
          total_recibidos?: number
          total_requeridos?: number
          updated_at?: string
        }
        Relationships: []
      }
      acreditaciones_revisiones_ia: {
        Row: {
          advertencia_legal: string
          archivo_hash: string | null
          archivo_nombre: string | null
          auth_user_id: string | null
          campos_faltantes: Json
          categoria: string
          confianza: number | null
          costo_usd: number
          created_at: string
          datos_extraidos: Json
          decision_comentario: string | null
          decision_en: string | null
          decision_humana: string | null
          decision_por: string | null
          documento_clave: string
          documento_nombre: string
          empresa: string
          entidad_nombre: string | null
          hallazgos: Json
          ia_consumo_id: string | null
          id: string
          modelo: string
          obra_nombre: string | null
          recomendacion: string | null
          resultado: string
          resumen: string | null
          revisado_por: string | null
          subcontratista_nombre: string | null
          subcontratista_rut: string | null
          tokens_total: number
        }
        Insert: {
          advertencia_legal?: string
          archivo_hash?: string | null
          archivo_nombre?: string | null
          auth_user_id?: string | null
          campos_faltantes?: Json
          categoria: string
          confianza?: number | null
          costo_usd?: number
          created_at?: string
          datos_extraidos?: Json
          decision_comentario?: string | null
          decision_en?: string | null
          decision_humana?: string | null
          decision_por?: string | null
          documento_clave: string
          documento_nombre: string
          empresa: string
          entidad_nombre?: string | null
          hallazgos?: Json
          ia_consumo_id?: string | null
          id?: string
          modelo: string
          obra_nombre?: string | null
          recomendacion?: string | null
          resultado: string
          resumen?: string | null
          revisado_por?: string | null
          subcontratista_nombre?: string | null
          subcontratista_rut?: string | null
          tokens_total?: number
        }
        Update: {
          advertencia_legal?: string
          archivo_hash?: string | null
          archivo_nombre?: string | null
          auth_user_id?: string | null
          campos_faltantes?: Json
          categoria?: string
          confianza?: number | null
          costo_usd?: number
          created_at?: string
          datos_extraidos?: Json
          decision_comentario?: string | null
          decision_en?: string | null
          decision_humana?: string | null
          decision_por?: string | null
          documento_clave?: string
          documento_nombre?: string
          empresa?: string
          entidad_nombre?: string | null
          hallazgos?: Json
          ia_consumo_id?: string | null
          id?: string
          modelo?: string
          obra_nombre?: string | null
          recomendacion?: string | null
          resultado?: string
          resumen?: string | null
          revisado_por?: string | null
          subcontratista_nombre?: string | null
          subcontratista_rut?: string | null
          tokens_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "acreditaciones_revisiones_ia_ia_consumo_id_fkey"
            columns: ["ia_consumo_id"]
            isOneToOne: false
            referencedRelation: "ia_consumos"
            referencedColumns: ["id"]
          },
        ]
      }
      acreditaciones_subcontratos: {
        Row: {
          companyDocs: Json
          correo_contacto: string | null
          created_at: string
          credencial_pass: string
          empresa: string
          empresa_nombre: string
          equiposList: Json
          estado: string
          estado_cumplimiento: number
          id: number
          obra_asociada: string | null
          personalList: Json
          rut_empresa: string
          token_acceso: string
          updated_at: string
        }
        Insert: {
          companyDocs?: Json
          correo_contacto?: string | null
          created_at?: string
          credencial_pass: string
          empresa: string
          empresa_nombre: string
          equiposList?: Json
          estado?: string
          estado_cumplimiento?: number
          id?: number
          obra_asociada?: string | null
          personalList?: Json
          rut_empresa: string
          token_acceso: string
          updated_at?: string
        }
        Update: {
          companyDocs?: Json
          correo_contacto?: string | null
          created_at?: string
          credencial_pass?: string
          empresa?: string
          empresa_nombre?: string
          equiposList?: Json
          estado?: string
          estado_cumplimiento?: number
          id?: number
          obra_asociada?: string | null
          personalList?: Json
          rut_empresa?: string
          token_acceso?: string
          updated_at?: string
        }
        Relationships: []
      }
      asistencia_personal: {
        Row: {
          asistencia: string | null
          colacion: string | null
          created_at: string | null
          distancia_obra_m: number | null
          empresa: string
          fecha_marcacion: string
          firma_base64: string | null
          horas_extras_auto: number | null
          horas_extras_manual: number | null
          horas_ordinarias: number | null
          id: number
          ingreso: string | null
          latitud: number | null
          longitud: number | null
          obra_id: number
          obra_nombre: string | null
          rut: string | null
          rut_normalizado: string | null
          salida: string | null
          supervisor: string | null
          trabajador: string | null
          verificado_qr: boolean | null
        }
        Insert: {
          asistencia?: string | null
          colacion?: string | null
          created_at?: string | null
          distancia_obra_m?: number | null
          empresa: string
          fecha_marcacion?: string
          firma_base64?: string | null
          horas_extras_auto?: number | null
          horas_extras_manual?: number | null
          horas_ordinarias?: number | null
          id?: number
          ingreso?: string | null
          latitud?: number | null
          longitud?: number | null
          obra_id: number
          obra_nombre?: string | null
          rut?: string | null
          rut_normalizado?: string | null
          salida?: string | null
          supervisor?: string | null
          trabajador?: string | null
          verificado_qr?: boolean | null
        }
        Update: {
          asistencia?: string | null
          colacion?: string | null
          created_at?: string | null
          distancia_obra_m?: number | null
          empresa?: string
          fecha_marcacion?: string
          firma_base64?: string | null
          horas_extras_auto?: number | null
          horas_extras_manual?: number | null
          horas_ordinarias?: number | null
          id?: number
          ingreso?: string | null
          latitud?: number | null
          longitud?: number | null
          obra_id?: number
          obra_nombre?: string | null
          rut?: string | null
          rut_normalizado?: string | null
          salida?: string | null
          supervisor?: string | null
          trabajador?: string | null
          verificado_qr?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "asistencia_personal_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asistencia_personal_obra_nombre_fkey"
            columns: ["obra_nombre"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["nombre"]
          },
        ]
      }
      auditoria_plataforma: {
        Row: {
          accion: string
          actor_auth_user_id: string | null
          actor_empresa: string | null
          actor_nombre: string | null
          actor_rol: string | null
          actor_usuario: string | null
          categoria: string
          created_at: string
          descripcion: string | null
          empresa: string
          entidad_id: string | null
          entidad_tipo: string | null
          id: number
          metadatos: Json
          modulo: string
          nivel: string
          obra_nombre: string | null
          origen: string
          resultado: string
          source_id: string | null
          source_table: string | null
        }
        Insert: {
          accion: string
          actor_auth_user_id?: string | null
          actor_empresa?: string | null
          actor_nombre?: string | null
          actor_rol?: string | null
          actor_usuario?: string | null
          categoria?: string
          created_at?: string
          descripcion?: string | null
          empresa: string
          entidad_id?: string | null
          entidad_tipo?: string | null
          id?: number
          metadatos?: Json
          modulo: string
          nivel?: string
          obra_nombre?: string | null
          origen?: string
          resultado?: string
          source_id?: string | null
          source_table?: string | null
        }
        Update: {
          accion?: string
          actor_auth_user_id?: string | null
          actor_empresa?: string | null
          actor_nombre?: string | null
          actor_rol?: string | null
          actor_usuario?: string | null
          categoria?: string
          created_at?: string
          descripcion?: string | null
          empresa?: string
          entidad_id?: string | null
          entidad_tipo?: string | null
          id?: number
          metadatos?: Json
          modulo?: string
          nivel?: string
          obra_nombre?: string | null
          origen?: string
          resultado?: string
          source_id?: string | null
          source_table?: string | null
        }
        Relationships: []
      }
      auth_login_intentos: {
        Row: {
          clave_hash: string
          created_at: string
          exitoso: boolean
          id: number
        }
        Insert: {
          clave_hash: string
          created_at?: string
          exitoso?: boolean
          id?: number
        }
        Update: {
          clave_hash?: string
          created_at?: string
          exitoso?: boolean
          id?: number
        }
        Relationships: []
      }
      avances_produccion_partidas: {
        Row: {
          cantidad: number | null
          created_at: string | null
          empresa: string
          frente: string | null
          horas_cuadrilla: number | null
          id: number
          obra_id: number
          obra_nombre: string | null
          observaciones: string | null
          partida: string | null
          partida_id: number | null
          cuadrilla_id: number | null
          cuadrilla_miembros: Json
          cuadrilla_nombre: string | null
          supervisor: string | null
          unidad: string | null
        }
        Insert: {
          cantidad?: number | null
          created_at?: string | null
          empresa: string
          frente?: string | null
          horas_cuadrilla?: number | null
          id?: number
          obra_id: number
          obra_nombre?: string | null
          observaciones?: string | null
          partida?: string | null
          partida_id?: number | null
          cuadrilla_id?: number | null
          cuadrilla_miembros?: Json
          cuadrilla_nombre?: string | null
          supervisor?: string | null
          unidad?: string | null
        }
        Update: {
          cantidad?: number | null
          created_at?: string | null
          empresa?: string
          frente?: string | null
          horas_cuadrilla?: number | null
          id?: number
          obra_id?: number
          obra_nombre?: string | null
          observaciones?: string | null
          partida?: string | null
          partida_id?: number | null
          cuadrilla_id?: number | null
          cuadrilla_miembros?: Json
          cuadrilla_nombre?: string | null
          supervisor?: string | null
          unidad?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "avances_produccion_partidas_cuadrilla_id_fkey"
            columns: ["cuadrilla_id"]
            isOneToOne: false
            referencedRelation: "obra_cuadrillas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avances_produccion_partidas_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avances_produccion_partidas_partida_id_fkey"
            columns: ["partida_id"]
            isOneToOne: false
            referencedRelation: "partidas_obra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avances_produccion_partidas_obra_nombre_fkey"
            columns: ["obra_nombre"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["nombre"]
          },
        ]
      }
      bitacora_eventos_obra: {
        Row: {
          accion: string
          actor: string
          categoria: string
          created_at: string
          detalle: string | null
          empresa: string
          fecha: string
          id: number
          obra_nombre: string
        }
        Insert: {
          accion: string
          actor?: string
          categoria: string
          created_at?: string
          detalle?: string | null
          empresa: string
          fecha?: string
          id?: number
          obra_nombre: string
        }
        Update: {
          accion?: string
          actor?: string
          categoria?: string
          created_at?: string
          detalle?: string | null
          empresa?: string
          fecha?: string
          id?: number
          obra_nombre?: string
        }
        Relationships: []
      }
      bodega_bodegas: {
        Row: {
          activo: boolean
          centro_gestion_id: number
          codigo: string
          created_at: string
          empresa: string
          id: number
          nombre: string
          obra_nombre: string | null
          responsable: string | null
          tipo: string
          ubicacion: string | null
          updated_at: string
        }
        Insert: {
          activo?: boolean
          centro_gestion_id: number
          codigo: string
          created_at?: string
          empresa: string
          id?: number
          nombre: string
          obra_nombre?: string | null
          responsable?: string | null
          tipo?: string
          ubicacion?: string | null
          updated_at?: string
        }
        Update: {
          activo?: boolean
          centro_gestion_id?: number
          codigo?: string
          created_at?: string
          empresa?: string
          id?: number
          nombre?: string
          obra_nombre?: string | null
          responsable?: string | null
          tipo?: string
          ubicacion?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bodega_bodegas_centro_gestion_id_fkey"
            columns: ["centro_gestion_id"]
            isOneToOne: false
            referencedRelation: "facturacion_centros_gestion"
            referencedColumns: ["id"]
          },
        ]
      }
      bodega_movimientos: {
        Row: {
          bodega_id: number
          cantidad: number
          centro_gestion_id: number | null
          contraparte: string | null
          costo_unitario: number
          created_at: string
          documento: string | null
          dte_documento_id: string | null
          empresa: string
          estado_validacion: string
          fecha: string
          id: number
          obra_nombre: string | null
          observaciones: string | null
          producto_id: number
          responsable: string | null
          tipo: string
          tipo_documento: string | null
          transferencia_id: string | null
          validado_at: string | null
          validado_por: string | null
        }
        Insert: {
          bodega_id: number
          cantidad: number
          centro_gestion_id?: number | null
          contraparte?: string | null
          costo_unitario?: number
          created_at?: string
          documento?: string | null
          dte_documento_id?: string | null
          empresa: string
          estado_validacion?: string
          fecha?: string
          id?: number
          obra_nombre?: string | null
          observaciones?: string | null
          producto_id: number
          responsable?: string | null
          tipo: string
          tipo_documento?: string | null
          transferencia_id?: string | null
          validado_at?: string | null
          validado_por?: string | null
        }
        Update: {
          bodega_id?: number
          cantidad?: number
          centro_gestion_id?: number | null
          contraparte?: string | null
          costo_unitario?: number
          created_at?: string
          documento?: string | null
          dte_documento_id?: string | null
          empresa?: string
          estado_validacion?: string
          fecha?: string
          id?: number
          obra_nombre?: string | null
          observaciones?: string | null
          producto_id?: number
          responsable?: string | null
          tipo?: string
          tipo_documento?: string | null
          transferencia_id?: string | null
          validado_at?: string | null
          validado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bodega_movimientos_bodega_id_fkey"
            columns: ["bodega_id"]
            isOneToOne: false
            referencedRelation: "bodega_bodegas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bodega_movimientos_centro_gestion_id_fkey"
            columns: ["centro_gestion_id"]
            isOneToOne: false
            referencedRelation: "facturacion_centros_gestion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bodega_movimientos_dte_documento_id_fkey"
            columns: ["dte_documento_id"]
            isOneToOne: false
            referencedRelation: "dte_documentos_operacion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bodega_movimientos_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "bodega_productos"
            referencedColumns: ["id"]
          },
        ]
      }
      bodega_productos: {
        Row: {
          activo: boolean
          categoria: string
          codigo: string
          costo_referencia: number
          created_at: string
          empresa: string
          id: number
          nombre: string
          stock_minimo: number
          unidad: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          categoria?: string
          codigo: string
          costo_referencia?: number
          created_at?: string
          empresa: string
          id?: number
          nombre: string
          stock_minimo?: number
          unidad?: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          categoria?: string
          codigo?: string
          costo_referencia?: number
          created_at?: string
          empresa?: string
          id?: number
          nombre?: string
          stock_minimo?: number
          unidad?: string
          updated_at?: string
        }
        Relationships: []
      }
      calidad_no_conformidades: {
        Row: {
          accion_correctiva: string | null
          causa_categoria: string
          causa_raiz: string | null
          clasificacion: string
          codigo: string
          correccion_inmediata: string | null
          created_at: string | null
          descripcion: string
          eficacia_verificada: boolean
          empresa: string | null
          estado: string
          fecha_cierre: string | null
          fecha_compromiso: string | null
          fecha_verificacion: string | null
          fecha_verificacion_eficacia: string | null
          id: number
          impacto: string
          metodo_causa_raiz: string
          obra_nombre: string
          observacion_verificacion: string | null
          origen: string
          partida: string
          rdi_id: number | null
          responsable: string
          trazabilidad: Json
          updated_at: string | null
          verificado_por: string | null
        }
        Insert: {
          accion_correctiva?: string | null
          causa_categoria?: string
          causa_raiz?: string | null
          clasificacion?: string
          codigo: string
          correccion_inmediata?: string | null
          created_at?: string | null
          descripcion: string
          eficacia_verificada?: boolean
          empresa?: string | null
          estado?: string
          fecha_cierre?: string | null
          fecha_compromiso?: string | null
          fecha_verificacion?: string | null
          fecha_verificacion_eficacia?: string | null
          id?: number
          impacto?: string
          metodo_causa_raiz?: string
          obra_nombre: string
          observacion_verificacion?: string | null
          origen?: string
          partida: string
          rdi_id?: number | null
          responsable: string
          trazabilidad?: Json
          updated_at?: string | null
          verificado_por?: string | null
        }
        Update: {
          accion_correctiva?: string | null
          causa_categoria?: string
          causa_raiz?: string | null
          clasificacion?: string
          codigo?: string
          correccion_inmediata?: string | null
          created_at?: string | null
          descripcion?: string
          eficacia_verificada?: boolean
          empresa?: string | null
          estado?: string
          fecha_cierre?: string | null
          fecha_compromiso?: string | null
          fecha_verificacion?: string | null
          fecha_verificacion_eficacia?: string | null
          id?: number
          impacto?: string
          metodo_causa_raiz?: string
          obra_nombre?: string
          observacion_verificacion?: string | null
          origen?: string
          partida?: string
          rdi_id?: number | null
          responsable?: string
          trazabilidad?: Json
          updated_at?: string | null
          verificado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calidad_no_conformidades_rdi_id_fkey"
            columns: ["rdi_id"]
            isOneToOne: false
            referencedRelation: "calidad_rdi"
            referencedColumns: ["id"]
          },
        ]
      }
      calidad_pac: {
        Row: {
          created_at: string | null
          criterios: string
          empresa: string
          estado: string
          id: number
          obra_nombre: string
          partida: string
          procedimiento: string
          puntos_espera: string | null
          puntos_inspeccion: string | null
          responsable: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          criterios: string
          empresa: string
          estado?: string
          id?: number
          obra_nombre: string
          partida: string
          procedimiento: string
          puntos_espera?: string | null
          puntos_inspeccion?: string | null
          responsable?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          criterios?: string
          empresa?: string
          estado?: string
          id?: number
          obra_nombre?: string
          partida?: string
          procedimiento?: string
          puntos_espera?: string | null
          puntos_inspeccion?: string | null
          responsable?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      calidad_rdi: {
        Row: {
          cantidad: number | null
          codigo: string
          created_at: string | null
          empresa: string
          estado: string
          evidencia_urls: Json | null
          fecha_inspeccion: string | null
          fecha_solicitud: string
          id: number
          inspector: string | null
          obra_nombre: string
          observaciones: string | null
          pac_id: number | null
          partida: string
          sector: string
          solicitado_por: string
          trazabilidad: Json
          unidad: string | null
          updated_at: string | null
        }
        Insert: {
          cantidad?: number | null
          codigo: string
          created_at?: string | null
          empresa: string
          estado?: string
          evidencia_urls?: Json | null
          fecha_inspeccion?: string | null
          fecha_solicitud?: string
          id?: number
          inspector?: string | null
          obra_nombre: string
          observaciones?: string | null
          pac_id?: number | null
          partida: string
          sector: string
          solicitado_por: string
          trazabilidad?: Json
          unidad?: string | null
          updated_at?: string | null
        }
        Update: {
          cantidad?: number | null
          codigo?: string
          created_at?: string | null
          empresa?: string
          estado?: string
          evidencia_urls?: Json | null
          fecha_inspeccion?: string | null
          fecha_solicitud?: string
          id?: number
          inspector?: string | null
          obra_nombre?: string
          observaciones?: string | null
          pac_id?: number | null
          partida?: string
          sector?: string
          solicitado_por?: string
          trazabilidad?: Json
          unidad?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calidad_rdi_pac_id_fkey"
            columns: ["pac_id"]
            isOneToOne: false
            referencedRelation: "calidad_pac"
            referencedColumns: ["id"]
          },
        ]
      }
      calidad_recepcion_controles: {
        Row: {
          created_at: string | null
          evidencia_urls: Json
          fecha_revision: string | null
          id: number
          observacion: string | null
          pac_id: number | null
          punto: string
          recepcion_id: number
          resultado: string
          revisado_por: string | null
          tipo: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          evidencia_urls?: Json
          fecha_revision?: string | null
          id?: number
          observacion?: string | null
          pac_id?: number | null
          punto: string
          recepcion_id: number
          resultado?: string
          revisado_por?: string | null
          tipo?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          evidencia_urls?: Json
          fecha_revision?: string | null
          id?: number
          observacion?: string | null
          pac_id?: number | null
          punto?: string
          recepcion_id?: number
          resultado?: string
          revisado_por?: string | null
          tipo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calidad_recepcion_controles_pac_id_fkey"
            columns: ["pac_id"]
            isOneToOne: false
            referencedRelation: "calidad_pac"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calidad_recepcion_controles_recepcion_id_fkey"
            columns: ["recepcion_id"]
            isOneToOne: false
            referencedRelation: "calidad_recepciones_partidas"
            referencedColumns: ["id"]
          },
        ]
      }
      calidad_recepciones_partidas: {
        Row: {
          cantidad: number | null
          codigo: string
          created_at: string | null
          empresa: string
          entrega_por: string
          estado: string
          fecha_entrega: string
          id: number
          obra_nombre: string
          observaciones: string | null
          pac_id: number | null
          partida: string
          rdi_id: number | null
          recibe_por: string | null
          sector: string | null
          trazabilidad: Json
          unidad: string | null
          updated_at: string | null
        }
        Insert: {
          cantidad?: number | null
          codigo: string
          created_at?: string | null
          empresa: string
          entrega_por: string
          estado?: string
          fecha_entrega?: string
          id?: number
          obra_nombre: string
          observaciones?: string | null
          pac_id?: number | null
          partida: string
          rdi_id?: number | null
          recibe_por?: string | null
          sector?: string | null
          trazabilidad?: Json
          unidad?: string | null
          updated_at?: string | null
        }
        Update: {
          cantidad?: number | null
          codigo?: string
          created_at?: string | null
          empresa?: string
          entrega_por?: string
          estado?: string
          fecha_entrega?: string
          id?: number
          obra_nombre?: string
          observaciones?: string | null
          pac_id?: number | null
          partida?: string
          rdi_id?: number | null
          recibe_por?: string | null
          sector?: string | null
          trazabilidad?: Json
          unidad?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calidad_recepciones_partidas_pac_id_fkey"
            columns: ["pac_id"]
            isOneToOne: false
            referencedRelation: "calidad_pac"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calidad_recepciones_partidas_rdi_id_fkey"
            columns: ["rdi_id"]
            isOneToOne: false
            referencedRelation: "calidad_rdi"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes_portal_eventos: {
        Row: {
          accion: string
          actor: string | null
          created_at: string
          detalle: string | null
          empresa: string
          id: number
          metadata: Json
          obra_nombre: string | null
          portal_id: string | null
        }
        Insert: {
          accion: string
          actor?: string | null
          created_at?: string
          detalle?: string | null
          empresa: string
          id?: number
          metadata?: Json
          obra_nombre?: string | null
          portal_id?: string | null
        }
        Update: {
          accion?: string
          actor?: string | null
          created_at?: string
          detalle?: string | null
          empresa?: string
          id?: number
          metadata?: Json
          obra_nombre?: string | null
          portal_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clientes_portal_eventos_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "clientes_portales"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes_portal_obras: {
        Row: {
          created_at: string
          empresa: string
          id: number
          obra_nombre: string
          permisos: Json
          permite_comentar: boolean
          portal_id: string
          publicada: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          empresa: string
          id?: number
          obra_nombre: string
          permisos?: Json
          permite_comentar?: boolean
          portal_id: string
          publicada?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          empresa?: string
          id?: number
          obra_nombre?: string
          permisos?: Json
          permite_comentar?: boolean
          portal_id?: string
          publicada?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clientes_portal_obras_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "clientes_portales"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes_portales: {
        Row: {
          activo: boolean
          clave_hash: string
          cliente_nombre: string
          cliente_rut: string
          contacto_cargo: string | null
          contacto_email: string
          contacto_nombre: string
          creado_por: string | null
          created_at: string
          empresa: string
          id: string
          token: string
          ultimo_acceso: string | null
          updated_at: string
        }
        Insert: {
          activo?: boolean
          clave_hash: string
          cliente_nombre: string
          cliente_rut: string
          contacto_cargo?: string | null
          contacto_email: string
          contacto_nombre: string
          creado_por?: string | null
          created_at?: string
          empresa: string
          id?: string
          token?: string
          ultimo_acceso?: string | null
          updated_at?: string
        }
        Update: {
          activo?: boolean
          clave_hash?: string
          cliente_nombre?: string
          cliente_rut?: string
          contacto_cargo?: string | null
          contacto_email?: string
          contacto_nombre?: string
          creado_por?: string | null
          created_at?: string
          empresa?: string
          id?: string
          token?: string
          ultimo_acceso?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      colaboraciones_obra: {
        Row: {
          correo_contacto: string | null
          created_at: string
          empresa_colaboradora: string
          empresa_contratista: string
          estado: string
          id: number
          invitado_en: string
          invitado_por: string | null
          obra_nombre: string
          observacion: string | null
          permisos: Json
          respondido_en: string | null
          respondido_por: string | null
          rut_colaboradora: string
          rut_contratista: string
        }
        Insert: {
          correo_contacto?: string | null
          created_at?: string
          empresa_colaboradora: string
          empresa_contratista: string
          estado?: string
          id?: number
          invitado_en?: string
          invitado_por?: string | null
          obra_nombre: string
          observacion?: string | null
          permisos?: Json
          respondido_en?: string | null
          respondido_por?: string | null
          rut_colaboradora: string
          rut_contratista: string
        }
        Update: {
          correo_contacto?: string | null
          created_at?: string
          empresa_colaboradora?: string
          empresa_contratista?: string
          estado?: string
          id?: number
          invitado_en?: string
          invitado_por?: string | null
          obra_nombre?: string
          observacion?: string | null
          permisos?: Json
          respondido_en?: string | null
          respondido_por?: string | null
          rut_colaboradora?: string
          rut_contratista?: string
        }
        Relationships: []
      }
      compras_conciliaciones: {
        Row: {
          alertas: Json
          centro_gestion_id: number | null
          created_at: string
          diferencia_cantidad: number
          diferencia_monto: number
          empresa: string
          estado: string
          factura_id: string | null
          guia_id: string | null
          id: string
          monto_factura: number
          monto_nota_credito: number
          monto_oc: number
          monto_recepcion: number
          nota_credito_id: string | null
          numero_oc: string | null
          obra_nombre: string | null
          observaciones: string | null
          proveedor_nombre: string | null
          proveedor_rut: string | null
          revisado_at: string | null
          revisado_por: string | null
          updated_at: string
        }
        Insert: {
          alertas?: Json
          centro_gestion_id?: number | null
          created_at?: string
          diferencia_cantidad?: number
          diferencia_monto?: number
          empresa: string
          estado?: string
          factura_id?: string | null
          guia_id?: string | null
          id?: string
          monto_factura?: number
          monto_nota_credito?: number
          monto_oc?: number
          monto_recepcion?: number
          nota_credito_id?: string | null
          numero_oc?: string | null
          obra_nombre?: string | null
          observaciones?: string | null
          proveedor_nombre?: string | null
          proveedor_rut?: string | null
          revisado_at?: string | null
          revisado_por?: string | null
          updated_at?: string
        }
        Update: {
          alertas?: Json
          centro_gestion_id?: number | null
          created_at?: string
          diferencia_cantidad?: number
          diferencia_monto?: number
          empresa?: string
          estado?: string
          factura_id?: string | null
          guia_id?: string | null
          id?: string
          monto_factura?: number
          monto_nota_credito?: number
          monto_oc?: number
          monto_recepcion?: number
          nota_credito_id?: string | null
          numero_oc?: string | null
          obra_nombre?: string | null
          observaciones?: string | null
          proveedor_nombre?: string | null
          proveedor_rut?: string | null
          revisado_at?: string | null
          revisado_por?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "compras_conciliaciones_centro_gestion_id_fkey"
            columns: ["centro_gestion_id"]
            isOneToOne: false
            referencedRelation: "facturacion_centros_gestion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compras_conciliaciones_factura_id_fkey"
            columns: ["factura_id"]
            isOneToOne: false
            referencedRelation: "dte_documentos_operacion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compras_conciliaciones_guia_id_fkey"
            columns: ["guia_id"]
            isOneToOne: false
            referencedRelation: "dte_documentos_operacion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compras_conciliaciones_nota_credito_id_fkey"
            columns: ["nota_credito_id"]
            isOneToOne: false
            referencedRelation: "dte_documentos_operacion"
            referencedColumns: ["id"]
          },
        ]
      }
      condiciones_pago_obra: {
        Row: {
          anticipo_pct: number
          aprobador_email: string | null
          aprobador_nombre: string | null
          created_at: string
          empresa: string
          id: number
          obra_nombre: string
          revisor_email: string | null
          revisor_nombre: string | null
          updated_at: string
        }
        Insert: {
          anticipo_pct?: number
          aprobador_email?: string | null
          aprobador_nombre?: string | null
          created_at?: string
          empresa: string
          id?: number
          obra_nombre: string
          revisor_email?: string | null
          revisor_nombre?: string | null
          updated_at?: string
        }
        Update: {
          anticipo_pct?: number
          aprobador_email?: string | null
          aprobador_nombre?: string | null
          created_at?: string
          empresa?: string
          id?: number
          obra_nombre?: string
          revisor_email?: string | null
          revisor_nombre?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      config_correos: {
        Row: {
          correos: string
          created_at: string | null
          empresa: string
          filtro: string | null
          id: number
          tipo: string
        }
        Insert: {
          correos: string
          created_at?: string | null
          empresa: string
          filtro?: string | null
          id?: number
          tipo: string
        }
        Update: {
          correos?: string
          created_at?: string | null
          empresa?: string
          filtro?: string | null
          id?: number
          tipo?: string
        }
        Relationships: []
      }
      config_empresa: {
        Row: {
          administrador: string | null
          color_primario: string | null
          color_secundario: string | null
          comuna: string | null
          configuracion_completa: boolean
          correo_administrador: string | null
          correos_contextuales: Json
          created_at: string | null
          direccion: string | null
          email_notificaciones: string | null
          email_notificaciones_cc: string | null
          email_sender: string | null
          empresa: string
          giro: string | null
          id: number
          logo_base64: string | null
          modulos_activos: string | null
          moneda: string
          notificaciones_automaticas: boolean
          pais: string
          razon_social: string | null
          rut: string | null
          submenus_activos: string | null
          telefono: string | null
          updated_at: string
          zona_horaria: string
        }
        Insert: {
          administrador?: string | null
          color_primario?: string | null
          color_secundario?: string | null
          comuna?: string | null
          configuracion_completa?: boolean
          correo_administrador?: string | null
          correos_contextuales?: Json
          created_at?: string | null
          direccion?: string | null
          email_notificaciones?: string | null
          email_notificaciones_cc?: string | null
          email_sender?: string | null
          empresa: string
          giro?: string | null
          id?: number
          logo_base64?: string | null
          modulos_activos?: string | null
          moneda?: string
          notificaciones_automaticas?: boolean
          pais?: string
          razon_social?: string | null
          rut?: string | null
          submenus_activos?: string | null
          telefono?: string | null
          updated_at?: string
          zona_horaria?: string
        }
        Update: {
          administrador?: string | null
          color_primario?: string | null
          color_secundario?: string | null
          comuna?: string | null
          configuracion_completa?: boolean
          correo_administrador?: string | null
          correos_contextuales?: Json
          created_at?: string | null
          direccion?: string | null
          email_notificaciones?: string | null
          email_notificaciones_cc?: string | null
          email_sender?: string | null
          empresa?: string
          giro?: string | null
          id?: number
          logo_base64?: string | null
          modulos_activos?: string | null
          moneda?: string
          notificaciones_automaticas?: boolean
          pais?: string
          razon_social?: string | null
          rut?: string | null
          submenus_activos?: string | null
          telefono?: string | null
          updated_at?: string
          zona_horaria?: string
        }
        Relationships: []
      }
      config_global_obraxis: {
        Row: {
          actualizado_por: string | null
          archivo_max_mb: number
          correo_habilitado: boolean
          correo_remitente: string
          correo_respuesta: string
          correo_soporte: string
          hora_resumen_diario: string
          ia_archivo_max_mb: number
          ia_confianza_minima: number
          ia_habilitada: boolean
          ia_modelo: string
          ia_proveedor: string
          id: number
          idioma: string
          mantenimiento_activo: boolean
          mensaje_mantenimiento: string
          modulos_empresa_nueva: string
          moneda: string
          nombre_plataforma: string
          pais: string
          retencion_auditoria_anos: number
          retencion_documentos_anos: number
          submenus_empresa_nueva: string
          updated_at: string
          url_publica: string
          zona_horaria: string
        }
        Insert: {
          actualizado_por?: string | null
          archivo_max_mb?: number
          correo_habilitado?: boolean
          correo_remitente?: string
          correo_respuesta?: string
          correo_soporte?: string
          hora_resumen_diario?: string
          ia_archivo_max_mb?: number
          ia_confianza_minima?: number
          ia_habilitada?: boolean
          ia_modelo?: string
          ia_proveedor?: string
          id?: number
          idioma?: string
          mantenimiento_activo?: boolean
          mensaje_mantenimiento?: string
          modulos_empresa_nueva?: string
          moneda?: string
          nombre_plataforma?: string
          pais?: string
          retencion_auditoria_anos?: number
          retencion_documentos_anos?: number
          submenus_empresa_nueva?: string
          updated_at?: string
          url_publica?: string
          zona_horaria?: string
        }
        Update: {
          actualizado_por?: string | null
          archivo_max_mb?: number
          correo_habilitado?: boolean
          correo_remitente?: string
          correo_respuesta?: string
          correo_soporte?: string
          hora_resumen_diario?: string
          ia_archivo_max_mb?: number
          ia_confianza_minima?: number
          ia_habilitada?: boolean
          ia_modelo?: string
          ia_proveedor?: string
          id?: number
          idioma?: string
          mantenimiento_activo?: boolean
          mensaje_mantenimiento?: string
          modulos_empresa_nueva?: string
          moneda?: string
          nombre_plataforma?: string
          pais?: string
          retencion_auditoria_anos?: number
          retencion_documentos_anos?: number
          submenus_empresa_nueva?: string
          updated_at?: string
          url_publica?: string
          zona_horaria?: string
        }
        Relationships: []
      }
      contactos_publicos: {
        Row: {
          cerrado_at: string | null
          contactado_at: string | null
          correo: string
          created_at: string
          empresa: string
          empresa_interesada: string | null
          estado: string
          id: number
          ip_hash: string | null
          mensaje: string
          nombre: string
          notas_internas: string | null
          origen: string
          resend_id: string | null
          responsable_auth_user_id: string | null
          responsable_nombre: string | null
          telefono: string | null
          updated_at: string
        }
        Insert: {
          cerrado_at?: string | null
          contactado_at?: string | null
          correo: string
          created_at?: string
          empresa?: string
          empresa_interesada?: string | null
          estado?: string
          id?: number
          ip_hash?: string | null
          mensaje: string
          nombre: string
          notas_internas?: string | null
          origen?: string
          resend_id?: string | null
          responsable_auth_user_id?: string | null
          responsable_nombre?: string | null
          telefono?: string | null
          updated_at?: string
        }
        Update: {
          cerrado_at?: string | null
          contactado_at?: string | null
          correo?: string
          created_at?: string
          empresa?: string
          empresa_interesada?: string | null
          estado?: string
          id?: number
          ip_hash?: string | null
          mensaje?: string
          nombre?: string
          notas_internas?: string | null
          origen?: string
          resend_id?: string | null
          responsable_auth_user_id?: string | null
          responsable_nombre?: string | null
          telefono?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      contratos_colaborativos: {
        Row: {
          aceptado_at: string | null
          aceptado_por: string | null
          codigo: string
          colaboracion_id: number
          creado_por: string | null
          created_at: string
          empresa_colaboradora: string
          empresa_contratista: string
          especialidad: string | null
          estado: string
          fecha_inicio: string | null
          fecha_termino: string | null
          id: string
          monto_contrato: number
          nombre: string
          obra_colaboradora_id: number | null
          obra_colaboradora_nombre: string | null
          obra_contratista_id: number
          obra_contratista_nombre: string
          permisos_compartidos: Json
          rut_colaboradora: string | null
          rut_contratista: string | null
          updated_at: string
        }
        Insert: {
          aceptado_at?: string | null
          aceptado_por?: string | null
          codigo: string
          colaboracion_id: number
          creado_por?: string | null
          created_at?: string
          empresa_colaboradora: string
          empresa_contratista: string
          especialidad?: string | null
          estado?: string
          fecha_inicio?: string | null
          fecha_termino?: string | null
          id?: string
          monto_contrato?: number
          nombre: string
          obra_colaboradora_id?: number | null
          obra_colaboradora_nombre?: string | null
          obra_contratista_id: number
          obra_contratista_nombre: string
          permisos_compartidos?: Json
          rut_colaboradora?: string | null
          rut_contratista?: string | null
          updated_at?: string
        }
        Update: {
          aceptado_at?: string | null
          aceptado_por?: string | null
          codigo?: string
          colaboracion_id?: number
          creado_por?: string | null
          created_at?: string
          empresa_colaboradora?: string
          empresa_contratista?: string
          especialidad?: string | null
          estado?: string
          fecha_inicio?: string | null
          fecha_termino?: string | null
          id?: string
          monto_contrato?: number
          nombre?: string
          obra_colaboradora_id?: number | null
          obra_colaboradora_nombre?: string | null
          obra_contratista_id?: number
          obra_contratista_nombre?: string
          permisos_compartidos?: Json
          rut_colaboradora?: string | null
          rut_contratista?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contratos_colaborativos_colaboracion_id_fkey"
            columns: ["colaboracion_id"]
            isOneToOne: false
            referencedRelation: "colaboraciones_obra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_colaborativos_obra_colaboradora_id_fkey"
            columns: ["obra_colaboradora_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_colaborativos_obra_contratista_id_fkey"
            columns: ["obra_contratista_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      contratos_colaborativos_eventos: {
        Row: {
          accion: string
          actor_auth_id: string | null
          actor_nombre: string | null
          contrato_id: string
          created_at: string
          detalle: string | null
          empresa: string
          estado_resultante: string | null
          id: number
        }
        Insert: {
          accion: string
          actor_auth_id?: string | null
          actor_nombre?: string | null
          contrato_id: string
          created_at?: string
          detalle?: string | null
          empresa: string
          estado_resultante?: string | null
          id?: number
        }
        Update: {
          accion?: string
          actor_auth_id?: string | null
          actor_nombre?: string | null
          contrato_id?: string
          created_at?: string
          detalle?: string | null
          empresa?: string
          estado_resultante?: string | null
          id?: number
        }
        Relationships: [
          {
            foreignKeyName: "contratos_colaborativos_eventos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos_colaborativos"
            referencedColumns: ["id"]
          },
        ]
      }
      contratos_colaborativos_partidas: {
        Row: {
          aceptado_at: string | null
          aceptado_por: string | null
          cantidad_contratada: number
          codigo_colaboradora: string | null
          codigo_contratista: string | null
          contrato_id: string
          creado_por: string | null
          created_at: string
          estado: string
          factor_conversion: number
          id: string
          nombre_colaboradora: string | null
          nombre_contratista: string
          observacion: string | null
          partida_colaboradora_id: number | null
          partida_contratista_id: number
          ponderacion: number
          unidad_colaboradora: string | null
          unidad_contratista: string | null
          updated_at: string
        }
        Insert: {
          aceptado_at?: string | null
          aceptado_por?: string | null
          cantidad_contratada?: number
          codigo_colaboradora?: string | null
          codigo_contratista?: string | null
          contrato_id: string
          creado_por?: string | null
          created_at?: string
          estado?: string
          factor_conversion?: number
          id?: string
          nombre_colaboradora?: string | null
          nombre_contratista: string
          observacion?: string | null
          partida_colaboradora_id?: number | null
          partida_contratista_id: number
          ponderacion?: number
          unidad_colaboradora?: string | null
          unidad_contratista?: string | null
          updated_at?: string
        }
        Update: {
          aceptado_at?: string | null
          aceptado_por?: string | null
          cantidad_contratada?: number
          codigo_colaboradora?: string | null
          codigo_contratista?: string | null
          contrato_id?: string
          creado_por?: string | null
          created_at?: string
          estado?: string
          factor_conversion?: number
          id?: string
          nombre_colaboradora?: string | null
          nombre_contratista?: string
          observacion?: string | null
          partida_colaboradora_id?: number | null
          partida_contratista_id?: number
          ponderacion?: number
          unidad_colaboradora?: string | null
          unidad_contratista?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contratos_colaborativos_partidas_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos_colaborativos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_colaborativos_partidas_partida_colaboradora_id_fkey"
            columns: ["partida_colaboradora_id"]
            isOneToOne: false
            referencedRelation: "partidas_obra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_colaborativos_partidas_partida_contratista_id_fkey"
            columns: ["partida_contratista_id"]
            isOneToOne: false
            referencedRelation: "partidas_obra"
            referencedColumns: ["id"]
          },
        ]
      }
      copiloto_obra_consultas: {
        Row: {
          auth_user_id: string
          created_at: string
          empresa: string
          ia_consumo_id: string | null
          id: string
          obra_nombre: string
          pregunta: string
          respuesta: Json
          usuario: string | null
        }
        Insert: {
          auth_user_id: string
          created_at?: string
          empresa: string
          ia_consumo_id?: string | null
          id?: string
          obra_nombre: string
          pregunta: string
          respuesta?: Json
          usuario?: string | null
        }
        Update: {
          auth_user_id?: string
          created_at?: string
          empresa?: string
          ia_consumo_id?: string | null
          id?: string
          obra_nombre?: string
          pregunta?: string
          respuesta?: Json
          usuario?: string | null
        }
        Relationships: []
      }
      correo_sistema_intentos: {
        Row: {
          actor_id: string | null
          canal: string
          created_at: string
          exitoso: boolean
          id: number
          ip_hash: string
        }
        Insert: {
          actor_id?: string | null
          canal: string
          created_at?: string
          exitoso?: boolean
          id?: never
          ip_hash: string
        }
        Update: {
          actor_id?: string | null
          canal?: string
          created_at?: string
          exitoso?: boolean
          id?: never
          ip_hash?: string
        }
        Relationships: []
      }
      costos_reales_obra: {
        Row: {
          asociar_factura: boolean | null
          created_at: string | null
          empresa: string | null
          id: number
          imputaciones: Json | null
          monto: number
          nombre: string
          num_factura: string | null
          obra_nombre: string
          origen: string | null
          origen_id: number | null
          tipo_costo: string | null
        }
        Insert: {
          asociar_factura?: boolean | null
          created_at?: string | null
          empresa?: string | null
          id?: number
          imputaciones?: Json | null
          monto?: number
          nombre: string
          num_factura?: string | null
          obra_nombre: string
          origen?: string | null
          origen_id?: number | null
          tipo_costo?: string | null
        }
        Update: {
          asociar_factura?: boolean | null
          created_at?: string | null
          empresa?: string | null
          id?: number
          imputaciones?: Json | null
          monto?: number
          nombre?: string
          num_factura?: string | null
          obra_nombre?: string
          origen?: string | null
          origen_id?: number | null
          tipo_costo?: string | null
        }
        Relationships: []
      }
      dte_configuracion: {
        Row: {
          ambiente: string
          certificado_estado: string
          codigo_actividad: string | null
          comuna: string | null
          creado_por: string | null
          created_at: string
          direccion: string | null
          email_intercambio: string | null
          empresa: string
          giro: string | null
          habilitado: boolean
          modalidad: string
          proveedor_dte: string | null
          razon_social: string | null
          resolucion_fecha: string | null
          resolucion_numero: string | null
          rut_emisor: string | null
          ultima_sincronizacion: string | null
          updated_at: string
        }
        Insert: {
          ambiente?: string
          certificado_estado?: string
          codigo_actividad?: string | null
          comuna?: string | null
          creado_por?: string | null
          created_at?: string
          direccion?: string | null
          email_intercambio?: string | null
          empresa: string
          giro?: string | null
          habilitado?: boolean
          modalidad?: string
          proveedor_dte?: string | null
          razon_social?: string | null
          resolucion_fecha?: string | null
          resolucion_numero?: string | null
          rut_emisor?: string | null
          ultima_sincronizacion?: string | null
          updated_at?: string
        }
        Update: {
          ambiente?: string
          certificado_estado?: string
          codigo_actividad?: string | null
          comuna?: string | null
          creado_por?: string | null
          created_at?: string
          direccion?: string | null
          email_intercambio?: string | null
          empresa?: string
          giro?: string | null
          habilitado?: boolean
          modalidad?: string
          proveedor_dte?: string | null
          razon_social?: string | null
          resolucion_fecha?: string | null
          resolucion_numero?: string | null
          rut_emisor?: string | null
          ultima_sincronizacion?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      dte_documento_items: {
        Row: {
          cantidad: number
          codigo: string | null
          descripcion: string
          descuento: number
          documento_id: string
          exento: boolean
          id: number
          linea: number
          precio_unitario: number
          total_linea: number
          unidad: string | null
        }
        Insert: {
          cantidad?: number
          codigo?: string | null
          descripcion: string
          descuento?: number
          documento_id: string
          exento?: boolean
          id?: number
          linea: number
          precio_unitario?: number
          total_linea?: number
          unidad?: string | null
        }
        Update: {
          cantidad?: number
          codigo?: string | null
          descripcion?: string
          descuento?: number
          documento_id?: string
          exento?: boolean
          id?: number
          linea?: number
          precio_unitario?: number
          total_linea?: number
          unidad?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dte_documento_items_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "dte_documentos_operacion"
            referencedColumns: ["id"]
          },
        ]
      }
      dte_documento_referencias: {
        Row: {
          codigo_referencia: string | null
          documento_id: string
          fecha: string | null
          folio: string
          id: number
          razon: string | null
          tipo_documento: number
        }
        Insert: {
          codigo_referencia?: string | null
          documento_id: string
          fecha?: string | null
          folio: string
          id?: number
          razon?: string | null
          tipo_documento: number
        }
        Update: {
          codigo_referencia?: string | null
          documento_id?: string
          fecha?: string | null
          folio?: string
          id?: number
          razon?: string | null
          tipo_documento?: number
        }
        Relationships: [
          {
            foreignKeyName: "dte_documento_referencias_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "dte_documentos_operacion"
            referencedColumns: ["id"]
          },
        ]
      }
      dte_documentos_operacion: {
        Row: {
          aprobado_por: string | null
          centro_gestion_id: number | null
          comuna_contraparte: string | null
          creado_por: string | null
          created_at: string
          direccion: string
          direccion_contraparte: string | null
          documento_origen: string | null
          email_contraparte: string | null
          empresa: string
          estado: string
          estado_comercial: string
          estado_pago: string
          estado_pago_id: number | null
          estado_sii: string
          fecha_emision: string
          fecha_recepcion: string | null
          fecha_vencimiento: string | null
          folio: number | null
          giro_contraparte: string | null
          id: string
          monto_exento: number
          monto_iva: number
          monto_neto: number
          monto_total: number
          obra_nombre: string | null
          observaciones: string | null
          pdf_url: string | null
          razon_social_contraparte: string
          revisado_por: string | null
          rut_contraparte: string
          tasa_iva: number
          tipo_dte: number
          tipo_nombre: string
          track_id: string | null
          updated_at: string
          xml_url: string | null
        }
        Insert: {
          aprobado_por?: string | null
          centro_gestion_id?: number | null
          comuna_contraparte?: string | null
          creado_por?: string | null
          created_at?: string
          direccion: string
          direccion_contraparte?: string | null
          documento_origen?: string | null
          email_contraparte?: string | null
          empresa: string
          estado?: string
          estado_comercial?: string
          estado_pago?: string
          estado_pago_id?: number | null
          estado_sii?: string
          fecha_emision?: string
          fecha_recepcion?: string | null
          fecha_vencimiento?: string | null
          folio?: number | null
          giro_contraparte?: string | null
          id?: string
          monto_exento?: number
          monto_iva?: number
          monto_neto?: number
          monto_total?: number
          obra_nombre?: string | null
          observaciones?: string | null
          pdf_url?: string | null
          razon_social_contraparte: string
          revisado_por?: string | null
          rut_contraparte: string
          tasa_iva?: number
          tipo_dte: number
          tipo_nombre: string
          track_id?: string | null
          updated_at?: string
          xml_url?: string | null
        }
        Update: {
          aprobado_por?: string | null
          centro_gestion_id?: number | null
          comuna_contraparte?: string | null
          creado_por?: string | null
          created_at?: string
          direccion?: string
          direccion_contraparte?: string | null
          documento_origen?: string | null
          email_contraparte?: string | null
          empresa?: string
          estado?: string
          estado_comercial?: string
          estado_pago?: string
          estado_pago_id?: number | null
          estado_sii?: string
          fecha_emision?: string
          fecha_recepcion?: string | null
          fecha_vencimiento?: string | null
          folio?: number | null
          giro_contraparte?: string | null
          id?: string
          monto_exento?: number
          monto_iva?: number
          monto_neto?: number
          monto_total?: number
          obra_nombre?: string | null
          observaciones?: string | null
          pdf_url?: string | null
          razon_social_contraparte?: string
          revisado_por?: string | null
          rut_contraparte?: string
          tasa_iva?: number
          tipo_dte?: number
          tipo_nombre?: string
          track_id?: string | null
          updated_at?: string
          xml_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dte_documentos_operacion_centro_gestion_id_fkey"
            columns: ["centro_gestion_id"]
            isOneToOne: false
            referencedRelation: "facturacion_centros_gestion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dte_documentos_operacion_estado_pago_id_fkey"
            columns: ["estado_pago_id"]
            isOneToOne: false
            referencedRelation: "estados_pago_obra"
            referencedColumns: ["id"]
          },
        ]
      }
      dte_eventos: {
        Row: {
          accion: string
          actor: string | null
          created_at: string
          detalle: string | null
          documento_id: string
          empresa: string
          estado_destino: string | null
          estado_origen: string | null
          id: number
          metadata: Json
        }
        Insert: {
          accion: string
          actor?: string | null
          created_at?: string
          detalle?: string | null
          documento_id: string
          empresa: string
          estado_destino?: string | null
          estado_origen?: string | null
          id?: number
          metadata?: Json
        }
        Update: {
          accion?: string
          actor?: string | null
          created_at?: string
          detalle?: string | null
          documento_id?: string
          empresa?: string
          estado_destino?: string | null
          estado_origen?: string | null
          id?: number
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "dte_eventos_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "dte_documentos_operacion"
            referencedColumns: ["id"]
          },
        ]
      }
      dte_folios: {
        Row: {
          ambiente: string
          archivo_nombre: string | null
          created_at: string
          desde: number
          empresa: string
          estado: string
          fecha_autorizacion: string | null
          hasta: number
          id: number
          siguiente: number
          tipo_dte: number
        }
        Insert: {
          ambiente?: string
          archivo_nombre?: string | null
          created_at?: string
          desde: number
          empresa: string
          estado?: string
          fecha_autorizacion?: string | null
          hasta: number
          id?: number
          siguiente: number
          tipo_dte: number
        }
        Update: {
          ambiente?: string
          archivo_nombre?: string | null
          created_at?: string
          desde?: number
          empresa?: string
          estado?: string
          fecha_autorizacion?: string | null
          hasta?: number
          id?: number
          siguiente?: number
          tipo_dte?: number
        }
        Relationships: []
      }
      estados_pago_obra: {
        Row: {
          anticipo_descontado: number
          aprobador_email: string | null
          aprobador_nombre: string | null
          clave_aprobacion_hash: string | null
          clave_revision_hash: string | null
          created_at: string
          empresa: string
          estado: string
          factura_actualizada_en: string | null
          factura_archivo_base64: string | null
          factura_archivo_nombre: string | null
          factura_documento_id: number | null
          factura_estado: string
          factura_fecha: string | null
          factura_fecha_envio: string | null
          factura_fecha_pago: string | null
          factura_monto: number | null
          factura_numero: string | null
          factura_observaciones: string | null
          fecha_corte: string
          id: number
          items: Json
          monto_bruto: number
          monto_neto: number
          numero: number
          obra_nombre: string
          observacion_aprobacion: string | null
          observacion_revision: string | null
          observaciones: string | null
          preparado_por: string | null
          retencion_monto: number
          retencion_pct: number
          revisor_email: string | null
          revisor_nombre: string | null
          token_aprobacion: string | null
          token_revision: string | null
          trazabilidad: Json
          updated_at: string
        }
        Insert: {
          anticipo_descontado?: number
          aprobador_email?: string | null
          aprobador_nombre?: string | null
          clave_aprobacion_hash?: string | null
          clave_revision_hash?: string | null
          created_at?: string
          empresa: string
          estado?: string
          factura_actualizada_en?: string | null
          factura_archivo_base64?: string | null
          factura_archivo_nombre?: string | null
          factura_documento_id?: number | null
          factura_estado?: string
          factura_fecha?: string | null
          factura_fecha_envio?: string | null
          factura_fecha_pago?: string | null
          factura_monto?: number | null
          factura_numero?: string | null
          factura_observaciones?: string | null
          fecha_corte: string
          id?: number
          items?: Json
          monto_bruto?: number
          monto_neto?: number
          numero: number
          obra_nombre: string
          observacion_aprobacion?: string | null
          observacion_revision?: string | null
          observaciones?: string | null
          preparado_por?: string | null
          retencion_monto?: number
          retencion_pct?: number
          revisor_email?: string | null
          revisor_nombre?: string | null
          token_aprobacion?: string | null
          token_revision?: string | null
          trazabilidad?: Json
          updated_at?: string
        }
        Update: {
          anticipo_descontado?: number
          aprobador_email?: string | null
          aprobador_nombre?: string | null
          clave_aprobacion_hash?: string | null
          clave_revision_hash?: string | null
          created_at?: string
          empresa?: string
          estado?: string
          factura_actualizada_en?: string | null
          factura_archivo_base64?: string | null
          factura_archivo_nombre?: string | null
          factura_documento_id?: number | null
          factura_estado?: string
          factura_fecha?: string | null
          factura_fecha_envio?: string | null
          factura_fecha_pago?: string | null
          factura_monto?: number | null
          factura_numero?: string | null
          factura_observaciones?: string | null
          fecha_corte?: string
          id?: number
          items?: Json
          monto_bruto?: number
          monto_neto?: number
          numero?: number
          obra_nombre?: string
          observacion_aprobacion?: string | null
          observacion_revision?: string | null
          observaciones?: string | null
          preparado_por?: string | null
          retencion_monto?: number
          retencion_pct?: number
          revisor_email?: string | null
          revisor_nombre?: string | null
          token_aprobacion?: string | null
          token_revision?: string | null
          trazabilidad?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "estados_pago_obra_factura_documento_id_fkey"
            columns: ["factura_documento_id"]
            isOneToOne: false
            referencedRelation: "facturacion_documentos"
            referencedColumns: ["id"]
          },
        ]
      }
      facturacion_centros_gestion: {
        Row: {
          activo: boolean
          codigo: string
          created_at: string | null
          descripcion: string | null
          empresa: string
          id: number
          nombre: string
          tipo: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          codigo: string
          created_at?: string | null
          descripcion?: string | null
          empresa: string
          id?: number
          nombre: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          codigo?: string
          created_at?: string | null
          descripcion?: string | null
          empresa?: string
          id?: number
          nombre?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      facturacion_config: {
        Row: {
          actividades_economicas: Json | null
          certificado_digital_base64: string | null
          certificado_nombre: string | null
          comuna: string | null
          created_at: string | null
          direccion: string | null
          empresa: string
          facturacion_habilitada: boolean
          giro: string | null
          id: number
          modo_sii: string | null
          proveedor_integracion: string | null
          razon_social: string | null
          rechazo_sin_oc: boolean | null
          rut_empresa: string | null
          ultima_sincronizacion: string | null
        }
        Insert: {
          actividades_economicas?: Json | null
          certificado_digital_base64?: string | null
          certificado_nombre?: string | null
          comuna?: string | null
          created_at?: string | null
          direccion?: string | null
          empresa: string
          facturacion_habilitada?: boolean
          giro?: string | null
          id?: number
          modo_sii?: string | null
          proveedor_integracion?: string | null
          razon_social?: string | null
          rechazo_sin_oc?: boolean | null
          rut_empresa?: string | null
          ultima_sincronizacion?: string | null
        }
        Update: {
          actividades_economicas?: Json | null
          certificado_digital_base64?: string | null
          certificado_nombre?: string | null
          comuna?: string | null
          created_at?: string | null
          direccion?: string | null
          empresa?: string
          facturacion_habilitada?: boolean
          giro?: string | null
          id?: number
          modo_sii?: string | null
          proveedor_integracion?: string | null
          razon_social?: string | null
          rechazo_sin_oc?: boolean | null
          rut_empresa?: string | null
          ultima_sincronizacion?: string | null
        }
        Relationships: []
      }
      facturacion_documentos: {
        Row: {
          centro_gestion_id: number | null
          created_at: string | null
          detalles: Json | null
          direccion_flujo: string | null
          empresa: string
          estado_acuse: string | null
          estado_pago: string
          estado_pago_id: number | null
          estado_sii: string | null
          fecha_emision: string | null
          fecha_recepcion: string | null
          fecha_vencimiento: string | null
          folio: number
          id: number
          monto_iva: number | null
          monto_neto: number | null
          monto_total: number | null
          motivo_reclamo: string | null
          nombre_emisor: string | null
          nombre_receptor: string
          obra_nombre: string | null
          origen: string
          referencia_folio: number | null
          referencia_oc_id: number | null
          referencia_tipo: number | null
          rut_emisor: string | null
          rut_receptor: string
          seccion_id: number | null
          tipo_dte: number
          track_id: string | null
          updated_at: string
          xml_content: string | null
        }
        Insert: {
          centro_gestion_id?: number | null
          created_at?: string | null
          detalles?: Json | null
          direccion_flujo?: string | null
          empresa: string
          estado_acuse?: string | null
          estado_pago?: string
          estado_pago_id?: number | null
          estado_sii?: string | null
          fecha_emision?: string | null
          fecha_recepcion?: string | null
          fecha_vencimiento?: string | null
          folio: number
          id?: number
          monto_iva?: number | null
          monto_neto?: number | null
          monto_total?: number | null
          motivo_reclamo?: string | null
          nombre_emisor?: string | null
          nombre_receptor: string
          obra_nombre?: string | null
          origen?: string
          referencia_folio?: number | null
          referencia_oc_id?: number | null
          referencia_tipo?: number | null
          rut_emisor?: string | null
          rut_receptor: string
          seccion_id?: number | null
          tipo_dte: number
          track_id?: string | null
          updated_at?: string
          xml_content?: string | null
        }
        Update: {
          centro_gestion_id?: number | null
          created_at?: string | null
          detalles?: Json | null
          direccion_flujo?: string | null
          empresa?: string
          estado_acuse?: string | null
          estado_pago?: string
          estado_pago_id?: number | null
          estado_sii?: string | null
          fecha_emision?: string | null
          fecha_recepcion?: string | null
          fecha_vencimiento?: string | null
          folio?: number
          id?: number
          monto_iva?: number | null
          monto_neto?: number | null
          monto_total?: number | null
          motivo_reclamo?: string | null
          nombre_emisor?: string | null
          nombre_receptor?: string
          obra_nombre?: string | null
          origen?: string
          referencia_folio?: number | null
          referencia_oc_id?: number | null
          referencia_tipo?: number | null
          rut_emisor?: string | null
          rut_receptor?: string
          seccion_id?: number | null
          tipo_dte?: number
          track_id?: string | null
          updated_at?: string
          xml_content?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "facturacion_documentos_centro_gestion_id_fkey"
            columns: ["centro_gestion_id"]
            isOneToOne: false
            referencedRelation: "facturacion_centros_gestion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facturacion_documentos_estado_pago_id_fkey"
            columns: ["estado_pago_id"]
            isOneToOne: false
            referencedRelation: "estados_pago_obra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facturacion_documentos_referencia_oc_id_fkey"
            columns: ["referencia_oc_id"]
            isOneToOne: false
            referencedRelation: "facturacion_ordenes_compra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facturacion_documentos_seccion_id_fkey"
            columns: ["seccion_id"]
            isOneToOne: false
            referencedRelation: "facturacion_secciones"
            referencedColumns: ["id"]
          },
        ]
      }
      facturacion_folios: {
        Row: {
          actual: number
          caf_xml: string | null
          created_at: string | null
          desde: number
          empresa: string
          fecha_autorizacion: string | null
          hasta: number
          id: number
          tipo_dte: number
        }
        Insert: {
          actual: number
          caf_xml?: string | null
          created_at?: string | null
          desde: number
          empresa: string
          fecha_autorizacion?: string | null
          hasta: number
          id?: number
          tipo_dte: number
        }
        Update: {
          actual?: number
          caf_xml?: string | null
          created_at?: string | null
          desde?: number
          empresa?: string
          fecha_autorizacion?: string | null
          hasta?: number
          id?: number
          tipo_dte?: number
        }
        Relationships: []
      }
      facturacion_ordenes_compra: {
        Row: {
          centro_gestion_id: number | null
          created_at: string | null
          detalles: Json | null
          empresa: string
          estado: string | null
          fecha: string | null
          id: number
          monto_iva: number | null
          monto_neto: number | null
          monto_total: number | null
          numero: number
          proveedor_nombre: string
          proveedor_rut: string
          seccion_id: number | null
        }
        Insert: {
          centro_gestion_id?: number | null
          created_at?: string | null
          detalles?: Json | null
          empresa: string
          estado?: string | null
          fecha?: string | null
          id?: number
          monto_iva?: number | null
          monto_neto?: number | null
          monto_total?: number | null
          numero: number
          proveedor_nombre: string
          proveedor_rut: string
          seccion_id?: number | null
        }
        Update: {
          centro_gestion_id?: number | null
          created_at?: string | null
          detalles?: Json | null
          empresa?: string
          estado?: string | null
          fecha?: string | null
          id?: number
          monto_iva?: number | null
          monto_neto?: number | null
          monto_total?: number | null
          numero?: number
          proveedor_nombre?: string
          proveedor_rut?: string
          seccion_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "facturacion_ordenes_compra_centro_gestion_id_fkey"
            columns: ["centro_gestion_id"]
            isOneToOne: false
            referencedRelation: "facturacion_centros_gestion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facturacion_ordenes_compra_seccion_id_fkey"
            columns: ["seccion_id"]
            isOneToOne: false
            referencedRelation: "facturacion_secciones"
            referencedColumns: ["id"]
          },
        ]
      }
      facturacion_proveedores: {
        Row: {
          comuna: string | null
          created_at: string | null
          direccion: string | null
          email_dte: string | null
          empresa: string
          giro: string | null
          id: number
          plazo_pago: number | null
          razon_social: string
          rut: string
        }
        Insert: {
          comuna?: string | null
          created_at?: string | null
          direccion?: string | null
          email_dte?: string | null
          empresa: string
          giro?: string | null
          id?: number
          plazo_pago?: number | null
          razon_social: string
          rut: string
        }
        Update: {
          comuna?: string | null
          created_at?: string | null
          direccion?: string | null
          email_dte?: string | null
          empresa?: string
          giro?: string | null
          id?: number
          plazo_pago?: number | null
          razon_social?: string
          rut?: string
        }
        Relationships: []
      }
      facturacion_recepciones: {
        Row: {
          created_at: string | null
          detalles: Json | null
          empresa: string
          fecha_recepcion: string | null
          id: number
          oc_id: number | null
          recibido_por: string
        }
        Insert: {
          created_at?: string | null
          detalles?: Json | null
          empresa: string
          fecha_recepcion?: string | null
          id?: number
          oc_id?: number | null
          recibido_por: string
        }
        Update: {
          created_at?: string | null
          detalles?: Json | null
          empresa?: string
          fecha_recepcion?: string | null
          id?: number
          oc_id?: number | null
          recibido_por?: string
        }
        Relationships: [
          {
            foreignKeyName: "facturacion_recepciones_oc_id_fkey"
            columns: ["oc_id"]
            isOneToOne: false
            referencedRelation: "facturacion_ordenes_compra"
            referencedColumns: ["id"]
          },
        ]
      }
      facturacion_secciones: {
        Row: {
          created_at: string | null
          descripcion: string | null
          empresa: string
          id: number
          nombre: string
        }
        Insert: {
          created_at?: string | null
          descripcion?: string | null
          empresa: string
          id?: number
          nombre: string
        }
        Update: {
          created_at?: string | null
          descripcion?: string | null
          empresa?: string
          id?: number
          nombre?: string
        }
        Relationships: []
      }
      formulario_publico_intentos: {
        Row: {
          accion: string
          created_at: string
          exitoso: boolean
          id: number
          ip_hash: string
          token_hash: string
        }
        Insert: {
          accion: string
          created_at?: string
          exitoso?: boolean
          id?: never
          ip_hash: string
          token_hash: string
        }
        Update: {
          accion?: string
          created_at?: string
          exitoso?: boolean
          id?: never
          ip_hash?: string
          token_hash?: string
        }
        Relationships: []
      }
      gastos_rendicion_acciones: {
        Row: {
          accion: string
          actor_email: string | null
          actor_nombre: string
          comentario: string | null
          created_at: string
          empresa: string
          estado_resultante: string
          id: number
          rendicion_id: number
        }
        Insert: {
          accion: string
          actor_email?: string | null
          actor_nombre: string
          comentario?: string | null
          created_at?: string
          empresa: string
          estado_resultante: string
          id?: number
          rendicion_id: number
        }
        Update: {
          accion?: string
          actor_email?: string | null
          actor_nombre?: string
          comentario?: string | null
          created_at?: string
          empresa?: string
          estado_resultante?: string
          id?: number
          rendicion_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "gastos_rendicion_acciones_rendicion_id_fkey"
            columns: ["rendicion_id"]
            isOneToOne: false
            referencedRelation: "gastos_rendiciones"
            referencedColumns: ["id"]
          },
        ]
      }
      gastos_rendicion_items: {
        Row: {
          categoria: string
          centro_gestion_id: number
          confianza_ia: number | null
          confirmado: boolean
          created_at: string
          descripcion: string | null
          empresa: string
          fecha_documento: string
          folio: string | null
          id: number
          imagen_path: string | null
          lectura_ia: Json | null
          monto_iva: number
          monto_neto: number
          monto_total: number
          obra_nombre: string | null
          proveedor: string
          rendicion_id: number
          rut_proveedor: string | null
          tipo_documento: string
        }
        Insert: {
          categoria?: string
          centro_gestion_id: number
          confianza_ia?: number | null
          confirmado?: boolean
          created_at?: string
          descripcion?: string | null
          empresa: string
          fecha_documento: string
          folio?: string | null
          id?: number
          imagen_path?: string | null
          lectura_ia?: Json | null
          monto_iva?: number
          monto_neto?: number
          monto_total: number
          obra_nombre?: string | null
          proveedor: string
          rendicion_id: number
          rut_proveedor?: string | null
          tipo_documento?: string
        }
        Update: {
          categoria?: string
          centro_gestion_id?: number
          confianza_ia?: number | null
          confirmado?: boolean
          created_at?: string
          descripcion?: string | null
          empresa?: string
          fecha_documento?: string
          folio?: string | null
          id?: number
          imagen_path?: string | null
          lectura_ia?: Json | null
          monto_iva?: number
          monto_neto?: number
          monto_total?: number
          obra_nombre?: string | null
          proveedor?: string
          rendicion_id?: number
          rut_proveedor?: string | null
          tipo_documento?: string
        }
        Relationships: [
          {
            foreignKeyName: "gastos_rendicion_items_centro_gestion_id_fkey"
            columns: ["centro_gestion_id"]
            isOneToOne: false
            referencedRelation: "facturacion_centros_gestion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gastos_rendicion_items_rendicion_id_fkey"
            columns: ["rendicion_id"]
            isOneToOne: false
            referencedRelation: "gastos_rendiciones"
            referencedColumns: ["id"]
          },
        ]
      }
      gastos_rendiciones: {
        Row: {
          centro_gestion_id: number | null
          codigo: string | null
          created_at: string
          empresa: string
          estado: string
          fecha_desde: string | null
          fecha_hasta: string | null
          id: number
          observaciones: string | null
          rendidor_email: string | null
          rendidor_nombre: string
          rendidor_rut: string | null
          revisado_en: string | null
          revisor_email: string | null
          revisor_nombre: string | null
          tipo: string
          titulo: string
          total: number
          updated_at: string
        }
        Insert: {
          centro_gestion_id?: number | null
          codigo?: string | null
          created_at?: string
          empresa: string
          estado?: string
          fecha_desde?: string | null
          fecha_hasta?: string | null
          id?: number
          observaciones?: string | null
          rendidor_email?: string | null
          rendidor_nombre: string
          rendidor_rut?: string | null
          revisado_en?: string | null
          revisor_email?: string | null
          revisor_nombre?: string | null
          tipo?: string
          titulo: string
          total?: number
          updated_at?: string
        }
        Update: {
          centro_gestion_id?: number | null
          codigo?: string | null
          created_at?: string
          empresa?: string
          estado?: string
          fecha_desde?: string | null
          fecha_hasta?: string | null
          id?: number
          observaciones?: string | null
          rendidor_email?: string | null
          rendidor_nombre?: string
          rendidor_rut?: string | null
          revisado_en?: string | null
          revisor_email?: string | null
          revisor_nombre?: string | null
          tipo?: string
          titulo?: string
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gastos_rendiciones_centro_gestion_id_fkey"
            columns: ["centro_gestion_id"]
            isOneToOne: false
            referencedRelation: "facturacion_centros_gestion"
            referencedColumns: ["id"]
          },
        ]
      }
      ia_config_empresas: {
        Row: {
          actualizado_por: string | null
          alerta_porcentaje: number
          bloquear_al_limite: boolean
          created_at: string
          empresa: string
          funciones: Json
          habilitada: boolean
          limites_funcion: Json
          limites_usuario: Json
          modelo: string
          presupuesto_mensual_usd: number
          updated_at: string
        }
        Insert: {
          actualizado_por?: string | null
          alerta_porcentaje?: number
          bloquear_al_limite?: boolean
          created_at?: string
          empresa: string
          funciones?: Json
          habilitada?: boolean
          limites_funcion?: Json
          limites_usuario?: Json
          modelo?: string
          presupuesto_mensual_usd?: number
          updated_at?: string
        }
        Update: {
          actualizado_por?: string | null
          alerta_porcentaje?: number
          bloquear_al_limite?: boolean
          created_at?: string
          empresa?: string
          funciones?: Json
          habilitada?: boolean
          limites_funcion?: Json
          limites_usuario?: Json
          modelo?: string
          presupuesto_mensual_usd?: number
          updated_at?: string
        }
        Relationships: []
      }
      ia_consumos: {
        Row: {
          auth_user_id: string | null
          completed_at: string | null
          confianza: number | null
          costo_usd: number
          created_at: string
          duracion_ms: number | null
          empresa: string
          error_detalle: string | null
          estado: string
          funcion: string
          id: string
          metadatos: Json
          modelo: string
          obra_nombre: string | null
          tokens_entrada: number
          tokens_salida: number
          tokens_total: number
          usuario: string | null
        }
        Insert: {
          auth_user_id?: string | null
          completed_at?: string | null
          confianza?: number | null
          costo_usd?: number
          created_at?: string
          duracion_ms?: number | null
          empresa: string
          error_detalle?: string | null
          estado?: string
          funcion: string
          id?: string
          metadatos?: Json
          modelo: string
          obra_nombre?: string | null
          tokens_entrada?: number
          tokens_salida?: number
          tokens_total?: number
          usuario?: string | null
        }
        Update: {
          auth_user_id?: string | null
          completed_at?: string | null
          confianza?: number | null
          costo_usd?: number
          created_at?: string
          duracion_ms?: number | null
          empresa?: string
          error_detalle?: string | null
          estado?: string
          funcion?: string
          id?: string
          metadatos?: Json
          modelo?: string
          obra_nombre?: string | null
          tokens_entrada?: number
          tokens_salida?: number
          tokens_total?: number
          usuario?: string | null
        }
        Relationships: []
      }
      informes_ejecuciones: {
        Row: {
          aprobado_at: string | null
          aprobado_por: string | null
          contenido_html: string | null
          created_at: string
          destinatarios: Json
          ejecutado_por: string | null
          empresa: string
          enviada_at: string | null
          error_detalle: string | null
          estado: string
          ia_consumo_id: string | null
          id: number
          indicadores: Json
          interpretacion_ia: Json | null
          nombre: string
          obras: Json
          periodo_desde: string | null
          periodo_hasta: string | null
          plantilla_codigo: string
          programacion_id: string | null
        }
        Insert: {
          aprobado_at?: string | null
          aprobado_por?: string | null
          contenido_html?: string | null
          created_at?: string
          destinatarios?: Json
          ejecutado_por?: string | null
          empresa: string
          enviada_at?: string | null
          error_detalle?: string | null
          estado?: string
          ia_consumo_id?: string | null
          id?: number
          indicadores?: Json
          interpretacion_ia?: Json | null
          nombre: string
          obras?: Json
          periodo_desde?: string | null
          periodo_hasta?: string | null
          plantilla_codigo: string
          programacion_id?: string | null
        }
        Update: {
          aprobado_at?: string | null
          aprobado_por?: string | null
          contenido_html?: string | null
          created_at?: string
          destinatarios?: Json
          ejecutado_por?: string | null
          empresa?: string
          enviada_at?: string | null
          error_detalle?: string | null
          estado?: string
          ia_consumo_id?: string | null
          id?: number
          indicadores?: Json
          interpretacion_ia?: Json | null
          nombre?: string
          obras?: Json
          periodo_desde?: string | null
          periodo_hasta?: string | null
          plantilla_codigo?: string
          programacion_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "informes_ejecuciones_programacion_id_fkey"
            columns: ["programacion_id"]
            isOneToOne: false
            referencedRelation: "informes_programaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      informes_programaciones: {
        Row: {
          activa: boolean
          alcance_tipo: string
          correos_adicionales: Json
          creado_por: string | null
          created_at: string
          destinatarios_roles: Json
          destinatarios_usuarios: Json
          dia_mes: number | null
          dia_semana: number | null
          empresa: string
          frecuencia: string
          hora_envio: string
          id: string
          incluir_correo: boolean
          incluir_pdf: boolean
          nombre: string
          obras: Json
          plantilla_codigo: string
          proxima_ejecucion: string | null
          secciones: Json
          ultima_ejecucion: string | null
          updated_at: string
          usar_ia: boolean
          zona_horaria: string
        }
        Insert: {
          activa?: boolean
          alcance_tipo?: string
          correos_adicionales?: Json
          creado_por?: string | null
          created_at?: string
          destinatarios_roles?: Json
          destinatarios_usuarios?: Json
          dia_mes?: number | null
          dia_semana?: number | null
          empresa: string
          frecuencia: string
          hora_envio?: string
          id?: string
          incluir_correo?: boolean
          incluir_pdf?: boolean
          nombre: string
          obras?: Json
          plantilla_codigo: string
          proxima_ejecucion?: string | null
          secciones?: Json
          ultima_ejecucion?: string | null
          updated_at?: string
          usar_ia?: boolean
          zona_horaria?: string
        }
        Update: {
          activa?: boolean
          alcance_tipo?: string
          correos_adicionales?: Json
          creado_por?: string | null
          created_at?: string
          destinatarios_roles?: Json
          destinatarios_usuarios?: Json
          dia_mes?: number | null
          dia_semana?: number | null
          empresa?: string
          frecuencia?: string
          hora_envio?: string
          id?: string
          incluir_correo?: boolean
          incluir_pdf?: boolean
          nombre?: string
          obras?: Json
          plantilla_codigo?: string
          proxima_ejecucion?: string | null
          secciones?: Json
          ultima_ejecucion?: string | null
          updated_at?: string
          usar_ia?: boolean
          zona_horaria?: string
        }
        Relationships: []
      }
      inventario_maquinaria: {
        Row: {
          cantidad_minima: number
          color_calendario: string
          costo_interno: number
          created_at: string | null
          empresa: string
          estado_equipo: string | null
          foto_derecha: string | null
          foto_frontal: string | null
          foto_izquierda: string | null
          foto_posterior: string | null
          horometro_inicial: number | null
          id: number
          mantenimiento_descripcion: string | null
          mantenimiento_intervalo: number | null
          mantenimiento_ultima_fecha: string | null
          mantenimiento_ultima_lectura: number | null
          mantenimiento_unidad: string | null
          marca: string | null
          modalidad_dias: string
          obra_nombre: string | null
          patente: string | null
          planes_mantencion: Json
          publico_token: string
          tipo: string
          tipo_activo: string | null
          tipo_condicion_minima: string
          unidad_costo_interno: string
        }
        Insert: {
          cantidad_minima?: number
          color_calendario?: string
          costo_interno?: number
          created_at?: string | null
          empresa?: string
          estado_equipo?: string | null
          foto_derecha?: string | null
          foto_frontal?: string | null
          foto_izquierda?: string | null
          foto_posterior?: string | null
          horometro_inicial?: number | null
          id?: number
          mantenimiento_descripcion?: string | null
          mantenimiento_intervalo?: number | null
          mantenimiento_ultima_fecha?: string | null
          mantenimiento_ultima_lectura?: number | null
          mantenimiento_unidad?: string | null
          marca?: string | null
          modalidad_dias?: string
          obra_nombre?: string | null
          patente?: string | null
          planes_mantencion?: Json
          publico_token?: string
          tipo: string
          tipo_activo?: string | null
          tipo_condicion_minima?: string
          unidad_costo_interno?: string
        }
        Update: {
          cantidad_minima?: number
          color_calendario?: string
          costo_interno?: number
          created_at?: string | null
          empresa?: string
          estado_equipo?: string | null
          foto_derecha?: string | null
          foto_frontal?: string | null
          foto_izquierda?: string | null
          foto_posterior?: string | null
          horometro_inicial?: number | null
          id?: number
          mantenimiento_descripcion?: string | null
          mantenimiento_intervalo?: number | null
          mantenimiento_ultima_fecha?: string | null
          mantenimiento_ultima_lectura?: number | null
          mantenimiento_unidad?: string | null
          marca?: string | null
          modalidad_dias?: string
          obra_nombre?: string | null
          patente?: string | null
          planes_mantencion?: Json
          publico_token?: string
          tipo?: string
          tipo_activo?: string | null
          tipo_condicion_minima?: string
          unidad_costo_interno?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventario_maquinaria_obra_nombre_fkey"
            columns: ["obra_nombre"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["nombre"]
          },
        ]
      }
      inventario_materiales: {
        Row: {
          cantidad: number | null
          created_at: string | null
          empresa: string
          guia: string | null
          id: number
          material: string | null
          obra_nombre: string | null
          tipo_movimiento: string | null
        }
        Insert: {
          cantidad?: number | null
          created_at?: string | null
          empresa: string
          guia?: string | null
          id?: number
          material?: string | null
          obra_nombre?: string | null
          tipo_movimiento?: string | null
        }
        Update: {
          cantidad?: number | null
          created_at?: string | null
          empresa?: string
          guia?: string | null
          id?: number
          material?: string | null
          obra_nombre?: string | null
          tipo_movimiento?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventario_materiales_obra_nombre_fkey"
            columns: ["obra_nombre"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["nombre"]
          },
        ]
      }
      last_planner_recursos: {
        Row: {
          actualizado_por: string | null
          cantidad_requerida: number | null
          created_at: string | null
          criticidad: string
          empresa: string | null
          estado: string
          fecha_compromiso: string | null
          id: number
          liberado_at: string | null
          liberado_por: string | null
          obra_nombre: string
          observacion: string | null
          origen: string
          partida: string
          recurso: string
          recurso_clave: string
          responsable: string | null
          tipo: string | null
          unidad: string | null
          updated_at: string | null
        }
        Insert: {
          actualizado_por?: string | null
          cantidad_requerida?: number | null
          created_at?: string | null
          criticidad?: string
          empresa?: string | null
          estado?: string
          fecha_compromiso?: string | null
          id?: number
          liberado_at?: string | null
          liberado_por?: string | null
          obra_nombre: string
          observacion?: string | null
          origen?: string
          partida: string
          recurso: string
          recurso_clave: string
          responsable?: string | null
          tipo?: string | null
          unidad?: string | null
          updated_at?: string | null
        }
        Update: {
          actualizado_por?: string | null
          cantidad_requerida?: number | null
          created_at?: string | null
          criticidad?: string
          empresa?: string | null
          estado?: string
          fecha_compromiso?: string | null
          id?: number
          liberado_at?: string | null
          liberado_por?: string | null
          obra_nombre?: string
          observacion?: string | null
          origen?: string
          partida?: string
          recurso?: string
          recurso_clave?: string
          responsable?: string | null
          tipo?: string | null
          unidad?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      libro_obra_digital: {
        Row: {
          asunto: string
          autorizador_nombre: string | null
          clave_cliente_hash: string | null
          created_at: string
          destinatario: string | null
          detalle: string
          emisor: string
          empresa: string
          estado: string
          fecha: string
          fecha_cierre: string | null
          fecha_respuesta: string | null
          flujo_estado: string
          folio: string
          id: number
          obra_nombre: string
          partida: string | null
          respuesta: string | null
          tipo: string
          token_cliente: string | null
          trazabilidad: Json
          updated_at: string
        }
        Insert: {
          asunto: string
          autorizador_nombre?: string | null
          clave_cliente_hash?: string | null
          created_at?: string
          destinatario?: string | null
          detalle: string
          emisor: string
          empresa: string
          estado?: string
          fecha?: string
          fecha_cierre?: string | null
          fecha_respuesta?: string | null
          flujo_estado?: string
          folio: string
          id?: number
          obra_nombre: string
          partida?: string | null
          respuesta?: string | null
          tipo: string
          token_cliente?: string | null
          trazabilidad?: Json
          updated_at?: string
        }
        Update: {
          asunto?: string
          autorizador_nombre?: string | null
          clave_cliente_hash?: string | null
          created_at?: string
          destinatario?: string | null
          detalle?: string
          emisor?: string
          empresa?: string
          estado?: string
          fecha?: string
          fecha_cierre?: string | null
          fecha_respuesta?: string | null
          flujo_estado?: string
          folio?: string
          id?: number
          obra_nombre?: string
          partida?: string | null
          respuesta?: string | null
          tipo?: string
          token_cliente?: string | null
          trazabilidad?: Json
          updated_at?: string
        }
        Relationships: []
      }
      maestro_personal: {
        Row: {
          afp: string | null
          area: string | null
          banco: string | null
          cargo: string | null
          centro_gestion_id: number | null
          centro_trabajo: string | null
          centro_trabajo_id: number | null
          colacion: number | null
          created_at: string | null
          email: string | null
          empresa: string | null
          fecha_asig: string | null
          fecha_inicio_contrato: string | null
          fecha_vencimiento_contrato: string | null
          fono: string | null
          gratificacion: string | null
          id: number
          inicio: string | null
          movilizacion: number | null
          nombre: string
          numero_cuenta: string | null
          obra_nombre: string | null
          prevision_salud: string | null
          rut: string | null
          sueldo_base: number | null
          termino: string | null
          tipo_contrato: string | null
          tipo_cuenta: string | null
        }
        Insert: {
          afp?: string | null
          area?: string | null
          banco?: string | null
          cargo?: string | null
          centro_gestion_id?: number | null
          centro_trabajo?: string | null
          centro_trabajo_id?: number | null
          colacion?: number | null
          created_at?: string | null
          email?: string | null
          empresa?: string | null
          fecha_asig?: string | null
          fecha_inicio_contrato?: string | null
          fecha_vencimiento_contrato?: string | null
          fono?: string | null
          gratificacion?: string | null
          id?: number
          inicio?: string | null
          movilizacion?: number | null
          nombre: string
          numero_cuenta?: string | null
          obra_nombre?: string | null
          prevision_salud?: string | null
          rut?: string | null
          sueldo_base?: number | null
          termino?: string | null
          tipo_contrato?: string | null
          tipo_cuenta?: string | null
        }
        Update: {
          afp?: string | null
          area?: string | null
          banco?: string | null
          cargo?: string | null
          centro_gestion_id?: number | null
          centro_trabajo?: string | null
          centro_trabajo_id?: number | null
          colacion?: number | null
          created_at?: string | null
          email?: string | null
          empresa?: string | null
          fecha_asig?: string | null
          fecha_inicio_contrato?: string | null
          fecha_vencimiento_contrato?: string | null
          fono?: string | null
          gratificacion?: string | null
          id?: number
          inicio?: string | null
          movilizacion?: number | null
          nombre?: string
          numero_cuenta?: string | null
          obra_nombre?: string | null
          prevision_salud?: string | null
          rut?: string | null
          sueldo_base?: number | null
          termino?: string | null
          tipo_contrato?: string | null
          tipo_cuenta?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maestro_personal_centro_gestion_id_fkey"
            columns: ["centro_gestion_id"]
            isOneToOne: false
            referencedRelation: "facturacion_centros_gestion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maestro_personal_centro_trabajo_id_fkey"
            columns: ["centro_trabajo_id"]
            isOneToOne: false
            referencedRelation: "rrhh_centros_trabajo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maestro_personal_obra_nombre_fkey"
            columns: ["obra_nombre"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["nombre"]
          },
        ]
      }
      mandante_acreditaciones: {
        Row: {
          categoria: string
          contrato_id: string
          empresa_mandante: string
          estado: string
          id: string
          observacion: string | null
          proximo_vencimiento: string | null
          total_aprobados: number
          total_recibidos: number
          total_requeridos: number
          updated_at: string
        }
        Insert: {
          categoria: string
          contrato_id: string
          empresa_mandante: string
          estado?: string
          id?: string
          observacion?: string | null
          proximo_vencimiento?: string | null
          total_aprobados?: number
          total_recibidos?: number
          total_requeridos?: number
          updated_at?: string
        }
        Update: {
          categoria?: string
          contrato_id?: string
          empresa_mandante?: string
          estado?: string
          id?: string
          observacion?: string | null
          proximo_vencimiento?: string | null
          total_aprobados?: number
          total_recibidos?: number
          total_requeridos?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mandante_acreditaciones_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "mandante_contratos"
            referencedColumns: ["id"]
          },
        ]
      }
      mandante_adjuntos: {
        Row: {
          contrato_id: string
          created_at: string
          empresa_mandante: string
          entrega_id: string | null
          estado: string
          id: string
          mime_type: string | null
          nombre_archivo: string
          storage_path: string
          subido_por: string | null
          tamano_bytes: number
        }
        Insert: {
          contrato_id: string
          created_at?: string
          empresa_mandante: string
          entrega_id?: string | null
          estado?: string
          id?: string
          mime_type?: string | null
          nombre_archivo: string
          storage_path: string
          subido_por?: string | null
          tamano_bytes?: number
        }
        Update: {
          contrato_id?: string
          created_at?: string
          empresa_mandante?: string
          entrega_id?: string | null
          estado?: string
          id?: string
          mime_type?: string | null
          nombre_archivo?: string
          storage_path?: string
          subido_por?: string | null
          tamano_bytes?: number
        }
        Relationships: [
          {
            foreignKeyName: "mandante_adjuntos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "mandante_contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mandante_adjuntos_entrega_id_fkey"
            columns: ["entrega_id"]
            isOneToOne: false
            referencedRelation: "mandante_entregas"
            referencedColumns: ["id"]
          },
        ]
      }
      mandante_contratos: {
        Row: {
          administrador_contrato: string | null
          alcance_acreditacion: Json
          clave_externa_hash: string | null
          codigo: string
          contacto_email: string | null
          contacto_nombre: string | null
          creado_por: string | null
          created_at: string
          empresa_contratista: string
          empresa_mandante: string
          empresa_obraxis_vinculada: string | null
          estado: string
          exige_acreditacion: boolean
          fecha_inicio: string | null
          fecha_termino: string | null
          id: string
          ito_responsable: string | null
          modalidad: string
          nombre: string
          obra_contratista_id: number | null
          obra_contratista_nombre: string | null
          paquetes: Json
          periodicidad: Json
          presupuesto_contractual: number
          proxima_sincronizacion_at: string | null
          proyecto_id: string
          rut_contratista: string
          sincronizacion_automatica: boolean
          sincronizacion_error: string | null
          sincronizacion_estado: string | null
          sincronizacion_frecuencia: string
          token_externo: string
          ultima_sincronizacion_at: string | null
          ultimo_acceso_externo: string | null
          updated_at: string
        }
        Insert: {
          administrador_contrato?: string | null
          alcance_acreditacion?: Json
          clave_externa_hash?: string | null
          codigo: string
          contacto_email?: string | null
          contacto_nombre?: string | null
          creado_por?: string | null
          created_at?: string
          empresa_contratista: string
          empresa_mandante: string
          empresa_obraxis_vinculada?: string | null
          estado?: string
          exige_acreditacion?: boolean
          fecha_inicio?: string | null
          fecha_termino?: string | null
          id?: string
          ito_responsable?: string | null
          modalidad?: string
          nombre: string
          obra_contratista_id?: number | null
          obra_contratista_nombre?: string | null
          paquetes?: Json
          periodicidad?: Json
          presupuesto_contractual?: number
          proxima_sincronizacion_at?: string | null
          proyecto_id: string
          rut_contratista: string
          sincronizacion_automatica?: boolean
          sincronizacion_error?: string | null
          sincronizacion_estado?: string | null
          sincronizacion_frecuencia?: string
          token_externo?: string
          ultima_sincronizacion_at?: string | null
          ultimo_acceso_externo?: string | null
          updated_at?: string
        }
        Update: {
          administrador_contrato?: string | null
          alcance_acreditacion?: Json
          clave_externa_hash?: string | null
          codigo?: string
          contacto_email?: string | null
          contacto_nombre?: string | null
          creado_por?: string | null
          created_at?: string
          empresa_contratista?: string
          empresa_mandante?: string
          empresa_obraxis_vinculada?: string | null
          estado?: string
          exige_acreditacion?: boolean
          fecha_inicio?: string | null
          fecha_termino?: string | null
          id?: string
          ito_responsable?: string | null
          modalidad?: string
          nombre?: string
          obra_contratista_id?: number | null
          obra_contratista_nombre?: string | null
          paquetes?: Json
          periodicidad?: Json
          presupuesto_contractual?: number
          proxima_sincronizacion_at?: string | null
          proyecto_id?: string
          rut_contratista?: string
          sincronizacion_automatica?: boolean
          sincronizacion_error?: string | null
          sincronizacion_estado?: string | null
          sincronizacion_frecuencia?: string
          token_externo?: string
          ultima_sincronizacion_at?: string | null
          ultimo_acceso_externo?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mandante_contratos_obra_contratista_id_fkey"
            columns: ["obra_contratista_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mandante_contratos_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "mandante_proyectos"
            referencedColumns: ["id"]
          },
        ]
      }
      mandante_entrega_acciones: {
        Row: {
          accion: string
          actor_cargo: string | null
          actor_empresa: string | null
          actor_nombre: string | null
          actor_rut: string | null
          actor_tipo: string
          comentario: string | null
          contrato_id: string
          created_at: string
          empresa_mandante: string
          entrega_id: string
          estado_resultante: string | null
          id: string
        }
        Insert: {
          accion: string
          actor_cargo?: string | null
          actor_empresa?: string | null
          actor_nombre?: string | null
          actor_rut?: string | null
          actor_tipo?: string
          comentario?: string | null
          contrato_id: string
          created_at?: string
          empresa_mandante: string
          entrega_id: string
          estado_resultante?: string | null
          id?: string
        }
        Update: {
          accion?: string
          actor_cargo?: string | null
          actor_empresa?: string | null
          actor_nombre?: string | null
          actor_rut?: string | null
          actor_tipo?: string
          comentario?: string | null
          contrato_id?: string
          created_at?: string
          empresa_mandante?: string
          entrega_id?: string
          estado_resultante?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mandante_entrega_acciones_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "mandante_contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mandante_entrega_acciones_entrega_id_fkey"
            columns: ["entrega_id"]
            isOneToOne: false
            referencedRelation: "mandante_entregas"
            referencedColumns: ["id"]
          },
        ]
      }
      mandante_entregas: {
        Row: {
          archivo_nombre: string | null
          archivo_url: string | null
          contrato_id: string
          datos: Json
          empresa_mandante: string
          empresa_origen: string
          entrega_anterior_id: string | null
          entrega_raiz_id: string
          enviado_at: string
          enviado_por: string | null
          estado: string
          fecha_compromiso: string | null
          id: string
          monto: number
          observacion_mandante: string | null
          periodo_desde: string | null
          periodo_hasta: string | null
          respondido_at: string | null
          respondido_por: string | null
          respuesta_contratista: string | null
          revisado_at: string | null
          revisado_por: string | null
          tipo: string
          titulo: string
          updated_at: string
          version: number
        }
        Insert: {
          archivo_nombre?: string | null
          archivo_url?: string | null
          contrato_id: string
          datos?: Json
          empresa_mandante: string
          empresa_origen: string
          entrega_anterior_id?: string | null
          entrega_raiz_id: string
          enviado_at?: string
          enviado_por?: string | null
          estado?: string
          fecha_compromiso?: string | null
          id?: string
          monto?: number
          observacion_mandante?: string | null
          periodo_desde?: string | null
          periodo_hasta?: string | null
          respondido_at?: string | null
          respondido_por?: string | null
          respuesta_contratista?: string | null
          revisado_at?: string | null
          revisado_por?: string | null
          tipo: string
          titulo: string
          updated_at?: string
          version?: number
        }
        Update: {
          archivo_nombre?: string | null
          archivo_url?: string | null
          contrato_id?: string
          datos?: Json
          empresa_mandante?: string
          empresa_origen?: string
          entrega_anterior_id?: string | null
          entrega_raiz_id?: string
          enviado_at?: string
          enviado_por?: string | null
          estado?: string
          fecha_compromiso?: string | null
          id?: string
          monto?: number
          observacion_mandante?: string | null
          periodo_desde?: string | null
          periodo_hasta?: string | null
          respondido_at?: string | null
          respondido_por?: string | null
          respuesta_contratista?: string | null
          revisado_at?: string | null
          revisado_por?: string | null
          tipo?: string
          titulo?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "mandante_entregas_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "mandante_contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mandante_entregas_entrega_anterior_id_fkey"
            columns: ["entrega_anterior_id"]
            isOneToOne: false
            referencedRelation: "mandante_entregas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mandante_entregas_entrega_raiz_id_fkey"
            columns: ["entrega_raiz_id"]
            isOneToOne: false
            referencedRelation: "mandante_entregas"
            referencedColumns: ["id"]
          },
        ]
      }
      mandante_eventos: {
        Row: {
          accion: string
          actor_cargo: string | null
          actor_empresa: string | null
          actor_nombre: string | null
          actor_rut: string | null
          contrato_id: string | null
          created_at: string
          detalle: string | null
          empresa_mandante: string
          estado_resultante: string | null
          id: number
          proyecto_id: string | null
        }
        Insert: {
          accion: string
          actor_cargo?: string | null
          actor_empresa?: string | null
          actor_nombre?: string | null
          actor_rut?: string | null
          contrato_id?: string | null
          created_at?: string
          detalle?: string | null
          empresa_mandante: string
          estado_resultante?: string | null
          id?: number
          proyecto_id?: string | null
        }
        Update: {
          accion?: string
          actor_cargo?: string | null
          actor_empresa?: string | null
          actor_nombre?: string | null
          actor_rut?: string | null
          contrato_id?: string | null
          created_at?: string
          detalle?: string | null
          empresa_mandante?: string
          estado_resultante?: string | null
          id?: number
          proyecto_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mandante_eventos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "mandante_contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mandante_eventos_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "mandante_proyectos"
            referencedColumns: ["id"]
          },
        ]
      }
      mandante_informes_config: {
        Row: {
          activo: boolean
          contrato_id: string
          creado_por: string | null
          created_at: string
          destinatarios: string[]
          dia_mes: number
          dia_semana: number
          empresa_mandante: string
          frecuencia: string
          hora: string
          id: string
          proxima_ejecucion_at: string | null
          ultima_ejecucion_at: string | null
          ultimo_error: string | null
          ultimo_estado: string | null
          updated_at: string
        }
        Insert: {
          activo?: boolean
          contrato_id: string
          creado_por?: string | null
          created_at?: string
          destinatarios?: string[]
          dia_mes?: number
          dia_semana?: number
          empresa_mandante: string
          frecuencia?: string
          hora?: string
          id?: string
          proxima_ejecucion_at?: string | null
          ultima_ejecucion_at?: string | null
          ultimo_error?: string | null
          ultimo_estado?: string | null
          updated_at?: string
        }
        Update: {
          activo?: boolean
          contrato_id?: string
          creado_por?: string | null
          created_at?: string
          destinatarios?: string[]
          dia_mes?: number
          dia_semana?: number
          empresa_mandante?: string
          frecuencia?: string
          hora?: string
          id?: string
          proxima_ejecucion_at?: string | null
          ultima_ejecucion_at?: string | null
          ultimo_error?: string | null
          ultimo_estado?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mandante_informes_config_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: true
            referencedRelation: "mandante_contratos"
            referencedColumns: ["id"]
          },
        ]
      }
      mandante_informes_historial: {
        Row: {
          config_id: string | null
          contrato_id: string
          destinatarios: string[]
          empresa_mandante: string
          enviado_at: string | null
          error: string | null
          estado: string
          generado_at: string
          generado_por: string | null
          html: string
          id: string
          periodo: string
          resumen: Json
        }
        Insert: {
          config_id?: string | null
          contrato_id: string
          destinatarios?: string[]
          empresa_mandante: string
          enviado_at?: string | null
          error?: string | null
          estado?: string
          generado_at?: string
          generado_por?: string | null
          html: string
          id?: string
          periodo: string
          resumen?: Json
        }
        Update: {
          config_id?: string | null
          contrato_id?: string
          destinatarios?: string[]
          empresa_mandante?: string
          enviado_at?: string | null
          error?: string | null
          estado?: string
          generado_at?: string
          generado_por?: string | null
          html?: string
          id?: string
          periodo?: string
          resumen?: Json
        }
        Relationships: [
          {
            foreignKeyName: "mandante_informes_historial_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "mandante_informes_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mandante_informes_historial_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "mandante_contratos"
            referencedColumns: ["id"]
          },
        ]
      }
      mandante_integraciones: {
        Row: {
          contrato_id: string
          created_at: string
          empresa_mandante: string
          empresa_origen: string
          entrega_id: string
          fuente_actualizada_at: string | null
          fuente_id: string
          fuente_tabla: string
          huella: string
          id: string
          modulo: string
          resumen: Json
          sincronizado_por: string | null
        }
        Insert: {
          contrato_id: string
          created_at?: string
          empresa_mandante: string
          empresa_origen: string
          entrega_id: string
          fuente_actualizada_at?: string | null
          fuente_id: string
          fuente_tabla: string
          huella: string
          id?: string
          modulo: string
          resumen?: Json
          sincronizado_por?: string | null
        }
        Update: {
          contrato_id?: string
          created_at?: string
          empresa_mandante?: string
          empresa_origen?: string
          entrega_id?: string
          fuente_actualizada_at?: string | null
          fuente_id?: string
          fuente_tabla?: string
          huella?: string
          id?: string
          modulo?: string
          resumen?: Json
          sincronizado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mandante_integraciones_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "mandante_contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mandante_integraciones_entrega_id_fkey"
            columns: ["entrega_id"]
            isOneToOne: false
            referencedRelation: "mandante_entregas"
            referencedColumns: ["id"]
          },
        ]
      }
      mandante_obligaciones: {
        Row: {
          activa: boolean
          contrato_id: string
          correo_responsable: string | null
          created_at: string
          empresa_mandante: string
          id: string
          nombre: string
          notificar_dias_antes: number
          periodicidad: string
          proxima_fecha: string | null
          responsable: string | null
          tipo: string
          ultima_entrega_at: string | null
          ultima_entrega_id: string | null
          updated_at: string
        }
        Insert: {
          activa?: boolean
          contrato_id: string
          correo_responsable?: string | null
          created_at?: string
          empresa_mandante: string
          id?: string
          nombre: string
          notificar_dias_antes?: number
          periodicidad?: string
          proxima_fecha?: string | null
          responsable?: string | null
          tipo: string
          ultima_entrega_at?: string | null
          ultima_entrega_id?: string | null
          updated_at?: string
        }
        Update: {
          activa?: boolean
          contrato_id?: string
          correo_responsable?: string | null
          created_at?: string
          empresa_mandante?: string
          id?: string
          nombre?: string
          notificar_dias_antes?: number
          periodicidad?: string
          proxima_fecha?: string | null
          responsable?: string | null
          tipo?: string
          ultima_entrega_at?: string | null
          ultima_entrega_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mandante_obligaciones_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "mandante_contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mandante_obligaciones_ultima_entrega_id_fkey"
            columns: ["ultima_entrega_id"]
            isOneToOne: false
            referencedRelation: "mandante_entregas"
            referencedColumns: ["id"]
          },
        ]
      }
      mandante_proyectos: {
        Row: {
          administrador_contrato: string | null
          codigo: string
          creado_por: string | null
          created_at: string
          descripcion: string | null
          empresa_mandante: string
          estado: string
          fecha_inicio: string | null
          fecha_termino: string | null
          id: string
          ito_responsable: string | null
          nombre: string
          presupuesto_contractual: number
          ubicacion: string | null
          updated_at: string
        }
        Insert: {
          administrador_contrato?: string | null
          codigo: string
          creado_por?: string | null
          created_at?: string
          descripcion?: string | null
          empresa_mandante: string
          estado?: string
          fecha_inicio?: string | null
          fecha_termino?: string | null
          id?: string
          ito_responsable?: string | null
          nombre: string
          presupuesto_contractual?: number
          ubicacion?: string | null
          updated_at?: string
        }
        Update: {
          administrador_contrato?: string | null
          codigo?: string
          creado_por?: string | null
          created_at?: string
          descripcion?: string | null
          empresa_mandante?: string
          estado?: string
          fecha_inicio?: string | null
          fecha_termino?: string | null
          id?: string
          ito_responsable?: string | null
          nombre?: string
          presupuesto_contractual?: number
          ubicacion?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      maquinaria_fallas: {
        Row: {
          causa: string | null
          created_at: string
          descripcion: string
          detuvo_equipo: boolean
          empresa: string
          equipo_id: number
          equipo_patente: string | null
          equipo_tipo: string | null
          fecha: string
          horas_fuera_servicio: number
          id: number
          obra_nombre: string | null
          registrado_por: string | null
          responsable: string | null
          severidad: string
          solucion: string | null
        }
        Insert: {
          causa?: string | null
          created_at?: string
          descripcion: string
          detuvo_equipo?: boolean
          empresa: string
          equipo_id: number
          equipo_patente?: string | null
          equipo_tipo?: string | null
          fecha: string
          horas_fuera_servicio?: number
          id?: number
          obra_nombre?: string | null
          registrado_por?: string | null
          responsable?: string | null
          severidad?: string
          solucion?: string | null
        }
        Update: {
          causa?: string | null
          created_at?: string
          descripcion?: string
          detuvo_equipo?: boolean
          empresa?: string
          equipo_id?: number
          equipo_patente?: string | null
          equipo_tipo?: string | null
          fecha?: string
          horas_fuera_servicio?: number
          id?: number
          obra_nombre?: string | null
          registrado_por?: string | null
          responsable?: string | null
          severidad?: string
          solucion?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maquinaria_fallas_equipo_id_fkey"
            columns: ["equipo_id"]
            isOneToOne: false
            referencedRelation: "inventario_maquinaria"
            referencedColumns: ["id"]
          },
        ]
      }
      maquinaria_mantenciones: {
        Row: {
          costo: number
          created_at: string
          descripcion: string
          empresa: string
          equipo_id: number
          equipo_patente: string | null
          equipo_tipo: string | null
          fecha: string
          horometro: number | null
          id: number
          obra_nombre: string | null
          proveedor: string | null
          registrado_por: string | null
          responsable: string | null
          tipo: string
        }
        Insert: {
          costo?: number
          created_at?: string
          descripcion: string
          empresa: string
          equipo_id: number
          equipo_patente?: string | null
          equipo_tipo?: string | null
          fecha: string
          horometro?: number | null
          id?: number
          obra_nombre?: string | null
          proveedor?: string | null
          registrado_por?: string | null
          responsable?: string | null
          tipo?: string
        }
        Update: {
          costo?: number
          created_at?: string
          descripcion?: string
          empresa?: string
          equipo_id?: number
          equipo_patente?: string | null
          equipo_tipo?: string | null
          fecha?: string
          horometro?: number | null
          id?: number
          obra_nombre?: string | null
          proveedor?: string | null
          registrado_por?: string | null
          responsable?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "maquinaria_mantenciones_equipo_id_fkey"
            columns: ["equipo_id"]
            isOneToOne: false
            referencedRelation: "inventario_maquinaria"
            referencedColumns: ["id"]
          },
        ]
      }
      maquinaria_reservas: {
        Row: {
          created_at: string | null
          empresa: string
          equipo_id: string | null
          equipo_patente: string | null
          equipo_tipo: string | null
          estado: string | null
          fecha_fin: string | null
          fecha_inicio: string | null
          id: number
          obra_destino: string | null
          proposito: string | null
          solicitante: string | null
        }
        Insert: {
          created_at?: string | null
          empresa: string
          equipo_id?: string | null
          equipo_patente?: string | null
          equipo_tipo?: string | null
          estado?: string | null
          fecha_fin?: string | null
          fecha_inicio?: string | null
          id?: number
          obra_destino?: string | null
          proposito?: string | null
          solicitante?: string | null
        }
        Update: {
          created_at?: string | null
          empresa?: string
          equipo_id?: string | null
          equipo_patente?: string | null
          equipo_tipo?: string | null
          estado?: string | null
          fecha_fin?: string | null
          fecha_inicio?: string | null
          id?: number
          obra_destino?: string | null
          proposito?: string | null
          solicitante?: string | null
        }
        Relationships: []
      }
      maquinaria_uso_diario: {
        Row: {
          combustible_cargado: number | null
          created_at: string | null
          empresa: string
          equipo_id: string | null
          equipo_patente: string | null
          equipo_tipo: string | null
          fecha: string | null
          horas_trabajadas: number | null
          horometro_final: number | null
          horometro_inicial: number | null
          id: number
          obra_nombre: string | null
          observaciones: string | null
          operador: string | null
        }
        Insert: {
          combustible_cargado?: number | null
          created_at?: string | null
          empresa: string
          equipo_id?: string | null
          equipo_patente?: string | null
          equipo_tipo?: string | null
          fecha?: string | null
          horas_trabajadas?: number | null
          horometro_final?: number | null
          horometro_inicial?: number | null
          id?: number
          obra_nombre?: string | null
          observaciones?: string | null
          operador?: string | null
        }
        Update: {
          combustible_cargado?: number | null
          created_at?: string | null
          empresa?: string
          equipo_id?: string | null
          equipo_patente?: string | null
          equipo_tipo?: string | null
          fecha?: string | null
          horas_trabajadas?: number | null
          horometro_final?: number | null
          horometro_inicial?: number | null
          id?: number
          obra_nombre?: string | null
          observaciones?: string | null
          operador?: string | null
        }
        Relationships: []
      }
      notificaciones_entregas: {
        Row: {
          asunto: string | null
          canal: string
          created_at: string
          destinatario: string | null
          empresa: string
          enviada_at: string | null
          error_detalle: string | null
          estado: string
          evento_codigo: string
          id: number
          leida_at: string | null
          obra_nombre: string | null
          payload: Json
          programada_para: string | null
          regla_id: string | null
        }
        Insert: {
          asunto?: string | null
          canal: string
          created_at?: string
          destinatario?: string | null
          empresa: string
          enviada_at?: string | null
          error_detalle?: string | null
          estado?: string
          evento_codigo: string
          id?: number
          leida_at?: string | null
          obra_nombre?: string | null
          payload?: Json
          programada_para?: string | null
          regla_id?: string | null
        }
        Update: {
          asunto?: string | null
          canal?: string
          created_at?: string
          destinatario?: string | null
          empresa?: string
          enviada_at?: string | null
          error_detalle?: string | null
          estado?: string
          evento_codigo?: string
          id?: number
          leida_at?: string | null
          obra_nombre?: string | null
          payload?: Json
          programada_para?: string | null
          regla_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notificaciones_entregas_regla_id_fkey"
            columns: ["regla_id"]
            isOneToOne: false
            referencedRelation: "notificaciones_reglas"
            referencedColumns: ["id"]
          },
        ]
      }
      notificaciones_reglas: {
        Row: {
          activa: boolean
          canal_email: boolean
          canal_plataforma: boolean
          condiciones: Json
          correos_adicionales: Json
          creado_por: string | null
          created_at: string
          descripcion: string | null
          destinatarios_roles: Json
          destinatarios_usuarios: Json
          dias_anticipacion: number | null
          empresa: string
          evento_codigo: string
          frecuencia: string
          hora_envio: string | null
          id: string
          modulo: string
          nombre: string
          obra_nombre: string | null
          updated_at: string
        }
        Insert: {
          activa?: boolean
          canal_email?: boolean
          canal_plataforma?: boolean
          condiciones?: Json
          correos_adicionales?: Json
          creado_por?: string | null
          created_at?: string
          descripcion?: string | null
          destinatarios_roles?: Json
          destinatarios_usuarios?: Json
          dias_anticipacion?: number | null
          empresa: string
          evento_codigo: string
          frecuencia?: string
          hora_envio?: string | null
          id?: string
          modulo: string
          nombre: string
          obra_nombre?: string | null
          updated_at?: string
        }
        Update: {
          activa?: boolean
          canal_email?: boolean
          canal_plataforma?: boolean
          condiciones?: Json
          correos_adicionales?: Json
          creado_por?: string | null
          created_at?: string
          descripcion?: string | null
          destinatarios_roles?: Json
          destinatarios_usuarios?: Json
          dias_anticipacion?: number | null
          empresa?: string
          evento_codigo?: string
          frecuencia?: string
          hora_envio?: string | null
          id?: string
          modulo?: string
          nombre?: string
          obra_nombre?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      obra_cuadrillas: {
        Row: {
          created_at: string
          empresa: string
          especialidad: string | null
          id: number
          lider: string | null
          miembros: Json
          nombre: string
          obra_id: number | null
          obra_nombre: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          empresa: string
          especialidad?: string | null
          id?: number
          lider?: string | null
          miembros?: Json
          nombre: string
          obra_id?: number | null
          obra_nombre: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          empresa?: string
          especialidad?: string | null
          id?: number
          lider?: string | null
          miembros?: Json
          nombre?: string
          obra_id?: number | null
          obra_nombre?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "obra_cuadrillas_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      obra_liquidaciones: {
        Row: {
          criterio_imputacion: string | null
          created_at: string
          dias_imputados: number
          empresa: string
          id: number
          monto_real: number
          monto_liquidacion_total: number
          nomina_id: number | null
          nomina_item_id: number | null
          num_folio: string | null
          obra_id: number | null
          obra_nombre: string
          partida: string | null
          periodo: string
          trabajador: string
          trabajador_id: number | null
          porcentaje_imputacion: number
        }
        Insert: {
          criterio_imputacion?: string | null
          created_at?: string
          dias_imputados?: number
          empresa: string
          id?: number
          monto_real?: number
          monto_liquidacion_total?: number
          nomina_id?: number | null
          nomina_item_id?: number | null
          num_folio?: string | null
          obra_id?: number | null
          obra_nombre: string
          partida?: string | null
          periodo: string
          trabajador: string
          trabajador_id?: number | null
          porcentaje_imputacion?: number
        }
        Update: {
          criterio_imputacion?: string | null
          created_at?: string
          dias_imputados?: number
          empresa?: string
          id?: number
          monto_real?: number
          monto_liquidacion_total?: number
          nomina_id?: number | null
          nomina_item_id?: number | null
          num_folio?: string | null
          obra_id?: number | null
          obra_nombre?: string
          partida?: string | null
          periodo?: string
          trabajador?: string
          trabajador_id?: number | null
          porcentaje_imputacion?: number
        }
        Relationships: [
          {
            foreignKeyName: "obra_liquidaciones_nomina_id_fkey"
            columns: ["nomina_id"]
            isOneToOne: false
            referencedRelation: "rrhh_nominas_mensuales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_liquidaciones_nomina_item_id_fkey"
            columns: ["nomina_item_id"]
            isOneToOne: false
            referencedRelation: "rrhh_nomina_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_liquidaciones_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_liquidaciones_trabajador_id_fkey"
            columns: ["trabajador_id"]
            isOneToOne: false
            referencedRelation: "maestro_personal"
            referencedColumns: ["id"]
          },
        ]
      }
      obra_liquidaciones_partidas: {
        Row: {
          created_at: string
          criterio: string
          cuadrilla_id: number | null
          cuadrilla_nombre: string | null
          empresa: string
          id: number
          liquidacion_id: number
          monto_imputado: number
          nomina_id: number
          nomina_item_id: number
          obra_id: number
          partida: string
          partida_id: number | null
          ponderador: number
          porcentaje_imputacion: number
          trabajador_id: number | null
        }
        Insert: {
          created_at?: string
          criterio: string
          cuadrilla_id?: number | null
          cuadrilla_nombre?: string | null
          empresa: string
          id?: number
          liquidacion_id: number
          monto_imputado?: number
          nomina_id: number
          nomina_item_id: number
          obra_id: number
          partida: string
          partida_id?: number | null
          ponderador?: number
          porcentaje_imputacion?: number
          trabajador_id?: number | null
        }
        Update: {
          created_at?: string
          criterio?: string
          cuadrilla_id?: number | null
          cuadrilla_nombre?: string | null
          empresa?: string
          id?: number
          liquidacion_id?: number
          monto_imputado?: number
          nomina_id?: number
          nomina_item_id?: number
          obra_id?: number
          partida?: string
          partida_id?: number | null
          ponderador?: number
          porcentaje_imputacion?: number
          trabajador_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "obra_liquidaciones_partidas_cuadrilla_id_fkey"
            columns: ["cuadrilla_id"]
            isOneToOne: false
            referencedRelation: "obra_cuadrillas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_liquidaciones_partidas_liquidacion_id_fkey"
            columns: ["liquidacion_id"]
            isOneToOne: false
            referencedRelation: "obra_liquidaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_liquidaciones_partidas_nomina_id_fkey"
            columns: ["nomina_id"]
            isOneToOne: false
            referencedRelation: "rrhh_nominas_mensuales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_liquidaciones_partidas_nomina_item_id_fkey"
            columns: ["nomina_item_id"]
            isOneToOne: false
            referencedRelation: "rrhh_nomina_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_liquidaciones_partidas_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_liquidaciones_partidas_partida_id_fkey"
            columns: ["partida_id"]
            isOneToOne: false
            referencedRelation: "partidas_obra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_liquidaciones_partidas_trabajador_id_fkey"
            columns: ["trabajador_id"]
            isOneToOne: false
            referencedRelation: "maestro_personal"
            referencedColumns: ["id"]
          },
        ]
      }
      obra_presupuestos: {
        Row: {
          created_at: string | null
          empresa: string | null
          flujo_caja_ajustes: Json
          id: number
          obra_nombre: string
          presupuesto_id: number
        }
        Insert: {
          created_at?: string | null
          empresa?: string | null
          flujo_caja_ajustes?: Json
          id?: number
          obra_nombre: string
          presupuesto_id: number
        }
        Update: {
          created_at?: string | null
          empresa?: string | null
          flujo_caja_ajustes?: Json
          id?: number
          obra_nombre?: string
          presupuesto_id?: number
        }
        Relationships: []
      }
      obras: {
        Row: {
          admin_contrato: string | null
          administrador: string | null
          area: string | null
          asistencia_token: string
          centro_gestion_id: number | null
          centro_trabajo_id: number | null
          cliente: string | null
          cliente_email: string | null
          cliente_telefono: string | null
          created_at: string | null
          empresa: string | null
          estado: string | null
          fecha_inicio_real: string | null
          fecha_termino_estimada: string | null
          fecha_termino_real: string | null
          id: number
          imagen_base64: string | null
          latitud: number | null
          link: string | null
          longitud: number | null
          motivo_cierre: string | null
          nombre: string
          oficina_tecnica: string | null
          prevencionista: string | null
          radio_cobertura_m: number | null
          tipo: string | null
          ubicacion: string | null
        }
        Insert: {
          admin_contrato?: string | null
          administrador?: string | null
          area?: string | null
          asistencia_token?: string
          centro_gestion_id?: number | null
          centro_trabajo_id?: number | null
          cliente?: string | null
          cliente_email?: string | null
          cliente_telefono?: string | null
          created_at?: string | null
          empresa?: string | null
          estado?: string | null
          fecha_inicio_real?: string | null
          fecha_termino_estimada?: string | null
          fecha_termino_real?: string | null
          id?: number
          imagen_base64?: string | null
          latitud?: number | null
          link?: string | null
          longitud?: number | null
          motivo_cierre?: string | null
          nombre: string
          oficina_tecnica?: string | null
          prevencionista?: string | null
          radio_cobertura_m?: number | null
          tipo?: string | null
          ubicacion?: string | null
        }
        Update: {
          admin_contrato?: string | null
          administrador?: string | null
          area?: string | null
          asistencia_token?: string
          centro_gestion_id?: number | null
          centro_trabajo_id?: number | null
          cliente?: string | null
          cliente_email?: string | null
          cliente_telefono?: string | null
          created_at?: string | null
          empresa?: string | null
          estado?: string | null
          fecha_inicio_real?: string | null
          fecha_termino_estimada?: string | null
          fecha_termino_real?: string | null
          id?: number
          imagen_base64?: string | null
          latitud?: number | null
          link?: string | null
          longitud?: number | null
          motivo_cierre?: string | null
          nombre?: string
          oficina_tecnica?: string | null
          prevencionista?: string | null
          radio_cobertura_m?: number | null
          tipo?: string | null
          ubicacion?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "obras_centro_gestion_id_fkey"
            columns: ["centro_gestion_id"]
            isOneToOne: false
            referencedRelation: "facturacion_centros_gestion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obras_centro_trabajo_id_fkey"
            columns: ["centro_trabajo_id"]
            isOneToOne: false
            referencedRelation: "rrhh_centros_trabajo"
            referencedColumns: ["id"]
          },
        ]
      }
      ox_consultas_modulo: {
        Row: {
          auth_user_id: string
          created_at: string
          empresa: string
          ia_consumo_id: string | null
          id: string
          modulo: string
          pregunta: string
          respuesta: Json
          usuario: string | null
        }
        Insert: {
          auth_user_id: string
          created_at?: string
          empresa: string
          ia_consumo_id?: string | null
          id?: string
          modulo: string
          pregunta: string
          respuesta?: Json
          usuario?: string | null
        }
        Update: {
          auth_user_id?: string
          created_at?: string
          empresa?: string
          ia_consumo_id?: string | null
          id?: string
          modulo?: string
          pregunta?: string
          respuesta?: Json
          usuario?: string | null
        }
        Relationships: []
      }
      partidas_obra: {
        Row: {
          cantidad_presupuestada: number | null
          codigo: string | null
          costo_por_dia: number | null
          created_at: string | null
          desfase_dias: number
          empresa: string
          es_titulo: boolean
          fecha_inicio: string | null
          fecha_termino: string | null
          id: number
          obra_id: number
          obra_nombre: string | null
          orden: number
          partida: string
          predecesora: string | null
          rendimiento_meta: number | null
          tipo_relacion: string
          unidad: string | null
        }
        Insert: {
          cantidad_presupuestada?: number | null
          codigo?: string | null
          costo_por_dia?: number | null
          created_at?: string | null
          desfase_dias?: number
          empresa: string
          es_titulo?: boolean
          fecha_inicio?: string | null
          fecha_termino?: string | null
          id?: number
          obra_id: number
          obra_nombre?: string | null
          orden?: number
          partida: string
          predecesora?: string | null
          rendimiento_meta?: number | null
          tipo_relacion?: string
          unidad?: string | null
        }
        Update: {
          cantidad_presupuestada?: number | null
          codigo?: string | null
          costo_por_dia?: number | null
          created_at?: string | null
          desfase_dias?: number
          empresa?: string
          es_titulo?: boolean
          fecha_inicio?: string | null
          fecha_termino?: string | null
          id?: number
          obra_id?: number
          obra_nombre?: string | null
          orden?: number
          partida?: string
          predecesora?: string | null
          rendimiento_meta?: number | null
          tipo_relacion?: string
          unidad?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partidas_obra_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partidas_obra_obra_nombre_fkey"
            columns: ["obra_nombre"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["nombre"]
          },
        ]
      }
      planificacion_cronogramas: {
        Row: {
          codigo: string | null
          created_at: string | null
          duracion: number | null
          estado: string | null
          fecha_fin: string
          fecha_inicio: string
          id: number
          porcentaje_avance: number | null
          predecesora: string | null
          presupuesto_id: number | null
          responsable: string | null
          tarea: string
        }
        Insert: {
          codigo?: string | null
          created_at?: string | null
          duracion?: number | null
          estado?: string | null
          fecha_fin: string
          fecha_inicio: string
          id?: number
          porcentaje_avance?: number | null
          predecesora?: string | null
          presupuesto_id?: number | null
          responsable?: string | null
          tarea: string
        }
        Update: {
          codigo?: string | null
          created_at?: string | null
          duracion?: number | null
          estado?: string | null
          fecha_fin?: string
          fecha_inicio?: string
          id?: number
          porcentaje_avance?: number | null
          predecesora?: string | null
          presupuesto_id?: number | null
          responsable?: string | null
          tarea?: string
        }
        Relationships: [
          {
            foreignKeyName: "planificacion_cronogramas_presupuesto_id_fkey"
            columns: ["presupuesto_id"]
            isOneToOne: false
            referencedRelation: "presupuestos_proyectos"
            referencedColumns: ["id"]
          },
        ]
      }
      planificacion_tareas: {
        Row: {
          codigo: string | null
          created_at: string | null
          duracion: number | null
          empresa: string
          estado: string | null
          fecha_fin: string
          fecha_inicio: string
          id: number
          obra_nombre: string | null
          porcentaje_avance: number | null
          predecesora: string | null
          responsable: string | null
          tarea: string
        }
        Insert: {
          codigo?: string | null
          created_at?: string | null
          duracion?: number | null
          empresa: string
          estado?: string | null
          fecha_fin: string
          fecha_inicio: string
          id?: number
          obra_nombre?: string | null
          porcentaje_avance?: number | null
          predecesora?: string | null
          responsable?: string | null
          tarea: string
        }
        Update: {
          codigo?: string | null
          created_at?: string | null
          duracion?: number | null
          empresa?: string
          estado?: string | null
          fecha_fin?: string
          fecha_inicio?: string
          id?: number
          obra_nombre?: string | null
          porcentaje_avance?: number | null
          predecesora?: string | null
          responsable?: string | null
          tarea?: string
        }
        Relationships: [
          {
            foreignKeyName: "planificacion_tareas_obra_nombre_fkey"
            columns: ["obra_nombre"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["nombre"]
          },
        ]
      }
      predicciones_obra_historial: {
        Row: {
          confianza_datos: number
          costo_final_predicho: number
          costo_final_real: number | null
          cpi: number | null
          creado_por: string | null
          created_at: string
          empresa: string
          error_costo_pct: number | null
          error_plazo_dias: number | null
          estado_validacion: string
          fecha_corte: string
          fecha_termino_predicha: string
          fecha_termino_real: string | null
          id: number
          modo: string
          obra_id: number
          obra_nombre: string
          spi: number | null
          validada_at: string | null
          validado_por: string | null
        }
        Insert: {
          confianza_datos?: number
          costo_final_predicho?: number
          costo_final_real?: number | null
          cpi?: number | null
          creado_por?: string | null
          created_at?: string
          empresa: string
          error_costo_pct?: number | null
          error_plazo_dias?: number | null
          estado_validacion?: string
          fecha_corte: string
          fecha_termino_predicha: string
          fecha_termino_real?: string | null
          id?: number
          modo?: string
          obra_id: number
          obra_nombre: string
          spi?: number | null
          validada_at?: string | null
          validado_por?: string | null
        }
        Update: {
          confianza_datos?: number
          costo_final_predicho?: number
          costo_final_real?: number | null
          cpi?: number | null
          creado_por?: string | null
          created_at?: string
          empresa?: string
          error_costo_pct?: number | null
          error_plazo_dias?: number | null
          estado_validacion?: string
          fecha_corte?: string
          fecha_termino_predicha?: string
          fecha_termino_real?: string | null
          id?: number
          modo?: string
          obra_id?: number
          obra_nombre?: string
          spi?: number | null
          validada_at?: string | null
          validado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "predicciones_obra_historial_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      presupuestos_costos_indirectos: {
        Row: {
          concepto: string
          created_at: string | null
          id: number
          presupuesto_id: number | null
          tipo: string | null
          valor: number | null
        }
        Insert: {
          concepto: string
          created_at?: string | null
          id?: number
          presupuesto_id?: number | null
          tipo?: string | null
          valor?: number | null
        }
        Update: {
          concepto?: string
          created_at?: string | null
          id?: number
          presupuesto_id?: number | null
          tipo?: string | null
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "presupuestos_costos_indirectos_presupuesto_id_fkey"
            columns: ["presupuesto_id"]
            isOneToOne: false
            referencedRelation: "presupuestos_proyectos"
            referencedColumns: ["id"]
          },
        ]
      }
      presupuestos_items: {
        Row: {
          cantidad: number | null
          codigo: string | null
          costo_herramientas: number | null
          costo_mano_obra: number | null
          costo_maquinaria: number | null
          costo_materiales: number | null
          costo_otros: number | null
          costo_unitario: number | null
          created_at: string | null
          dias_habiles_mes: number | null
          divisor_cantidad: number | null
          divisor_unidad: string | null
          herramientas_menores_pct: number | null
          horas_jornada: number | null
          id: number
          imponderables_pct: number | null
          leyes_sociales_pct: number | null
          tipo_item: string
          parent_id: number | null
          nivel: number
          es_titulo: boolean
          codigo_origen: string | null
          origen_importacion: string
          orden: number | null
          partida: string
          precio_combustible: number | null
          presupuesto_id: number | null
          rendimiento_meta: number | null
          tiempo_estimado: number | null
          tipo_metodologia: string | null
          unidad: string | null
        }
        Insert: {
          cantidad?: number | null
          codigo?: string | null
          costo_herramientas?: number | null
          costo_mano_obra?: number | null
          costo_maquinaria?: number | null
          costo_materiales?: number | null
          costo_otros?: number | null
          costo_unitario?: number | null
          created_at?: string | null
          dias_habiles_mes?: number | null
          divisor_cantidad?: number | null
          divisor_unidad?: string | null
          herramientas_menores_pct?: number | null
          horas_jornada?: number | null
          id?: number
          imponderables_pct?: number | null
          leyes_sociales_pct?: number | null
          tipo_item?: string
          parent_id?: number | null
          nivel?: number
          es_titulo?: boolean
          codigo_origen?: string | null
          origen_importacion?: string
          orden?: number | null
          partida: string
          precio_combustible?: number | null
          presupuesto_id?: number | null
          rendimiento_meta?: number | null
          tiempo_estimado?: number | null
          tipo_metodologia?: string | null
          unidad?: string | null
        }
        Update: {
          cantidad?: number | null
          codigo?: string | null
          costo_herramientas?: number | null
          costo_mano_obra?: number | null
          costo_maquinaria?: number | null
          costo_materiales?: number | null
          costo_otros?: number | null
          costo_unitario?: number | null
          created_at?: string | null
          dias_habiles_mes?: number | null
          divisor_cantidad?: number | null
          divisor_unidad?: string | null
          herramientas_menores_pct?: number | null
          horas_jornada?: number | null
          id?: number
          imponderables_pct?: number | null
          leyes_sociales_pct?: number | null
          tipo_item?: string
          parent_id?: number | null
          nivel?: number
          es_titulo?: boolean
          codigo_origen?: string | null
          origen_importacion?: string
          orden?: number | null
          partida?: string
          precio_combustible?: number | null
          presupuesto_id?: number | null
          rendimiento_meta?: number | null
          tiempo_estimado?: number | null
          tipo_metodologia?: string | null
          unidad?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "presupuestos_items_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "presupuestos_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presupuestos_items_presupuesto_id_fkey"
            columns: ["presupuesto_id"]
            isOneToOne: false
            referencedRelation: "presupuestos_proyectos"
            referencedColumns: ["id"]
          },
        ]
      }
      presupuestos_items_recursos: {
        Row: {
          cantidad_unidad: number | null
          consumo_combustible_lh: number | null
          created_at: string | null
          id: number
          item_id: number | null
          recurso_id: number | null
          rendimiento: number | null
        }
        Insert: {
          cantidad_unidad?: number | null
          consumo_combustible_lh?: number | null
          created_at?: string | null
          id?: number
          item_id?: number | null
          recurso_id?: number | null
          rendimiento?: number | null
        }
        Update: {
          cantidad_unidad?: number | null
          consumo_combustible_lh?: number | null
          created_at?: string | null
          id?: number
          item_id?: number | null
          recurso_id?: number | null
          rendimiento?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "presupuestos_items_recursos_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "presupuestos_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presupuestos_items_recursos_recurso_id_fkey"
            columns: ["recurso_id"]
            isOneToOne: false
            referencedRelation: "recursos_presupuesto"
            referencedColumns: ["id"]
          },
        ]
      }
      presupuestos_proyectos: {
        Row: {
          cliente: string | null
          comuna: string | null
          created_at: string | null
          descripcion: string | null
          empresa: string
          id: number
          metodologia: string | null
          nombre: string
          plazo_estimado: number | null
          presupuesto_estimado: number | null
          tipo_proyecto: string | null
          ubicacion: string | null
        }
        Insert: {
          cliente?: string | null
          comuna?: string | null
          created_at?: string | null
          descripcion?: string | null
          empresa?: string
          id?: number
          metodologia?: string | null
          nombre: string
          plazo_estimado?: number | null
          presupuesto_estimado?: number | null
          tipo_proyecto?: string | null
          ubicacion?: string | null
        }
        Update: {
          cliente?: string | null
          comuna?: string | null
          created_at?: string | null
          descripcion?: string | null
          empresa?: string
          id?: number
          metodologia?: string | null
          nombre?: string
          plazo_estimado?: number | null
          presupuesto_estimado?: number | null
          tipo_proyecto?: string | null
          ubicacion?: string | null
        }
        Relationships: []
      }
      prevencion_capacitaciones: {
        Row: {
          contenido_texto: string | null
          creado_por: string | null
          created_at: string | null
          descripcion: string | null
          empresa: string
          id: number
          preguntas: Json
          publico_token: string | null
          titulo: string
          video_url: string | null
        }
        Insert: {
          contenido_texto?: string | null
          creado_por?: string | null
          created_at?: string | null
          descripcion?: string | null
          empresa: string
          id?: number
          preguntas?: Json
          publico_token?: string | null
          titulo: string
          video_url?: string | null
        }
        Update: {
          contenido_texto?: string | null
          creado_por?: string | null
          created_at?: string | null
          descripcion?: string | null
          empresa?: string
          id?: number
          preguntas?: Json
          publico_token?: string | null
          titulo?: string
          video_url?: string | null
        }
        Relationships: []
      }
      prevencion_capacitaciones_intentos: {
        Row: {
          aprobado: boolean | null
          capacitacion_id: number | null
          created_at: string | null
          empresa: string
          id: number
          nombre_trabajador: string
          nota: number | null
          puntaje_maximo: number | null
          puntaje_obtenido: number | null
          respuestas: Json
          rut_trabajador: string
        }
        Insert: {
          aprobado?: boolean | null
          capacitacion_id?: number | null
          created_at?: string | null
          empresa: string
          id?: number
          nombre_trabajador: string
          nota?: number | null
          puntaje_maximo?: number | null
          puntaje_obtenido?: number | null
          respuestas?: Json
          rut_trabajador: string
        }
        Update: {
          aprobado?: boolean | null
          capacitacion_id?: number | null
          created_at?: string | null
          empresa?: string
          id?: number
          nombre_trabajador?: string
          nota?: number | null
          puntaje_maximo?: number | null
          puntaje_obtenido?: number | null
          respuestas?: Json
          rut_trabajador?: string
        }
        Relationships: [
          {
            foreignKeyName: "prevencion_capacitaciones_intentos_capacitacion_id_fkey"
            columns: ["capacitacion_id"]
            isOneToOne: false
            referencedRelation: "prevencion_capacitaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      prevencion_cumplimiento_asignaciones: {
        Row: {
          activo: boolean
          created_at: string | null
          dia_mes: number | null
          dia_semana: number | null
          empresa: string | null
          formulario_id: number | null
          frecuencia: string
          hora_limite: string
          id: number
          notificar_pendiente: boolean
          registro_nombre: string
          trabajador_nombre: string
          trabajador_rut: string
          usuario_id: number | null
        }
        Insert: {
          activo?: boolean
          created_at?: string | null
          dia_mes?: number | null
          dia_semana?: number | null
          empresa?: string | null
          formulario_id?: number | null
          frecuencia: string
          hora_limite?: string
          id?: number
          notificar_pendiente?: boolean
          registro_nombre: string
          trabajador_nombre: string
          trabajador_rut: string
          usuario_id?: number | null
        }
        Update: {
          activo?: boolean
          created_at?: string | null
          dia_mes?: number | null
          dia_semana?: number | null
          empresa?: string | null
          formulario_id?: number | null
          frecuencia?: string
          hora_limite?: string
          id?: number
          notificar_pendiente?: boolean
          registro_nombre?: string
          trabajador_nombre?: string
          trabajador_rut?: string
          usuario_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "prevencion_cumplimiento_asignaciones_formulario_id_fkey"
            columns: ["formulario_id"]
            isOneToOne: false
            referencedRelation: "prevencion_formularios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prevencion_cumplimiento_asignaciones_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      prevencion_cumplimiento_registros: {
        Row: {
          asignacion_id: number | null
          created_at: string | null
          empresa: string | null
          estado: string | null
          fecha_cumplimiento: string
          id: number
          observaciones: string | null
          verificado_por: string | null
        }
        Insert: {
          asignacion_id?: number | null
          created_at?: string | null
          empresa?: string | null
          estado?: string | null
          fecha_cumplimiento: string
          id?: number
          observaciones?: string | null
          verificado_por?: string | null
        }
        Update: {
          asignacion_id?: number | null
          created_at?: string | null
          empresa?: string | null
          estado?: string | null
          fecha_cumplimiento?: string
          id?: number
          observaciones?: string | null
          verificado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prevencion_cumplimiento_registros_asignacion_id_fkey"
            columns: ["asignacion_id"]
            isOneToOne: false
            referencedRelation: "prevencion_cumplimiento_asignaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      prevencion_formularios: {
        Row: {
          campos: Json
          cargos_obligados: string | null
          categoria: string | null
          codigo: string | null
          correos_notificacion: string | null
          creado_por: string | null
          created_at: string | null
          descripcion: string | null
          empresa: string
          fecha_revision: string | null
          id: number
          publico_token: string | null
          revision: string | null
          titulo: string
        }
        Insert: {
          campos?: Json
          cargos_obligados?: string | null
          categoria?: string | null
          codigo?: string | null
          correos_notificacion?: string | null
          creado_por?: string | null
          created_at?: string | null
          descripcion?: string | null
          empresa: string
          fecha_revision?: string | null
          id?: number
          publico_token?: string | null
          revision?: string | null
          titulo: string
        }
        Update: {
          campos?: Json
          cargos_obligados?: string | null
          categoria?: string | null
          codigo?: string | null
          correos_notificacion?: string | null
          creado_por?: string | null
          created_at?: string | null
          descripcion?: string | null
          empresa?: string
          fecha_revision?: string | null
          id?: number
          publico_token?: string | null
          revision?: string | null
          titulo?: string
        }
        Relationships: []
      }
      prevencion_matrices_riesgo: {
        Row: {
          archivo_nombre: string | null
          archivo_path: string | null
          archivo_tipo: string | null
          codigo: string
          columnas: Json
          creado_por: string | null
          created_at: string
          empresa: string
          estado: string
          fecha_revision: string
          id: string
          metodologia: string
          nombre: string
          obra_id: number | null
          updated_at: string
          version: string
        }
        Insert: {
          archivo_nombre?: string | null
          archivo_path?: string | null
          archivo_tipo?: string | null
          codigo: string
          columnas?: Json
          creado_por?: string | null
          created_at?: string
          empresa: string
          estado?: string
          fecha_revision?: string
          id?: string
          metodologia?: string
          nombre: string
          obra_id?: number | null
          updated_at?: string
          version?: string
        }
        Update: {
          archivo_nombre?: string | null
          archivo_path?: string | null
          archivo_tipo?: string | null
          codigo?: string
          columnas?: Json
          creado_por?: string | null
          created_at?: string
          empresa?: string
          estado?: string
          fecha_revision?: string
          id?: string
          metodologia?: string
          nombre?: string
          obra_id?: number | null
          updated_at?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "prevencion_matrices_riesgo_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      prevencion_matriz_riesgo_filas: {
        Row: {
          created_at: string
          datos: Json
          empresa: string
          id: number
          matriz_id: string
          nivel_riesgo: string | null
          orden: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          datos?: Json
          empresa: string
          id?: number
          matriz_id: string
          nivel_riesgo?: string | null
          orden: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          datos?: Json
          empresa?: string
          id?: number
          matriz_id?: string
          nivel_riesgo?: string | null
          orden?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prevencion_matriz_riesgo_filas_matriz_empresa_fk"
            columns: ["matriz_id", "empresa"]
            isOneToOne: false
            referencedRelation: "prevencion_matrices_riesgo"
            referencedColumns: ["id", "empresa"]
          },
        ]
      }
      prevencion_procedimientos: {
        Row: {
          archivo_base64: string | null
          archivo_nombre: string | null
          archivo_tamano: string | null
          area: string | null
          codigo: string
          created_at: string
          empresa: string
          fecha: string
          id: number
          nombre: string
          obra_nombre: string | null
          updated_at: string
          version: string
        }
        Insert: {
          archivo_base64?: string | null
          archivo_nombre?: string | null
          archivo_tamano?: string | null
          area?: string | null
          codigo: string
          created_at?: string
          empresa: string
          fecha?: string
          id?: number
          nombre: string
          obra_nombre?: string | null
          updated_at?: string
          version?: string
        }
        Update: {
          archivo_base64?: string | null
          archivo_nombre?: string | null
          archivo_tamano?: string | null
          area?: string | null
          codigo?: string
          created_at?: string
          empresa?: string
          fecha?: string
          id?: number
          nombre?: string
          obra_nombre?: string | null
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      prevencion_respuestas: {
        Row: {
          centro_gestion_id: number | null
          created_at: string | null
          firma_url: string | null
          formulario_id: number | null
          id: number
          inspector: string | null
          obra_id: number | null
          proyecto_nombre: string | null
          respuestas: Json
        }
        Insert: {
          centro_gestion_id?: number | null
          created_at?: string | null
          firma_url?: string | null
          formulario_id?: number | null
          id?: number
          inspector?: string | null
          obra_id?: number | null
          proyecto_nombre?: string | null
          respuestas?: Json
        }
        Update: {
          centro_gestion_id?: number | null
          created_at?: string | null
          firma_url?: string | null
          formulario_id?: number | null
          id?: number
          inspector?: string | null
          obra_id?: number | null
          proyecto_nombre?: string | null
          respuestas?: Json
        }
        Relationships: [
          {
            foreignKeyName: "prevencion_respuestas_centro_gestion_id_fkey"
            columns: ["centro_gestion_id"]
            isOneToOne: false
            referencedRelation: "facturacion_centros_gestion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prevencion_respuestas_formulario_id_fkey"
            columns: ["formulario_id"]
            isOneToOne: false
            referencedRelation: "prevencion_formularios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prevencion_respuestas_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      recursos_presupuesto: {
        Row: {
          cantidad_estimada: number | null
          categoria: string
          ciudad: string | null
          costo_unitario: number | null
          created_at: string | null
          id: number
          presupuesto_id: number | null
          proveedor: string | null
          recurso: string
          tipo: string | null
          unidad: string | null
        }
        Insert: {
          cantidad_estimada?: number | null
          categoria?: string
          ciudad?: string | null
          costo_unitario?: number | null
          created_at?: string | null
          id?: number
          presupuesto_id?: number | null
          proveedor?: string | null
          recurso: string
          tipo?: string | null
          unidad?: string | null
        }
        Update: {
          cantidad_estimada?: number | null
          categoria?: string
          ciudad?: string | null
          costo_unitario?: number | null
          created_at?: string | null
          id?: number
          presupuesto_id?: number | null
          proveedor?: string | null
          recurso?: string
          tipo?: string | null
          unidad?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recursos_presupuesto_presupuesto_id_fkey"
            columns: ["presupuesto_id"]
            isOneToOne: false
            referencedRelation: "presupuestos_proyectos"
            referencedColumns: ["id"]
          },
        ]
      }
      reporte_maquinaria: {
        Row: {
          created_at: string | null
          empresa: string
          horometro_combustible: number | null
          horometro_entrada: number | null
          horometro_salida: number | null
          id: number
          litros_combustible: number | null
          maquinaria: string | null
          obra_nombre: string | null
          observaciones: string | null
          operador: string | null
          paralizacion: string | null
          supervisor: string | null
        }
        Insert: {
          created_at?: string | null
          empresa: string
          horometro_combustible?: number | null
          horometro_entrada?: number | null
          horometro_salida?: number | null
          id?: number
          litros_combustible?: number | null
          maquinaria?: string | null
          obra_nombre?: string | null
          observaciones?: string | null
          operador?: string | null
          paralizacion?: string | null
          supervisor?: string | null
        }
        Update: {
          created_at?: string | null
          empresa?: string
          horometro_combustible?: number | null
          horometro_entrada?: number | null
          horometro_salida?: number | null
          id?: number
          litros_combustible?: number | null
          maquinaria?: string | null
          obra_nombre?: string | null
          observaciones?: string | null
          operador?: string | null
          paralizacion?: string | null
          supervisor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reporte_maquinaria_obra_nombre_fkey"
            columns: ["obra_nombre"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["nombre"]
          },
        ]
      }
      roles: {
        Row: {
          archivado: boolean
          created_at: string | null
          descripcion: string | null
          empresa: string
          id: number
          modulos: string | null
          nombre: string
          permisos: Json
          permisos_actualizados_en: string | null
          permisos_actualizados_por: string | null
          rol_base: string
          submenus: string | null
        }
        Insert: {
          archivado?: boolean
          created_at?: string | null
          descripcion?: string | null
          empresa: string
          id?: number
          modulos?: string | null
          nombre: string
          permisos?: Json
          permisos_actualizados_en?: string | null
          permisos_actualizados_por?: string | null
          rol_base?: string
          submenus?: string | null
        }
        Update: {
          archivado?: boolean
          created_at?: string | null
          descripcion?: string | null
          empresa?: string
          id?: number
          modulos?: string | null
          nombre?: string
          permisos?: Json
          permisos_actualizados_en?: string | null
          permisos_actualizados_por?: string | null
          rol_base?: string
          submenus?: string | null
        }
        Relationships: []
      }
      rrhh_asignaciones_personal: {
        Row: {
          cargo: string | null
          centro_gestion_id: number | null
          creado_por: string | null
          created_at: string
          destino_nombre: string
          empresa: string
          fecha_inicio: string
          fecha_termino: string | null
          id: number
          obra_nombre: string | null
          trabajador_id: number
          trabajador_nombre: string
          trabajador_rut: string | null
          updated_at: string
        }
        Insert: {
          cargo?: string | null
          centro_gestion_id?: number | null
          creado_por?: string | null
          created_at?: string
          destino_nombre?: string
          empresa: string
          fecha_inicio: string
          fecha_termino?: string | null
          id?: number
          obra_nombre?: string | null
          trabajador_id: number
          trabajador_nombre: string
          trabajador_rut?: string | null
          updated_at?: string
        }
        Update: {
          cargo?: string | null
          centro_gestion_id?: number | null
          creado_por?: string | null
          created_at?: string
          destino_nombre?: string
          empresa?: string
          fecha_inicio?: string
          fecha_termino?: string | null
          id?: number
          obra_nombre?: string | null
          trabajador_id?: number
          trabajador_nombre?: string
          trabajador_rut?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rrhh_asignaciones_personal_centro_gestion_id_fkey"
            columns: ["centro_gestion_id"]
            isOneToOne: false
            referencedRelation: "facturacion_centros_gestion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rrhh_asignaciones_personal_trabajador_id_fkey"
            columns: ["trabajador_id"]
            isOneToOne: false
            referencedRelation: "maestro_personal"
            referencedColumns: ["id"]
          },
        ]
      }
      rrhh_centros_trabajo: {
        Row: {
          activo: boolean
          created_at: string
          direccion: string | null
          empresa: string
          id: number
          nombre: string
          numero: number
          obra_id: number | null
          tipo: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          direccion?: string | null
          empresa: string
          id?: number
          nombre: string
          numero: number
          obra_id?: number | null
          tipo?: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          direccion?: string | null
          empresa?: string
          id?: number
          nombre?: string
          numero?: number
          obra_id?: number | null
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rrhh_centros_trabajo_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: true
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      rrhh_documentos_trabajadores: {
        Row: {
          archivo_nombre: string
          archivo_path: string
          confianza_ia: number | null
          confirmado: boolean
          creado_por: string | null
          created_at: string
          empresa: string
          estado_vigencia: string
          fecha_emision: string | null
          fecha_vencimiento: string | null
          id: number
          mime_type: string | null
          resultado_ia: Json | null
          tipo_documento: string
          trabajador_id: number
          trabajador_nombre: string
          trabajador_rut: string | null
          updated_at: string
        }
        Insert: {
          archivo_nombre: string
          archivo_path: string
          confianza_ia?: number | null
          confirmado?: boolean
          creado_por?: string | null
          created_at?: string
          empresa: string
          estado_vigencia?: string
          fecha_emision?: string | null
          fecha_vencimiento?: string | null
          id?: number
          mime_type?: string | null
          resultado_ia?: Json | null
          tipo_documento: string
          trabajador_id: number
          trabajador_nombre: string
          trabajador_rut?: string | null
          updated_at?: string
        }
        Update: {
          archivo_nombre?: string
          archivo_path?: string
          confianza_ia?: number | null
          confirmado?: boolean
          creado_por?: string | null
          created_at?: string
          empresa?: string
          estado_vigencia?: string
          fecha_emision?: string | null
          fecha_vencimiento?: string | null
          id?: number
          mime_type?: string | null
          resultado_ia?: Json | null
          tipo_documento?: string
          trabajador_id?: number
          trabajador_nombre?: string
          trabajador_rut?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      rrhh_formatos_documentos: {
        Row: {
          actualizado_por: string | null
          advertencias: Json
          archivo_nombre: string | null
          contenido: string
          created_at: string
          empresa: string
          estado: string
          id: number
          tipo: string
          titulo: string
          updated_at: string
          variables: Json
          version: number
        }
        Insert: {
          actualizado_por?: string | null
          advertencias?: Json
          archivo_nombre?: string | null
          contenido: string
          created_at?: string
          empresa: string
          estado?: string
          id?: number
          tipo?: string
          titulo: string
          updated_at?: string
          variables?: Json
          version?: number
        }
        Update: {
          actualizado_por?: string | null
          advertencias?: Json
          archivo_nombre?: string | null
          contenido?: string
          created_at?: string
          empresa?: string
          estado?: string
          id?: number
          tipo?: string
          titulo?: string
          updated_at?: string
          variables?: Json
          version?: number
        }
        Relationships: []
      }
      rrhh_nomina_items: {
        Row: {
          calculo: Json
          cargo: string | null
          centro_gestion_id: number | null
          created_at: string
          id: number
          nomina_id: number
          novedades: Json
          obra_nombre: string | null
          sueldo_liquido: number
          trabajador_id: number | null
          trabajador_nombre: string
          trabajador_rut: string | null
        }
        Insert: {
          calculo?: Json
          cargo?: string | null
          centro_gestion_id?: number | null
          created_at?: string
          id?: number
          nomina_id: number
          novedades?: Json
          obra_nombre?: string | null
          sueldo_liquido?: number
          trabajador_id?: number | null
          trabajador_nombre: string
          trabajador_rut?: string | null
        }
        Update: {
          calculo?: Json
          cargo?: string | null
          centro_gestion_id?: number | null
          created_at?: string
          id?: number
          nomina_id?: number
          novedades?: Json
          obra_nombre?: string | null
          sueldo_liquido?: number
          trabajador_id?: number | null
          trabajador_nombre?: string
          trabajador_rut?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rrhh_nomina_items_centro_gestion_id_fkey"
            columns: ["centro_gestion_id"]
            isOneToOne: false
            referencedRelation: "facturacion_centros_gestion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rrhh_nomina_items_nomina_id_fkey"
            columns: ["nomina_id"]
            isOneToOne: false
            referencedRelation: "rrhh_nominas_mensuales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rrhh_nomina_items_trabajador_id_fkey"
            columns: ["trabajador_id"]
            isOneToOne: false
            referencedRelation: "maestro_personal"
            referencedColumns: ["id"]
          },
        ]
      }
      rrhh_nominas_mensuales: {
        Row: {
          created_at: string
          empresa: string
          estado: string
          generado_por: string | null
          id: number
          parametros: Json
          periodo: string
          total_descuentos: number
          total_haberes: number
          total_liquido: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          empresa: string
          estado?: string
          generado_por?: string | null
          id?: number
          parametros?: Json
          periodo: string
          total_descuentos?: number
          total_haberes?: number
          total_liquido?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          empresa?: string
          estado?: string
          generado_por?: string | null
          id?: number
          parametros?: Json
          periodo?: string
          total_descuentos?: number
          total_haberes?: number
          total_liquido?: number
          updated_at?: string
        }
        Relationships: []
      }
      rrhh_proyecciones_dotacion: {
        Row: {
          cantidad_requerida: number
          cargo: string
          costo_mensual_unitario: number
          creado_por: string | null
          created_at: string
          empresa: string
          estado: string
          fecha_inicio: string
          fecha_termino: string
          id: number
          obra_nombre: string
          observaciones: string | null
          turno: string | null
          updated_at: string
        }
        Insert: {
          cantidad_requerida?: number
          cargo: string
          costo_mensual_unitario?: number
          creado_por?: string | null
          created_at?: string
          empresa: string
          estado?: string
          fecha_inicio: string
          fecha_termino: string
          id?: number
          obra_nombre: string
          observaciones?: string | null
          turno?: string | null
          updated_at?: string
        }
        Update: {
          cantidad_requerida?: number
          cargo?: string
          costo_mensual_unitario?: number
          creado_por?: string | null
          created_at?: string
          empresa?: string
          estado?: string
          fecha_inicio?: string
          fecha_termino?: string
          id?: number
          obra_nombre?: string
          observaciones?: string | null
          turno?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      subcontrato_asistencia: {
        Row: {
          ausentes: number | null
          contrato_colaborativo_id: string | null
          created_at: string | null
          empresa: string
          empresa_origen: string | null
          enviado_por_auth_id: string | null
          estado: string
          fecha: string
          horas_hombre: number | null
          id: number
          obra_nombre: string
          obra_origen_id: number | null
          presentes: number
          subcontrato_id: number
          subcontrato_nombre: string
        }
        Insert: {
          ausentes?: number | null
          contrato_colaborativo_id?: string | null
          created_at?: string | null
          empresa: string
          empresa_origen?: string | null
          enviado_por_auth_id?: string | null
          estado?: string
          fecha: string
          horas_hombre?: number | null
          id?: number
          obra_nombre: string
          obra_origen_id?: number | null
          presentes: number
          subcontrato_id: number
          subcontrato_nombre: string
        }
        Update: {
          ausentes?: number | null
          contrato_colaborativo_id?: string | null
          created_at?: string | null
          empresa?: string
          empresa_origen?: string | null
          enviado_por_auth_id?: string | null
          estado?: string
          fecha?: string
          horas_hombre?: number | null
          id?: number
          obra_nombre?: string
          obra_origen_id?: number | null
          presentes?: number
          subcontrato_id?: number
          subcontrato_nombre?: string
        }
        Relationships: [
          {
            foreignKeyName: "subcontrato_asistencia_contrato_colaborativo_id_fkey"
            columns: ["contrato_colaborativo_id"]
            isOneToOne: false
            referencedRelation: "contratos_colaborativos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subcontrato_asistencia_obra_origen_id_fkey"
            columns: ["obra_origen_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      subcontrato_avances: {
        Row: {
          cantidad: number
          comentario: string | null
          contrato_colaborativo_id: string | null
          created_at: string | null
          empresa: string
          empresa_origen: string | null
          enlace_partida_id: string | null
          enviado_por_auth_id: string | null
          estado: string
          fecha: string
          id: number
          obra_nombre: string
          obra_origen_id: number | null
          partida_nombre: string
          revisado_at: string | null
          revisado_por: string | null
          subcontrato_id: number
          subcontrato_nombre: string
          unidad: string | null
        }
        Insert: {
          cantidad: number
          comentario?: string | null
          contrato_colaborativo_id?: string | null
          created_at?: string | null
          empresa: string
          empresa_origen?: string | null
          enlace_partida_id?: string | null
          enviado_por_auth_id?: string | null
          estado?: string
          fecha: string
          id?: number
          obra_nombre: string
          obra_origen_id?: number | null
          partida_nombre: string
          revisado_at?: string | null
          revisado_por?: string | null
          subcontrato_id: number
          subcontrato_nombre: string
          unidad?: string | null
        }
        Update: {
          cantidad?: number
          comentario?: string | null
          contrato_colaborativo_id?: string | null
          created_at?: string | null
          empresa?: string
          empresa_origen?: string | null
          enlace_partida_id?: string | null
          enviado_por_auth_id?: string | null
          estado?: string
          fecha?: string
          id?: number
          obra_nombre?: string
          obra_origen_id?: number | null
          partida_nombre?: string
          revisado_at?: string | null
          revisado_por?: string | null
          subcontrato_id?: number
          subcontrato_nombre?: string
          unidad?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subcontrato_avances_contrato_colaborativo_id_fkey"
            columns: ["contrato_colaborativo_id"]
            isOneToOne: false
            referencedRelation: "contratos_colaborativos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subcontrato_avances_enlace_partida_id_fkey"
            columns: ["enlace_partida_id"]
            isOneToOne: false
            referencedRelation: "contratos_colaborativos_partidas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subcontrato_avances_obra_origen_id_fkey"
            columns: ["obra_origen_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      subcontrato_ep_documentos: {
        Row: {
          archivo_nombre: string
          archivo_path: string
          cargado_por: string | null
          created_at: string
          estado: string
          estado_pago_id: number
          id: number
          mime_type: string | null
          observacion_revision: string | null
          periodo_desde: string | null
          periodo_hasta: string | null
          requisito_id: number
          revisado_at: string | null
          revisado_por: string | null
          tamano_bytes: number | null
          updated_at: string
          version: number
        }
        Insert: {
          archivo_nombre: string
          archivo_path: string
          cargado_por?: string | null
          created_at?: string
          estado?: string
          estado_pago_id: number
          id?: number
          mime_type?: string | null
          observacion_revision?: string | null
          periodo_desde?: string | null
          periodo_hasta?: string | null
          requisito_id: number
          revisado_at?: string | null
          revisado_por?: string | null
          tamano_bytes?: number | null
          updated_at?: string
          version?: number
        }
        Update: {
          archivo_nombre?: string
          archivo_path?: string
          cargado_por?: string | null
          created_at?: string
          estado?: string
          estado_pago_id?: number
          id?: number
          mime_type?: string | null
          observacion_revision?: string | null
          periodo_desde?: string | null
          periodo_hasta?: string | null
          requisito_id?: number
          revisado_at?: string | null
          revisado_por?: string | null
          tamano_bytes?: number | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "subcontrato_ep_documentos_estado_pago_id_fkey"
            columns: ["estado_pago_id"]
            isOneToOne: false
            referencedRelation: "subcontrato_estados_pago"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subcontrato_ep_documentos_requisito_id_fkey"
            columns: ["requisito_id"]
            isOneToOne: false
            referencedRelation: "subcontrato_ep_requisitos"
            referencedColumns: ["id"]
          },
        ]
      }
      subcontrato_ep_historial: {
        Row: {
          accion: string
          actor_cargo: string | null
          actor_empresa: string | null
          actor_nombre: string | null
          actor_rut: string | null
          created_at: string
          detalle: string | null
          documento_id: number | null
          estado_destino: string | null
          estado_origen: string | null
          estado_pago_id: number
          id: number
        }
        Insert: {
          accion: string
          actor_cargo?: string | null
          actor_empresa?: string | null
          actor_nombre?: string | null
          actor_rut?: string | null
          created_at?: string
          detalle?: string | null
          documento_id?: number | null
          estado_destino?: string | null
          estado_origen?: string | null
          estado_pago_id: number
          id?: number
        }
        Update: {
          accion?: string
          actor_cargo?: string | null
          actor_empresa?: string | null
          actor_nombre?: string | null
          actor_rut?: string | null
          created_at?: string
          detalle?: string | null
          documento_id?: number | null
          estado_destino?: string | null
          estado_origen?: string | null
          estado_pago_id?: number
          id?: number
        }
        Relationships: [
          {
            foreignKeyName: "subcontrato_ep_historial_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "subcontrato_ep_documentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subcontrato_ep_historial_estado_pago_id_fkey"
            columns: ["estado_pago_id"]
            isOneToOne: false
            referencedRelation: "subcontrato_estados_pago"
            referencedColumns: ["id"]
          },
        ]
      }
      subcontrato_ep_requisitos: {
        Row: {
          activo: boolean
          categoria: string
          codigo: string
          created_at: string
          descripcion: string | null
          empresa: string
          fundamento: string | null
          id: number
          nombre: string
          obligatorio: boolean
          obra_nombre: string | null
          orden: number
          requiere_vigencia: boolean
        }
        Insert: {
          activo?: boolean
          categoria?: string
          codigo: string
          created_at?: string
          descripcion?: string | null
          empresa: string
          fundamento?: string | null
          id?: number
          nombre: string
          obligatorio?: boolean
          obra_nombre?: string | null
          orden?: number
          requiere_vigencia?: boolean
        }
        Update: {
          activo?: boolean
          categoria?: string
          codigo?: string
          created_at?: string
          descripcion?: string | null
          empresa?: string
          fundamento?: string | null
          id?: number
          nombre?: string
          obligatorio?: boolean
          obra_nombre?: string | null
          orden?: number
          requiere_vigencia?: boolean
        }
        Relationships: []
      }
      subcontrato_estados_pago: {
        Row: {
          aprobado_at: string | null
          aprobado_por: string | null
          contrato_colaborativo_id: string | null
          costo_real_id: number | null
          created_at: string | null
          empresa: string
          empresa_origen: string | null
          enviado_por_auth_id: string | null
          estado: string
          factura_folio: string | null
          factura_url: string | null
          id: number
          monto_aprobado: number | null
          monto_presentado: number
          numero: number
          obra_nombre: string
          obra_origen_id: number | null
          observaciones: string | null
          periodo_desde: string
          periodo_hasta: string
          subcontrato_id: number
          subcontrato_nombre: string
        }
        Insert: {
          aprobado_at?: string | null
          aprobado_por?: string | null
          contrato_colaborativo_id?: string | null
          costo_real_id?: number | null
          created_at?: string | null
          empresa: string
          empresa_origen?: string | null
          enviado_por_auth_id?: string | null
          estado?: string
          factura_folio?: string | null
          factura_url?: string | null
          id?: number
          monto_aprobado?: number | null
          monto_presentado: number
          numero: number
          obra_nombre: string
          obra_origen_id?: number | null
          observaciones?: string | null
          periodo_desde: string
          periodo_hasta: string
          subcontrato_id: number
          subcontrato_nombre: string
        }
        Update: {
          aprobado_at?: string | null
          aprobado_por?: string | null
          contrato_colaborativo_id?: string | null
          costo_real_id?: number | null
          created_at?: string | null
          empresa?: string
          empresa_origen?: string | null
          enviado_por_auth_id?: string | null
          estado?: string
          factura_folio?: string | null
          factura_url?: string | null
          id?: number
          monto_aprobado?: number | null
          monto_presentado?: number
          numero?: number
          obra_nombre?: string
          obra_origen_id?: number | null
          observaciones?: string | null
          periodo_desde?: string
          periodo_hasta?: string
          subcontrato_id?: number
          subcontrato_nombre?: string
        }
        Relationships: [
          {
            foreignKeyName: "subcontrato_estados_pago_contrato_colaborativo_id_fkey"
            columns: ["contrato_colaborativo_id"]
            isOneToOne: false
            referencedRelation: "contratos_colaborativos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subcontrato_estados_pago_obra_origen_id_fkey"
            columns: ["obra_origen_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      subcontrato_portal_intentos: {
        Row: {
          created_at: string
          id: number
          token_hash: string
        }
        Insert: {
          created_at?: string
          id?: number
          token_hash: string
        }
        Update: {
          created_at?: string
          id?: number
          token_hash?: string
        }
        Relationships: []
      }
      usuarios: {
        Row: {
          auth_user_id: string | null
          cargo: string | null
          contrasena: string | null
          correo: string | null
          created_at: string | null
          empresa: string | null
          id: number
          modulos: string | null
          nombre: string | null
          obras: string | null
          permisos: Json
          permisos_actualizados_en: string | null
          permisos_actualizados_por: string | null
          rol: string | null
          rol_base: string | null
          submenus: string | null
          trabajador_rut: string | null
          usuario: string
        }
        Insert: {
          auth_user_id?: string | null
          cargo?: string | null
          contrasena?: string | null
          correo?: string | null
          created_at?: string | null
          empresa?: string | null
          id?: number
          modulos?: string | null
          nombre?: string | null
          obras?: string | null
          permisos?: Json
          permisos_actualizados_en?: string | null
          permisos_actualizados_por?: string | null
          rol?: string | null
          rol_base?: string | null
          submenus?: string | null
          trabajador_rut?: string | null
          usuario: string
        }
        Update: {
          auth_user_id?: string | null
          cargo?: string | null
          contrasena?: string | null
          correo?: string | null
          created_at?: string | null
          empresa?: string | null
          id?: number
          modulos?: string | null
          nombre?: string | null
          obras?: string | null
          permisos?: Json
          permisos_actualizados_en?: string | null
          permisos_actualizados_por?: string | null
          rol?: string | null
          rol_base?: string | null
          submenus?: string | null
          trabajador_rut?: string | null
          usuario?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      aprobar_ep_subcontrato_y_cargar_costo: {
        Args: { p_aprobado_por: string; p_estado_pago_id: number }
        Returns: number
      }
      asignar_folio_dte: { Args: { p_documento: string }; Returns: number }
       distribuir_nomina_a_obras: {
          Args: { p_nomina_id: number }
          Returns: Json
        }
        distribuir_nomina_a_obras_base: {
          Args: { p_nomina_id: number }
          Returns: Json
        }
        distribuir_nomina_partidas_por_asistencia: {
          Args: { p_nomina_id: number }
          Returns: Json
        }
      formulario_catalogo_vinculado: {
        Args: { p_campo_id: string; p_token: string }
        Returns: Json
      }
      formulario_centros_gestion: { Args: { p_token: string }; Returns: Json }
      ia_finalizar_consumo: {
        Args: {
          p_confianza: number
          p_costo_usd: number
          p_duracion_ms: number
          p_error_detalle: string
          p_estado: string
          p_id: string
          p_metadatos?: Json
          p_tokens_entrada: number
          p_tokens_salida: number
        }
        Returns: undefined
      }
      ia_reservar_consumo: {
        Args: {
          p_auth_user_id: string
          p_empresa: string
          p_funcion: string
          p_modelo: string
          p_obra_nombre: string
          p_reserva_usd?: number
          p_usuario: string
        }
        Returns: string
      }
      importar_presupuesto_excel: {
        Args: {
          p_moneda_base?: string
          p_partidas: Json
          p_presupuesto_id: number
          p_recursos: Json
        }
        Returns: Json
      }
      importar_presupuesto_excel_v2: {
        Args: {
          p_moneda_base?: string
          p_partidas: Json
          p_presupuesto_id: number
          p_recursos: Json
        }
        Returns: Json
      }
      registrar_error_cliente: {
        Args: { p_contexto?: Json; p_mensaje: string; p_stack?: string }
        Returns: number
      }
      revisar_documento_ep_subcontrato: {
        Args: {
          p_documento_id: number
          p_estado: string
          p_observacion?: string
        }
        Returns: string
      }
      validar_cron_mandante: { Args: { p_secret: string }; Returns: boolean }
      verify_internal_cron_secret: {
        Args: { p_secret: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
