import type { PropsWithChildren } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { useTheme } from '@/theme/ThemeProvider';

export function SessionGate({ children }: PropsWithChildren) {
  const { session, profile, loading, profileError, retryProfile, signOut } = useAuth();
  const { colors } = useTheme();
  if (!loading && !profileError && (!session || profile)) return children;
  return <View style={{ flex: 1, padding: 30, gap: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.soft }}>
    {loading || !profileError ? <ActivityIndicator color={colors.blue} /> : <>
      <Text accessibilityRole="alert" style={{ color: colors.ink, textAlign: 'center' }}>{profileError}</Text>
      <Pressable accessibilityRole="button" onPress={retryProfile} style={{ padding: 16 }}>
        <Text style={{ color: colors.blue }}>Reintentar</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => { void signOut(); }} style={{ padding: 16 }}>
        <Text style={{ color: colors.ink }}>Cerrar sesión</Text>
      </Pressable>
    </>}
  </View>;
}
