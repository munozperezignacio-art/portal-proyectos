import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import type { ThemeColors } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/auth/AuthProvider';
import { Card, Screen } from '@/components/ui';
import { AppearanceSettings } from '@/components/AppearanceSettings';
import { UpdateRecommendation, UpdateSettings } from '@/components/AppUpdates';
import { useAppUpdates } from '@/lib/useAppUpdates';
import { BuildVersion } from '@/components/BuildVersion';

import { can, canUse } from '@/lib/types';
import { fetchNotificationInbox } from '@/lib/notifications';

const modules = [
  ['Obras', 'Avances y asistencia', 'business-outline', '/obras', 'obra'],
  ['Equipos', 'Flota y mantenciones', 'construct-outline', '/maquinaria', 'maquinaria'],
  ['Personal', 'Personas y asignaciones', 'people-outline', '/personal', 'rrhh'],
  ['Prevención', 'Formularios y manuales', 'shield-checkmark-outline', '/formularios', 'formulario'],
] as const;

export default function Home() {
  const updates=useAppUpdates();
  const {colors}=useTheme();
  const s=useThemedStyles(createStyles);

  const { profile, signOut, biometricAvailable, biometricEnabled, biometricOfferPending, setBiometricEnabled, dismissBiometricOffer } = useAuth();
  const insets = useSafeAreaInsets(); const [menu, setMenu] = useState(false); const prompted = useRef(false);
  const [unread, setUnread] = useState(0);
  const visible = (module:string) => module === 'obra' ? canUse(profile, 'obra') && can(profile, 'obras.ficha.ver') : module === 'maquinaria' ? canUse(profile, module) && can(profile, 'maquinaria.inventario.ver') : module === 'rrhh' ? canUse(profile, module) && can(profile, 'rrhh.personal.ver') : (canUse(profile, 'formulario') || canUse(profile, 'prevencion')) && (can(profile, 'formularios.formularios.ver') || can(profile, 'prevencion.registros.ver'));
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
    <View style={s.brandRow}>
      <Text style={s.brand} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>OBRAXIS</Text>
      <View style={s.headerActions}>
        <Pressable accessibilityRole="button" accessibilityLabel="Mis solicitudes" onPress={() => router.push('/solicitudes' as never)} style={({pressed})=>[s.requestsButton,pressed&&{backgroundColor:colors.selected}]}>
          <Text style={s.requestsLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>Mis solicitudes</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Abrir notificaciones" onPress={() => router.push('/notificaciones')} style={s.menuButton}><Ionicons name="notifications-outline" size={21} color={colors.ink}/>{unread>0&&<View style={s.badge}><Text style={s.badgeText}>{unread>9?'9+':unread}</Text></View>}</Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Abrir mi cuenta" onPress={() => setMenu(true)} style={s.menuButton}><Ionicons name="menu-outline" size={22} color={colors.ink}/></Pressable>
      </View>
    </View>
    <View><Text style={s.greeting}>Hola, {profile?.nombre || profile?.usuario}</Text><Text style={s.greetingText}>Tu espacio de trabajo en terreno.</Text></View>
    <View style={s.company}><View style={s.companyIcon}><Ionicons name="business-outline" size={21} color={colors.blue}/></View><View style={s.flex}><Text style={s.companyName}>{profile?.empresa}</Text><Text style={s.companyRole}>{profile?.cargo || profile?.rol || 'Usuario'}</Text></View></View>
    <UpdateRecommendation updates={updates}/>
    <Text accessibilityRole="header" style={s.sectionTitle}>Accesos de trabajo</Text>
    <View style={s.moduleGrid}>{modules.filter(item => visible(item[4])).map(item => <View style={s.gridItem} key={item[0]}><Card onPress={() => router.push(item[3] as never)}><View style={s.moduleTop}><View style={s.moduleIcon}><Ionicons name={item[2]} size={22} color={colors.blue}/></View><Ionicons name="arrow-forward-outline" size={17} color={colors.muted}/></View><Text style={s.moduleTitle}>{item[0]}</Text><Text style={s.moduleText}>{item[1]}</Text></Card></View>)}</View>
    <Modal visible={menu} transparent animationType="fade" onRequestClose={() => setMenu(false)}><Pressable style={s.overlay} onPress={() => setMenu(false)}><Pressable style={[s.drawer, { paddingTop: Math.max(28, insets.top + 12) }]} onPress={event => event.stopPropagation()}><View style={s.drawerTop}><View><Text style={s.drawerTitle}>Mi cuenta</Text><Text style={s.drawerMeta}>{profile?.usuario} · {profile?.empresa}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Cerrar mi cuenta" onPress={() => setMenu(false)} style={s.close}><Ionicons name="close" size={23} color={colors.ink}/></Pressable></View><ScrollView style={{flex:1}} contentContainerStyle={{gap:20}}><AppearanceSettings/><Pressable style={s.setting} onPress={()=>{setMenu(false);router.push('/notificaciones')}}><View style={s.securityIcon}><Ionicons name="notifications-outline" size={22} color={colors.blue}/></View><View style={s.flex}><Text style={s.moduleTitle}>Centro de notificaciones</Text><Text style={s.moduleText}>{unread?`${unread} notificación${unread===1?'':'es'} sin leer.`:'No tienes avisos pendientes.'}</Text></View><Ionicons name="chevron-forward" size={19} color={colors.muted}/></Pressable><View style={s.setting}><View style={s.securityIcon}><Ionicons name="finger-print" size={23} color={colors.blue}/></View><View style={s.flex}><Text style={s.moduleTitle}>Acceso biométrico</Text><Text style={s.moduleText}>{biometricAvailable ? 'Protege el inicio de la sesión guardada.' : 'No disponible en este teléfono.'}</Text></View><Switch disabled={!biometricAvailable} value={biometricEnabled} onValueChange={toggle}/></View><UpdateSettings updates={updates}/></ScrollView><Pressable onPress={signOut} style={s.logout}><Ionicons name="log-out-outline" size={20} color={colors.red}/><Text style={s.logoutText}>Cerrar sesión</Text></Pressable></Pressable></Pressable></Modal>
    <BuildVersion />
  </Screen>;
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  brandRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},brand:{fontSize:13,fontWeight:'700',letterSpacing:2,color:colors.blue,flexShrink:1,minWidth:0},headerActions:{flexDirection:'row',gap:6,alignItems:'center',flexShrink:0},requestsButton:{height:44,width:112,paddingHorizontal:8,borderRadius:12,borderWidth:1,borderColor:colors.line,backgroundColor:colors.surface,alignItems:'center',justifyContent:'center'},requestsLabel:{fontSize:12,fontWeight:'600',color:colors.blue},menuButton:{width:44,height:44,borderRadius:12,borderWidth:1,borderColor:colors.line,backgroundColor:colors.surface,alignItems:'center',justifyContent:'center'},badge:{position:'absolute',right:-2,top:-3,minWidth:17,height:17,borderRadius:9,backgroundColor:colors.danger,alignItems:'center',justifyContent:'center',paddingHorizontal:3},badgeText:{fontSize:10,fontWeight:'600',color:colors.onPrimary},
  greeting:{fontSize:28,fontWeight:'700',letterSpacing:-0.8,color:colors.ink},greetingText:{fontSize:14,lineHeight:21,color:colors.muted,marginTop:5},company:{flexDirection:'row',alignItems:'center',gap:12,padding:16,backgroundColor:colors.blueSoft,borderRadius:14,marginTop:4},companyIcon:{width:40,height:40,alignItems:'center',justifyContent:'center',backgroundColor:colors.surface,borderRadius:11},companyName:{fontSize:14,fontWeight:'600',color:colors.blue},companyRole:{fontSize:12,lineHeight:18,color:colors.muted,marginTop:2},sectionTitle:{fontSize:15,fontWeight:'600',color:colors.ink,marginTop:10},moduleGrid:{flexDirection:'row',flexWrap:'wrap',gap:12},gridItem:{width:'47%',flexGrow:1},moduleTop:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:8},
  row:{flexDirection:'row',alignItems:'center',gap:13},flex:{flex:1,minWidth:0},moduleIcon:{width:40,height:40,borderRadius:11,backgroundColor:colors.blueSoft,alignItems:'center',justifyContent:'center'},securityIcon:{width:40,height:40,borderRadius:11,backgroundColor:colors.blueSoft,alignItems:'center',justifyContent:'center'},moduleTitle:{fontSize:15,fontWeight:'600',color:colors.ink},moduleText:{fontSize:12,color:colors.muted,lineHeight:18},overlay:{flex:1,backgroundColor:colors.overlay,alignItems:'flex-end'},drawer:{height:'100%',width:'88%',maxWidth:380,backgroundColor:colors.surface,padding:22,gap:20},drawerTop:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingBottom:18,borderBottomWidth:1,borderBottomColor:colors.line},drawerTitle:{fontSize:23,fontWeight:'600',color:colors.ink},drawerMeta:{fontSize:12,color:colors.muted,marginTop:4},close:{width:44,height:44,borderRadius:12,backgroundColor:colors.soft,alignItems:'center',justifyContent:'center'},setting:{padding:14,borderWidth:1,borderColor:colors.line,borderRadius:14,flexDirection:'row',alignItems:'center',gap:11},logout:{marginBottom:16,height:48,borderRadius:12,backgroundColor:colors.redSoft,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},logoutText:{fontSize:13,fontWeight:'600',color:colors.red}
});
