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
  Keyboard,
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
  const [userMessageMap, setUserMessageMap] = useState<{[key: string]: string}>({});
  const [eventAddedMessages, setEventAddedMessages] = useState<Set<string>>(new Set());
  const [keyboardHeight, setKeyboardHeight] = useState(0);
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
        
        // Check if this response contains event data
        const jsonMatch = textContent.match(/\{[\s\S]*"Event"[\s\S]*"Time"[\s\S]*"Priority"[\s\S]*"Date"[\s\S]*\}/);
        if (jsonMatch) {
          // Mark this message as having an event added
          setEventAddedMessages(prev => new Set([...prev, message.message.id]));
          parseAndStoreEvent(textContent, message.message.id);
        }
      }
    },
  });

  // Load events from storage on component mount
  useEffect(() => {
    loadEventsFromStorage();
  }, []);

  // Handle keyboard events
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
      }
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
      }
    );

    return () => {
      keyboardDidShowListener?.remove();
      keyboardDidHideListener?.remove();
    };
  }, []);


  // Watch for new assistant messages and check for event data
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'assistant' && !eventAddedMessages.has(lastMessage.id)) {
        const textContent = lastMessage.parts
          .filter((part: any) => part.type === 'text')
          .map((part: any) => part.text)
          .join(' ');
        
        const jsonMatch = textContent.match(/\{[\s\S]*"Event"[\s\S]*"Time"[\s\S]*"Priority"[\s\S]*"Date"[\s\S]*\}/);
        if (jsonMatch) {
          setEventAddedMessages(prev => new Set([...prev, lastMessage.id]));
        }
      }
    }
  }, [messages]); // Removed eventAddedMessages from dependency array to prevent infinite loop

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

  const addEventsToStorage = async (eventsToAdd: CalendarEvent[]) => {
    try {
      // Get existing events from storage
      const existingEventsString = await AsyncStorage.getItem('calendarEvents');
      const existingEvents = existingEventsString ? JSON.parse(existingEventsString) : [];
      
      // Combine existing events with new events
      const allEvents = [...existingEvents, ...eventsToAdd];
      
      // Save the combined events
      await AsyncStorage.setItem('calendarEvents', JSON.stringify(allEvents));
      
      // Update the local state
      setEvents(allEvents);
    } catch (error) {
      console.error('Error adding events to storage:', error);
    }
  };

  const parseAndStoreEvent = (content: string, messageId: string) => {
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
          addEventsToStorage([newEvent]);
          
          // Message ID is already tracked in onFinish callback
        }
      }
    } catch (error) {
      console.error('Error parsing event data:', error);
    }
  };



  const handleSend = () => {
    if (input.trim()) {
      const userInput = input.trim();
      
      // Create enhanced prompt for ChatGPT
      const today = new Date();
      const todayString = today.toISOString().split('T')[0]; // YYYY-MM-DD format
      const enhancedPrompt = `Please analyze this message. If it contains event information (meetings, appointments, tasks with time), respond with JSON format: {"Event": "event name", "Time": "HH:MM format", "Priority": "low", "Date": "YYYY-MM-DD format"}. For dates, use today's date (${todayString}) unless specifically mentioned otherwise. If it's not an event, respond normally as a chat assistant. Original message: ${userInput}`;
      
      // Send the enhanced prompt to ChatGPT
      sendMessage({ text: enhancedPrompt });
      
      // Store the original user input to display instead of the enhanced prompt
      setUserMessageMap(prev => ({ ...prev, [enhancedPrompt]: userInput }));
      
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
        const userInput = transcribedText.trim();
        
        // Check if the transcribed text is too short or insufficient
        const words = userInput.split(/\s+/).filter((word: string) => word.length > 0);
        
        if (words.length === 0) {
          Alert.alert(
            'No Speech Detected', 
            'Try again, long press to record',
            [{ text: 'OK', style: 'default' }]
          );
          return;
        }
        
        if (words.length === 1) {
          Alert.alert(
            'Insufficient Speech', 
            'Try again, long press to record',
            [{ text: 'OK', style: 'default' }]
          );
          return;
        }
        
        // Automatically send the transcribed message
        // Create enhanced prompt for ChatGPT
        const today = new Date();
        const todayString = today.toISOString().split('T')[0]; // YYYY-MM-DD format
        const enhancedPrompt = `Please analyze this message. If it contains event information (meetings, appointments, tasks with time), respond with JSON format: {"Event": "event name", "Time": "HH:MM format", "Priority": "low", "Date": "YYYY-MM-DD format"}. For dates, use today's date (${todayString}) unless specifically mentioned otherwise. If it's not an event, respond normally as a chat assistant. Original message: ${userInput}`;
        
        // Send the enhanced prompt to ChatGPT
        sendMessage({ text: enhancedPrompt });
        
        // Store the original user input to display instead of the enhanced prompt
        setUserMessageMap(prev => ({ ...prev, [enhancedPrompt]: userInput }));
        
        setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
      } else {
        Alert.alert(
          'No Speech Detected', 
          'Try again, long press to record',
          [{ text: 'OK', style: 'default' }]
        );
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
      keyboardVerticalOffset={Platform.OS === 'ios' ? -20 : -20}
    >
      {/* Recording Overlay */}
      {isRecording && (
        <View style={styles.recordingOverlay}>
          <View style={styles.recordingView}>
            <View style={styles.recordingIcon}>
              <Ionicons name="mic" size={40} color="#FF3B30" />
            </View>
            <Text style={styles.recordingText}>Recording...</Text>
            <Text style={styles.recordingSubtext}>Release to stop</Text>
          </View>
        </View>
      )}

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
                        {m.role === 'user' ? (() => {
                          const originalMessage = userMessageMap[part.text];
                          return originalMessage || part.text;
                        })() : (() => {
                          // Check if this specific message had an event added
                          if (m.role === 'assistant' && eventAddedMessages.has(m.id)) {
                            return "Event added! Please check your calendar.";
                          }
                          return part.text;
                        })()}
                      </Text>
                    );
                }
              })}
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={[styles.inputContainer, { paddingBottom: keyboardHeight > 0 ? 40 : 100 }]}>
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
  recordingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  recordingView: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    minWidth: 200,
  },
  recordingIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFE5E5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  recordingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FF3B30',
    marginBottom: 4,
  },
  recordingSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});
