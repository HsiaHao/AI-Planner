import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
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
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const daySlideAnim = useRef(new Animated.Value(0)).current;
  const monthSlideAnim = useRef(new Animated.Value(0)).current;

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
      {viewMode === 'month' && (
        <TouchableOpacity 
          style={[
            styles.floatingTodayButton,
            { backgroundColor: isTodayVisibleInMonth() ? '#9DC8B9' : 'transparent' }
          ]} 
          onPress={goToCurrentDate}
        >
          <Text style={styles.todayButtonText}>Today</Text>
        </TouchableOpacity>
      )}

      {/* Floating Today button for week view */}
      {viewMode === 'week' && (
        <TouchableOpacity 
          style={[
            styles.floatingTodayButtonWeek,
            { backgroundColor: isCurrentWeek() ? '#9DC8B9' : 'transparent' }
          ]} 
          onPress={goToCurrentDate}
        >
          <Text style={styles.todayButtonText}>Today</Text>
        </TouchableOpacity>
      )}

      {/* Floating Today button for day view */}
      {viewMode === 'day' && (
        <TouchableOpacity 
          style={[
            styles.floatingTodayButtonDay,
            { backgroundColor: isCurrentDay() ? '#9DC8B9' : 'transparent' }
          ]} 
          onPress={goToCurrentDate}
        >
          <Text style={styles.todayButtonText}>Today</Text>
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
                    .map((event) => {
                      const nearestEventTime = getNearestEventTime(currentDay);
                      const isNearestEvent = nearestEventTime === event.time;
                      
                      return (
                      <View key={event.id} style={styles.dayEventItem}>
                        <View style={styles.dayEventTime}>
                          {isNearestEvent && <View style={styles.nearestEventCircle} />}
                          <Text style={styles.dayEventTimeText}>{event.time}</Text>
                        </View>
                      <View style={styles.dayEventContent}>
                        <Text style={styles.dayEventTitle}>{event.event}</Text>
                        <Text style={styles.dayEventPriority}>Priority: {event.priority}</Text>
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
            </Animated.View>
          </PanGestureHandler>
        )}
      </Animated.View>
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
    bottom: 100, // Further above nav bar to avoid overlap
    right: 20, // Consistent with other views
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
    bottom: 100, // Further above nav bar
    right: 20, // Consistent padding
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
    bottom: 100, // Further above nav bar
    right: 20, // Consistent padding
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
  dayEventsContainer: {
    flex: 1,
    marginTop: 20,
    paddingHorizontal: 20,
  },
  dayEventItem: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#000000',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
  monthViewContainer: {
    flex: 1,
    backgroundColor: '#E4E3DA',
    paddingTop: 20,
    paddingHorizontal: 20, // Consistent horizontal padding like other views
    paddingBottom: 20, // Ensure no overlap with navigation bar
  },
  monthViewTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000000',
    textAlign: 'left',
    marginBottom: 20,
  },
  calendarGrid: {
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
    marginBottom: 16,
    minHeight: 350, // Ensure enough space for all dates
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
    height: 180, // Reduced height to ensure no overlap with nav bar
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
  },
  monthEventsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 12,
  },
  monthEventsContainer: {
    flex: 1,
    maxHeight: 130, // Adjusted to match reduced section height
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
