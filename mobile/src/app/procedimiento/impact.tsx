import { useRef, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { Badge, Card, Empty, Header, Screen } from '@/components/ui';
import { can } from '@/lib/types';
import { colors } from '@/lib/theme';
import manual from '@/data/impactManual.json';
import { impactImages } from '@/data/impactImages';

export default function ImpactProcedure() {
  const { profile } = useAuth();
  const viewport = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const [details, setDetails] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [zoom, setZoom] = useState(false);
  const [chooser, setChooser] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const step = manual.pasos[index];
  const photo = impactImages[step.paso];
  const canView = can(profile, 'formularios.formularios.ver') || can(profile, 'prevencion.registros.ver');
  const navigate = (next: number) => {
    setIndex(Math.max(0, Math.min(manual.pasos.length - 1, next)));
    setDetails(false); setChooser(false); setPhotoOpen(false); setZoom(false);
    scroll.current?.scrollTo({ y: 0, animated: false });
  };
  const back = () => router.canGoBack() ? router.back() : router.replace('/formularios');
  if (!canView) return <Screen><Header title="Manual Impact" icon="book-outline"/><Empty text="Tu rol no tiene permiso para consultar procedimientos."/></Screen>;

  return <SafeAreaView style={s.page}>
    <View style={s.bar}><Pressable accessibilityRole="button" onPress={back} style={s.button}><Text style={s.link}>Volver</Text></Pressable><Text style={s.barTitle}>Armado Impact</Text><Pressable accessibilityRole="button" accessibilityLabel="Elegir paso del manual" onPress={() => setChooser(true)} style={s.button}><Text style={s.link}>Ir al paso</Text></Pressable></View>
    <ScrollView ref={scroll} contentContainerStyle={s.content}>
      <Badge tone="amber">Borrador para revisión técnica</Badge>
      <Text style={s.notice}>Guía de apoyo para personal capacitado, con procedimiento aprobado y supervisión. Portada Rev. 01 e interiores Rev. 00: pendiente de validación técnica.</Text>
      <Text style={s.position} accessibilityLiveRegion="polite">Paso {step.paso} de {manual.pasos.length}</Text>
      <Text accessibilityRole="header" style={s.title}>{step.titulo}</Text>
      {photo ? <Card><Pressable accessibilityRole="button" accessibilityLabel={`Ampliar fotografía: ${step.imagen_descripcion}`} onPress={() => { setZoom(false); setPhotoOpen(true); }}><Image source={photo} resizeMode="contain" style={s.photo} accessibilityLabel={step.imagen_descripcion}/></Pressable><Text style={s.caption}>{step.imagen_descripcion}</Text><Text style={s.hint}>Fotografía del procedimiento · Toca para ampliar</Text></Card> : <Card>{step.elementos_visuales?.map(text => <Text key={text} style={s.control}>• {text}</Text>)}<Text style={s.hint}>El documento no incluye una fotografía específica de esta acción.</Text></Card>}
      <Text style={s.action}>{step.texto}</Text>
      <Card><Pressable accessibilityRole="button" accessibilityState={{ expanded: details }} onPress={() => setDetails(!details)} style={s.button}><Text style={s.link}>{details ? 'Ocultar' : 'Ver'} detalle técnico y controles</Text></Pressable>{details && <><Text style={s.detail}>{step.detalle}</Text><Text style={s.hint}>Fuente: PC-MN-06 · páginas {step.paginas_fuente}</Text></>}</Card>
      {index === manual.pasos.length - 1 && <Text style={s.notice}>Fin de la guía. La lectura no reemplaza la revisión ni la aprobación del armado.</Text>}
    </ScrollView>
    <View style={s.footer}><Pressable accessibilityRole="button" accessibilityState={{ disabled: index === 0 }} disabled={index === 0} onPress={() => navigate(index - 1)} style={[s.nav,index === 0 && s.disabled]}><Text style={s.link}>Anterior</Text></Pressable><Text style={s.hint}>{index + 1} / {manual.pasos.length}</Text><Pressable accessibilityRole="button" accessibilityState={{ disabled: index === manual.pasos.length - 1 }} disabled={index === manual.pasos.length - 1} onPress={() => navigate(index + 1)} style={[s.nav,s.primary,index === manual.pasos.length - 1 && s.disabled]}><Text style={s.white}>Siguiente</Text></Pressable></View>
    <Modal visible={chooser} animationType="slide" onRequestClose={() => setChooser(false)}><SafeAreaView style={s.page}><View style={s.bar}><Text style={s.barTitle}>Elegir paso</Text><Pressable accessibilityRole="button" onPress={() => setChooser(false)} style={s.button}><Text style={s.link}>Cerrar</Text></Pressable></View><ScrollView contentContainerStyle={s.content}>{manual.pasos.map((item, position) => <Pressable key={item.paso} accessibilityRole="button" accessibilityState={{ selected: index === position }} onPress={() => navigate(position)} style={[s.choice,index === position && s.selected]}><Text style={s.caption}>{item.paso}. {item.titulo}</Text></Pressable>)}</ScrollView></SafeAreaView></Modal>
    <Modal visible={photoOpen} animationType="fade" onRequestClose={() => setPhotoOpen(false)}><SafeAreaView style={s.page}><View style={s.bar}><Pressable accessibilityRole="button" onPress={() => setZoom(!zoom)} style={s.button}><Text style={s.link}>{zoom ? 'Ajustar' : 'Ampliar ×2'}</Text></Pressable><Pressable accessibilityRole="button" onPress={() => setPhotoOpen(false)} style={s.button}><Text style={s.link}>Cerrar fotografía</Text></Pressable></View><ScrollView contentContainerStyle={s.zoomContent}><ScrollView horizontal contentContainerStyle={s.zoomContent}><Image source={photo} resizeMode="contain" style={zoom ? {width:viewport.width * 2,height:viewport.height * 1.5} : {width:viewport.width,height:viewport.height * 0.65}} accessibilityLabel={step.imagen_descripcion}/></ScrollView></ScrollView><Text style={[s.caption,{padding:16}]}>{step.imagen_descripcion}</Text><Text style={[s.hint,{padding:16}]}>Usa Ampliar ×2 y desliza para recorrer la fotografía.</Text></SafeAreaView></Modal>
  </SafeAreaView>;
}

const s = StyleSheet.create({page:{flex:1,backgroundColor:colors.soft},bar:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingHorizontal:12,backgroundColor:'white',gap:8},barTitle:{fontSize:17,fontWeight:'800',color:colors.ink},button:{minHeight:48,justifyContent:'center',padding:8},link:{fontSize:14,fontWeight:'800',color:colors.blue},content:{padding:16,gap:16,paddingBottom:30},notice:{fontSize:12,lineHeight:18,color:'#78551A',backgroundColor:'#FFF4DB',padding:12,borderRadius:12},position:{fontSize:14,fontWeight:'800',color:colors.blue},title:{fontSize:27,lineHeight:33,fontWeight:'900',color:colors.ink},photo:{width:'100%',height:280},caption:{fontSize:14,fontWeight:'700',color:colors.ink,lineHeight:20},hint:{fontSize:12,color:colors.muted,lineHeight:18},control:{fontSize:18,lineHeight:26,fontWeight:'700',color:colors.ink},action:{fontSize:21,lineHeight:31,color:colors.ink},detail:{fontSize:15,lineHeight:24,color:colors.ink},footer:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',padding:12,gap:8,backgroundColor:'white'},nav:{padding:14,borderRadius:12,borderWidth:1,borderColor:colors.line,minHeight:48},primary:{backgroundColor:colors.navy},white:{color:'white',fontWeight:'800',fontSize:14},disabled:{opacity:0.35},choice:{padding:16,borderWidth:1,borderColor:colors.line,borderRadius:12,backgroundColor:'white'},selected:{borderColor:colors.blue,backgroundColor:'#EEF4FF'},zoomContent:{flexGrow:1,alignItems:'center',justifyContent:'center'}});
