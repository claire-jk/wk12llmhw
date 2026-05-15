import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

/* =========================
   AsyncStorage Key
========================= */
const STORAGE_KEY = 'CHAT_HISTORY';

/* =========================
   System Prompt 設定
========================= */
const SYSTEM_PROMPT = {
  role: 'system',
  content: `
你是一位友善且專業的 AI 助理。

請遵守以下規則：
1. 使用繁體中文（台灣用語）回答
2. 回答簡潔、有條理、易閱讀
3. 若是程式問題，請提供完整可執行範例
4. 若使用者問題不明確，請主動詢問
5. 保持自然對話風格
6. 不要輸出危險、違法內容
7. 可以適度使用條列式整理重點
8. 若是 React Native / Expo 問題，優先使用最新寫法
`,
};

interface Message {
  role: 'user' | 'assistant';
  content: string;
  time: string;
}

export default function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const insets = useSafeAreaInsets();

  /* =========================
     取得目前時間
  ========================= */
  const getCurrentTime = () => {
    const now = new Date();

    return now.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  /* =========================
     載入歷史聊天紀錄
  ========================= */
  const loadMessages = async () => {
    try {
      const savedMessages =
        await AsyncStorage.getItem(STORAGE_KEY);

      if (savedMessages) {
        const parsedMessages = JSON.parse(savedMessages);

        setMessages(parsedMessages);

        console.log(
          '已載入聊天紀錄:',
          parsedMessages
        );
      }
    } catch (error) {
      console.log(
        '讀取聊天紀錄失敗:',
        error
      );
    }
  };

  /* =========================
     保存聊天紀錄
  ========================= */
  const saveMessages = async (
    newMessages: Message[]
  ) => {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(newMessages)
      );

      console.log('聊天紀錄已保存');
    } catch (error) {
      console.log(
        '保存聊天紀錄失敗:',
        error
      );
    }
  };

  /* =========================
     清除聊天紀錄
  ========================= */
  const clearMessages = () => {
    Alert.alert(
      '清除聊天紀錄',
      '確定要刪除所有聊天紀錄嗎？',
      [
        {
          text: '取消',
          style: 'cancel',
        },
        {
          text: '確定',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.removeItem(
                STORAGE_KEY
              );

              setMessages([]);

              console.log(
                '聊天紀錄已清除'
              );
            } catch (error) {
              console.log(
                '清除聊天紀錄失敗:',
                error
              );
            }
          },
        },
      ]
    );
  };

  /* =========================
     APP 啟動時載入紀錄
  ========================= */
  useEffect(() => {
    loadMessages();
  }, []);

  /* =========================
     自動滾動到底部
  ========================= */
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({
          animated: true,
        });
      }, 100);
    }
  }, [messages]);

  /* =========================
     發送訊息
  ========================= */
  const sendMessage = async () => {
    if (!inputText.trim() || isLoading)
      return;

    /* ========= User Message ========= */
    const userMessage: Message = {
      role: 'user',
      content: inputText.trim(),
      time: getCurrentTime(),
    };

    /* ========= nextRows ========= */
    const nextRows = [
      ...messages,
      userMessage,
    ];

    /* 更新聊天室 */
    setMessages(nextRows);

    /* 保存歷史紀錄 */
    await saveMessages(nextRows);

    /* 清空輸入框 */
    setInputText('');

    /* Loading */
    setIsLoading(true);

    try {
      /* =========================
         UserPrompt
      ========================= */
      const userPrompt = nextRows.map(
        ({ role, content }) => ({
          role,
          content,
        })
      );

      /* =========================
         apiMessages
      ========================= */
      const apiMessages = [
        SYSTEM_PROMPT,
        ...userPrompt,
      ];

      /* =========================
         呼叫 Groq API
      ========================= */
      const response = await fetch(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          method: 'POST',

          headers: {
            Authorization:
              `Bearer ${process.env.EXPO_PUBLIC_GROQ_API_KEY}`,
            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            model:
              'llama-3.1-8b-instant',

            messages: apiMessages,

            temperature: 0.7,

            max_tokens: 1024,
          }),
        }
      );

      const data = await response.json();

      console.log(
        'Groq Response:',
        data
      );

      /* =========================
         AI 回覆
      ========================= */
      if (
        response.ok &&
        data.choices?.length > 0
      ) {
        const aiResponse: Message = {
          role: 'assistant',

          content:
            data.choices[0]?.message
              ?.content ||
            'AI 沒有回應',

          time: getCurrentTime(),
        };

        const updatedMessages = [
          ...nextRows,
          aiResponse,
        ];

        /* 更新聊天室 */
        setMessages(updatedMessages);

        /* 保存 AI 回覆 */
        await saveMessages(
          updatedMessages
        );
      } else {
        console.log(data);

        alert(
          data?.error?.message ||
            'AI 暫時沒有回應'
        );
      }
    } catch (error) {
      console.log(error);

      alert('連線失敗');
    } finally {
      setIsLoading(false);
    }
  };

  /* =========================
     聊天泡泡
  ========================= */
  const renderItem = ({
    item,
  }: {
    item: Message;
  }) => {
    const isUser =
      item.role === 'user';

    return (
      <View
        style={[
          styles.messageWrapper,
          isUser
            ? styles.userWrapper
            : styles.aiWrapper,
        ]}
      >
        {/* AI Avatar */}
        {!isUser && (
          <View style={styles.aiAvatar}>
            <Text
              style={
                styles.aiAvatarText
              }
            >
              AI
            </Text>
          </View>
        )}

        {/* Bubble */}
        <View
          style={[
            styles.bubbleContainer,
            isUser
              ? styles.userContainer
              : styles.aiContainer,
          ]}
        >
          <View
            style={[
              styles.bubble,
              isUser
                ? styles.userBubble
                : styles.aiBubble,
            ]}
          >
            <Text
              style={[
                styles.messageText,
                {
                  color: isUser
                    ? '#fff'
                    : '#2C3E50',
                },
              ]}
            >
              {item.content}
            </Text>
          </View>

          {/* Time */}
          <Text style={styles.timeText}>
            {item.time}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView
      style={styles.container}
    >
      <StatusBar
        barStyle="light-content"
      />

      {/* =========================
          Header
      ========================= */}
      <View style={styles.header}>
        <View style={styles.headerInfo}>
          <Text
            style={styles.headerTitle}
          >
            雲端 AI 助理
          </Text>

          <View
            style={styles.statusRow}
          >
            <View
              style={styles.onlineDot}
            />

            <Text
              style={styles.statusText}
            >
              在線中
            </Text>
          </View>
        </View>

        {/* 清除聊天按鈕 */}
        <TouchableOpacity
          style={styles.clearButton}
          onPress={clearMessages}
        >
          <Text
            style={
              styles.clearButtonText
            }
          >
            清除聊天
          </Text>
        </TouchableOpacity>
      </View>

      {/* =========================
          Keyboard
      ========================= */}
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : 'height'
        }
        keyboardVerticalOffset={
          Platform.OS === 'ios'
            ? 0
            : 20
        }
      >
        <TouchableWithoutFeedback
          onPress={Keyboard.dismiss}
        >
          <View style={styles.content}>
            {/* =========================
                Chat List
            ========================= */}
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(
                _,
                index
              ) => index.toString()}
              renderItem={renderItem}
              contentContainerStyle={
                styles.chatContainer
              }
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={
                false
              }
              ListEmptyComponent={
                <View
                  style={
                    styles.emptyView
                  }
                >
                  <Text
                    style={
                      styles.emptyTitle
                    }
                  >
                    👋 你好！
                  </Text>

                  <Text
                    style={
                      styles.emptySub
                    }
                  >
                    今天想跟我聊聊什麼呢？
                  </Text>
                </View>
              }
            />

            {/* =========================
                Input Area
            ========================= */}
            <View
              style={[
                styles.inputWrapper,
                {
                  paddingBottom:
                    Math.max(
                      insets.bottom,
                      12
                    ),
                },
              ]}
            >
              <View
                style={
                  styles.inputShadowContainer
                }
              >
                <TextInput
                  style={styles.input}
                  value={inputText}
                  onChangeText={
                    setInputText
                  }
                  placeholder={
                    isLoading
                      ? 'AI 正在思考中...'
                      : '輸入訊息...'
                  }
                  placeholderTextColor="#A0A0A0"
                  editable={
                    !isLoading
                  }
                  multiline
                />

                <TouchableOpacity
                  style={[
                    styles.sendButton,
                    (!inputText.trim() ||
                      isLoading) &&
                      styles.disabledButton,
                  ]}
                  onPress={sendMessage}
                  disabled={
                    !inputText.trim() ||
                    isLoading
                  }
                >
                  {isLoading ? (
                    <ActivityIndicator
                      color="#fff"
                      size="small"
                    />
                  ) : (
                    <Text
                      style={
                        styles.sendButtonText
                      }
                    >
                      發送
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* =========================
   Styles
========================= */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F2F5',
  },

  keyboardView: {
    flex: 1,
  },

  content: {
    flex: 1,
  },

  /* Header */
  header: {
    backgroundColor: '#87a8ad',
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent:
      'space-between',
    flexDirection: 'row',

    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 3.84,

    elevation: 5,
  },

  headerInfo: {
    alignItems: 'flex-start',
  },

  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },

  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CD964',
    marginRight: 5,
  },

  statusText: {
    color: '#E0E0E0',
    fontSize: 12,
  },

  clearButton: {
    backgroundColor:
      'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },

  clearButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },

  /* Chat */
  chatContainer: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 20,
    flexGrow: 1,
  },

  messageWrapper: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-end',
  },

  userWrapper: {
    justifyContent: 'flex-end',
  },

  aiWrapper: {
    justifyContent: 'flex-start',
  },

  aiAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#87a8ad',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,

    borderWidth: 1,
    borderColor: '#fff',
  },

  aiAvatarText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },

  bubbleContainer: {
    maxWidth: '80%',
  },

  userContainer: {
    alignItems: 'flex-end',
  },

  aiContainer: {
    alignItems: 'flex-start',
  },

  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,

    elevation: 1,

    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },

  userBubble: {
    backgroundColor: '#87a8ad',
    borderBottomRightRadius: 4,
  },

  aiBubble: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },

  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },

  timeText: {
    fontSize: 10,
    color: '#999',
    marginTop: 4,
    marginHorizontal: 4,
  },

  /* Input */
  inputWrapper: {
    backgroundColor: '#fff',
    paddingTop: 12,
    paddingHorizontal: 12,

    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,

    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -3,
    },
    shadowOpacity: 0.05,
    shadowRadius: 5,

    elevation: 10,
  },

  inputShadowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 25,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: '#EEE',
  },

  input: {
    flex: 1,
    paddingHorizontal: 15,
    paddingVertical: 10,
    minHeight: 40,
    maxHeight: 120,
    color: '#333',
    fontSize: 16,
  },

  sendButton: {
    backgroundColor: '#87a8ad',
    height: 36,
    paddingHorizontal: 18,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 4,
  },

  disabledButton: {
    backgroundColor: '#D1D1D1',
  },

  sendButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },

  /* Empty */
  emptyView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 100,
  },

  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#87a8ad',
    marginBottom: 8,
  },

  emptySub: {
    fontSize: 14,
    color: '#999',
  },
});