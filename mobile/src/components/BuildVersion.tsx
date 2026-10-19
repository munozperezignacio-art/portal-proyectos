import { useTheme } from '@/theme/ThemeProvider';
import Constants from 'expo-constants';
import { Text } from 'react-native';


export function BuildVersion() {
  const {colors}=useTheme();

  const release = Constants.expoConfig?.extra?.release;
  return <Text style={{fontSize:12,color:colors.muted,textAlign:'center',padding:8}}>Versión {Constants.expoConfig?.version || 'desarrollo'} · {release?.commit ? `Revisión ${String(release.commit).slice(0,8)}` : 'Desarrollo local'}</Text>;
}
