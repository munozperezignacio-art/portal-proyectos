/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth } from "@/auth/AuthProvider";
import {
  Badge,
  Card,
  Empty,
  ErrorBox,
  Header,
  Loading,
  Screen,
  Segments,
} from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { colors } from "@/lib/theme";
type Row = Record<string, any>;

export default function SubcontractDetail() {
  const { id, obra, nombre } = useLocalSearchParams<{
    id: string;
    obra: string;
    nombre: string;
  }>();
  const { profile } = useAuth();
  const [tab, setTab] = useState("avances");
  const [data, setData] = useState<Row>({
    advances: [],
    attendance: [],
    payments: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = async () => {
    setLoading(true);
    const [a, s, p] = await Promise.all([
      supabase
        .from("subcontrato_avances")
        .select("*")
        .eq("empresa", profile!.empresa)
        .eq("obra_nombre", obra)
        .eq("subcontrato_id", Number(id))
        .order("fecha", { ascending: false }),
      supabase
        .from("subcontrato_asistencia")
        .select("*")
        .eq("empresa", profile!.empresa)
        .eq("obra_nombre", obra)
        .eq("subcontrato_id", Number(id))
        .order("fecha", { ascending: false }),
      supabase
        .from("subcontrato_estados_pago")
        .select("*")
        .eq("empresa", profile!.empresa)
        .eq("obra_nombre", obra)
        .eq("subcontrato_id", Number(id))
        .order("numero", { ascending: false }),
    ]);
    const failure = [a, s, p].find((item) => item.error);
    if (failure?.error) setError(failure.error.message);
    else
      setData({
        advances: a.data || [],
        attendance: s.data || [],
        payments: p.data || [],
      });
    setLoading(false);
  };
  useEffect(() => {
    void load();
  }, [id, obra, profile]);
  return (
    <Screen refreshing={loading} onRefresh={load}>
      <Pressable onPress={() => router.back()} style={s.back}>
        <Ionicons name="arrow-back" size={20} />
        <Text style={s.backText}>Volver a la obra</Text>
      </Pressable>
      <Header
        title={nombre || "Subcontrato"}
        subtitle={obra}
        icon="people-circle-outline"
      />
      <Segments
        value={tab}
        options={[
          { key: "avances", label: "Avances" },
          { key: "asistencia", label: "Asistencia" },
          { key: "pagos", label: "Estados de pago" },
        ]}
        onChange={setTab}
      />
      <ErrorBox text={error} />
      {loading ? (
        <Loading />
      ) : tab === "avances" ? (
        data.advances.length ? (
          data.advances.map((item: Row) => (
            <Card key={item.id}>
              <View style={s.top}>
                <Badge>{item.estado || "Reportado"}</Badge>
                <Text style={s.date}>{item.fecha}</Text>
              </View>
              <Text style={s.name}>{item.partida_nombre}</Text>
              <Text style={s.meta}>
                {Number(item.cantidad || 0).toLocaleString("es-CL")}{" "}
                {item.unidad || ""}
              </Text>
              <Text style={s.meta}>{item.comentario || "Sin comentario"}</Text>
            </Card>
          ))
        ) : (
          <Empty text="No hay avances enviados." />
        )
      ) : tab === "asistencia" ? (
        data.attendance.length ? (
          data.attendance.map((item: Row) => (
            <Card key={item.id}>
              <View style={s.top}>
                <Text style={s.name}>{item.fecha}</Text>
                <Badge>{item.estado || "Reportado"}</Badge>
              </View>
              <Text style={s.metric}>{item.presentes} presentes</Text>
              <Text style={s.meta}>
                {item.ausentes || 0} ausentes ·{" "}
                {Number(item.horas_hombre || 0).toLocaleString("es-CL")} HH
              </Text>
            </Card>
          ))
        ) : (
          <Empty text="No hay asistencias enviadas." />
        )
      ) : data.payments.length ? (
        data.payments.map((item: Row) => (
          <Card key={item.id}>
            <View style={s.top}>
              <Text style={s.name}>Estado de pago N° {item.numero}</Text>
              <Badge
                tone={
                  item.estado === "Aprobado"
                    ? "green"
                    : item.estado?.includes("Observ")
                      ? "amber"
                      : "blue"
                }
              >
                {item.estado}
              </Badge>
            </View>
            <Text style={s.metric}>
              $
              {Number(
                (item.monto_aprobado ?? item.monto_presentado) || 0,
              ).toLocaleString("es-CL")}
            </Text>
            <Text style={s.meta}>
              {item.periodo_desde} → {item.periodo_hasta}
            </Text>
            <Text style={s.meta}>
              Factura: {item.factura_folio || "Pendiente"}
            </Text>
          </Card>
        ))
      ) : (
        <Empty text="No hay estados de pago presentados." />
      )}
    </Screen>
  );
}
const s = StyleSheet.create({
  back: { flexDirection: "row", alignItems: "center", gap: 7 },
  backText: { fontSize: 12, fontWeight: "800", color: colors.ink },
  top: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  name: { fontSize: 14, fontWeight: "900", color: colors.ink },
  meta: { fontSize: 11, color: colors.muted, lineHeight: 16 },
  date: { fontSize: 11, fontWeight: "800", color: colors.muted },
  metric: { fontSize: 23, fontWeight: "900", color: colors.green },
});
