import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
  SafeAreaView,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AdminService } from '../../services/adminService';
import { COLORS } from '../../theme/colors';

const TABS = ['Pending', 'All Users', 'Login History'];

function timeAgo(dateStr) {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

// ─── Pending Tab ──────────────────────────────────────────────────────────────
function PendingTab({ onCountChange }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await AdminService.getPendingUsers();
      setUsers(data.pending || []);
      onCountChange?.(data.pending?.length || 0);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, []);

  const handleApprove = (user) => {
    Alert.alert('Approve User', `Allow ${user.email} to access the app?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Approve', style: 'default',
        onPress: async () => {
          setActionLoading(user.id);
          try {
            await AdminService.approveUser(user.id);
            setUsers((prev) => prev.filter((u) => u.id !== user.id));
            onCountChange?.((c) => Math.max(0, c - 1));
          } catch (e) {
            Alert.alert('Error', e.message);
          } finally {
            setActionLoading(null);
          }
        },
      },
    ]);
  };

  const handleReject = (user) => {
    Alert.alert('Reject & Delete', `Permanently delete ${user.email}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject', style: 'destructive',
        onPress: async () => {
          setActionLoading(user.id);
          try {
            await AdminService.rejectUser(user.id);
            setUsers((prev) => prev.filter((u) => u.id !== user.id));
            onCountChange?.((c) => Math.max(0, c - 1));
          } catch (e) {
            Alert.alert('Error', e.message);
          } finally {
            setActionLoading(null);
          }
        },
      },
    ]);
  };

  if (loading) return <Loader />;

  if (!users.length) {
    return (
      <EmptyState
        icon="checkmark-circle"
        iconColor={COLORS.primary}
        title="No pending approvals"
        subtitle="All signups have been reviewed"
      />
    );
  }

  return (
    <FlatList
      data={users}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={COLORS.primary} />}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Avatar uri={item.avatar_url} name={item.display_name} />
            <View style={styles.cardInfo}>
              <Text style={styles.cardName}>{item.display_name}</Text>
              <Text style={styles.cardEmail}>{item.email}</Text>
              <View style={styles.badgeRow}>
                {item.has_google && <Badge label="Google" color={COLORS.info} />}
                <Badge label="Pending" color={COLORS.warning} />
              </View>
            </View>
          </View>
          {item.device_name && (
            <View style={styles.deviceRow}>
              <Ionicons name="phone-portrait-outline" size={13} color={COLORS.textMuted} />
              <Text style={styles.deviceText}>
                {item.device_name}{item.os ? ` • ${item.os}` : ''}
                {item.app_version ? ` • v${item.app_version}` : ''}
              </Text>
            </View>
          )}
          <Text style={styles.cardDate}>Signed up {formatDate(item.created_at)}</Text>
          <View style={styles.actionRow}>
            {actionLoading === item.id ? (
              <ActivityIndicator color={COLORS.primary} style={{ flex: 1 }} />
            ) : (
              <>
                <TouchableOpacity style={styles.approveBtn} onPress={() => handleApprove(item)}>
                  <Ionicons name="checkmark" size={16} color="#fff" />
                  <Text style={styles.approveBtnText}>Approve</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.rejectBtn} onPress={() => handleReject(item)}>
                  <Ionicons name="close" size={16} color="#fff" />
                  <Text style={styles.rejectBtnText}>Reject</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      )}
    />
  );
}

// ─── All Users Tab ────────────────────────────────────────────────────────────
function AllUsersTab() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await AdminService.getAllUsers();
      setUsers(data.users || []);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, []);

  if (loading) return <Loader />;

  if (!users.length) {
    return <EmptyState icon="people-outline" title="No users found" subtitle="No registered accounts yet" />;
  }

  return (
    <FlatList
      data={users}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={COLORS.primary} />}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Avatar uri={item.avatar_url} name={item.display_name} />
            <View style={styles.cardInfo}>
              <Text style={styles.cardName}>{item.display_name}</Text>
              <Text style={styles.cardEmail}>{item.email}</Text>
              <View style={styles.badgeRow}>
                {item.has_google && <Badge label="Google" color={COLORS.info} />}
                <Badge
                  label={item.approved ? 'Approved' : 'Pending'}
                  color={item.approved ? COLORS.primary : COLORS.warning}
                />
              </View>
            </View>
          </View>
          <View style={styles.statsRow}>
            <StatItem icon="phone-portrait-outline" value={item.device_count} label="devices" />
            <StatItem icon="log-in-outline" value={item.login_count} label="logins" />
            <StatItem icon="time-outline" value={timeAgo(item.last_login)} label="last seen" />
          </View>
          <Text style={styles.cardDate}>Joined {formatDate(item.created_at)}</Text>
        </View>
      )}
    />
  );
}

// ─── Login History Tab ────────────────────────────────────────────────────────
function LoginHistoryTab() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await AdminService.getLoginHistory(100);
      setLogs(data.logs || []);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, []);

  if (loading) return <Loader />;

  if (!logs.length) {
    return <EmptyState icon="time-outline" title="No login history" subtitle="Login events will appear here" />;
  }

  return (
    <FlatList
      data={logs}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={COLORS.primary} />}
      renderItem={({ item }) => (
        <View style={styles.logCard}>
          <View style={styles.logTop}>
            <View style={styles.logLeft}>
              <Ionicons
                name={item.method === 'google' ? 'logo-google' : 'mail-outline'}
                size={14}
                color={item.method === 'google' ? COLORS.info : COLORS.textSecondary}
              />
              <Text style={styles.logEmail}>{item.email}</Text>
            </View>
            <Text style={styles.logTime}>{timeAgo(item.logged_in_at)}</Text>
          </View>
          {item.device_name && (
            <View style={styles.deviceRow}>
              <Ionicons name="phone-portrait-outline" size={12} color={COLORS.textMuted} />
              <Text style={styles.deviceText}>
                {item.device_name}{item.os ? ` • ${item.os}` : ''}
              </Text>
            </View>
          )}
          {item.ip && (
            <View style={styles.deviceRow}>
              <Ionicons name="globe-outline" size={12} color={COLORS.textMuted} />
              <Text style={styles.deviceText}>{item.ip}</Text>
            </View>
          )}
        </View>
      )}
    />
  );
}

// ─── Shared Components ────────────────────────────────────────────────────────
function Avatar({ uri, name }) {
  if (uri) {
    return <Image source={{ uri }} style={styles.avatar} />;
  }
  const letter = (name || '?')[0].toUpperCase();
  return (
    <View style={styles.avatarFallback}>
      <Text style={styles.avatarLetter}>{letter}</Text>
    </View>
  );
}

function Badge({ label, color }) {
  return (
    <View style={[styles.badge, { backgroundColor: color + '22' }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

function StatItem({ icon, value, label }) {
  return (
    <View style={styles.statItem}>
      <Ionicons name={icon} size={12} color={COLORS.textMuted} />
      <Text style={styles.statValue}>{value ?? 0}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Loader() {
  return (
    <View style={styles.centered}>
      <ActivityIndicator color={COLORS.primary} size="large" />
    </View>
  );
}

function EmptyState({ icon, iconColor, title, subtitle }) {
  return (
    <View style={styles.centered}>
      <Ionicons name={icon} size={56} color={iconColor || COLORS.textMuted} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySubtitle}>{subtitle}</Text>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function AdminPanelScreen() {
  const [activeTab, setActiveTab] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Ionicons name="shield-checkmark" size={22} color={COLORS.primary} />
        <Text style={styles.headerTitle}>Admin Panel</Text>
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {TABS.map((tab, i) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === i && styles.tabActive]}
            onPress={() => setActiveTab(i)}
          >
            <Text style={[styles.tabText, activeTab === i && styles.tabTextActive]}>
              {tab}
            </Text>
            {i === 0 && pendingCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{pendingCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <View style={styles.content}>
        {activeTab === 0 && <PendingTab onCountChange={setPendingCount} />}
        {activeTab === 1 && <AllUsersTab />}
        {activeTab === 2 && <LoginHistoryTab />}
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginHorizontal: 16,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  tabTextActive: {
    color: COLORS.primary,
  },
  content: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  // Card
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
  },
  cardInfo: {
    flex: 1,
    gap: 2,
  },
  cardName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  cardEmail: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  cardDate: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 6,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 20,
    backgroundColor: COLORS.elevated,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  // Avatar
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.elevated,
  },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary + '33',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primary,
  },
  // Device row
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  deviceText: {
    fontSize: 11,
    color: COLORS.textMuted,
    flex: 1,
  },
  // Action buttons
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  approveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: 10,
  },
  approveBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  rejectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.error,
    borderRadius: 8,
    paddingVertical: 10,
  },
  rejectBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  // Stats row
  statsRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  // Log card
  logCard: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 12,
    marginBottom: 2,
    gap: 4,
  },
  logTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  logEmail: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
    flex: 1,
  },
  logTime: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  // Empty / Loading
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
});
