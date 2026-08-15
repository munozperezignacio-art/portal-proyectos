import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { flushPendingWrites, pendingWriteCount } from '@/lib/offlineQueue';
import { colors } from '@/lib/theme';
export function OfflineSync(){const insets=useSafeAreaInsets();const[online,setOnline]=useState(true);const[pending,setPending]=useState(0);useEffect(()=>NetInfo.addEventListener(state=>{const connected=Boolean(state.isConnected);setOnline(connected);void pendingWriteCount().then(setPending);if(connected)void flushPendingWrites().then(()=>pendingWriteCount().then(setPending))}),[]);if(online&&!pending)return null;return <View pointerEvents="none" style={[s.banner,{top:insets.top+6}]}><Text style={s.text}>{online?'Sincronizando registros pendientes…':`Sin conexión · ${pending} pendiente${pending===1?'':'s'}`}</Text></View>}
const s=StyleSheet.create({banner:{position:'absolute',right:12,zIndex:9999,backgroundColor:colors.navy,borderRadius:99,paddingHorizontal:13,paddingVertical:8,shadowColor:'#000',shadowOpacity:.18,shadowRadius:8,elevation:8},text:{fontSize:11,fontWeight:'900',color:'white'}});
