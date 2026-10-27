import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card, Badge } from './ui';
import { useThemedStyles } from '@/theme/ThemeProvider';
import type { ThemeColors } from '@/lib/theme';
type Row=Record<string,any>;
const show=(value:any,unit='')=>value===null||value===undefined||value===''?'No informado':`${typeof value==='number'?value.toLocaleString('es-CL'):value}${unit?' '+unit:''}`;
export function MachineryReportCard({report}:{report:Row}) {
 const s=useThemedStyles(styles),[expanded,setExpanded]=useState(false);const data=report.reporte_datos||{},unit=data.unidad||'h';
 const field=(label:string,value:any)=><View style={s.field}><Text style={s.label}>{label}</Text><Text style={s.value}>{show(value)}</Text></View>;
 return <Card><Badge tone="green">Reporte #{report.id}</Badge><Text style={s.title}>{report.equipo_patente} · {report.equipo_tipo}</Text><Text style={s.value}>{report.fecha} · {report.obra_nombre||'Sin obra informada'}</Text><Text style={s.value}>Operador: {report.operador||'No informado'}</Text><View style={s.row}>{field('Trabajo',show(report.horas_trabajadas,'h'))}{field('Combustible',show(report.combustible_cargado,'L'))}</View><Pressable accessibilityRole="button" accessibilityState={{expanded}} onPress={()=>setExpanded(!expanded)} style={s.button}><Text style={s.link}>{expanded?'Ocultar detalle':'Ver datos del reporte'}</Text></Pressable>{expanded&&<View style={s.details}>
 <Text style={s.title}>Lecturas</Text><View style={s.row}>{field('Inicial',show(report.horometro_inicial,unit))}{field('Final',show(report.horometro_final,unit))}</View>
 <Text style={s.title}>Fallas y paralización</Text>{field('Falla',data.hubo_falla===true?'Sí':data.hubo_falla===false?'No, según el reporte':'No informado en este reporte')}{data.hubo_falla&&<>{field('Descripción',data.descripcion)}{field('Severidad',data.severidad)}{field('Paralización',data.detuvo_equipo?show(data.horas_fuera_servicio,'h'):'No, según el reporte')}</>}
 <Text style={s.title}>Observaciones</Text><Text style={s.value}>{report.observaciones||'Sin observaciones'}</Text><Text style={s.title}>Trazabilidad</Text>{field('Registrado por',report.registrado_por)}{field('Documento',data.codigo?`${data.codigo} · Rev. ${data.revision}`:'Formato anterior')}{field('Responsable de maquinaria',data.responsable)}<Text style={s.help}>El PDF y el historial Excel se descargan desde el portal web.</Text>
 </View>}</Card>;
}
const styles=(c:ThemeColors)=>StyleSheet.create({title:{fontSize:14,fontWeight:'700',color:c.ink},value:{fontSize:13,color:c.ink,lineHeight:20},label:{fontSize:11,color:c.muted},field:{flex:1,minWidth:110,gap:3},row:{flexDirection:'row',gap:12,flexWrap:'wrap'},details:{gap:14,borderTopWidth:1,borderColor:c.line,paddingTop:14},button:{paddingVertical:10,minHeight:44},link:{color:c.blue,fontWeight:'600'},help:{color:c.muted,fontSize:12,lineHeight:18}});
