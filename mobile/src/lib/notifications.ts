import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const MAINTENANCE_KEY='obraxis:notification:maintenance';
Notifications.setNotificationHandler({handleNotification:async()=>({shouldShowBanner:true,shouldShowList:true,shouldPlaySound:false,shouldSetBadge:false})});
export async function configureNotifications(){if(Platform.OS==='android')await Notifications.setNotificationChannelAsync('operacion',{name:'Operación Obraxis',importance:Notifications.AndroidImportance.DEFAULT});const current=await Notifications.getPermissionsAsync();if(current.status!=='granted')await Notifications.requestPermissionsAsync()}
export async function scheduleMaintenanceSummary(count:number){const previous=await AsyncStorage.getItem(MAINTENANCE_KEY);if(previous)await Notifications.cancelScheduledNotificationAsync(previous).catch(()=>undefined);if(!count){await AsyncStorage.removeItem(MAINTENANCE_KEY);return}const permission=await Notifications.getPermissionsAsync();if(permission.status!=='granted')return;const when=new Date(Date.now()+24*60*60*1000);when.setHours(8,0,0,0);if(when.getTime()<=Date.now())when.setDate(when.getDate()+1);const id=await Notifications.scheduleNotificationAsync({content:{title:'Mantenciones por revisar',body:`Hay ${count} equipo${count===1?'':'s'} con mantención próxima o vencida.`,data:{route:'/maquinaria'}},trigger:{type:Notifications.SchedulableTriggerInputTypes.DATE,date:when,channelId:'operacion'}});await AsyncStorage.setItem(MAINTENANCE_KEY,id)}
