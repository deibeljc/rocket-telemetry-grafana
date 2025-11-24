package plugin

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// Make sure Datasource implements required interfaces. This is important to do
// since otherwise we will only get a not implemented error response from plugin in
// runtime. In this example datasource instance implements backend.QueryDataHandler,
// backend.CheckHealthHandler interfaces. Plugin should not implement all these
// interfaces - only those which are required for a particular task.
var (
	_ backend.CheckHealthHandler    = (*Datasource)(nil)
	_ instancemgmt.InstanceDisposer = (*Datasource)(nil)
	_ backend.StreamHandler         = (*Datasource)(nil)
)

// NewDatasource creates a new datasource instance.
func NewDatasource(_ context.Context, _ backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
	return &Datasource{}, nil
}

// Datasource is an example datasource which can respond to data queries, reports
// its health and has streaming skills.
type Datasource struct{}

// PublishStream implements backend.StreamHandler.
func (d *Datasource) PublishStream(ctx context.Context, req *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	return &backend.PublishStreamResponse{
		Status: backend.PublishStreamStatusPermissionDenied,
	}, nil
}

func (d *Datasource) RunStream(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender) error {
	q := Query{}
	json.Unmarshal(req.Data, &q)

	log.DefaultLogger.Info("Starting stream", "fields", q.Fields)

	sim := NewRocketSimulation()

	ticker := time.NewTicker(time.Duration(500) * time.Millisecond)
	defer ticker.Stop()

	// Helper to check if a field is requested
	shouldInclude := func(field string) bool {
		if len(q.Fields) == 0 {
			return true // Default to all if none specified
		}
		for _, f := range q.Fields {
			if f == field {
				return true
			}
		}
		return false
	}

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
			packet := sim.Tick()

			frame := data.NewFrame("response")

			// Always include time
			frame.Fields = append(frame.Fields, data.NewField("time", nil, []time.Time{time.UnixMilli(int64(packet.Timestamp))}))

			if shouldInclude("altitude") {
				frame.Fields = append(frame.Fields, data.NewField("altitude", nil, []float64{packet.Altitude}))
			}
			if shouldInclude("latitude") {
				frame.Fields = append(frame.Fields, data.NewField("latitude", nil, []float64{packet.GPS.Latitude}))
			}
			if shouldInclude("longitude") {
				frame.Fields = append(frame.Fields, data.NewField("longitude", nil, []float64{packet.GPS.Longitude}))
			}
			if shouldInclude("state") {
				frame.Fields = append(frame.Fields, data.NewField("state", nil, []int64{int64(packet.State)}))
			}
			if shouldInclude("pitch") {
				frame.Fields = append(frame.Fields, data.NewField("pitch", nil, []float64{packet.Pitch}))
			}
			if shouldInclude("roll") {
				frame.Fields = append(frame.Fields, data.NewField("roll", nil, []float64{packet.Roll}))
			}
			if shouldInclude("yaw") {
				frame.Fields = append(frame.Fields, data.NewField("yaw", nil, []float64{packet.Yaw}))
			}
			if shouldInclude("gforce") {
				frame.Fields = append(frame.Fields, data.NewField("gforce", nil, []float64{packet.GForce}))
			}
			if shouldInclude("signal") {
				frame.Fields = append(frame.Fields, data.NewField("signal", nil, []int64{int64(packet.Signal)}))
			}

			err := sender.SendFrame(frame, data.IncludeAll)

			if err != nil {
				log.DefaultLogger.Error("Failed send frame", "error", err)
			}
		}
	}
}

// SubscribeStream implements backend.StreamHandler.
func (d *Datasource) SubscribeStream(ctx context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	return &backend.SubscribeStreamResponse{
		Status: backend.SubscribeStreamStatusOK,
	}, nil
}

// Dispose here tells plugin SDK that plugin wants to clean up resources when a new instance
// created. As soon as datasource settings change detected by SDK old datasource instance will
// be disposed and a new one will be created using NewSampleDatasource factory function.
func (d *Datasource) Dispose() {
	// Clean up datasource instance resources.
}

// QueryData handles multiple queries and returns multiple responses.
// req contains the queries []DataQuery (where each query contains RefID as a unique identifier).
// The QueryDataResponse contains a map of RefID to the response for each query, and each response
// contains Frames ([]*Frame).
func (d *Datasource) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	// create response struct
	response := backend.NewQueryDataResponse()

	// loop over queries and execute them individually.
	for _, q := range req.Queries {
		res := d.query(ctx, req.PluginContext, q)

		// save the response in a hashmap
		// based on with RefID as identifier
		response.Responses[q.RefID] = res
	}

	return response, nil
}

type queryModel struct{}

func (d *Datasource) query(_ context.Context, pCtx backend.PluginContext, query backend.DataQuery) backend.DataResponse {
	var response backend.DataResponse

	// Unmarshal the JSON into our queryModel.
	var qm queryModel

	err := json.Unmarshal(query.JSON, &qm)
	if err != nil {
		return backend.ErrDataResponse(backend.StatusBadRequest, fmt.Sprintf("json unmarshal: %v", err.Error()))
	}

	// create data frame response.
	// For an overview on data frames and how grafana handles them:
	// https://grafana.com/developers/plugin-tools/introduction/data-frames
	frame := data.NewFrame("response")

	// add fields.
	frame.Fields = append(frame.Fields,
		data.NewField("time", nil, []time.Time{query.TimeRange.From, query.TimeRange.To}),
		data.NewField("values", nil, []int64{10, 20}),
	)

	// add the frames to the response.
	response.Frames = append(response.Frames, frame)

	return response
}

// CheckHealth handles health checks sent from Grafana to the plugin.
// The main use case for these health checks is the test button on the
// datasource configuration page which allows users to verify that
// a datasource is working as expected.
func (d *Datasource) CheckHealth(_ context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	return &backend.CheckHealthResult{
		Status:  backend.HealthStatusOk,
		Message: "Data source is working",
	}, nil
}
