import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
  ScrollView, StatusBar,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../theme/colors';
import { AuthService } from '../../services/authService';
import PendingApprovalScreen from './PendingApprovalScreen';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [pendingEmail, setPendingEmail] = useState(null);

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
        if (!displayName) { Alert.alert('Error', 'Enter your name'); setLoading(false); return; }
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
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inner}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Logo */}
          <View style={styles.logoWrap}>
            <Ionicons name="musical-notes" size={52} color={COLORS.primary} />
            <Text style={styles.logoText}>Sandy5</Text>
            <Text style={styles.tagline}>Millions of songs. Free on Sandy5.</Text>
          </View>

          {/* Google Sign In */}
          <TouchableOpacity
            style={styles.socialBtn}
            onPress={() => promptAsync()}
            disabled={loading}
            activeOpacity={0.8}
          >
            <Ionicons name="logo-google" size={20} color="#fff" />
            <Text style={styles.socialBtnText}>Continue with Google</Text>
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Form */}
          {mode === 'signup' && (
            <>
              <Text style={styles.fieldLabel}>What's your name?</Text>
              <View style={styles.inputWrap}>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your name"
                  placeholderTextColor={COLORS.textMuted}
                  value={displayName}
                  onChangeText={setDisplayName}
                  autoCapitalize="words"
                />
              </View>
            </>
          )}

          <Text style={styles.fieldLabel}>Email</Text>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              placeholder="Enter your email"
              placeholderTextColor={COLORS.textMuted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <Text style={styles.fieldLabel}>Password</Text>
          <View style={styles.inputWrap}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Enter your password"
              placeholderTextColor={COLORS.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPass}
            />
            <TouchableOpacity onPress={() => setShowPass(!showPass)} style={styles.eyeBtn}>
              <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitBtn, loading && { opacity: 0.6 }]}
            onPress={handleEmailAuth}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.submitText}>
                {mode === 'login' ? 'Log In' : 'Sign Up'}
              </Text>
            )}
          </TouchableOpacity>

          {/* Switch mode */}
          <TouchableOpacity onPress={() => setMode(mode === 'login' ? 'signup' : 'login')} style={styles.switchWrap}>
            <Text style={styles.switchText}>
              {mode === 'login'
                ? "Don't have an account? "
                : 'Already have an account? '}
            </Text>
            <Text style={styles.switchLink}>
              {mode === 'login' ? 'Sign up for Sandy5' : 'Log in'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  inner: { flex: 1 },
  scroll: {
    flexGrow: 1, justifyContent: 'center',
    paddingHorizontal: 32, paddingVertical: 48,
  },

  // Logo
  logoWrap: { alignItems: 'center', marginBottom: 40 },
  logoText: { fontSize: 36, fontWeight: '800', color: '#fff', marginTop: 8, letterSpacing: -0.5 },
  tagline: { fontSize: 14, color: COLORS.textSecondary, marginTop: 6 },

  // Social
  socialBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: COLORS.textMuted, borderRadius: 30,
    paddingVertical: 14, gap: 10,
  },
  socialBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  // Divider
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 28 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#282828' },
  dividerText: { color: COLORS.textSecondary, marginHorizontal: 14, fontSize: 13 },

  // Form
  fieldLabel: { color: '#fff', fontSize: 14, fontWeight: '700', marginBottom: 8, marginTop: 4 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#121212', borderRadius: 6,
    borderWidth: 1, borderColor: '#333',
    paddingHorizontal: 14, marginBottom: 16, height: 52,
  },
  input: { flex: 1, color: '#fff', fontSize: 15 },
  eyeBtn: { padding: 6 },

  // Submit
  submitBtn: {
    backgroundColor: COLORS.primary, borderRadius: 30,
    paddingVertical: 16, alignItems: 'center', marginTop: 8,
  },
  submitText: { color: '#000', fontWeight: '800', fontSize: 16 },

  // Switch
  switchWrap: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  switchText: { color: COLORS.textSecondary, fontSize: 14 },
  switchLink: { color: '#fff', fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' },
});
