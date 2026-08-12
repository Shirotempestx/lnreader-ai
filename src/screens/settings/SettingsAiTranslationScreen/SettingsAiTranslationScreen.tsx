import { useCallback, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  TextInput as RNTextInput,
  View,
} from 'react-native';
import { Text, TextInput , IconButton } from 'react-native-paper';

import { Appbar, List, SafeAreaView } from '@components';
import { useTheme, useAiTranslationSettings , AiProviderId, ALL_PROVIDERS, PROVIDER_LABELS } from '@hooks/persisted';
import { clearAllTranslationCache } from '@hooks/persisted/useAiTranslation';
import { AiTranslationSettingsScreenProps } from '@navigators/types';
import { showToast } from '@utils/showToast';
import SettingSwitch from '../components/SettingSwitch';

const MASKED_PLACEHOLDER = '••••••••••••••••••••••••';

const SettingsAiTranslationScreen = ({
  navigation,
}: AiTranslationSettingsScreenProps) => {
  const theme = useTheme();
  const {
    enableForReading,
    enableForDownload,
    targetLanguage,
    providerOrder,
    apiKeys,
    downloadTranslationDelayMs,
    setAiTranslationSettings,
  } = useAiTranslationSettings();

  /**
   * Per-provider key visibility toggle — avoids exposing all keys at once.
   * Keys start hidden; tapping the eye icon reveals the actual stored value.
   */
  const [visibleKeys, setVisibleKeys] = useState<
    Partial<Record<AiProviderId, boolean>>
  >({});

  const toggleKeyVisibility = useCallback((id: AiProviderId) => {
    setVisibleKeys(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const setApiKey = useCallback(
    (id: AiProviderId, value: string) => {
      setAiTranslationSettings({
        apiKeys: { ...apiKeys, [id]: value.trim() },
      });
    },
    [apiKeys, setAiTranslationSettings],
  );

  /** Move a provider up one position in the priority list. */
  const moveUp = useCallback(
    (id: AiProviderId) => {
      const idx = providerOrder.indexOf(id);
      if (idx <= 0) {
        return;
      }
      const next = [...providerOrder];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      setAiTranslationSettings({ providerOrder: next });
    },
    [providerOrder, setAiTranslationSettings],
  );

  /** Move a provider down one position in the priority list. */
  const moveDown = useCallback(
    (id: AiProviderId) => {
      const idx = providerOrder.indexOf(id);
      if (idx < 0 || idx >= providerOrder.length - 1) {
        return;
      }
      const next = [...providerOrder];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      setAiTranslationSettings({ providerOrder: next });
    },
    [providerOrder, setAiTranslationSettings],
  );

  const handleClearCache = useCallback(() => {
    clearAllTranslationCache();
    showToast('Translation cache cleared.');
  }, []);

  const delaySeconds = Math.round(downloadTranslationDelayMs / 1000);

  return (
    <SafeAreaView excludeTop>
      <Appbar
        title="AI Translation"
        handleGoBack={navigation.goBack}
        theme={theme}
      />
      <ScrollView
        style={[{ backgroundColor: theme.background }, styles.flex]}
        contentContainerStyle={styles.content}
      >
        {/* ── Global Toggles ─────────────────────────────────── */}
        <List.Section>
          <List.SubHeader theme={theme}>Global Toggles</List.SubHeader>

          <SettingSwitch
            label="Enable for Online Reading"
            description="Translate chapters when reading online or from cache"
            value={enableForReading}
            onPress={() =>
              setAiTranslationSettings({ enableForReading: !enableForReading })
            }
            theme={theme}
          />
          <SettingSwitch
            label="Enable for Downloads"
            description="Translate and cache text when downloading chapters"
            value={enableForDownload}
            onPress={() =>
              setAiTranslationSettings({
                enableForDownload: !enableForDownload,
              })
            }
            theme={theme}
          />
        </List.Section>

        {/* ── Target Language ────────────────────────────────── */}
        <List.Section>
          <List.SubHeader theme={theme}>Target Language</List.SubHeader>
          <View style={[styles.inputRow, { borderColor: theme.outline }]}>
            <Text
              style={[styles.inputLabel, { color: theme.onSurfaceVariant }]}
            >
              Language
            </Text>
            <TextInput
              mode="outlined"
              value={targetLanguage}
              onChangeText={val =>
                setAiTranslationSettings({ targetLanguage: val })
              }
              placeholder="e.g. Arabic, French, Spanish"
              placeholderTextColor={theme.onSurfaceVariant}
              style={[styles.textInput, { color: theme.onSurface }]}
              outlineColor={theme.outline}
              activeOutlineColor={theme.primary}
              textColor={theme.onSurface}
            />
          </View>
        </List.Section>

        {/* ── API Keys ───────────────────────────────────────── */}
        <List.Section>
          <List.SubHeader theme={theme}>API Keys</List.SubHeader>
          {ALL_PROVIDERS.map(id => {
            const stored = apiKeys[id] ?? '';
            const isVisible = visibleKeys[id] ?? false;
            return (
              <View
                key={id}
                style={[styles.apiKeyRow, { borderColor: theme.outline }]}
              >
                <Text
                  style={[
                    styles.apiKeyLabel,
                    { color: theme.onSurfaceVariant },
                  ]}
                >
                  {PROVIDER_LABELS[id]}
                </Text>
                <View style={styles.apiKeyInputRow}>
                  <RNTextInput
                    value={
                      isVisible ? stored : stored ? MASKED_PLACEHOLDER : ''
                    }
                    onChangeText={val => setApiKey(id, val)}
                    placeholder={`Paste ${PROVIDER_LABELS[id]} API key`}
                    placeholderTextColor={theme.onSurfaceVariant}
                    style={[
                      styles.apiKeyInput,
                      {
                        color: theme.onSurface,
                        borderColor: theme.outline,
                        backgroundColor: theme.surface,
                      },
                    ]}
                    secureTextEntry={!isVisible}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={isVisible || !stored}
                  />
                  <IconButton
                    icon={isVisible ? 'eye-off' : 'eye'}
                    size={20}
                    iconColor={theme.onSurfaceVariant}
                    onPress={() => toggleKeyVisibility(id)}
                  />
                </View>
              </View>
            );
          })}
        </List.Section>

        {/* ── Provider Priority ──────────────────────────────── */}
        <List.Section>
          <List.SubHeader theme={theme}>Provider Priority</List.SubHeader>
          <Text style={[styles.hint, { color: theme.onSurfaceVariant }]}>
            Higher position = tried first. Providers without an API key are
            automatically skipped.
          </Text>
          {providerOrder.map((id, idx) => (
            <View
              key={id}
              style={[
                styles.priorityRow,
                { borderColor: theme.outline, backgroundColor: theme.surface },
              ]}
            >
              <Text style={[styles.priorityIndex, { color: theme.primary }]}>
                {idx + 1}
              </Text>
              <Text style={[styles.priorityLabel, { color: theme.onSurface }]}>
                {PROVIDER_LABELS[id]}
              </Text>
              <View style={styles.priorityButtons}>
                <IconButton
                  icon="chevron-up"
                  size={20}
                  iconColor={
                    idx === 0 ? theme.onSurfaceVariant : theme.onSurface
                  }
                  disabled={idx === 0}
                  onPress={() => moveUp(id)}
                />
                <IconButton
                  icon="chevron-down"
                  size={20}
                  iconColor={
                    idx === providerOrder.length - 1
                      ? theme.onSurfaceVariant
                      : theme.onSurface
                  }
                  disabled={idx === providerOrder.length - 1}
                  onPress={() => moveDown(id)}
                />
              </View>
            </View>
          ))}
        </List.Section>

        {/* ── Download Delay ─────────────────────────────────── */}
        <List.Section>
          <List.SubHeader theme={theme}>Download Rate Limiting</List.SubHeader>
          <List.Item
            title={`Translation delay: ${delaySeconds}s between chapters`}
            description="Extra pause between AI requests during bulk downloads to avoid rate limits"
            theme={theme}
          />
          <View style={styles.delayRow}>
            {[2, 3, 4, 5, 8, 10].map(sec => (
              <View
                key={sec}
                style={[
                  styles.delayChip,
                  {
                    backgroundColor:
                      delaySeconds === sec ? theme.primary : theme.surface,
                    borderColor:
                      delaySeconds === sec ? theme.primary : theme.outline,
                  },
                ]}
              >
                <Text
                  style={{
                    color:
                      delaySeconds === sec ? theme.onPrimary : theme.onSurface,
                    fontWeight: delaySeconds === sec ? 'bold' : 'normal',
                  }}
                  onPress={() =>
                    setAiTranslationSettings({
                      downloadTranslationDelayMs: sec * 1000,
                    })
                  }
                >
                  {sec}s
                </Text>
              </View>
            ))}
          </View>
        </List.Section>

        {/* ── Cache Management ───────────────────────────────── */}
        <List.Section>
          <List.SubHeader theme={theme}>Cache</List.SubHeader>
          <List.Item
            title="Clear Translation Cache"
            description="Removes all locally cached translated chapter text"
            icon="cached"
            theme={theme}
            onPress={handleClearCache}
          />
        </List.Section>
      </ScrollView>
    </SafeAreaView>
  );
};

export default SettingsAiTranslationScreen;

const styles = StyleSheet.create({
  apiKeyInput: {
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  apiKeyInputRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  apiKeyLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  apiKeyRow: {
    borderRadius: 8,
    borderWidth: 1,
    marginHorizontal: 16,
    marginVertical: 6,
    padding: 12,
  },
  content: {
    paddingBottom: 32,
  },
  delayChip: {
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  delayRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  flex: { flex: 1 },
  hint: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  inputRow: {
    borderRadius: 8,
    borderWidth: 1,
    marginHorizontal: 16,
    marginVertical: 6,
    padding: 12,
  },
  priorityButtons: {
    flexDirection: 'row',
  },
  priorityIndex: {
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 12,
    minWidth: 24,
  },
  priorityLabel: {
    flex: 1,
    fontSize: 15,
  },
  priorityRow: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    marginHorizontal: 16,
    marginVertical: 4,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  textInput: {
    fontSize: 14,
  },
});
