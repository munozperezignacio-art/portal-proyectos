import Constants from 'expo-constants';
import { Text } from 'react-native';
import { colors } from '@/lib/theme';

export function BuildVersion() {
  const release = Constants.expoConfig?.extra?.release;
  return <Text style={{fontSize:11,color:colors.muted,textAlign:'center',padding:8}}>Versión {Constants.expoConfig?.version || 'desarrollo'} · {release?.commit ? `Revisión ${String(release.commit).slice(0,8)}` : 'Desarrollo local'}</Text>;
}
