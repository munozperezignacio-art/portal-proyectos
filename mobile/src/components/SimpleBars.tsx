import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import type { ThemeColors } from '@/lib/theme';
import { StyleSheet, Text, View } from 'react-native';


export type BarDatum={label:string;value:number;display?:string;color?:string};
export function SimpleBars({data,max}: {data:BarDatum[];max?:number}){
  const {colors}=useTheme();
  const s=useThemedStyles(createStyles);

  const ceiling=max||Math.max(1,...data.map(item=>item.value));
  return <View style={s.list}>{data.map((item,index)=><View key={`${item.label}-${index}`} style={s.item}><View style={s.head}><Text numberOfLines={1} style={s.label}>{item.label}</Text><Text style={s.value}>{item.display||item.value.toLocaleString('es-CL')}</Text></View><View style={s.track}><View style={[s.fill,{width:`${Math.max(2,Math.min(100,item.value/ceiling*100))}%`,backgroundColor:item.color||colors.blue}]}/></View></View>)}</View>;
}
const createStyles = (colors: ThemeColors) => StyleSheet.create({list:{gap:13},item:{gap:6},head:{flexDirection:'row',gap:10,alignItems:'center'},label:{flex:1,fontSize:12,fontWeight:'600',color:colors.ink},value:{fontSize:12,fontWeight:'700',color:colors.ink},track:{height:10,borderRadius:99,backgroundColor:colors.track,overflow:'hidden'},fill:{height:'100%',borderRadius:99}});
