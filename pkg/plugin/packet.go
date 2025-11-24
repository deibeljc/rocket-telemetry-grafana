package plugin

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"
)

type RocketState int

const (
	LANDED      RocketState = 0
	LAUNCHING   RocketState = 1
	APEX        RocketState = 2
	DESCENDING  RocketState = 3
	CALIBRATION RocketState = 4
)

type GPS struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
}

type TelemetryPacket struct {
	Signal         int         `json:"signal"`
	Timestamp      float64     `json:"timestamp"`
	Pitch          float64     `json:"pitch"`
	Roll           float64     `json:"roll"`
	Yaw            float64     `json:"yaw"`
	GForce         float64     `json:"gforce"`
	Altitude       float64     `json:"altitude"`
	GPS            GPS         `json:"gps"`
	State          RocketState `json:"state"`
	LoopsPerSecond float64     `json:"loopsPerSecond"`
}

type RocketSimulation struct {
	startTime time.Time
	state     RocketState
	altitude  float64
	velocity  float64
	lat       float64
	lon       float64
}

func NewRocketSimulation() *RocketSimulation {
	return &RocketSimulation{
		startTime: time.Now(),
		state:     LANDED,
		altitude:  0,
		velocity:  0,
		lat:       37.7749, // Default start (SF)
		lon:       -122.4194,
	}
}

func (s *RocketSimulation) Tick() TelemetryPacket {
	dt := 0.5 // Time step in seconds (approximate if called every 500ms)
	now := time.Now()
	elapsed := now.Sub(s.startTime).Seconds()

	// Simple state machine for simulation
	switch s.state {
	case LANDED:
		if elapsed > 5 { // Launch after 5 seconds
			s.state = LAUNCHING
			s.velocity = 150
		}
	case LAUNCHING:
		s.altitude += s.velocity * dt
		s.velocity -= 9.8 * dt // Gravity
		if s.velocity <= 0 {
			s.state = APEX
		}
	case APEX:
		s.state = DESCENDING
	case DESCENDING:
		s.velocity -= 9.8 * dt
		if s.velocity < -10 { // Terminal velocity with parachute
			s.velocity = -10
		}
		s.altitude += s.velocity * dt
		if s.altitude <= 0 {
			s.altitude = 0
			s.velocity = 0
			s.state = LANDED
			s.startTime = now
			s.lat = 37.7749
			s.lon = -122.4194
		}
	}

	// Simulate GPS movement along a line during flight
	if s.state == LAUNCHING || s.state == APEX || s.state == DESCENDING {
		s.lat += 0.0001 * dt
		s.lon += 0.0001 * dt
	}

	return TelemetryPacket{
		Signal:    -50,
		Timestamp: float64(now.UnixMilli()),
		Pitch:     90, // Vertical
		Roll:      0,
		Yaw:       0,
		GForce:    1.0 + (s.velocity/9.8)/10.0, // Rough approx
		Altitude:  s.altitude,
		GPS: GPS{
			Latitude:  s.lat,
			Longitude: s.lon,
		},
		State:          s.state,
		LoopsPerSecond: 10,
	}
}

func ParsePacket(packetString string) (*TelemetryPacket, error) {
	// Check if the message has the "Received - RSSI: X, Message: " format
	message := packetString
	rssi := -50 // Default

	// Regex to match RSSI and Message
	// Matches "RSSI: -89, Message: 1234,..."
	re := regexp.MustCompile(`RSSI:\s*(-?\d+),\s*Message:\s*(.+)`)
	matches := re.FindStringSubmatch(packetString)
	if len(matches) == 3 {
		if val, err := strconv.Atoi(matches[1]); err == nil {
			rssi = val
		}
		message = strings.TrimSpace(matches[2])
	}

	parts := strings.Split(message, ",")
	for i := range parts {
		parts[i] = strings.TrimSpace(parts[i])
	}

	// Radio packet format: timestamp,pitch,roll,yaw,gforce,altitude,lat,lon,state,loops
	if len(parts) != 10 {
		return nil, fmt.Errorf("invalid packet length: expected 10 parts, got %d", len(parts))
	}

	// Helper to parse float
	parseFloat := func(s string) float64 {
		val, _ := strconv.ParseFloat(s, 64)
		return val
	}

	timestamp := parseFloat(parts[0])
	pitch := parseFloat(parts[1])
	roll := parseFloat(parts[2])
	yaw := parseFloat(parts[3])
	gforce := parseFloat(parts[4])
	altitude := parseFloat(parts[5])
	lat := parseFloat(parts[6])
	lon := parseFloat(parts[7])

	stateString := strings.ToUpper(parts[8])
	var state RocketState
	switch stateString {
	case "LANDED":
		state = LANDED
	case "LAUNCHING":
		state = LAUNCHING
	case "APEX":
		state = APEX
	case "DESCENDING":
		state = DESCENDING
	case "CALIBRATION":
		state = CALIBRATION
	default:
		state = LANDED
	}

	loops := parseFloat(parts[9])

	return &TelemetryPacket{
		Signal:    rssi,
		Timestamp: timestamp,
		Pitch:     pitch,
		Roll:      roll,
		Yaw:       yaw,
		GForce:    gforce,
		Altitude:  altitude,
		GPS: GPS{
			Latitude:  lat,
			Longitude: lon,
		},
		State:          state,
		LoopsPerSecond: loops,
	}, nil
}
