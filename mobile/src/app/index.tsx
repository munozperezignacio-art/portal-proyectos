import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { colors } from '@/lib/theme';
export default function Index(){const{session,loading}=useAuth();if(loading)return <View style={{flex:1,alignItems:'center',justifyContent:'center'}}><ActivityIndicator color={colors.orange}/></View>;return <Redirect href={session?'/inicio':'/login'}/>}
