import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import type { ThemeColors } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';


export function BiometricGate({ children }:{children:React.ReactNode}) {
  const {colors}=useTheme();
  const s=useThemedStyles(createStyles);

  const { locked, unlock, signOut } = useAuth();
  if (!locked) return children;
  return <View style={s.screen}><View style={s.mark}><Ionicons name="finger-print" size={52} color={colors.orange}/></View><Text style={s.title}>Obraxis está protegido</Text><Text style={s.text}>Confirma tu identidad para continuar con la sesión guardada.</Text><Pressable style={s.button} onPress={unlock}><Ionicons name="finger-print" size={22} color={colors.onPrimary}/><Text style={s.buttonText}>Desbloquear</Text></Pressable><Pressable onPress={signOut} style={s.link}><Text style={s.linkText}>Cerrar sesión y usar otra cuenta</Text></Pressable></View>;
}
const createStyles = (colors: ThemeColors) => StyleSheet.create({screen:{flex:1,backgroundColor:colors.soft,alignItems:'center',justifyContent:'center',padding:30},mark:{width:96,height:96,borderRadius:32,backgroundColor:colors.blueSoft,alignItems:'center',justifyContent:'center'},title:{color:colors.ink,fontSize:24,fontWeight:'700',marginTop:24},text:{color:colors.muted,fontSize:13,lineHeight:20,textAlign:'center',maxWidth:330,marginTop:8},button:{marginTop:28,minWidth:230,borderRadius:16,backgroundColor:colors.primary,paddingVertical:15,paddingHorizontal:24,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:10},buttonText:{color:colors.onPrimary,fontSize:14,fontWeight:'700'},link:{marginTop:20,padding:10},linkText:{color:colors.muted,fontSize:12,fontWeight:'600'},});
