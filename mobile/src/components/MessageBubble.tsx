import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Message } from '../types';

interface Props {
  message: Message;
  onCopy: (content: string) => void;
}

const MessageBubble = memo(({ message, onCopy }: Props) => {
  const isUser = message.role === 'user';
  const isEmpty = !message.content && message.role === 'assistant';

  return (
    <View style={[styles.wrapper, isUser ? styles.wrapperUser : styles.wrapperAssistant]}>
      {!isUser && (
        <View style={styles.avatar}>
          <Ionicons name="sparkles" size={14} color="#7c3aed" />
        </View>
      )}

      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
        {isEmpty ? (
          // Typing indicator (three dots)
          <View style={styles.typingRow}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={styles.typingDot} />
            ))}
          </View>
        ) : (
          <>
            <Text style={[styles.text, isUser ? styles.textUser : styles.textAssistant]}>
              {message.content}
            </Text>

            {/* Metadata row */}
            <View style={styles.metaRow}>
              <Text style={styles.metaTime}>
                {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
              {message.model && (
                <Text style={styles.metaModel} numberOfLines={1}>
                  {message.model}
                </Text>
              )}
              {message.tokens && (
                <Text style={styles.metaTokens}>{message.tokens}t</Text>
              )}
              <TouchableOpacity onPress={() => onCopy(message.content)} style={styles.copyBtn}>
                <Ionicons name="copy-outline" size={12} color="#475569" />
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </View>
  );
});

MessageBubble.displayName = 'MessageBubble';
export default MessageBubble;

const styles = StyleSheet.create({
  wrapper: { flexDirection: 'row', marginBottom: 4, maxWidth: '90%' },
  wrapperUser: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
  wrapperAssistant: { alignSelf: 'flex-start' },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1a1d2e',
    borderWidth: 1,
    borderColor: '#2d3148',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    marginRight: 6,
  },
  bubble: { borderRadius: 16, padding: 12, maxWidth: '100%' },
  bubbleUser: {
    backgroundColor: '#7c3aed',
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    backgroundColor: '#1a1d2e',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#2d3148',
  },
  text: { fontSize: 15, lineHeight: 22 },
  textUser: { color: '#ffffff' },
  textAssistant: { color: '#e2e8f0' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' },
  metaTime: { color: '#475569', fontSize: 10 },
  metaModel: { color: '#475569', fontSize: 10, maxWidth: 80 },
  metaTokens: { color: '#475569', fontSize: 10 },
  copyBtn: { marginLeft: 2 },
  typingRow: { flexDirection: 'row', gap: 4, paddingVertical: 4, paddingHorizontal: 2 },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#7c3aed',
    opacity: 0.7,
  },
});
