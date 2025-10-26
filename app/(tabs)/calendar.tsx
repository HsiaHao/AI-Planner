import { generateAPIUrl } from '@/utils';
import { useChat } from '@ai-sdk/react';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { DefaultChatTransport } from 'ai';
import { fetch as expoFetch } from 'expo/fetch';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { PanGestureHandler, State } from 'react-native-gesture-handler';

interface CalendarEvent {
  id: string;
  event: string;
  time: string;
  priority: 'low' | 'medium' | 'high';
  date: string;
  timestamp: number;
}

export default function Calendar() {
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - dayOfWeek);
    return startOfWeek;
  });
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('week');
  const [currentDay, setCurrentDay] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date()); // For month view event display
  const [swipedEventId, setSwipedEventId] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null); // For week view event selection
  const [isEditMode, setIsEditMode] = useState(false); // For edit mode in action view
  const [editedEventName, setEditedEventName] = useState('');
  const [editedEventTime, setEditedEventTime] = useState('');
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedTime, setSelectedTime] = useState(new Date());
  const [showAddBottomSheet, setShowAddBottomSheet] = useState(false); // For add event bottom sheet
  const [chatInput, setChatInput] = useState(''); // For chat input in bottom sheet
  const [eventAddedMessages, setEventAddedMessages] = useState<Set<string>>(new Set());
  const [eventDetailsMap, setEventDetailsMap] = useState<{[key: string]: {event: string, time: string, date: string}}>({});
  const [userMessageMap, setUserMessageMap] = useState<{[key: string]: string}>({});
  const [chatSessionId, setChatSessionId] = useState(0);
  const bottomSheetScrollRef = useRef<ScrollView>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const daySlideAnim = useRef(new Animated.Value(0)).current;
  const monthSlideAnim = useRef(new Animated.Value(0)).current;
  const eventSwipeAnims = useRef<{[key: string]: Animated.Value}>({}).current;
  const bottomSheetSlideAnim = useRef(new Animated.Value(0)).current;

  // Chat functionality
  const { messages, sendMessage } = useChat({
    id: `chat-session-${chatSessionId}`,
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

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  // Calendar cell colors - all using white background
  const dayColors = [
    '#FFFFFF', // White background
    '#FFFFFF', // White background
    '#FFFFFF', // White background
    '#FFFFFF', // White background
    '#FFFFFF', // White background
    '#FFFFFF', // White background
    '#FFFFFF', // White background
  ];

  const getWeekDates = () => {
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentWeekStart);
      date.setDate(currentWeekStart.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  const getMonthDates = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    // Get first day of the month
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    // Get the starting date (might be from previous month)
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    const dates = [];
    const currentDate = new Date(startDate);
    
    // Generate 42 days (6 weeks) to fill the calendar grid
    for (let i = 0; i < 42; i++) {
      dates.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return dates;
  };

  const goToCurrentDate = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - dayOfWeek);
    setCurrentWeekStart(startOfWeek);
    setCurrentDay(today);
    setCurrentMonth(today);
    setSelectedDate(today); // Also select today's date in month view
  };

  const navigateDay = (direction: 'prev' | 'next') => {
    // Set initial slide position based on direction
    const slideDistance = direction === 'next' ? 300 : -300;
    daySlideAnim.setValue(slideDistance);
    
    // Update the day
    const newDay = new Date(currentDay);
    newDay.setDate(currentDay.getDate() + (direction === 'next' ? 1 : -1));
    setCurrentDay(newDay);
    
    // Animate slide to center
    Animated.timing(daySlideAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    // Set initial slide position based on direction
    const slideDistance = direction === 'next' ? 300 : -300;
    monthSlideAnim.setValue(slideDistance);
    
    // Update the month
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(currentMonth.getMonth() + (direction === 'next' ? 1 : -1));
    setCurrentMonth(newMonth);
    
    // Animate slide to center
    Animated.timing(monthSlideAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const handleViewModeChange = (newViewMode: 'month' | 'week' | 'day') => {
    // Fade out animation
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      // Change view mode
      setViewMode(newViewMode);
      // Fade in animation
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start();
    });
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    // Only animate if we're in week view
    if (viewMode === 'week') {
      // Set initial slide position based on direction
      // Right button (next): slide from right to left (start at +300, end at 0)
      // Left button (prev): slide from left to right (start at -300, end at 0)
      const slideDistance = direction === 'next' ? 300 : -300;
      slideAnim.setValue(slideDistance);
      
      // Update the week
      const newWeekStart = new Date(currentWeekStart);
      newWeekStart.setDate(currentWeekStart.getDate() + (direction === 'next' ? 7 : -7));
      setCurrentWeekStart(newWeekStart);
      
      // Animate slide to center
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      // For other views, just update without animation
      const newWeekStart = new Date(currentWeekStart);
      newWeekStart.setDate(currentWeekStart.getDate() + (direction === 'next' ? 7 : -7));
      setCurrentWeekStart(newWeekStart);
    }
  };

  const formatDate = (date: Date) => {
    const dayName = dayNames[date.getDay()];
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const day = date.getDate();
    return { dayName, month, day };
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isCurrentDay = () => {
    const today = new Date();
    return currentDay.toDateString() === today.toDateString();
  };

  const isCurrentWeek = () => {
    const today = new Date();
    const todayWeekStart = new Date(today);
    todayWeekStart.setDate(today.getDate() - today.getDay());
    
    return currentWeekStart.toDateString() === todayWeekStart.toDateString();
  };

  const isTodayVisibleInMonth = () => {
    const today = new Date();
    return today.getMonth() === currentMonth.getMonth() && today.getFullYear() === currentMonth.getFullYear();
  };

  const weekDates = getWeekDates();

  // Load events from storage when component mounts or week changes
  useEffect(() => {
    loadEventsFromStorage();
  }, []);

  // Refresh events when component becomes focused (user switches to this tab)
  useEffect(() => {
    const refreshEvents = () => {
      loadEventsFromStorage();
    };

    // Refresh events every time the component is focused
    const interval = setInterval(refreshEvents, 2000); // Check every 2 seconds
    
    return () => clearInterval(interval);
  }, []);

  // Reset chat state when bottom sheet closes
  useEffect(() => {
    if (!showAddBottomSheet) {
      setChatInput('');
      setEventAddedMessages(new Set());
      setEventDetailsMap({});
      setUserMessageMap({});
      // Increment session ID to create a new chat session next time
      setChatSessionId(prev => prev + 1);
    }
  }, [showAddBottomSheet]);

  // Animate bottom sheet slide up/down
  useEffect(() => {
    if (showAddBottomSheet) {
      // Slide up animation
      Animated.spring(bottomSheetSlideAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      // Slide down animation
      Animated.timing(bottomSheetSlideAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [showAddBottomSheet]);

  const loadEventsFromStorage = async () => {
    try {
      const storedEvents = await AsyncStorage.getItem('calendarEvents');
      console.log('Stored events from storage:', storedEvents);
      if (storedEvents) {
        const parsedEvents = JSON.parse(storedEvents);
        console.log('Parsed events:', parsedEvents);
        setEvents(parsedEvents);
      }
    } catch (error) {
      console.error('Error loading events from storage:', error);
    }
  };

  const deleteEvent = async (eventId: string) => {
    try {
      const updatedEvents = events.filter(event => event.id !== eventId);
      await AsyncStorage.setItem('calendarEvents', JSON.stringify(updatedEvents));
      setEvents(updatedEvents);
      console.log('Event deleted successfully');
    } catch (error) {
      console.error('Error deleting event:', error);
      Alert.alert('Error', 'Failed to delete event. Please try again.');
    }
  };

  const handleDeleteEvent = (eventId: string, eventTitle: string) => {
    Alert.alert(
      'Delete Event',
      `Are you sure you want to delete "${eventTitle}"?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => {
            // Reset swipe animation
            if (eventSwipeAnims[eventId]) {
              Animated.spring(eventSwipeAnims[eventId], {
                toValue: 0,
                useNativeDriver: true,
              }).start();
            }
            setSwipedEventId(null);
          }
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteEvent(eventId);
            setSwipedEventId(null);
          }
        }
      ]
    );
  };

  const handleWeekViewDelete = (event: CalendarEvent) => {
    Alert.alert(
      'Delete Event',
      `Are you sure you want to delete "${event.event}"?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => {
            setSelectedEvent(null);
            setIsEditMode(false);
          }
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteEvent(event.id);
            setSelectedEvent(null);
            setIsEditMode(false);
          }
        }
      ]
    );
  };

  const handleWeekViewEdit = (event: CalendarEvent) => {
    setEditedEventName(event.event);
    setEditedEventTime(event.time);
    
    // Parse the time string (HH:MM) and set selectedTime
    const [hours, minutes] = event.time.split(':').map(Number);
    const timeDate = new Date();
    timeDate.setHours(hours || 0, minutes || 0, 0, 0);
    setSelectedTime(timeDate);
    
    setIsEditMode(true);
    setShowTimePicker(true); // Show time picker immediately when entering edit mode
  };

  const formatDateString = (dateString: string): string => {
    try {
      // Parse the date string directly to avoid timezone issues
      const [year, month, day] = dateString.split('-').map(Number);
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${monthNames[month - 1]} ${day}`;
    } catch (error) {
      return dateString;
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
            date: eventData.Date,
            timestamp: Date.now(),
          };

          // Add event to storage
          addEventsToStorage([newEvent]);
          
          // Store event details for displaying in the message
          setEventDetailsMap(prev => ({
            ...prev,
            [messageId]: {
              event: eventData.Event,
              time: eventData.Time,
              date: eventData.Date
            }
          }));

          // Keep the bottom sheet open for further event creation
          setChatInput('');
        }
      }
    } catch (error) {
      console.error('Error parsing event data:', error);
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

  const handleChatSend = () => {
    if (chatInput.trim()) {
      const userInput = chatInput.trim();
      
      // Create enhanced prompt for ChatGPT
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const todayString = `${year}-${month}-${day}`; // YYYY-MM-DD format using local date
      const enhancedPrompt = `Please analyze this message. If it contains event information (meetings, appointments, tasks with time), respond with JSON format: {"Event": "event name", "Time": "HH:MM format", "Priority": "low", "Date": "YYYY-MM-DD format"}. For dates, use today's date (${todayString}) unless specifically mentioned otherwise. If it's not an event, respond normally as a chat assistant. Original message: ${userInput}`;
      
      // Send the enhanced prompt to ChatGPT
      sendMessage({ text: enhancedPrompt });
      
      // Store the original user input to display instead of the enhanced prompt
      setUserMessageMap(prev => ({ ...prev, [enhancedPrompt]: userInput }));
      
      setChatInput('');
      setTimeout(() => bottomSheetScrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const saveEditedEvent = async () => {
    if (!selectedEvent) return;
    
    if (!editedEventName.trim()) {
      Alert.alert('Error', 'Event name cannot be empty');
      return;
    }
    
    if (!editedEventTime.trim()) {
      Alert.alert('Error', 'Event time cannot be empty');
      return;
    }

    try {
      const updatedEvents = events.map(event => 
        event.id === selectedEvent.id 
          ? { ...event, event: editedEventName, time: editedEventTime }
          : event
      );
      await AsyncStorage.setItem('calendarEvents', JSON.stringify(updatedEvents));
      setEvents(updatedEvents);
      setIsEditMode(false);
      setSelectedEvent(null);
      setShowTimePicker(false);
      console.log('Event updated successfully');
    } catch (error) {
      console.error('Error updating event:', error);
      Alert.alert('Error', 'Failed to update event. Please try again.');
    }
  };

  // Get events for a specific date
  const getEventsForDate = (date: Date) => {
    // Use local date formatting to avoid timezone issues
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;
    const dayEvents = events.filter(event => event.date === dateString);
    console.log(`Events for ${dateString}:`, dayEvents);
    return dayEvents;
  };

  // Determine which time slot an event belongs to based on time
  const getTimeSlot = (time: string): 'morning' | 'afternoon' | 'night' => {
    const hour = parseInt(time.split(':')[0]);
    if (hour < 12) return 'morning';
    if (hour < 18) return 'afternoon';
    return 'night';
  };

  // Get priority color
  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'high': return '#FF6B6B';
      case 'medium': return '#FFD93D';
      case 'low': return '#6BCF7F';
      default: return '#6BCF7F';
    }
  };

  // Get slightly darker version of background color for event labels
  const getLighterColor = (color: string) => {
    // Convert hex to RGB and decrease lightness slightly for contrast
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    // Decrease each RGB value by 20 to make it slightly darker
    const newR = Math.max(0, r - 20);
    const newG = Math.max(0, g - 20);
    const newB = Math.max(0, b - 20);
    
    return `rgb(${newR}, ${newG}, ${newB})`;
  };

  // Find the nearest event to current time
  const getNearestEventTime = (date: Date = new Date()) => {
    const now = new Date();
    const currentTime = now.getHours() * 100 + now.getMinutes(); // Convert to HHMM format
    
    const dayEvents = getEventsForDate(date);
    if (dayEvents.length === 0) return null;
    
    // Sort events by time and find the nearest upcoming event
    const sortedEvents = dayEvents.sort((a, b) => {
      const timeA = parseInt(a.time.replace(':', ''));
      const timeB = parseInt(b.time.replace(':', ''));
      return timeA - timeB;
    });
    
    // Find the next upcoming event
    const upcomingEvent = sortedEvents.find(event => {
      const eventTime = parseInt(event.time.replace(':', ''));
      return eventTime >= currentTime;
    });
    
    // If no upcoming event, return the last event of the day
    return upcomingEvent ? upcomingEvent.time : sortedEvents[sortedEvents.length - 1].time;
  };

  return (
    <View style={styles.container}>
      <View style={[styles.weekNavigation, (viewMode === 'day' || viewMode === 'week') && styles.dayNavigation]}>
      </View>

      {/* Floating Today button for month view */}
      {viewMode === 'month' && !showAddBottomSheet && (
        <TouchableOpacity 
          style={[
            styles.floatingTodayButton,
            { backgroundColor: isTodayVisibleInMonth() ? '#9DC8B9' : '#E4E3DA' }
          ]} 
          onPress={goToCurrentDate}
        >
          <Text style={styles.todayButtonText}>Today</Text>
        </TouchableOpacity>
      )}

      {/* Floating Today button for week view */}
      {viewMode === 'week' && !selectedEvent && !showAddBottomSheet && (
        <TouchableOpacity 
          style={[
            styles.floatingTodayButtonWeek,
            { backgroundColor: isCurrentWeek() ? '#9DC8B9' : '#E4E3DA' }
          ]} 
          onPress={goToCurrentDate}
        >
          <Text style={styles.todayButtonText}>Today</Text>
        </TouchableOpacity>
      )}

      {/* Floating Today button for day view */}
      {viewMode === 'day' && !showAddBottomSheet && (
        <TouchableOpacity 
          style={[
            styles.floatingTodayButtonDay,
            { backgroundColor: isCurrentDay() ? '#9DC8B9' : '#E4E3DA' }
          ]} 
          onPress={goToCurrentDate}
        >
          <Text style={styles.todayButtonText}>Today</Text>
        </TouchableOpacity>
      )}

      {/* Floating Add button - middle bottom */}
      {!selectedEvent && !showAddBottomSheet && (
        <TouchableOpacity 
          style={styles.floatingAddButton}
          onPress={() => setShowAddBottomSheet(true)}
        >
          <Ionicons name="add" size={32} color="#FFFFFF" />
        </TouchableOpacity>
      )}

      {/* View Mode Navigation */}
      <View style={styles.viewModeNav}>
        <TouchableOpacity 
          style={[styles.viewModeButton, viewMode === 'day' && styles.viewModeButtonActive]}
          onPress={() => handleViewModeChange('day')}
        >
          <Text style={[styles.viewModeText, viewMode === 'day' && styles.viewModeTextActive]}>
            Day
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.viewModeButton, viewMode === 'week' && styles.viewModeButtonActive]}
          onPress={() => handleViewModeChange('week')}
        >
          <Text style={[styles.viewModeText, viewMode === 'week' && styles.viewModeTextActive]}>
            Week
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.viewModeButton, viewMode === 'month' && styles.viewModeButtonActive]}
          onPress={() => handleViewModeChange('month')}
        >
          <Text style={[styles.viewModeText, viewMode === 'month' && styles.viewModeTextActive]}>
            Month
          </Text>
        </TouchableOpacity>
      </View>

      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        {viewMode === 'day' ? (
          <PanGestureHandler
            onHandlerStateChange={(event) => {
              if (event.nativeEvent.state === State.END) {
                const { translationX } = event.nativeEvent;
                if (Math.abs(translationX) > 50) {
                  if (translationX > 0) {
                    navigateDay('prev');
                  } else {
                    navigateDay('next');
                  }
                }
              }
            }}
          >
            <Animated.View style={[styles.dayViewContainer, { transform: [{ translateX: daySlideAnim }] }]}>
              <Text style={styles.dayViewTitle}>
                {formatDate(currentDay).dayName} {formatDate(currentDay).day} {formatDate(currentDay).month}
              </Text>
              <ScrollView style={styles.dayEventsContainer}>
                {getEventsForDate(currentDay).length > 0 ? (
                  getEventsForDate(currentDay)
                    .sort((a, b) => {
                      // Convert time strings to comparable format (HH:MM)
                      const timeA = a.time.replace(':', '');
                      const timeB = b.time.replace(':', '');
                      return parseInt(timeA) - parseInt(timeB);
                    })
                    .map((event, index, array) => {
                      const nearestEventTime = getNearestEventTime(currentDay);
                      const isToday = currentDay.toDateString() === new Date().toDateString();
                      const isNearestEvent = isToday && nearestEventTime === event.time;
                      
                      // Check if we need to add a divider before this event
                      const currentHour = parseInt(event.time.split(':')[0]);
                      const show12pmDivider = currentHour >= 12 && index > 0 && 
                        parseInt(array[index - 1].time.split(':')[0]) < 12;
                      const show6pmDivider = currentHour >= 18 && index > 0 && 
                        parseInt(array[index - 1].time.split(':')[0]) < 18;
                      
                      return (
                        <View key={event.id}>
                          {show12pmDivider && (
                            <View style={styles.timeDivider}>
                              <View style={styles.timeDividerLine} />
                              <Text style={styles.timeDividerLabel}>12:00 PM</Text>
                              <View style={styles.timeDividerLine} />
                            </View>
                          )}
                          {show6pmDivider && (
                            <View style={styles.timeDivider}>
                              <View style={styles.timeDividerLine} />
                              <Text style={styles.timeDividerLabel}>6:00 PM</Text>
                              <View style={styles.timeDividerLine} />
                            </View>
                          )}
                          <View style={styles.eventItemContainer}>
                            {/* Delete button (hidden behind the event) */}
                            <View style={styles.deleteButtonContainer}>
                              <TouchableOpacity
                                style={styles.deleteButton}
                                onPress={() => handleDeleteEvent(event.id, event.event)}
                              >
                                <Text style={styles.deleteButtonText}>Delete</Text>
                              </TouchableOpacity>
                            </View>
                            
                            {/* Swipeable event item */}
                            <PanGestureHandler
                              onHandlerStateChange={(gestureEvent) => {
                                if (gestureEvent.nativeEvent.state === State.END) {
                                  const { translationX, velocityX } = gestureEvent.nativeEvent;
                                  
                                  // Initialize animation value if not exists
                                  if (!eventSwipeAnims[event.id]) {
                                    eventSwipeAnims[event.id] = new Animated.Value(0);
                                  }
                                  
                                  // Determine if we should show delete button
                                  if (translationX < -50 || velocityX < -500) {
                                    // Show delete button
                                    Animated.spring(eventSwipeAnims[event.id], {
                                      toValue: -80,
                                      useNativeDriver: true,
                                    }).start();
                                    setSwipedEventId(event.id);
                                  } else {
                                    // Hide delete button
                                    Animated.spring(eventSwipeAnims[event.id], {
                                      toValue: 0,
                                      useNativeDriver: true,
                                    }).start();
                                    setSwipedEventId(null);
                                  }
                                }
                              }}
                              onGestureEvent={(gestureEvent) => {
                                const { translationX } = gestureEvent.nativeEvent;
                                
                                // Initialize animation value if not exists
                                if (!eventSwipeAnims[event.id]) {
                                  eventSwipeAnims[event.id] = new Animated.Value(0);
                                }
                                
                                // Only allow left swipe (negative translationX)
                                if (translationX < 0) {
                                  eventSwipeAnims[event.id].setValue(Math.max(translationX, -80));
                                }
                              }}
                            >
                              <Animated.View 
                                style={[
                                  styles.dayEventItem,
                                  {
                                    transform: [
                                      {
                                        translateX: eventSwipeAnims[event.id] || new Animated.Value(0)
                                      }
                                    ]
                                  }
                                ]}
                              >
                                <View style={styles.dayEventTime}>
                                  {isNearestEvent && <View style={styles.nearestEventCircle} />}
                                  <Text style={styles.dayEventTimeText}>{event.time}</Text>
                                </View>
                                <View style={styles.dayEventContent}>
                                  <Text style={styles.dayEventTitle}>{event.event}</Text>
                                  <Text style={styles.dayEventPriority}>Priority: {event.priority}</Text>
                                </View>
                              </Animated.View>
                            </PanGestureHandler>
                          </View>
                        </View>
                      );
                    })
                ) : (
                  <View style={styles.noEventsContainer}>
                    <Text style={styles.noEventsText}>No events scheduled for this day</Text>
                  </View>
                )}
              </ScrollView>
            </Animated.View>
          </PanGestureHandler>
        ) : viewMode === 'month' ? (
          <PanGestureHandler
            onHandlerStateChange={(event) => {
              if (event.nativeEvent.state === State.END) {
                const { translationX } = event.nativeEvent;
                if (Math.abs(translationX) > 50) {
                  if (translationX > 0) {
                    navigateMonth('prev');
                  } else {
                    navigateMonth('next');
                  }
                }
              }
            }}
          >
            <Animated.View style={[styles.monthViewContainer, { transform: [{ translateX: monthSlideAnim }] }]}>
              <Text style={styles.monthViewTitle}>
                {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </Text>
              
              {/* Calendar Grid */}
              <View style={styles.calendarGrid}>
                {/* Day headers */}
                <View style={styles.dayHeaders}>
                  {dayNames.map((dayName) => (
                    <Text key={dayName} style={styles.dayHeaderText}>
                      {dayName}
                    </Text>
                  ))}
                </View>
                
                {/* Calendar dates */}
                <View style={styles.calendarDates}>
                  {getMonthDates().map((date, index) => {
                    const isCurrentMonth = date.getMonth() === currentMonth.getMonth();
                    const isToday = date.toDateString() === new Date().toDateString();
                    const hasEvents = getEventsForDate(date).length > 0;
                    const isSelected = date.toDateString() === selectedDate.toDateString();
                    const isTodayAndSelected = isToday && isSelected;
                    
                    return (
                      <TouchableOpacity
                        key={index}
                        style={[
                          styles.calendarDate,
                          !isCurrentMonth && styles.calendarDateOtherMonth,
                          isTodayAndSelected && styles.calendarDateTodaySelected,
                          !isTodayAndSelected && isToday && styles.calendarDateToday,
                          !isTodayAndSelected && isSelected && styles.calendarDateSelected
                        ]}
                        onPress={() => {
                          setSelectedDate(date);
                        }}
                      >
                        {isTodayAndSelected ? (
                          <>
                            {/* Half circle with green (left half) */}
                            <View style={styles.halfCircleLeft} />
                            {/* Half circle with yellow (right half) */}
                            <View style={styles.halfCircleRight} />
                          </>
                        ) : null}
                        <Text style={[
                          styles.calendarDateText,
                          !isCurrentMonth && styles.calendarDateTextOtherMonth,
                          isToday && styles.calendarDateTextToday,
                          isSelected && styles.calendarDateTextSelected
                        ]}>
                          {date.getDate()}
                        </Text>
                        {hasEvents && <View style={styles.eventDot} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Events Section for Selected Date */}
              <View style={styles.monthEventsSection}>
                <Text style={styles.monthEventsTitle}>
                  {selectedDate.toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </Text>
                <ScrollView 
                  style={styles.monthEventsContainer}
                  showsVerticalScrollIndicator={true}
                  nestedScrollEnabled={true}
                >
                  {getEventsForDate(selectedDate).length > 0 ? (
                    getEventsForDate(selectedDate)
                      .sort((a, b) => {
                        const timeA = a.time.replace(':', '');
                        const timeB = b.time.replace(':', '');
                        return parseInt(timeA) - parseInt(timeB);
                      })
                      .map((event) => (
                        <View key={event.id} style={styles.monthEventItem}>
                          <View style={styles.monthEventTime}>
                            <Text style={styles.monthEventTimeText}>{event.time}</Text>
                          </View>
                          <View style={styles.monthEventContent}>
                            <Text style={styles.monthEventTitle}>{event.event}</Text>
                            <Text style={styles.monthEventPriority}>Priority: {event.priority}</Text>
                          </View>
                        </View>
                      ))
                  ) : (
                    <View style={styles.monthNoEventsContainer}>
                      <Text style={styles.monthNoEventsText}>No events scheduled for this day</Text>
                    </View>
                  )}
                </ScrollView>
              </View>
            </Animated.View>
          </PanGestureHandler>
        ) : (
          <PanGestureHandler
            onHandlerStateChange={(event) => {
              if (event.nativeEvent.state === State.END) {
                const { translationX } = event.nativeEvent;
                if (Math.abs(translationX) > 50) {
                  if (translationX > 0) {
                    navigateWeek('prev');
                  } else {
                    navigateWeek('next');
                  }
                }
              }
            }}
          >
            <Animated.View style={[styles.calendarContainer, { transform: [{ translateX: slideAnim }] }]}>
              <ScrollView style={{ flex: 1 }}>
              {weekDates.map((date, index) => (
            <View 
              key={index} 
              style={[
                styles.dayRow,
                { backgroundColor: dayColors[index] }
              ]}
            >
              <View style={styles.calendarRow}>
                {/* Date Column */}
                <View style={styles.dateColumn}>
                  {isToday(date) && <View style={styles.todayCircle} />}
                  <View style={styles.dateHeader}>
                  </View>
                  <Text style={[styles.dayName, styles.whiteText]}>
                    {formatDate(date).dayName}
                  </Text>
                  <Text style={[styles.dayDate, styles.whiteText]}>
                    {formatDate(date).day}
                  </Text>
                  <Text style={[styles.monthText, styles.whiteText]}>
                    {formatDate(date).month}
                  </Text>
                </View>
                
                {/* Divider */}
                <View style={styles.columnDivider} />
                
                {/* Morning Column */}
                <View style={styles.timeColumn}>
                  <Text style={styles.timeSlotLabel}>Morning</Text>
                  <View style={styles.eventsContainer}>
                    {getEventsForDate(date)
                      .filter(event => getTimeSlot(event.time) === 'morning')
                      .map((event) => (
                        <TouchableOpacity 
                          key={event.id} 
                          style={[
                            styles.eventLabel,
                            selectedEvent?.id === event.id && styles.eventLabelSelected
                          ]}
                          onPress={() => setSelectedEvent(event)}
                        >
                          <Text style={styles.eventText}>{event.event}</Text>
                          <Text style={styles.eventTime}>{event.time}</Text>
                        </TouchableOpacity>
                      ))}
                  </View>
                </View>
                
                {/* Divider */}
                <View style={styles.columnDivider} />
                
                {/* Afternoon Column */}
                <View style={styles.timeColumn}>
                  <Text style={styles.timeSlotLabel}>Afternoon</Text>
                  <View style={styles.eventsContainer}>
                    {getEventsForDate(date)
                      .filter(event => getTimeSlot(event.time) === 'afternoon')
                      .map((event) => (
                        <TouchableOpacity 
                          key={event.id} 
                          style={[
                            styles.eventLabel,
                            selectedEvent?.id === event.id && styles.eventLabelSelected
                          ]}
                          onPress={() => setSelectedEvent(event)}
                        >
                          <Text style={styles.eventText}>{event.event}</Text>
                          <Text style={styles.eventTime}>{event.time}</Text>
                        </TouchableOpacity>
                      ))}
                  </View>
                </View>
                
                {/* Divider */}
                <View style={styles.columnDivider} />
                
                {/* Night Column */}
                <View style={styles.timeColumn}>
                  <Text style={styles.timeSlotLabel}>Night</Text>
                  <View style={styles.eventsContainer}>
                    {getEventsForDate(date)
                      .filter(event => getTimeSlot(event.time) === 'night')
                      .map((event) => (
                        <TouchableOpacity 
                          key={event.id} 
                          style={[
                            styles.eventLabel,
                            selectedEvent?.id === event.id && styles.eventLabelSelected
                          ]}
                          onPress={() => setSelectedEvent(event)}
                        >
                          <Text style={styles.eventText}>{event.event}</Text>
                          <Text style={styles.eventTime}>{event.time}</Text>
                        </TouchableOpacity>
                      ))}
                  </View>
                </View>
              </View>
            </View>
          ))}
              </ScrollView>
            </Animated.View>
          </PanGestureHandler>
        )}

      {/* Week View Event Action Subview */}
      {viewMode === 'week' && selectedEvent && (
        <View style={styles.eventActionOverlay}>
          <TouchableOpacity 
            style={styles.eventActionBackdrop}
            onPress={() => {
              setSelectedEvent(null);
              setIsEditMode(false);
              setEditedEventName('');
              setEditedEventTime('');
              setShowTimePicker(false);
            }}
            activeOpacity={1}
          />
          {isEditMode ? (
            <View style={styles.eventActionView}>
              <Text style={styles.editModeTitle}>Edit Event</Text>
              <View style={styles.editInputContainer}>
                <Text style={styles.editLabel}>Event Name</Text>
                <TextInput
                  style={styles.editInput}
                  value={editedEventName}
                  onChangeText={setEditedEventName}
                  placeholder="Enter event name"
                  placeholderTextColor="#999"
                />
              </View>
              <View style={styles.editInputContainer}>
                <Text style={styles.editLabel}>Time</Text>
                <TouchableOpacity 
                  style={styles.timePickerButton}
                  onPress={() => setShowTimePicker(true)}
                >
                  <Text style={editedEventTime ? styles.timePickerButtonText : styles.timePickerButtonTextPlaceholder}>
                    {editedEventTime || 'Select time'}
                  </Text>
                </TouchableOpacity>
                {showTimePicker && (
                  <DateTimePicker
                    value={selectedTime}
                    mode="time"
                    is24Hour={false}
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event, date) => {
                      setShowTimePicker(Platform.OS === 'ios');
                      if (date) {
                        setSelectedTime(date);
                        const hours = date.getHours();
                        const minutes = date.getMinutes();
                        const formattedTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
                        setEditedEventTime(formattedTime);
                      }
                    }}
                  />
                )}
              </View>
              <View style={styles.editButtons}>
                <TouchableOpacity 
                  style={[styles.eventActionButton, styles.saveButton]}
                  onPress={saveEditedEvent}
                >
                  <Text style={styles.eventActionButtonText}>Save</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.eventActionButton, styles.cancelEditButton]}
                  onPress={() => {
                    setIsEditMode(false);
                    setEditedEventName('');
                    setEditedEventTime('');
                    setShowTimePicker(false);
                  }}
                >
                  <Text style={styles.eventActionButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.eventActionView}>
              <Text style={styles.eventActionTitle}>{selectedEvent.event}</Text>
              <Text style={styles.eventActionTime}>{selectedEvent.time}</Text>
              <View style={styles.eventActionButtons}>
                <TouchableOpacity 
                  style={[styles.eventActionButton, styles.editButton]}
                  onPress={() => handleWeekViewEdit(selectedEvent)}
                >
                  <Text style={styles.eventActionButtonText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.eventActionButton, styles.deleteButtonWeek]}
                  onPress={() => handleWeekViewDelete(selectedEvent)}
                >
                  <Text style={styles.eventActionButtonText}>Delete</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity 
                style={styles.eventActionCancel}
                onPress={() => {
                  setSelectedEvent(null);
                  setIsEditMode(false);
                  setEditedEventName('');
                  setEditedEventTime('');
                  setShowTimePicker(false);
                }}
              >
                <Text style={styles.eventActionCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* Add Event Bottom Sheet */}
      {showAddBottomSheet && (
        <View style={styles.bottomSheetOverlay}>
          <TouchableOpacity 
            style={styles.bottomSheetBackdrop}
            onPress={() => setShowAddBottomSheet(false)}
            activeOpacity={1}
          />
          <Animated.View
            style={[
              styles.bottomSheetContainer,
              {
                transform: [
                  {
                    translateY: bottomSheetSlideAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [600, 0], // Slide from 600px below to 0
                    }),
                  },
                ],
              },
            ]}
          >
            <KeyboardAvoidingView 
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={{ flex: 1 }}
            >
              <ScrollView 
                ref={bottomSheetScrollRef}
                style={styles.bottomSheetMessages}
                contentContainerStyle={styles.bottomSheetMessagesContent}
              >
                {messages.length === 0 && (
                  <Text style={styles.bottomSheetSubtitle}>Tell me about your event</Text>
                )}
                {messages.map(m => (
                  <View 
                    key={m.id} 
                    style={[
                      styles.bottomSheetMessageRow,
                      m.role === 'user' ? styles.bottomSheetUserMessageRow : styles.bottomSheetAssistantMessageRow
                    ]}
                  >
                    <View 
                      style={[
                        styles.bottomSheetMessageBubble,
                        m.role === 'user' ? styles.bottomSheetUserBubble : styles.bottomSheetAssistantBubble
                      ]}
                    >
                      {m.parts.map((part, i) => {
                        switch (part.type) {
                          case 'text':
                            return (
                              <Text 
                                key={`${m.id}-${i}`} 
                                style={[
                                  styles.bottomSheetMessageText,
                                  m.role === 'user' ? styles.bottomSheetUserMessageText : styles.bottomSheetAssistantMessageText
                                ]}
                              >
                                {m.role === 'user' ? (() => {
                                  const originalMessage = userMessageMap[part.text];
                                  return originalMessage || part.text;
                                })() : (() => {
                                  // Check if this specific message had an event added
                                  if (m.role === 'assistant' && eventAddedMessages.has(m.id)) {
                                    const eventDetails = eventDetailsMap[m.id];
                                    if (eventDetails) {
                                      const formattedDate = formatDateString(eventDetails.date);
                                      return `Event added!\n\nEvent: ${eventDetails.event}\nTime: ${formattedDate} ${eventDetails.time}`;
                                    }
                                    return "Event added!";
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
            </KeyboardAvoidingView>
            <View style={styles.bottomSheetInputContainer}>
              <TextInput
                style={styles.bottomSheetInput}
                placeholder="e.g., Meeting with John at 3pm tomorrow"
                placeholderTextColor="#999"
                value={chatInput}
                onChangeText={setChatInput}
                multiline
                onSubmitEditing={handleChatSend}
              />
              <TouchableOpacity 
                style={styles.bottomSheetSendButton}
                onPress={handleChatSend}
              >
                <Ionicons name="send" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      )}
      </Animated.View>
    </View>
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
  weekNavigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    backgroundColor: '#E4E3DA',
  },
  dayNavigation: {
    justifyContent: 'center',
  },
  viewModeNav: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#E4E3DA',
    gap: 8,
  },
  viewModeButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#E4E3DA',
    borderColor: '#000000',
    borderWidth: 1,
  },
  viewModeButtonActive: {
    backgroundColor: '#9DC8B9',
  },
  viewModeText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '600',
  },
  viewModeTextActive: {
    color: '#000000',
    fontWeight: '700',
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E4E3DA',
    justifyContent: 'center',
    alignItems: 'center',
    borderColor: '#000000',
    borderWidth: 1,
  },
  todayButton: {
    backgroundColor: '#9DC8B9',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderColor: '#000000',
    borderWidth: 1,
  },
  floatingTodayButton: {
    position: 'absolute',
    bottom: 32, // Adjusted to align with Add button center (Add button is 64px tall, center is at 32px from bottom)
    left: '50%',
    marginLeft: 48, // Position to the right of Add button (Add button width 64 + gap)
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderColor: '#000000',
    borderWidth: 1,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  floatingTodayButtonWeek: {
    position: 'absolute',
    bottom: 32, // Adjusted to align with Add button center
    left: '50%',
    marginLeft: 48, // Position to the right of Add button
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderColor: '#000000',
    borderWidth: 1,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  floatingTodayButtonDay: {
    position: 'absolute',
    bottom: 32, // Adjusted to align with Add button center
    left: '50%',
    marginLeft: 48, // Position to the right of Add button
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderColor: '#000000',
    borderWidth: 1,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  floatingAddButton: {
    position: 'absolute',
    bottom: 20, // Bottom of screen
    left: '50%',
    marginLeft: -32, // Half of button width to center it
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#9DC8B9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000000',
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  todayButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '600',
  },
  calendarContainer: {
    flex: 1,
    paddingBottom: 94, // 10px padding above the Add button (button at bottom: 20, height: 64, so 20+64+10=94)
  },
  dayViewContainer: {
    flex: 1,
    backgroundColor: '#E4E3DA',
    paddingTop: 20,
    paddingLeft: 20,
    paddingBottom: 120, // Add padding to prevent overlap with floating buttons
  },
  dayViewTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000000',
    textAlign: 'left',
  },
  dayEventsContainer: {
    flex: 1,
    marginTop: 20,
    paddingHorizontal: 20,
  },
  eventItemContainer: {
    position: 'relative',
    marginBottom: 12,
    overflow: 'hidden',
  },
  deleteButtonContainer: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 80,
    zIndex: 1,
  },
  deleteButton: {
    flex: 1,
    backgroundColor: '#FF6B6B',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    marginLeft: 8,
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  dayEventItem: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#000000',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 2,
  },
  dayEventTime: {
    width: 80,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    position: 'relative',
  },
  nearestEventCircle: {
    position: 'absolute',
    width: 80,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#9DC8B9',
    zIndex: 0,
    top: '50%',
    left: '50%',
    marginTop: -15,
    marginLeft: -40,
  },
  dayEventTimeText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
    textAlign: 'center',
    zIndex: 1,
    position: 'relative',
  },
  dayEventContent: {
    flex: 1,
    justifyContent: 'center',
  },
  dayEventTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  dayEventPriority: {
    fontSize: 14,
    color: '#666666',
  },
  noEventsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  noEventsText: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
  },
  timeDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
    paddingHorizontal: 20,
  },
  timeDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#CCCCCC',
  },
  timeDividerLabel: {
    fontSize: 12,
    color: '#666666',
    marginHorizontal: 12,
    fontWeight: '500',
  },
  monthViewContainer: {
    flex: 1,
    backgroundColor: '#E4E3DA',
    paddingTop: 20,
    paddingHorizontal: 20, // Consistent horizontal padding like other views
    paddingBottom: 20, // Reduced since events section has marginBottom
  },
  monthViewTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000000',
    textAlign: 'left',
    marginBottom: 12,
  },
  calendarGrid: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#000000',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 12,
    minHeight: 220, // Further reduced to provide space for events section
  },
  dayHeaders: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  dayHeaderText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    paddingVertical: 8,
  },
  calendarDates: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  calendarDate: {
    width: '14.28%', // 100% / 7 days
    height: 45, // Fixed height for better visibility
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginBottom: 0, // No spacing between rows for tighter layout
  },
  calendarDateOtherMonth: {
    opacity: 0.3,
  },
  calendarDateToday: {
    backgroundColor: '#9DC8B9',
    borderRadius: 20,
  },
  calendarDateSelected: {
    backgroundColor: '#FFD93D',
    borderRadius: 20,
  },
  calendarDateTodaySelected: {
    backgroundColor: 'transparent', // We'll use custom styling for half circles
    borderRadius: 20,
    overflow: 'hidden',
  },
  calendarDateText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
  },
  calendarDateTextOtherMonth: {
    color: '#999999',
  },
  calendarDateTextToday: {
    color: '#000000',
    fontWeight: '700',
  },
  calendarDateTextSelected: {
    color: '#000000',
    fontWeight: '700',
  },
  eventDot: {
    position: 'absolute',
    bottom: 4,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF6B6B',
  },
  halfCircleLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: '50%',
    height: '100%',
    backgroundColor: '#9DC8B9', // Green color
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
  },
  halfCircleRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: '50%',
    height: '100%',
    backgroundColor: '#FFD93D', // Yellow color
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
  },
  monthEventsSection: {
    height: 230, // Further reduced height to ensure no overlap with add button
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#000000',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 94, // 10px padding above Add button (button at bottom: 20, height: 64, so 20+64+10=94)
  },
  monthEventsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 12,
  },
  monthEventsContainer: {
    height: 155, // Fixed height for the ScrollView (adjusted to fit within section)
  },
  monthEventItem: {
    flexDirection: 'row',
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  monthEventTime: {
    width: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  monthEventTimeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  monthEventContent: {
    flex: 1,
    justifyContent: 'center',
  },
  monthEventTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 2,
  },
  monthEventPriority: {
    fontSize: 12,
    color: '#666666',
  },
  monthNoEventsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  monthNoEventsText: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
  },
  dayRow: {
    marginBottom: 8,
    marginHorizontal: 16,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#000000',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  calendarRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: 120,
  },
  dateColumn: {
    width: 60, // Wider width
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
    position: 'relative',
  },
  todayCircle: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#9DC8B9',
    zIndex: -1,
  },
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  dayName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  monthText: {
    fontSize: 12,
    color: '#000000',
  },
  dayDate: {
    fontSize: 14,
    color: '#000000',
  },
  todayText: {
    color: '#007AFF',
    fontWeight: '700',
  },
  whiteText: {
    color: '#000000',
  },
  timeColumn: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingVertical: 4,
  },
  columnDivider: {
    width: 1,
    backgroundColor: '#000000',
    marginHorizontal: 4,
  },
  timeSlotLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
    textAlign: 'center',
  },
  eventsContainer: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    gap: 4,
  },
  eventLabel: {
    width: '90%',
    padding: 4,
    borderRadius: 6,
    marginVertical: 2,
    backgroundColor: '#F8F8F8',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  eventText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  eventTime: {
    fontSize: 8,
    color: '#666',
    textAlign: 'center',
  },
  eventLabelSelected: {
    backgroundColor: '#E8F5E9',
    borderColor: '#9DC8B9',
    borderWidth: 2,
  },
  eventActionOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  eventActionBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  eventActionView: {
    position: 'absolute',
    bottom:20, // Position right on top of navbar (navbar is at bottom: 20 with height: 60)
    left: 20, // Match navbar left margin
    right: 20, // Match navbar right margin
    backgroundColor: '#FFFFFF', // White rectangle card
    borderRadius: 20, // Rounded corners
    padding: 20,
    borderWidth: 1,
    borderColor: '#000000',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 10,
  },
  eventActionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 4,
    textAlign: 'center',
  },
  eventActionTime: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 20,
    textAlign: 'center',
  },
  eventActionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  eventActionButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#000000',
  },
  editButton: {
    backgroundColor: '#9DC8B9',
  },
  deleteButtonWeek: {
    backgroundColor: '#FF6B6B',
  },
  eventActionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  eventActionCancel: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  eventActionCancelText: {
    fontSize: 16,
    color: '#666666',
    fontWeight: '500',
  },
  editModeText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000000',
    textAlign: 'center',
    paddingVertical: 40,
  },
  editModeTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 20,
    textAlign: 'center',
  },
  editInputContainer: {
    marginBottom: 16,
  },
  editLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  editInput: {
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    fontSize: 16,
    color: '#000000',
  },
  timePickerButton: {
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    justifyContent: 'center',
  },
  timePickerButtonText: {
    fontSize: 16,
    color: '#000000',
  },
  timePickerButtonTextPlaceholder: {
    fontSize: 16,
    color: '#999',
  },
  editButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 8,
  },
  saveButton: {
    backgroundColor: '#9DC8B9',
  },
  cancelEditButton: {
    backgroundColor: '#E4E3DA',
  },
  bottomSheetOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2000,
  },
  bottomSheetBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  bottomSheetContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    maxHeight: '80%',
    flexDirection: 'column',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
  },
  bottomSheetContent: {
    flex: 1,
    padding: 20,
    paddingBottom: 0,
    minHeight: 0, // Allow shrinking
  },
  bottomSheetSubtitle: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 16,
    textAlign: 'center',
  },
  bottomSheetMessages: {
    flex: 1,
    minHeight: 0, // Prevent ScrollView from expanding
    paddingHorizontal: 20,
  },
  bottomSheetMessagesContent: {
    paddingBottom: 10,
    paddingTop: 20,
  },
  bottomSheetMessageRow: {
    marginBottom: 12,
    flexDirection: 'row',
  },
  bottomSheetUserMessageRow: {
    justifyContent: 'flex-end',
  },
  bottomSheetAssistantMessageRow: {
    justifyContent: 'flex-start',
  },
  bottomSheetMessageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 18,
  },
  bottomSheetUserBubble: {
    backgroundColor: '#9DC8B9',
  },
  bottomSheetAssistantBubble: {
    backgroundColor: '#F8F8F8',
  },
  bottomSheetMessageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  bottomSheetUserMessageText: {
    color: '#000000',
  },
  bottomSheetAssistantMessageText: {
    color: '#000000',
  },
  bottomSheetInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },
  bottomSheetInput: {
    flex: 1,
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    padding: 12,
    minHeight: 44,
    maxHeight: 100,
    fontSize: 16,
    color: '#000000',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  bottomSheetSendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#9DC8B9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000000',
  },
});

const calendarButton = StyleSheet.create({
    navButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#E4E3DA',
        justifyContent: 'center',
        alignItems: 'center',
        borderColor: '#000000',
        borderWidth: 1
    },
})
