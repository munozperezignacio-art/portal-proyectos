import { useTheme } from '@/theme/ThemeProvider';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { can, canUse } from '@/lib/types';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Loading, Screen } from '@/components/ui';

export default function TabsLayout() {
  const {colors}=useTheme();

  const {session,profile,loading}=useAuth();
  const insets=useSafeAreaInsets();
  if(loading)return <Screen><Loading/></Screen>;
  if(!session)return <Redirect href="/login"/>;
  if(!profile)return <Screen><Loading/></Screen>;
  return <Tabs screenOptions={{headerShown:false,tabBarActiveTintColor:colors.blue,tabBarInactiveTintColor:colors.muted,tabBarHideOnKeyboard:true,tabBarStyle:{height:62+insets.bottom,paddingTop:7,paddingBottom:Math.max(insets.bottom,7),paddingHorizontal:8,borderTopColor:colors.line,backgroundColor:colors.surface,elevation:0},tabBarLabelStyle:{fontSize:11,fontWeight:'600',marginTop:0},tabBarIconStyle:{height:28},tabBarActiveBackgroundColor:colors.selected,tabBarItemStyle:{borderRadius:12,marginHorizontal:2}}}>
    <Tabs.Screen name="inicio" options={{title:'Inicio',tabBarIcon:({color,focused})=><Ionicons name={focused?'home':'home-outline'} size={21} color={color}/>}}/>
    <Tabs.Screen name="obras" options={{title:'Obras',href:canUse(profile,'obra')&&can(profile,'obras.ficha.ver')?undefined:null,tabBarIcon:({color,focused})=><Ionicons name={focused?'business':'business-outline'} size={21} color={color}/>}}/>
    <Tabs.Screen name="maquinaria" options={{title:'Equipos',href:canUse(profile,'maquinaria')&&can(profile,'maquinaria.inventario.ver')?undefined:null,tabBarIcon:({color,focused})=><Ionicons name={focused?'construct':'construct-outline'} size={21} color={color}/>}}/>
    <Tabs.Screen name="personal" options={{title:'Personal',href:canUse(profile,'rrhh')&&can(profile,'rrhh.personal.ver')?undefined:null,tabBarIcon:({color,focused})=><Ionicons name={focused?'people':'people-outline'} size={21} color={color}/>}}/>
    <Tabs.Screen name="formularios" options={{title:'Prevención',href:(canUse(profile,'formulario')||canUse(profile,'prevencion'))&&(can(profile,'formularios.formularios.ver')||can(profile,'prevencion.registros.ver'))?undefined:null,tabBarIcon:({color,focused})=><Ionicons name={focused?'shield-checkmark':'shield-checkmark-outline'} size={21} color={color}/>}}/>
  </Tabs>;
}
