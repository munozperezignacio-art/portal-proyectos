import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { AppUpdates } from '@/lib/useAppUpdates';
import type { ThemeColors } from '@/lib/theme';
import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';

export function UpdateRecommendation({updates}:{updates:AppUpdates}) {
  const {colors}=useTheme();const s=useThemedStyles(styles);
  if(!updates.enabled||!updates.release||!updates.available)return null;
  return <View style={s.notice}><Ionicons name="cloud-download-outline" size={23} color={colors.blue}/><View style={s.flex}><Text accessibilityRole="header" style={s.title}>Hay una nueva versión</Text><Text style={s.text}>Obraxis {updates.release.version} está disponible. Te recomendamos actualizar para tener las últimas mejoras.</Text><Pressable accessibilityRole="button" onPress={()=>void updates.download()} style={s.link}><Text style={s.linkText}>Descargar actualización</Text><Ionicons name="arrow-forward" size={16} color={colors.blue}/></Pressable>{!!updates.error&&<Text style={s.error}>{updates.error}</Text>}</View></View>;
}
export function UpdateSettings({updates}:{updates:AppUpdates}) {
  const s=useThemedStyles(styles);
  if(!updates.enabled)return null;
  const available=updates.available;
  return <View style={s.panel}><Text accessibilityRole="header" style={s.title}>Actualizaciones</Text><Text style={s.text}>{updates.known?`Versión instalada: ${updates.version} · build ${updates.build}`:'No se pudo identificar la versión instalada.'}</Text>
    <Text accessibilityLiveRegion="polite" style={s.text}>{updates.status==='checking'?'Buscando actualizaciones…':updates.status==='current'?'Tienes la versión más reciente publicada.':updates.status==='error'?'No se pudo comprobar la última versión.':available?`Nueva versión ${updates.release!.version} disponible.`:'La app busca nuevas versiones automáticamente.'}</Text>
    {available&&<><Text style={s.title}>Novedades</Text>{updates.release!.notes.map((note,i)=><Text key={i} style={s.text}>• {note}</Text>)}<Pressable accessibilityRole="button" style={s.button} onPress={()=>void updates.download()}><Text style={s.buttonText}>Descargar actualización</Text></Pressable><Text style={s.help}>Se abrirá la descarga de la APK. Al terminar, ábrela y confirma la instalación en Android.</Text></>}
    {!!updates.error&&<Text accessibilityRole="alert" style={s.error}>{updates.error}</Text>}
    <Pressable accessibilityRole="button" accessibilityLabel="Buscar actualizaciones" disabled={updates.status==='checking'||!updates.known} onPress={()=>void updates.check()} style={[s.check,updates.status==='checking'&&{opacity:.5}]}><Text style={s.linkText}>{updates.status==='checking'?'Comprobando…':'Buscar actualizaciones'}</Text></Pressable>
    <Text style={s.help}>Chequeo al abrir la app y al volver a ella, como máximo cada 6 horas. Puedes comprobarlo manualmente cuando quieras.</Text>{updates.checkedAt&&<Text style={s.help}>Última comprobación: {new Date(updates.checkedAt).toLocaleString('es-CL')}</Text>}
  </View>;
}
const styles=(c:ThemeColors)=>StyleSheet.create({panel:{gap:10,paddingTop:18,borderTopWidth:1,borderTopColor:c.line},notice:{padding:16,borderRadius:15,backgroundColor:c.blueSoft,flexDirection:'row',gap:12},flex:{flex:1,minWidth:0},title:{fontSize:15,fontWeight:'600',color:c.ink,lineHeight:21},text:{fontSize:12,lineHeight:19,color:c.ink},help:{fontSize:11,lineHeight:17,color:c.muted},error:{fontSize:12,lineHeight:18,color:c.red},link:{minHeight:44,flexDirection:'row',alignItems:'center',gap:8,paddingVertical:8},linkText:{fontSize:13,fontWeight:'600',color:c.blue,flexShrink:1},button:{minHeight:46,borderRadius:12,backgroundColor:c.primary,alignItems:'center',justifyContent:'center',padding:12},buttonText:{fontSize:13,fontWeight:'600',color:c.onPrimary},check:{minHeight:44,alignItems:'center',justifyContent:'center',padding:10,borderRadius:12,borderWidth:1,borderColor:c.line}});
