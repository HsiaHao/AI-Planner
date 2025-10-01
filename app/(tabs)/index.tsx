import { generateAPIUrl } from '@/app/utils/utils';
import { useChat } from '@ai-sdk/react';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { DefaultChatTransport } from 'ai';
import { fetch as expoFetch } from 'expo/fetch';
import { useState, useRef } from 'react';
import { 
  ScrollView, 
  Text, 
  TextInput, 
  View, 
  TouchableOpacity, 
  StyleSheet, 
  ActivityIndicator,
  Alert,
  Platform 
} from 'react-native';

export default function App() {
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const recording = useRef<Audio.Recording | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  const { messages, error, sendMessage } = useChat({
    transport: new DefaultChatTransport({
      fetch: expoFetch as unknown as typeof globalThis.fetch,
      api: generateAPIUrl('/api/chat'),
    }),
    onError: error => console.error(error, 'ERROR'),
  });

  const handleSend = () => {
    if (input.trim()) {
      sendMessage({ text: input });
      setInput('');
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const startRecording = async () => {
    try {
      console.log('Requesting permissions..');
      const { granted } = await Audio.requestPermissionsAsync();
      
      if (!granted) {
        Alert.alert('Permission Required', 'Please allow microphone access to use voice input.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      console.log('Starting recording..');
      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recording.current = newRecording;
      setIsRecording(true);
      console.log('Recording started');
    } catch (err) {
      console.error('Failed to start recording', err);
      Alert.alert('Error', 'Failed to start recording. Please try again.');
    }
  };

  const stopRecording = async () => {
    console.log('Stopping recording..');
    if (!recording.current) return;

    try {
      setIsRecording(false);
      await recording.current.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });
      
      const uri = recording.current.getURI();
      recording.current = null;
      console.log('Recording stopped and stored at', uri);

      if (uri) {
        await transcribeAudio(uri);
      }
    } catch (err) {
      console.error('Failed to stop recording', err);
      Alert.alert('Error', 'Failed to process recording. Please try again.');
    }
  };

  const transcribeAudio = async (uri: string) => {
    setIsTranscribing(true);
    try {
      console.log('Starting transcription for URI:', uri);
      
      // Create FormData for our server endpoint
      const formData = new FormData();
      
      // For React Native, we need to create the file object differently
      const audioFile = {
        uri: uri,
        type: 'audio/m4a',
        name: 'recording.m4a',
      } as any;
      
      formData.append('file', audioFile);

      console.log('FormData created, making API request to server...');
      
      const response = await fetch(generateAPIUrl('/api/transcribe'), {
        method: 'POST',
        body: formData,
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Server Error Response:', errorText);
        throw new Error(`Transcription failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Transcription result:', data);
      
      const transcribedText = data.text;
      
      if (transcribedText) {
        setInput(transcribedText);
        Alert.alert('Success', 'Voice message transcribed successfully!');
      } else {
        Alert.alert('Warning', 'No text was transcribed from the audio.');
      }
    } catch (err) {
      console.error('Failed to transcribe audio', err);
      Alert.alert('Error', `Failed to transcribe audio: ${err.message}. Please try again or type your message.`);
    } finally {
      setIsTranscribing(false);
    }
  };

  if (error) return <Text style={styles.error}>{error.message}</Text>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>AI Chat Assistant</Text>
      </View>

      <ScrollView 
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
      >
        {messages.map(m => (
          <View 
            key={m.id} 
            style={[
              styles.messageRow,
              m.role === 'user' ? styles.userMessageRow : styles.assistantMessageRow
            ]}
          >
            <View 
              style={[
                styles.messageBubble,
                m.role === 'user' ? styles.userBubble : styles.assistantBubble
              ]}
            >
              <Text style={styles.roleLabel}>{m.role === 'user' ? 'You' : 'Assistant'}</Text>
              {m.parts.map((part, i) => {
                switch (part.type) {
                  case 'text':
                    return (
                      <Text 
                        key={`${m.id}-${i}`} 
                        style={[
                          styles.messageText,
                          m.role === 'user' ? styles.userMessageText : styles.assistantMessageText
                        ]}
                      >
                        {part.text}
                      </Text>
                    );
                }
              })}
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.inputContainer}>
        {isTranscribing && (
          <View style={styles.transcribingIndicator}>
            <ActivityIndicator size="small" color="#007AFF" />
            <Text style={styles.transcribingText}>Transcribing...</Text>
          </View>
        )}
        
        <View style={styles.inputRow}>
          <TouchableOpacity
            style={[styles.recordButton, isRecording && styles.recordingActive]}
            onPressIn={startRecording}
            onPressOut={stopRecording}
            disabled={isTranscribing}
          >
            <Ionicons 
              name={isRecording ? "mic" : "mic-outline"} 
              size={24} 
              color={isRecording ? "#FF3B30" : "#007AFF"} 
            />
          </TouchableOpacity>

          <TextInput
            style={styles.textInput}
            placeholder="Type a message or hold mic to record..."
            placeholderTextColor="#999"
            value={input}
            onChangeText={setInput}
            onSubmitEditing={handleSend}
            multiline
            maxLength={1000}
            editable={!isTranscribing}
          />

          <TouchableOpacity
            style={[styles.sendButton, !input.trim() && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!input.trim() || isTranscribing}
          >
            <Ionicons 
              name="send" 
              size={20} 
              color={input.trim() ? "#007AFF" : "#CCC"} 
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 15,
    paddingHorizontal: 16,
    backgroundColor: '#007AFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
    textAlign: 'center',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 8,
  },
  messageRow: {
    marginBottom: 12,
    flexDirection: 'row',
  },
  userMessageRow: {
    justifyContent: 'flex-end',
  },
  assistantMessageRow: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  userBubble: {
    backgroundColor: '#007AFF',
  },
  assistantBubble: {
    backgroundColor: '#FFF',
  },
  roleLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
    opacity: 0.7,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  userMessageText: {
    color: '#FFF',
  },
  assistantMessageText: {
    color: '#000',
  },
  inputContainer: {
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
  },
  transcribingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  transcribingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recordButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingActive: {
    backgroundColor: '#FFE5E5',
  },
  textInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    backgroundColor: '#F8F8F8',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    color: '#000',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  error: {
    color: '#FF3B30',
    textAlign: 'center',
    padding: 20,
    fontSize: 16,
  },
});
