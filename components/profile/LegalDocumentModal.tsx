import React from 'react';
import { Linking, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View, type StyleProp, type TextStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { Screen } from '@/components/common/Screen';
import { fontFamilies } from '@/theme/typography';
import type { LegalDocument, LegalSection } from '@/constants/legal/types';

// Full-screen legal page (Disclaimer): header with back button, "Last
// updated" date, then numbered sections. Email addresses in the text open
// the mail app. The pieces are exported so other legal screens
// (Acknowledgements) look exactly the same.

const EMAIL_SPLIT = /([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i;
const IS_EMAIL = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

/** Text with any email address made tappable. */
export function RichText({ text, style }: { text: string; style: StyleProp<TextStyle> }) {
  const parts = text.split(EMAIL_SPLIT);
  return (
    <Text style={style}>
      {parts.map((part, i) =>
        IS_EMAIL.test(part) ? (
          <Text
            key={i}
            style={styles.link}
            onPress={() => Linking.openURL(`mailto:${part}`).catch(() => {})}
            accessibilityRole="link"
          >
            {part}
          </Text>
        ) : (
          part
        )
      )}
    </Text>
  );
}

/** Header bar: back button and centered title. */
export function LegalHeaderBar({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={styles.headerBar}>
      <TouchableOpacity style={styles.backBtn} onPress={onBack} accessibilityRole="button" accessibilityLabel="Back">
        <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
      </TouchableOpacity>
      <Text style={styles.headerTitle} accessibilityRole="header">
        {title}
      </Text>
      <View style={{ width: 48 }} />
    </View>
  );
}

/** One numbered section: heading, paragraphs, bullets, footer paragraph. */
export function LegalSectionView({ number, section }: { number: number; section: LegalSection }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionHeading} accessibilityRole="header">
        {number}. {section.heading}
      </Text>
      {section.paragraphs.map((p, j) => (
        <RichText key={j} text={p} style={styles.paragraph} />
      ))}
      {section.bullets?.map((b, j) => (
        <View key={j} style={styles.bulletRow}>
          <Text style={styles.bulletDot}>•</Text>
          <RichText text={b} style={[styles.paragraph, styles.bulletText]} />
        </View>
      ))}
      {!!section.footer && <RichText text={section.footer} style={styles.paragraph} />}
    </View>
  );
}

export interface LegalDocumentModalProps {
  visible: boolean;
  document: LegalDocument;
  onClose: () => void;
}

export function LegalDocumentModal({ visible, document, onClose }: LegalDocumentModalProps) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={onClose}>
      <Screen style={styles.screen}>
        <LegalHeaderBar title={document.title} onBack={onClose} />

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.updated}>Last updated: {document.lastUpdated}</Text>
          {!!document.intro && <RichText text={document.intro} style={styles.intro} />}

          {document.sections.map((section, i) => (
            <LegalSectionView key={section.heading} number={i + 1} section={section} />
          ))}

          <View style={{ height: 32 }} />
        </ScrollView>
      </Screen>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#09090B',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#26282E',
  },
  backBtn: {
    width: 48,
    height: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: fontFamilies.bold,
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  updated: {
    fontFamily: fontFamilies.medium,
    fontSize: 12,
    color: '#71717A',
    marginBottom: 12,
  },
  intro: {
    fontFamily: fontFamilies.medium,
    fontSize: 14.5,
    lineHeight: 22,
    color: '#E4E4E7',
    marginBottom: 8,
  },
  section: {
    marginTop: 20,
    gap: 8,
  },
  sectionHeading: {
    fontFamily: fontFamilies.bold,
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  paragraph: {
    fontFamily: fontFamilies.regular,
    fontSize: 14,
    lineHeight: 21,
    color: '#A1A1AA',
  },
  bulletRow: {
    flexDirection: 'row',
    paddingLeft: 4,
  },
  bulletDot: {
    fontSize: 14,
    lineHeight: 21,
    color: '#FE5B01',
    width: 14,
  },
  bulletText: {
    flex: 1,
  },
  link: {
    color: '#FE5B01',
    textDecorationLine: 'underline',
  },
});

/** The legal pages' shared styles (screen, header, text, spacing). */
export const legalStyles = styles;
