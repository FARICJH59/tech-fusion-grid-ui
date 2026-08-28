# HOARE Robotics Integration Demonstrator

Phase-one robotics integration layer for HOARE.

## Scope

This demonstrator starts with a simulated UGV.

It does not connect to physical robotics hardware and does not issue real vehicle commands.

## Architecture

Intent
-> Policy
-> Simulation
-> Telemetry
-> Evidence Receipt

The robotics layer is intentionally thin so it can reuse existing HOARE,
PASOR, enterprise policy, execution, and evidence infrastructure.

## Initial Mission

Simulate an autonomous resupply mission from an origin coordinate to a
destination coordinate while carrying a payload.

## Safety Boundary

simulationOnly = true
mutationExecuted = false
