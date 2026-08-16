import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/auth/AuthProvider';
import { Card, Header, Screen } from '@/components/ui';
import { colors } from '@/lib/theme';
import { can, canUse } from '@/lib/types';
import { fetchNotificationInbox } from '@/lib/notifications';

const modules = [
  ['Obras', 'Avances, asistencia y gestión de terreno.', 'business', '/obras', 'obra'],
  ['Maquinaria', 'Equipos, registros, reservas y desempeño.', 'construct', '/maquinaria', 'maquinaria'],
  ['Recursos Humanos', 'Personal y asignaciones vigentes.', 'people', '/personal', 'rrhh'],
  ['Formularios', 'Biblioteca y registros operacionales.', 'clipboard', '/formularios', 'formulario'],
] as const;

export default function Home() {
  const { profile, signOut, biometricAvailable, biometricEnabled, biometricOfferPending, setBiometricEnabled, dismissBiometricOffer } = useAuth();
  const insets = useSafeAreaInsets(); const [menu, setMenu] = useState(false); const prompted = useRef(false);
  const [unread, setUnread] = useState(0);
  const visible = (module:string) => module === 'obra' ? canUse(profile, 'obra') && can(profile, 'obras.ficha.ver') : module === 'maquinaria' ? canUse(profile, module) && can(profile, 'maquinaria.inventario.ver') : module === 'rrhh' ? canUse(profile, module) && can(profile, 'rrhh.personal.ver') : (canUse(profile, 'formulario') || canUse(profile, 'prevencion')) && can(profile, 'formularios.formularios.ver');
  const toggle = async (value:boolean) => {
    const ok = await setBiometricEnabled(value);
    if (!ok) Alert.alert('Biometría no disponible', 'Configura huella, rostro o un bloqueo seguro en tu teléfono e intenta nuevamente.');
  };
  useEffect(() => {
    if (!biometricOfferPending || prompted.current) return;
    prompted.current = true;
    Alert.alert('¿Activar acceso biométrico?', 'Podrás abrir tu sesión guardada con la huella o seguridad configurada en este teléfono.', [
      { text: 'Ahora no', style: 'cancel', onPress: () => void dismissBiometricOffer() },
      { text: 'Activar', onPress: () => void setBiometricEnabled(true) },
    ]);
  }, [biometricOfferPending, dismissBiometricOffer, setBiometricEnabled]);
  useEffect(() => { if (profile) void fetchNotificationInbox(profile.id).then(rows => setUnread(rows.filter(row => !row.leida_at).length)).catch(() => undefined); }, [profile]);
  return <Screen>
    <Header title={`Hola, ${profile?.nombre || profile?.usuario}`} subtitle={`${profile?.empresa} · ${profile?.cargo || profile?.rol || 'Usuario'}`} icon="grid-outline" action={<View style={s.headerActions}><Pressable onPress={() => router.push('/notificaciones')} style={s.menuButton}><Ionicons name="notifications-outline" size={22} color={colors.ink}/>{unread>0&&<View style={s.badge}><Text style={s.badgeText}>{unread>9?'9+':unread}</Text></View>}</Pressable><Pressable onPress={() => setMenu(true)} style={s.menuButton}><Ionicons name="menu" size={23} color={colors.ink}/></Pressable></View>}/>
    <View style={s.hero}><Text style={s.kicker}>OPERACIÓN EN TERRENO</Text><Text style={s.heroTitle}>Todo lo esencial de la obra, en tu bolsillo.</Text><Text style={s.heroText}>Consulta datos reales y registra información con trazabilidad Obraxis.</Text></View>
    {modules.filter(item => visible(item[4])).map(item => <Card key={item[0]} onPress={() => router.push(item[3] as never)}><View style={s.row}><View style={s.moduleIcon}><Ionicons name={item[2]} size={23} color={colors.orange}/></View><View style={s.flex}><Text style={s.moduleTitle}>{item[0]}</Text><Text style={s.moduleText}>{item[1]}</Text></View><Ionicons name="chevron-forward" size={20} color={colors.muted}/></View></Card>)}
    <Modal visible={menu} transparent animationType="fade" onRequestClose={() => setMenu(false)}><Pressable style={s.overlay} onPress={() => setMenu(false)}><Pressable style={[s.drawer, { paddingTop: Math.max(28, insets.top + 12) }]} onPress={event => event.stopPropagation()}><View style={s.drawerTop}><View><Text style={s.drawerTitle}>Mi cuenta</Text><Text style={s.drawerMeta}>{profile?.usuario} · {profile?.empresa}</Text></View><Pressable onPress={() => setMenu(false)} style={s.close}><Ionicons name="close" size={23} color={colors.ink}/></Pressable></View><Pressable style={s.setting} onPress={()=>{setMenu(false);router.push('/notificaciones')}}><View style={s.securityIcon}><Ionicons name="notifications-outline" size={22} color={colors.blue}/></View><View style={s.flex}><Text style={s.moduleTitle}>Centro de notificaciones</Text><Text style={s.moduleText}>{unread?`${unread} notificación${unread===1?'':'es'} sin leer.`:'No tienes avisos pendientes.'}</Text></View><Ionicons name="chevron-forward" size={19} color={colors.muted}/></Pressable><View style={s.setting}><View style={s.securityIcon}><Ionicons name="finger-print" size={23} color={colors.blue}/></View><View style={s.flex}><Text style={s.moduleTitle}>Acceso biométrico</Text><Text style={s.moduleText}>{biometricAvailable ? 'Protege el inicio de la sesión guardada.' : 'No disponible en este teléfono.'}</Text></View><Switch disabled={!biometricAvailable} value={biometricEnabled} onValueChange={toggle}/></View><Pressable onPress={signOut} style={s.logout}><Ionicons name="log-out-outline" size={20} color={colors.red}/><Text style={s.logoutText}>Cerrar sesión</Text></Pressable></Pressable></Pressable></Modal>
  </Screen>;
}

const s = StyleSheet.create({ headerActions:{flexDirection:'row',gap:7},menuButton:{width:42,height:42,borderRadius:13,backgroundColor:'#F1F4F8',alignItems:'center',justifyContent:'center'},badge:{position:'absolute',right:-3,top:-4,minWidth:18,height:18,borderRadius:9,backgroundColor:colors.red,alignItems:'center',justifyContent:'center',paddingHorizontal:3},badgeText:{fontSize:9,fontWeight:'900',color:'white'},hero:{backgroundColor:colors.navy,borderRadius:22,padding:22,marginVertical:5},kicker:{fontSize:10,color:'#FFB368',letterSpacing:2,fontWeight:'900'},heroTitle:{fontSize:24,lineHeight:30,fontWeight:'900',color:'white',marginTop:8},heroText:{fontSize:13,lineHeight:19,color:'#BCC6D9',marginTop:8},row:{flexDirection:'row',alignItems:'center',gap:13},flex:{flex:1},moduleIcon:{width:46,height:46,borderRadius:14,backgroundColor:'#FFF4E8',alignItems:'center',justifyContent:'center'},securityIcon:{width:44,height:44,borderRadius:14,backgroundColor:'#EEF4FF',alignItems:'center',justifyContent:'center'},moduleTitle:{fontSize:15,fontWeight:'900',color:colors.ink},moduleText:{fontSize:11,color:colors.muted,marginTop:3,lineHeight:16},overlay:{flex:1,backgroundColor:'rgba(9,17,34,.45)',alignItems:'flex-end'},drawer:{height:'100%',width:'84%',maxWidth:360,backgroundColor:'white',padding:20,gap:20},drawerTop:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingBottom:18,borderBottomWidth:1,borderBottomColor:colors.line},drawerTitle:{fontSize:24,fontWeight:'900',color:colors.ink},drawerMeta:{fontSize:12,color:colors.muted,marginTop:4},close:{width:40,height:40,borderRadius:12,backgroundColor:colors.soft,alignItems:'center',justifyContent:'center'},setting:{padding:14,borderWidth:1,borderColor:colors.line,borderRadius:16,flexDirection:'row',alignItems:'center',gap:11},logout:{marginTop:'auto',marginBottom:16,height:52,borderRadius:14,backgroundColor:'#FFF1F2',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},logoutText:{fontSize:13,fontWeight:'900',color:colors.red} });
