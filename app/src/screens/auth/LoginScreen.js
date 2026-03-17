import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../theme/colors';
import { AuthService } from '../../services/authService';
import PendingApprovalScreen from './PendingApprovalScreen';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [pendingEmail, setPendingEmail] = useState(null); // non-null = show pending screen

  const [_request, response, promptAsync] = Google.useIdTokenAuthRequest({
    androidClientId: '18421210900-u1ko20ujhrnod8aeo7ct05smp2al6l54.apps.googleusercontent.com',
    webClientId: '51559246996-vii5dknpjdcgqgk4lsn1lm719vbj4u3f.apps.googleusercontent.com',
  });

  React.useEffect(() => {
    if (response?.type === 'success') {
      const { id_token, access_token } = response.params;
      handleGoogleCredential(id_token, access_token);
    }
  }, [response]);

  const handleGoogleCredential = async (idToken, accessToken) => {
    setLoading(true);
    try {
      await AuthService.signInWithGoogle(idToken, accessToken);
    } catch (e) {
      if (e.code === 'pending_approval') { setPendingEmail(e.email || ''); return; }
      Alert.alert('Google Sign-In failed', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'login') {
        await AuthService.signInWithEmail(email, password);
      } else {
        if (!displayName) { Alert.alert('Error', 'Enter your name'); return; }
        await AuthService.signUpWithEmail(email, password, displayName);
      }
    } catch (e) {
      if (e.code === 'pending_approval') { setPendingEmail(email); return; }
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  if (pendingEmail !== null) {
    return <PendingApprovalScreen email={pendingEmail} onSignOut={() => setPendingEmail(null)} />;
  }

  return (
    <LinearGradient colors={['#0a3d1f', '#121212', '#121212']} style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inner}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Logo */}
          <View style={styles.logoContainer}>
            <Ionicons name="musical-notes" size={60} color={COLORS.primary} />
            <Text style={styles.logoText}>Sandy5</Text>
            <Text style={styles.tagline}>Music for everyone</Text>
          </View>

          {/* Google Sign In */}
          <TouchableOpacity
            style={styles.googleBtn}
            onPress={() => promptAsync()}
            disabled={loading}
          >
            <Ionicons name="logo-google" size={20} color="#fff" />
            <Text style={styles.googleBtnText}>Continue with Google</Text>
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Email Auth */}
          {mode === 'signup' && (
            <View style={styles.inputWrapper}>
              <Ionicons name="person-outline" size={18} color={COLORS.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Your name"
                placeholderTextColor={COLORS.textMuted}
                value={displayName}
                onChangeText={setDisplayName}
                autoCapitalize="words"
              />
            </View>
          )}

          <View style={styles.inputWrapper}>
            <Ionicons name="mail-outline" size={18} color={COLORS.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Email address"
              placeholderTextColor={COLORS.textMuted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputWrapper}>
            <Ionicons name="lock-closed-outline" size={18} color={COLORS.textMuted} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Password"
              placeholderTextColor={COLORS.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPass}
            />
            <TouchableOpacity onPress={() => setShowPass(!showPass)} style={styles.eyeBtn}>
              <Ionicons name={showPass ? 'eye-off' : 'eye'} size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, loading && styles.btnDisabled]}
            onPress={handleEmailAuth}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.primaryBtnText}>
                {mode === 'login' ? 'Log In' : 'Sign Up'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setMode(mode === 'login' ? 'signup' : 'login')}>
            <Text style={styles.switchText}>
              {mode === 'login'
                ? "Don't have an account? Sign up"
                : 'Already have an account? Log in'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 32, paddingVertical: 60 },
  logoContainer: { alignItems: 'center', marginBottom: 48 },
  logoText: { fontSize: 40, fontWeight: '900', color: COLORS.primary, marginTop: 8 },
  tagline: { fontSize: 14, color: COLORS.textSecondary, marginTop: 4 },
  googleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#4285F4', borderRadius: 30, paddingVertical: 14,
    gap: 10,
  },
  googleBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 24 },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  dividerText: { color: COLORS.textMuted, marginHorizontal: 12, fontSize: 12 },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.surface, borderRadius: 8,
    borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 14, marginBottom: 12,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, color: COLORS.textPrimary, fontSize: 15, paddingVertical: 14 },
  eyeBtn: { padding: 4 },
  primaryBtn: {
    backgroundColor: COLORS.primary, borderRadius: 30,
    paddingVertical: 16, alignItems: 'center', marginTop: 8,
  },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: '#000', fontWeight: '800', fontSize: 16 },
  switchText: { color: COLORS.textSecondary, textAlign: 'center', marginTop: 20, fontSize: 14 },
});
