import { generateAPIUrl } from '@/utils';
import { useChat } from '@ai-sdk/react';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DefaultChatTransport } from 'ai';
import { Audio } from 'expo-av';
import { fetch as expoFetch } from 'expo/fetch';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

interface CalendarEvent {
  id: string;
  event: string;
  time: string;
  priority: 'low' | 'medium' | 'high';
  date: string;
  timestamp: number;
}

export default function Chat() {
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const recording = useRef<Audio.Recording | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  const { messages, error, sendMessage } = useChat({
    transport: new DefaultChatTransport({
      fetch: expoFetch as unknown as typeof globalThis.fetch,
      api: generateAPIUrl('/api/chat'),
    }),
    onError: error => console.error(error, 'ERROR'),
    onFinish: (message) => {
      // Check if the message contains event information and parse it
      if (message.message && message.message.parts && message.message.parts.length > 0) {
        const textContent = message.message.parts
          .filter((part: any) => part.type === 'text')
          .map((part: any) => part.text)
          .join(' ');
        parseAndStoreEvent(textContent);
      }
    },
  });

  // Load events from storage on component mount
  useEffect(() => {
    loadEventsFromStorage();
  }, []);

  const loadEventsFromStorage = async () => {
    try {
      const storedEvents = await AsyncStorage.getItem('calendarEvents');
      if (storedEvents) {
        setEvents(JSON.parse(storedEvents));
      }
    } catch (error) {
      console.error('Error loading events from storage:', error);
    }
  };

  const saveEventsToStorage = async (newEvents: CalendarEvent[]) => {
    try {
      await AsyncStorage.setItem('calendarEvents', JSON.stringify(newEvents));
    } catch (error) {
      console.error('Error saving events to storage:', error);
    }
  };

  const parseAndStoreEvent = (content: string) => {
    try {
      // Look for JSON format in the response
      const jsonMatch = content.match(/\{[\s\S]*"Event"[\s\S]*"Time"[\s\S]*"Priority"[\s\S]*"Date"[\s\S]*\}/);
      
      if (jsonMatch) {
        const eventData = JSON.parse(jsonMatch[0]);
        
        if (eventData.Event && eventData.Time && eventData.Priority && eventData.Date) {
          const newEvent: CalendarEvent = {
            id: Date.now().toString(),
            event: eventData.Event,
            time: eventData.Time,
            priority: eventData.Priority.toLowerCase() || 'low',
            date: eventData.Date, // Use the date from ChatGPT response
            timestamp: Date.now(),
          };

          // console.log('New event created:', newEvent);
          const updatedEvents = [...events, newEvent];
          // console.log('All events after adding:', updatedEvents);
          saveEventsToStorage(updatedEvents);
          
          Alert.alert(
            'Event Added!', 
            `Event "${newEvent.event}" at ${newEvent.time} on ${newEvent.date} has been added to your calendar.`,
            [{ text: 'OK' }]
          );
        }
      }
    } catch (error) {
      console.error('Error parsing event data:', error);
    }
  };


  const handleSend = () => {
    if (input.trim()) {
      // Always treat input as potential event - let ChatGPT decide how to respond
      const today = new Date();
      const todayString = today.toISOString().split('T')[0]; // YYYY-MM-DD format
      const messageToSend = `Please analyze this message. If it contains event information (meetings, appointments, tasks with time), respond with JSON format: {"Event": "event name", "Time": "HH:MM format", "Priority": "low", "Date": "YYYY-MM-DD format"}. For dates, use today's date (${todayString}) unless specifically mentioned otherwise. If it's not an event, respond normally as a chat assistant. Original message: ${input}`;
      
      sendMessage({ text: messageToSend });
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
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      Alert.alert('Error', `Failed to transcribe audio: ${errorMessage}. Please try again or type your message.`);
    } finally {
      setIsTranscribing(false);
    }
  };

  if (error) return <Text style={styles.error}>{error.message}</Text>;

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
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
          <TextInput
            style={styles.textInput}
            placeholder="Type a message or hold button to record..."
            placeholderTextColor="#999"
            value={input}
            onChangeText={setInput}
            onSubmitEditing={handleSend}
            multiline
            maxLength={1000}
            editable={!isTranscribing}
          />

          <TouchableOpacity
            style={[
              styles.smartButton, 
              isRecording && styles.recordingActive,
              !input.trim() && styles.recordButtonState
            ]}
            onPress={input.trim() ? handleSend : undefined}
            onPressIn={!input.trim() ? startRecording : undefined}
            onPressOut={!input.trim() ? stopRecording : undefined}
            disabled={isTranscribing}
          >
            <Ionicons 
              name={
                isRecording 
                  ? "mic" 
                  : input.trim() 
                    ? "send" 
                    : "mic-outline"
              } 
              size={24} 
              color={
                isRecording 
                  ? "#FF3B30" 
                  : input.trim() 
                    ? "#007AFF" 
                    : "#007AFF"
              } 
            />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E4E3DA',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 15,
    paddingHorizontal: 16,
    backgroundColor: '#E4E3DA',
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
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
  },
  messagesContent: {
    padding: 8,
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
    backgroundColor: '#E4E3DA',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    paddingBottom: Platform.OS === 'ios' ? 100 : 100, // Account for floating tab bar (60px height + 20px margin + extra padding)
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
  smartButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E4E3DA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingActive: {
    backgroundColor: '#FFE5E5',
  },
  recordButtonState: {
    backgroundColor: '#E4E3DA',
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
  error: {
    color: '#FF3B30',
    textAlign: 'center',
    padding: 20,
    fontSize: 16,
  },
});
