import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { colors } from '@/lib/theme';

export function BiometricGate({ children }:{children:React.ReactNode}) {
  const { locked, unlock, signOut } = useAuth();
  if (!locked) return children;
  return <View style={s.screen}><View style={s.mark}><Ionicons name="finger-print" size={52} color={colors.orange}/></View><Text style={s.title}>Obraxis está protegido</Text><Text style={s.text}>Confirma tu identidad para continuar con la sesión guardada.</Text><Pressable style={s.button} onPress={unlock}><Ionicons name="finger-print" size={22} color="white"/><Text style={s.buttonText}>Desbloquear</Text></Pressable><Pressable onPress={signOut} style={s.link}><Text style={s.linkText}>Cerrar sesión y usar otra cuenta</Text></Pressable></View>;
}
const s=StyleSheet.create({screen:{flex:1,backgroundColor:colors.navy,alignItems:'center',justifyContent:'center',padding:30},mark:{width:96,height:96,borderRadius:32,backgroundColor:'#202B47',alignItems:'center',justifyContent:'center'},title:{color:'white',fontSize:24,fontWeight:'900',marginTop:24},text:{color:'#BCC6D9',fontSize:13,lineHeight:20,textAlign:'center',maxWidth:330,marginTop:8},button:{marginTop:28,minWidth:230,borderRadius:16,backgroundColor:colors.orange,paddingVertical:15,paddingHorizontal:24,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:10},buttonText:{color:'white',fontSize:14,fontWeight:'900'},link:{marginTop:20,padding:10},linkText:{color:'#D7DEEA',fontSize:12,fontWeight:'800'},});
