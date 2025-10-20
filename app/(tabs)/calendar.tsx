import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
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

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  // Calendar cell colors - all using the same background color
  const dayColors = [
    '#E4E3DA', // Same as main background
    '#E4E3DA', // Same as main background
    '#E4E3DA', // Same as main background
    '#E4E3DA', // Same as main background
    '#E4E3DA', // Same as main background
    '#E4E3DA', // Same as main background
    '#E4E3DA', // Same as main background
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

  const goToCurrentDate = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - dayOfWeek);
    setCurrentWeekStart(startOfWeek);
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newWeekStart = new Date(currentWeekStart);
    newWeekStart.setDate(currentWeekStart.getDate() + (direction === 'next' ? 7 : -7));
    setCurrentWeekStart(newWeekStart);
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

  // Get events for a specific date
  const getEventsForDate = (date: Date) => {
    const dateString = date.toISOString().split('T')[0];
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

  return (
    <View style={styles.container}>
      <View style={styles.weekNavigation}>
        <TouchableOpacity 
          style={styles.navButton} 
          onPress={() => navigateWeek('prev')}
        >
          <Ionicons name="chevron-back" size={24} color="#000000" />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.todayButton} 
          onPress={goToCurrentDate}
        >
          <Text style={styles.todayButtonText}>Today</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.navButton} 
          onPress={() => navigateWeek('next')}
        >
          <Ionicons name="chevron-forward" size={24} color="#000000" />
        </TouchableOpacity>
      </View>

      {/* View Mode Navigation */}
      <View style={styles.viewModeNav}>
        <TouchableOpacity 
          style={[styles.viewModeButton, viewMode === 'month' && styles.viewModeButtonActive]}
          onPress={() => setViewMode('month')}
        >
          <Text style={[styles.viewModeText, viewMode === 'month' && styles.viewModeTextActive]}>
            Month
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.viewModeButton, viewMode === 'week' && styles.viewModeButtonActive]}
          onPress={() => setViewMode('week')}
        >
          <Text style={[styles.viewModeText, viewMode === 'week' && styles.viewModeTextActive]}>
            Week
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.viewModeButton, viewMode === 'day' && styles.viewModeButtonActive]}
          onPress={() => setViewMode('day')}
        >
          <Text style={[styles.viewModeText, viewMode === 'day' && styles.viewModeTextActive]}>
            Day
          </Text>
        </TouchableOpacity>
      </View>

      {viewMode === 'day' ? (
        <View style={styles.dayViewContainer}>
          <Text style={styles.dayViewTitle}>
            {formatDate(new Date()).dayName} {formatDate(new Date()).day} {formatDate(new Date()).month}
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.calendarContainer}>
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
                      <View key={event.id} style={[styles.eventLabel, { backgroundColor: getLighterColor(dayColors[index]) }]}>
                        <Text style={styles.eventText}>{event.event}</Text>
                        <Text style={styles.eventTime}>{event.time}</Text>
                      </View>
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
                      <View key={event.id} style={[styles.eventLabel, { backgroundColor: getLighterColor(dayColors[index]) }]}>
                        <Text style={styles.eventText}>{event.event}</Text>
                        <Text style={styles.eventTime}>{event.time}</Text>
                      </View>
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
                      <View key={event.id} style={[styles.eventLabel, { backgroundColor: getLighterColor(dayColors[index]) }]}>
                        <Text style={styles.eventText}>{event.event}</Text>
                        <Text style={styles.eventTime}>{event.time}</Text>
                      </View>
                    ))}
                </View>
              </View>
            </View>
          </View>
        ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E4E3DA',
    paddingBottom: 80, // Account for floating tab bar (60px height + 20px margin)
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
  todayButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '600',
  },
  calendarContainer: {
    flex: 1,
  },
  dayViewContainer: {
    flex: 1,
    backgroundColor: '#E4E3DA',
    paddingTop: 20,
    paddingLeft: 20,
  },
  dayViewTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000000',
    textAlign: 'left',
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
